import { supabaseAdmin } from '../supabase.js';
import { TELEPHONY_ENABLED } from '../config/features.js';

const CACHE_TTL_MS = 15_000;

// Short-lived cache + in-flight de-duplication: simultaneous callers (dashboard + analytics,
// two tabs, StrictMode double-mount) share one set of database queries.
function createCached(loader) {
  let value = null;
  let expiry = 0;
  let inflight = null;
  return async function cached() {
    if (value && Date.now() < expiry) return value;
    if (inflight) return inflight;
    inflight = (async () => {
      try {
        const result = await loader();
        // Never cache a degraded/fallback payload.
        if (!result.__degraded) {
          value = result;
          expiry = Date.now() + CACHE_TTL_MS;
        }
        return result;
      } finally {
        inflight = null;
      }
    })();
    return inflight;
  };
}

const KNOWN_STATUSES = [
  'NEW', 'CONTACTED', 'ENGAGED', 'TECHNICAL_EVALUATION', 'COMMERCIAL_DISCUSSION', 'TRIAL_ORDER',
  'APPROVED_SUPPLIER', 'RECURRING_CUSTOMER', 'ON_HOLD', 'LOST', 'DO_NOT_CONTACT',
  // Legacy vocabulary still present on older rows
  'INTERESTED', 'QUALIFIED', 'CUSTOMER', 'FOLLOW_UP', 'NO_RESPONSE', 'NOT_INTERESTED',
];

/**
 * Lead counts per status. Uses the lead_status_counts() SQL function (one grouped query) and falls back
 * to one cheap HEAD count per known status if the migration has not been applied yet.
 * (The previous implementation downloaded every lead's status, which PostgREST silently caps at 1000 rows.)
 */
async function getStatusCounts() {
  try {
    const { data, error } = await supabaseAdmin.rpc('lead_status_counts');
    if (!error && Array.isArray(data)) {
      const out = {};
      data.forEach((row) => {
        out[String(row.status).toUpperCase()] = Number(row.total) || 0;
      });
      return out;
    }
  } catch {
    // fall through to the count-based path
  }

  const results = await Promise.all(
    KNOWN_STATUSES.map((s) =>
      supabaseAdmin.from('leads').select('id', { count: 'exact', head: true }).eq('status', s)
    )
  );
  const out = {};
  results.forEach((r, i) => {
    out[KNOWN_STATUSES[i]] = r.count || 0;
  });
  return out;
}

const sumStatuses = (counts, keys) => keys.reduce((total, k) => total + (counts[k] || 0), 0);
const pct = (num, den) => (den > 0 ? ((num / den) * 100).toFixed(1) + '%' : '0.0%');

const headCount = (table, build) => {
  let q = supabaseAdmin.from(table).select('id', { count: 'exact', head: true });
  if (build) q = build(q);
  return q;
};

const EMPTY_DASHBOARD = {
  today: {
    emailsSent: 0,
    emailsDelivered: 0,
    repliesReceived: 0,
    replyRate: '0.0%',
    interestedLeads: 0,
    totalLeads: 0,
  },
  activeCampaigns: [],
  priorityLeads: [],
  recentActivities: [],
};

async function loadDashboard() {
  try {
    const [
      { count: totalEmailsSent },
      { count: totalEmailsDelivered },
      { count: totalRepliesReceived },
      statusCounts,
      { data: activeCampaignsData },
      { data: priorityLeadsData },
      { data: rawActivityLogs },
    ] = await Promise.all([
      headCount('email_messages', (q) => q.eq('direction', 'outbound')),
      headCount('email_messages', (q) =>
        q.eq('direction', 'outbound').in('status', ['sent', 'delivered', 'opened', 'clicked'])
      ),
      headCount('email_messages', (q) => q.eq('direction', 'inbound')),
      getStatusCounts(),
      supabaseAdmin
        .from('email_campaigns')
        .select('id, name, subject, status, stats')
        .in('status', ['running', 'RUNNING', 'queued', 'QUEUED', 'paused', 'PAUSED'])
        .order('created_at', { ascending: false })
        .limit(5),
      supabaseAdmin
        .from('leads')
        .select('id, first_name, last_name, full_name, email, company, job_title, score, status')
        .order('score', { ascending: false, nullsFirst: false })
        .limit(10),
      supabaseAdmin
        .from('activity_logs')
        .select('id, type, description, metadata, created_at, lead_id')
        .order('created_at', { ascending: false })
        .limit(15),
    ]);

    const sentCount = totalEmailsSent || 0;
    const replyCount = totalRepliesReceived || 0;

    let recentActivities = (rawActivityLogs || [])
      // Legacy voice/SMS log rows are kept in the database but hidden from the active feed.
      .filter((log) => TELEPHONY_ENABLED || !/call|sms|voice|twilio/i.test(String(log.type || '')))
      .map((log) => ({
        id: log.id,
        title: log.type || 'Activity',
        description: log.description,
        timestamp: log.created_at,
        metadata: log.metadata,
      }));

    // If the activity log is empty, build the feed from recent email messages.
    if (recentActivities.length === 0) {
      const { data: recentMsgs } = await supabaseAdmin
        .from('email_messages')
        .select('id, direction, recipient, subject, created_at')
        .order('created_at', { ascending: false })
        .limit(12);

      recentActivities = (recentMsgs || []).map((m) => ({
        id: m.id,
        title: m.direction === 'outbound' ? 'Outbound Email' : 'Prospect Reply',
        description:
          m.direction === 'outbound'
            ? `Dispatched email to ${m.recipient}: "${m.subject || 'Outbound inquiry'}"`
            : `Received reply from ${m.recipient}: "${m.subject || 'Re: Partnership'}"`,
        timestamp: m.created_at,
      }));
    }

    const priorityLeads = (priorityLeadsData || []).map((l) => ({
      id: l.id,
      _id: l.id,
      firstName: l.first_name || (l.full_name ? l.full_name.split(' ')[0] : 'Prospect'),
      lastName: l.last_name || '',
      fullName: l.full_name || `${l.first_name || ''} ${l.last_name || ''}`.trim(),
      email: l.email,
      company: l.company,
      jobTitle: l.job_title,
      score: Number(l.score) || 0,
      status: l.status,
    }));

    const today = {
      emailsSent: sentCount,
      emailsDelivered: totalEmailsDelivered || sentCount,
      repliesReceived: replyCount,
      replyRate: pct(replyCount, sentCount),
      interestedLeads: sumStatuses(statusCounts, ['INTERESTED', 'QUALIFIED', 'ENGAGED', 'CUSTOMER']),
      totalLeads: Object.values(statusCounts).reduce((a, b) => a + b, 0),
    };

    if (TELEPHONY_ENABLED) {
      // Legacy telephony counters are only computed when the feature flag is on.
      const [{ count: calls }, { count: connected }, { count: sms }] = await Promise.all([
        headCount('calls'),
        headCount('calls', (q) => q.eq('status', 'completed')),
        headCount('sms_messages', (q) => q.eq('direction', 'outbound')),
      ]);
      today.callsPlaced = calls || 0;
      today.callsConnected = connected || 0;
      today.smsSent = sms || 0;
    }

    return {
      today,
      activeCampaigns: (activeCampaignsData || []).map((c) => ({
        id: c.id,
        _id: c.id,
        name: c.name,
        subject: c.subject,
        status: c.status,
        stats: c.stats || { sent: 0, replyRate: '0.0%' },
        totalRecipients: c.stats?.totalRecipients || 0,
      })),
      priorityLeads,
      recentActivities,
    };
  } catch (err) {
    console.error('[Analytics] Error fetching Supabase dashboard data:', err);
    return { ...EMPTY_DASHBOARD, __degraded: true };
  }
}

const EMPTY_PIPELINE = {
  NEW: 0,
  CONTACTED: 0,
  ENGAGED: 0,
  TECHNICAL_EVALUATION: 0,
  COMMERCIAL_DISCUSSION: 0,
  TRIAL_ORDER: 0,
  APPROVED_SUPPLIER: 0,
  RECURRING_CUSTOMER: 0,
  ON_HOLD: 0,
  LOST: 0,
  DO_NOT_CONTACT: 0,
};

const EMPTY_PERFORMANCE = {
  email: {
    sent: 0,
    delivered: 0,
    opened: 0,
    replied: 0,
    bounced: 0,
    openRate: '0.0%',
    replyRate: '0.0%',
    bounceRate: '0.0%',
  },
  pipeline: { ...EMPTY_PIPELINE },
};

async function loadPerformance() {
  try {
    const [
      { count: totalEmailsSent },
      { count: totalReplies },
      { count: totalBounces },
      { count: recipientsSent },
      { count: recipientsOpened },
      statusCounts,
    ] = await Promise.all([
      headCount('email_messages', (q) => q.eq('direction', 'outbound')),
      headCount('email_messages', (q) => q.eq('direction', 'inbound')),
      headCount('email_messages', (q) => q.eq('status', 'bounced')),
      // Open tracking is recorded on campaign recipients by the Resend webhook.
      headCount('email_recipients', (q) => q.not('sent_at', 'is', null)),
      headCount('email_recipients', (q) => q.not('opened_at', 'is', null)),
      getStatusCounts(),
    ]);

    const sent = totalEmailsSent || 0;
    const replies = totalReplies || 0;
    const bounces = totalBounces || 0;
    const tracked = recipientsSent || 0;
    const opened = recipientsOpened || 0;

    // Pipeline = real per-status counts. Statuses outside the pipeline vocabulary (older rows) are
    // reported separately instead of being silently counted as NEW like before.
    const pipeline = { ...EMPTY_PIPELINE };
    const legacy = {};
    Object.entries(statusCounts).forEach(([status, total]) => {
      if (status in pipeline) pipeline[status] += total;
      else if (total > 0) legacy[status] = total;
    });

    const result = {
      email: {
        sent,
        delivered: Math.max(sent - bounces, 0),
        opened,
        replied: replies,
        bounced: bounces,
        // Open rate is measured against tracked campaign sends (where opens can be recorded)
        openRate: pct(opened, tracked),
        openTrackedSent: tracked,
        replyRate: pct(replies, sent),
        bounceRate: pct(bounces, sent),
      },
      pipeline,
      legacyStatuses: legacy,
    };

    if (TELEPHONY_ENABLED) {
      const [{ count: calls }, { count: connected }] = await Promise.all([
        headCount('calls'),
        headCount('calls', (q) => q.eq('status', 'completed')),
      ]);
      result.calls = {
        total: calls || 0,
        connected: connected || 0,
        connectRate: pct(connected || 0, calls || 0),
      };
    }

    return result;
  } catch (err) {
    console.error('[Analytics] Error fetching Supabase performance analytics:', err);
    return { ...EMPTY_PERFORMANCE, __degraded: true };
  }
}

export const getDashboardData = createCached(loadDashboard);
export const getPerformanceAnalytics = createCached(loadPerformance);
