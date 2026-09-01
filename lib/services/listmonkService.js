import { connectToDatabase } from '@/lib/db/mongoose';
import Lead from '@/lib/models/Lead';
import ActivityLog from '@/lib/models/ActivityLog';

const LISTMONK_URL = process.env.LISTMONK_URL || 'http://127.0.0.1:9000';
const LISTMONK_USER = process.env.LISTMONK_API_USERNAME || 'listmonk';
const LISTMONK_PASS = process.env.LISTMONK_API_PASSWORD || 'listmonk_secure_password';

function getAuthHeader() {
  const token = Buffer.from(`${LISTMONK_USER}:${LISTMONK_PASS}`).toString('base64');
  return {
    Authorization: `Basic ${token}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Programmatically synchronize Resend SMTP delivery credentials into Listmonk settings
 */
export async function syncResendSmtpToListmonk() {
  const resendApiKey = process.env.RESEND_API_KEY || process.env.RESEND_SMTP_PASSWORD;
  if (!resendApiKey) {
    return { success: false, message: 'No Resend SMTP credentials found in environment' };
  }

  try {
    const getRes = await fetch(`${LISTMONK_URL}/api/settings`, {
      method: 'GET',
      headers: getAuthHeader(),
    });

    if (!getRes.ok) {
      return { success: false, message: `Failed to fetch Listmonk settings (HTTP ${getRes.status})` };
    }

    const getData = await getRes.json();
    const currentSettings = getData.data || {};

    const smtpPort = parseInt(process.env.RESEND_SMTP_PORT || '465', 10);
    const resendSmtpConfig = {
      name: 'Resend SMTP',
      enabled: true,
      host: process.env.RESEND_SMTP_HOST || 'smtp.resend.com',
      hello_hostname: '',
      port: smtpPort,
      auth_protocol: 'login',
      username: process.env.RESEND_SMTP_USER || 'resend',
      password: process.env.RESEND_SMTP_PASSWORD || process.env.RESEND_API_KEY,
      email_headers: [],
      max_conns: 10,
      max_msg_retries: 3,
      msg_retry_delay: '1m0s',
      idle_timeout: '15s',
      wait_timeout: '5s',
      tls_type: smtpPort === 465 ? 'SSL' : 'STARTTLS',
      tls_skip_verify: false,
      from_addresses: [],
    };

    const updatedSettings = {
      ...currentSettings,
      smtp: [resendSmtpConfig],
      'app.from_email': process.env.EMAIL_FROM || currentSettings['app.from_email'] || 'outreach@8020outbound.com',
    };

    const putRes = await fetch(`${LISTMONK_URL}/api/settings`, {
      method: 'PUT',
      headers: getAuthHeader(),
      body: JSON.stringify(updatedSettings),
    });

    if (putRes.ok) {
      return { success: true, message: 'Resend SMTP synced into Listmonk delivery engine' };
    }

    return { success: false, message: `Failed to update Listmonk settings (HTTP ${putRes.status})` };
  } catch (err) {
    console.warn('[Listmonk] SMTP sync error:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Check if Listmonk API server is reachable and operational
 */
export async function checkListmonkHealth() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1200);

    const res = await fetch(`${LISTMONK_URL}/api/health`, {
      method: 'GET',
      headers: getAuthHeader(),
      signal: controller.signal,
    }).catch(() => null);

    clearTimeout(timeout);

    if (res && res.ok) {
      // Auto-sync Resend SMTP if available in background
      syncResendSmtpToListmonk().catch(() => null);
      return { connected: true, status: 'Connected', url: LISTMONK_URL };
    }

    // Try checking /api/lists as secondary health verification
    const listsRes = await fetch(`${LISTMONK_URL}/api/lists?per_page=1`, {
      method: 'GET',
      headers: getAuthHeader(),
    }).catch(() => null);

    if (listsRes && (listsRes.ok || listsRes.status === 401)) {
      if (listsRes.ok) {
        syncResendSmtpToListmonk().catch(() => null);
      }
      return {
        connected: listsRes.ok,
        status: listsRes.ok ? 'Connected' : 'Authentication Required',
        url: LISTMONK_URL,
      };
    }

    return { connected: false, status: 'Offline / In Dev Mode', url: LISTMONK_URL };
  } catch (err) {
    return { connected: false, status: 'Offline / In Dev Mode', url: LISTMONK_URL };
  }
}

/**
 * Get or create a target distribution list in Listmonk
 */
export async function getOrCreateList(listName = '80/20 Outbound Campaign List') {
  try {
    // 1. Check existing lists
    const res = await fetch(`${LISTMONK_URL}/api/lists?per_page=100`, {
      method: 'GET',
      headers: getAuthHeader(),
    });

    if (res.ok) {
      const data = await res.json();
      const existing = (data.data?.results || []).find((l) => l.name === listName);
      if (existing) {
        return existing.id;
      }
    }

    // 2. Create new list if not exists
    const createRes = await fetch(`${LISTMONK_URL}/api/lists`, {
      method: 'POST',
      headers: getAuthHeader(),
      body: JSON.stringify({
        name: listName,
        type: 'private',
        optin: 'single',
        tags: ['8020-outbound', 'sales-campaign'],
      }),
    });

    if (createRes.ok) {
      const created = await createRes.json();
      return created.data?.id || created.id;
    }

    return 1; // Default fallback ID
  } catch (err) {
    console.warn('[Listmonk] List creation failed or offline, using fallback list ID:', err.message);
    return 1;
  }
}

/**
 * Synchronize MongoDB Leads as Listmonk Subscribers into target List
 */
export async function syncSubscribersToListmonk(leads = [], listId = 1) {
  if (!Array.isArray(leads) || leads.length === 0) {
    return { synced: 0, suppressed: 0, errors: 0 };
  }

  let synced = 0;
  let suppressed = 0;
  let errors = 0;

  for (const lead of leads) {
    const email = (lead.email || '').trim().toLowerCase();
    if (!email) continue;

    const isSuppressed = Boolean(lead.suppression?.email || lead.status === 'DO_NOT_CONTACT');
    const subscriberStatus = isSuppressed ? 'blocklisted' : 'enabled';

    if (isSuppressed) suppressed++;

    try {
      // Upsert subscriber into Listmonk
      const res = await fetch(`${LISTMONK_URL}/api/subscribers`, {
        method: 'POST',
        headers: getAuthHeader(),
        body: JSON.stringify({
          email,
          name: lead.fullName || `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || 'Prospect',
          status: subscriberStatus,
          lists: [listId],
          attribs: {
            company: lead.company || '',
            jobTitle: lead.jobTitle || '',
            phone: lead.phone || '',
            leadId: lead._id ? lead._id.toString() : '',
          },
          preconfirm_subscriptions: true,
        }),
      });

      if (res.ok || res.status === 409) {
        synced++;
      } else {
        errors++;
      }
    } catch (err) {
      errors++;
    }
  }

  return { synced, suppressed, errors };
}

/**
 * Create a new campaign in Listmonk
 */
export async function createListmonkCampaign({
  name,
  subject,
  bodyHtml,
  listIds = [1],
  fromEmail = '',
  sendAt = null,
}) {
  try {
    // Ensure Resend SMTP is synced before campaign dispatch
    await syncResendSmtpToListmonk().catch(() => null);

    const payload = {
      name,
      subject,
      lists: listIds,
      type: 'regular',
      content_type: 'html',
      body: bodyHtml,
      from_email: fromEmail || process.env.EMAIL_FROM || 'outreach@8020outbound.com',
      tags: ['8020-blast'],
      messenger: 'email',
    };

    if (sendAt) {
      payload.send_at = new Date(sendAt).toISOString();
    }

    const res = await fetch(`${LISTMONK_URL}/api/campaigns`, {
      method: 'POST',
      headers: getAuthHeader(),
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const data = await res.json();
      return {
        success: true,
        campaignId: data.data?.id || data.id,
        status: data.data?.status || 'draft',
        data: data.data || data,
      };
    }

    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.message || `Listmonk API error (HTTP ${res.status})`);
  } catch (err) {
    console.warn('[Listmonk] Failed to create campaign on Listmonk engine:', err.message);
    return {
      success: false,
      error: err.message,
      simulated: true,
      campaignId: Date.now(),
      status: 'draft',
    };
  }
}

/**
 * Update Listmonk Campaign Status (running, paused, cancelled)
 */
export async function updateListmonkCampaignStatus(campaignId, status = 'running') {
  try {
    const res = await fetch(`${LISTMONK_URL}/api/campaigns/${campaignId}/status`, {
      method: 'PUT',
      headers: getAuthHeader(),
      body: JSON.stringify({ status }),
    });

    if (res.ok) {
      const data = await res.json();
      return { success: true, status: data.data?.status || status };
    }

    return { success: false, status };
  } catch (err) {
    return { success: false, status, error: err.message };
  }
}

/**
 * Fetch campaign statistics and delivery numbers from Listmonk
 */
export async function getListmonkCampaignStats(campaignId) {
  try {
    const res = await fetch(`${LISTMONK_URL}/api/campaigns/${campaignId}`, {
      method: 'GET',
      headers: getAuthHeader(),
    });

    if (res.ok) {
      const data = await res.json();
      const c = data.data || data;
      return {
        success: true,
        status: c.status,
        stats: {
          total: c.to_send || 0,
          sent: c.sent || 0,
          views: c.views || 0,
          clicks: c.clicks || 0,
          bounces: c.bounces || 0,
        },
      };
    }

    return { success: false };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Synchronize Listmonk Webhook Events (unsubscribes, bounces, complaints) to MongoDB Leads
 */
export async function handleListmonkWebhook(payload = {}) {
  const event = (payload.event || payload.type || '').toLowerCase();
  const email = (payload.email || payload.subscriber?.email || payload.data?.email || '').trim().toLowerCase();

  if (!email) {
    return { success: true, message: 'Webhook received without email target' };
  }

  let action = 'PROCESSED';

  try {
    await connectToDatabase();
    const lead = await Lead.findOne({ email });

    if (event.includes('unsub') || event.includes('block') || payload.status === 'unsubscribed') {
      action = 'UNSUBSCRIBED';
      if (lead) {
        lead.suppression = {
          email: true,
          reason: 'UNSUBSCRIBED',
          updatedAt: new Date(),
        };
        lead.status = 'DO_NOT_CONTACT';
        await lead.save();

        try {
          await ActivityLog.create({
            leadId: lead._id,
            action: 'SUPPRESSION_UPDATED',
            channel: 'email',
            direction: 'inbound',
            summary: `Prospect unsubscribed via Listmonk campaign (${email})`,
          });
        } catch (logErr) {}
      }
    } else if (event.includes('bounce') || payload.status === 'bounced') {
      action = 'BOUNCED';
      if (lead) {
        lead.suppression = {
          email: true,
          reason: 'BOUNCED',
          updatedAt: new Date(),
        };
        await lead.save();

        try {
          await ActivityLog.create({
            leadId: lead._id,
            action: 'EMAIL_BOUNCED',
            channel: 'email',
            direction: 'system',
            summary: `Outbound email bounced for prospect ${email}`,
          });
        } catch (logErr) {}
      }
    }
  } catch (err) {
    // If DB is offline, log and still respond gracefully
    console.warn('[Listmonk Webhook] Fallback during DB offline:', err.message);
    if (event.includes('unsub')) action = 'UNSUBSCRIBED';
    if (event.includes('bounce')) action = 'BOUNCED';
  }

  return { success: true, result: { action, email, event } };
}
