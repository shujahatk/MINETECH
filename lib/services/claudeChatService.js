import { supabaseAdmin } from '../supabase.js';
import {
  normalizeLeadRole,
  calculateClassificationCounts,
} from './leadClassificationService.js';
import { getWorkspaceSettings } from './workspaceSettingsService.js';
import { getAllSignaturesAsync } from './signatureService.js';

export const CLAUDE_MODELS = {
  SONNET: {
    id: 'claude-sonnet-4-6',
    name: 'MineTech AI',
    displayName: 'MineTech AI (Sonnet 4.6)',
    description: 'High-capability model for CRM intelligence, outreach strategy, analysis, and general tasks',
    supportsThinking: true,
  },
  OPUS: {
    id: 'claude-opus-4-6',
    name: 'MineTech AI High',
    displayName: 'MineTech AI High (Opus 4.6)',
    description: 'Premium reasoning for complex multi-step CRM investigations, strategy, and deep analysis',
    supportsThinking: true,
  },
  HAIKU: {
    id: 'claude-haiku-4-5',
    name: 'MineTech Fast',
    displayName: 'MineTech Fast (Haiku 4.5)',
    description: 'Fast, lightweight responses for quick CRM lookups and summarization',
    supportsThinking: false,
  },
};

export const DEFAULT_MODEL_ID = CLAUDE_MODELS.SONNET.id;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_CONTEXT_MESSAGES = 24;
const ANTHROPIC_TIMEOUT_MS = 60_000;

const GENERAL_SYSTEM_PROMPT = `You are MineTech AI, the central CRM intelligence assistant built into the MineTech Outbound CRM for MineTech Resources BV.

CORE CAPABILITIES & RULES:
1. LIVE CRM INTELLIGENCE: You have direct server-side tools to query live Supabase CRM data across Leads (Buyers, Sellers, Buyer & Seller, Unassigned), Email Workspace, Inbox & Sent Emails, Email Delivery/Bounce/Open/Reply telemetry, Call History & Recordings, Sales Pipeline stages, Campaigns, Follow-Up Sequences, Scheduled Callbacks/Follow-ups, Documents/Attachments, Templates, Signatures, and CRM Analytics.
2. ALWAYS RETRIEVE BEFORE ANSWERING CRM QUESTIONS: Whenever the user asks about any company, lead, buyer, seller, email, delivery status, call, campaign, pipeline, follow-up, sequence, document, template, signature, or CRM statistic, you MUST call the relevant CRM tool(s) first and ground your answer strictly in the returned database records.
3. CROSS-MODULE CHRONOLOGICAL SYNTHESIS: When asked about a specific company or lead (e.g., "Have we contacted them?", "Summarize their history", "What should we do next?"), combine their lead profile, email history, call history, campaign membership, follow-ups, notes, and pipeline stage into a clear chronological summary.
4. ZERO FABRICATION: NEVER invent, guess, or fabricate contact history, email delivery statuses, call outcomes, campaign numbers, or CRM records. If no records exist or information is unavailable, explicitly state that no records were found in the CRM.
5. CONSEQUENTIAL ACTIONS: You currently have read-only CRM tools. If a user asks you to send an email, delete records, or modify CRM data, explain clearly what you recommend and ask for explicit confirmation or guide them to the appropriate action button — never claim you sent an email or modified a record when you have not.
6. GENERAL ASSISTANCE: If the user asks a general non-CRM question (writing, analysis, coding, research), answer helpfully with clean markdown formatting without forcing mining or CRM context.`;

/* ========================================================================== */
/* SERVER-SIDE CRM TOOLS (READ-ONLY, AUTH-SCOPED)                             */
/* ========================================================================== */

export const CRM_READ_TOOLS = [
  {
    name: 'search_leads',
    description:
      'Search the MineTech CRM leads table by keyword (company, contact name, email, product/mineral), classification (Buyer, Seller, Buyer & Seller, Unassigned), pipeline stage/status, or qualified/unreplied filter. Returns live CRM records.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Optional keyword for company, contact name, email, or mineral product' },
        classification: {
          type: 'string',
          enum: ['ALL', 'Buyer', 'Seller', 'Buyer & Seller', 'Unassigned'],
          description: 'Optional lead role filter',
        },
        status: {
          type: 'string',
          description: 'Optional pipeline stage/status (e.g. NEW, CONTACTED, ENGAGED, TECHNICAL_EVALUATION, COMMERCIAL_DISCUSSION, TRIAL_ORDER, APPROVED_SUPPLIER, RECURRING_CUSTOMER)',
        },
        qualifiedOnly: { type: 'boolean', description: 'If true, return leads in ENGAGED or later stages or with score >= 75' },
        unrepliedOnly: { type: 'boolean', description: 'If true, return leads that were contacted/sent emails but have not replied' },
        limit: { type: 'number', description: 'Max records to return (default 15, max 50)' },
      },
    },
  },
  {
    name: 'get_lead_details',
    description: 'Get full profile, contact info, role classification, pipeline stage, scoring, next follow-up, notes, and custom fields for a specific lead by UUID, company name, or email.',
    input_schema: {
      type: 'object',
      properties: {
        leadId: { type: 'string', description: 'UUID of the lead' },
        companyOrName: { type: 'string', description: 'Company name, contact name, or email if UUID is not known' },
      },
    },
  },
  {
    name: 'get_crm_interaction_history',
    description:
      'Fetch the complete cross-module chronological interaction history for a lead or company: lead profile, inbox/sent emails, email delivery/open/reply/bounce status, call history & recordings, SMS messages, campaign memberships, scheduled follow-ups, notes, and activity logs.',
    input_schema: {
      type: 'object',
      properties: {
        leadId: { type: 'string', description: 'UUID of the lead' },
        emailOrCompany: { type: 'string', description: 'Company name, contact name, or email if UUID is not known' },
      },
    },
  },
  {
    name: 'search_emails',
    description:
      'Search inbox and sent emails (email_messages) and campaign email delivery/bounce/open/reply telemetry (email_recipients) by company, email address, subject, direction (inbound/outbound), or delivery status (sent, delivered, bounced, failed, replied).',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Optional email address, company name, or subject keyword' },
        direction: { type: 'string', enum: ['ALL', 'inbound', 'outbound'], description: 'Filter by email direction' },
        status: { type: 'string', description: 'Optional delivery status filter (e.g. sent, delivered, bounced, failed, replied)' },
        limit: { type: 'number', description: 'Max results (default 15, max 40)' },
      },
    },
  },
  {
    name: 'search_calls',
    description:
      'Search call history in the calls table by company/lead, outcome (e.g. callback, interested, voicemail, no answer), status, or direction. Returns duration, outcome, notes, transcription/summary, and recording URL where available.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Optional keyword to match lead company/name, outcome, notes, or transcription' },
        callbacksOnly: { type: 'boolean', description: 'If true, filter calls mentioning callback or follow-up' },
        limit: { type: 'number', description: 'Max calls to return (default 15, max 40)' },
      },
    },
  },
  {
    name: 'get_campaign_stats',
    description:
      'Get all outreach campaigns in Email Workspace with live delivery statistics (total recipients, sent, delivered, opened, clicked, replied, bounced, failed, qualified leads generated) and creation dates.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Optional campaign name filter' },
        limit: { type: 'number', description: 'Max campaigns to return (default 15)' },
      },
    },
  },
  {
    name: 'get_pipeline_summary',
    description:
      'Get live CRM sales pipeline summary and analytics: total lead count, exact breakdown by Lead Role (Buyers, Sellers, Buyer & Seller, Unassigned), breakdown across all 8 sales stages, qualified lead count, and overall email/call engagement metrics.',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_follow_up_info',
    description:
      'Get follow-up sequences (email_sequences), leads with scheduled follow-ups or callbacks (overdue, due today, upcoming), and buyers/sellers who need follow-up (contacted with no reply).',
    input_schema: {
      type: 'object',
      properties: {
        classification: {
          type: 'string',
          enum: ['ALL', 'Buyer', 'Seller', 'Buyer & Seller', 'Unassigned'],
          description: 'Optional role filter for leads needing follow-up',
        },
        includeSequences: { type: 'boolean', description: 'Whether to include configured follow-up sequences (default true)' },
      },
    },
  },
  {
    name: 'search_documents_and_templates',
    description:
      'Search workspace documents/attachments, email templates (email_templates), and saved email signatures configured in Email Workspace.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Optional keyword to filter documents, templates, or signatures' },
      },
    },
  },
];

async function executeCrmTool(name, input) {
  try {
    switch (name) {
      case 'search_leads': {
        const {
          query = '',
          classification = 'ALL',
          status = '',
          qualifiedOnly = false,
          unrepliedOnly = false,
          limit = 15,
        } = input || {};
        const maxRows = Math.min(Number(limit) || 15, 50);

        const { data: allRows, error } = await supabaseAdmin
          .from('leads')
          .select('id, full_name, company, email, phone, job_title, status, pipeline_stage, score, tags, is_dnc, last_contacted_at, next_follow_up_at, custom_fields, created_at')
          .order('updated_at', { ascending: false })
          .limit(300);

        if (error) return { error: error.message };

        let repliedLeadIds = new Set();
        let contactedLeadIds = new Set();
        if (unrepliedOnly) {
          const [recRes, msgRes] = await Promise.all([
            supabaseAdmin.from('email_recipients').select('lead_id, status, sent_at, replied_at').limit(1000),
            supabaseAdmin.from('email_messages').select('lead_id, direction').limit(1000),
          ]);
          (recRes.data || []).forEach((r) => {
            if (r.lead_id && (r.sent_at || r.status === 'SENT' || r.status === 'DELIVERED')) contactedLeadIds.add(r.lead_id);
            if (r.lead_id && (r.replied_at || r.status === 'REPLIED')) repliedLeadIds.add(r.lead_id);
          });
          (msgRes.data || []).forEach((m) => {
            if (m.lead_id && m.direction === 'outbound') contactedLeadIds.add(m.lead_id);
            if (m.lead_id && m.direction === 'inbound') repliedLeadIds.add(m.lead_id);
          });
        }

        const qLower = String(query || '').trim().toLowerCase();
        const statusUpper = String(status || '').trim().toUpperCase();
        const qualifiedStages = new Set(['ENGAGED', 'TECHNICAL_EVALUATION', 'COMMERCIAL_DISCUSSION', 'TRIAL_ORDER', 'APPROVED_SUPPLIER', 'RECURRING_CUSTOMER']);

        const filtered = (allRows || []).filter((r) => {
          const role = normalizeLeadRole(r);
          if (classification && classification !== 'ALL' && role !== classification) return false;
          const st = String(r.status || r.pipeline_stage || 'NEW').toUpperCase();
          if (statusUpper && statusUpper !== 'ALL' && st !== statusUpper) return false;
          if (qualifiedOnly && !qualifiedStages.has(st) && (Number(r.score) || 0) < 75) return false;
          if (unrepliedOnly) {
            const wasContacted = st === 'CONTACTED' || contactedLeadIds.has(r.id) || Boolean(r.last_contacted_at);
            if (!wasContacted || repliedLeadIds.has(r.id)) return false;
          }
          if (qLower) {
            const hay = [
              r.full_name,
              r.company,
              r.email,
              r.job_title,
              r.custom_fields?.materials,
              r.custom_fields?.product_category,
              r.custom_fields?.country,
              (r.tags || []).join(' '),
            ]
              .filter(Boolean)
              .join(' ')
              .toLowerCase();
            if (!hay.includes(qLower)) return false;
          }
          return true;
        });

        return {
          totalMatched: filtered.length,
          returnedCount: Math.min(filtered.length, maxRows),
          leads: filtered.slice(0, maxRows).map((r) => ({
            id: r.id,
            name: r.full_name,
            company: r.company,
            email: r.email,
            phone: r.phone,
            jobTitle: r.job_title,
            classification: normalizeLeadRole(r),
            status: r.status || r.pipeline_stage || 'NEW',
            score: r.score,
            materials: r.custom_fields?.materials || r.custom_fields?.product_category || '',
            country: r.custom_fields?.country || '',
            nextAction: r.custom_fields?.next_action || '',
            nextActionDate: r.custom_fields?.next_action_date || r.next_follow_up_at || null,
            lastContactedAt: r.last_contacted_at || null,
            isDnc: Boolean(r.is_dnc),
          })),
        };
      }

      case 'get_lead_details': {
        const { leadId, companyOrName } = input || {};
        let query = supabaseAdmin.from('leads').select('*');
        if (leadId && UUID_RE.test(leadId)) {
          query = query.eq('id', leadId);
        } else if (companyOrName) {
          const term = String(companyOrName).trim();
          query = query.or(`company.ilike.%${term}%,full_name.ilike.%${term}%,email.ilike.%${term}%`);
        } else {
          return { error: 'leadId or companyOrName is required' };
        }
        const { data, error } = await query.limit(1).maybeSingle();
        if (error) return { error: error.message };
        if (!data) return { found: false, message: 'No matching lead found in CRM.' };

        return {
          found: true,
          lead: {
            id: data.id,
            name: data.full_name,
            company: data.company,
            email: data.email,
            phone: data.phone,
            jobTitle: data.job_title,
            website: data.website,
            classification: normalizeLeadRole(data),
            status: data.status,
            pipelineStage: data.pipeline_stage || data.status,
            score: data.score,
            tags: data.tags || [],
            isDnc: Boolean(data.is_dnc),
            notes: data.notes || '',
            nextAction: data.custom_fields?.next_action || '',
            nextActionDate: data.custom_fields?.next_action_date || data.next_follow_up_at || null,
            materials: data.custom_fields?.materials || data.custom_fields?.product_category || '',
            country: data.custom_fields?.country || '',
            created_at: data.created_at,
            updated_at: data.updated_at,
            last_contacted_at: data.last_contacted_at,
          },
        };
      }

      case 'get_crm_interaction_history': {
        const { leadId, emailOrCompany } = input || {};
        let lead = null;
        if (leadId && UUID_RE.test(leadId)) {
          const { data } = await supabaseAdmin.from('leads').select('*').eq('id', leadId).maybeSingle();
          lead = data;
        } else if (emailOrCompany) {
          const term = String(emailOrCompany).trim();
          const { data } = await supabaseAdmin
            .from('leads')
            .select('*')
            .or(`email.ilike.%${term}%,company.ilike.%${term}%,full_name.ilike.%${term}%`)
            .limit(1)
            .maybeSingle();
          lead = data;
        }

        if (!lead) {
          return { interactionsFound: false, message: `No lead matching "${emailOrCompany || leadId}" was found in the CRM database.` };
        }

        const [msgRes, callRes, recRes, smsRes, actRes] = await Promise.all([
          supabaseAdmin
            .from('email_messages')
            .select('id, direction, sender, recipient, subject, body_plain, status, sent_at, created_at')
            .or(`lead_id.eq.${lead.id}${lead.email ? `,recipient.ilike.${lead.email},sender.ilike.${lead.email}` : ''}`)
            .order('sent_at', { ascending: false })
            .limit(20),
          supabaseAdmin
            .from('calls')
            .select('id, direction, status, duration, outcome, sentiment, notes, transcription, recording_url, created_at')
            .eq('lead_id', lead.id)
            .order('created_at', { ascending: false })
            .limit(15),
          supabaseAdmin
            .from('email_recipients')
            .select('campaign_id, email, status, sent_at, opened_at, clicked_at, replied_at, bounced_at, error_message, scheduled_at, email_campaigns(name, status)')
            .eq('lead_id', lead.id)
            .order('created_at', { ascending: false })
            .limit(15),
          supabaseAdmin
            .from('sms_messages')
            .select('id, direction, body, status, created_at')
            .eq('lead_id', lead.id)
            .order('created_at', { ascending: false })
            .limit(10),
          supabaseAdmin
            .from('activity_logs')
            .select('id, type, description, created_at')
            .eq('lead_id', lead.id)
            .order('created_at', { ascending: false })
            .limit(15),
        ]);

        const messages = (msgRes.data || []).map((m) => ({
          id: m.id,
          direction: m.direction,
          sender: m.sender,
          recipient: m.recipient,
          subject: m.subject,
          snippet: (m.body_plain || '').slice(0, 220),
          status: m.status,
          timestamp: m.sent_at || m.created_at,
        }));

        const calls = (callRes.data || []).map((c) => ({
          id: c.id,
          direction: c.direction,
          status: c.status,
          durationSeconds: c.duration || 0,
          outcome: c.outcome || '',
          sentiment: c.sentiment || 'neutral',
          notes: c.notes || '',
          transcription: (c.transcription || '').slice(0, 300),
          hasRecording: Boolean(c.recording_url),
          recordingUrl: c.recording_url || '',
          timestamp: c.created_at,
        }));

        const campaigns = (recRes.data || []).map((r) => ({
          campaignId: r.campaign_id,
          campaignName: r.email_campaigns?.name || 'Campaign',
          campaignStatus: r.email_campaigns?.status || '',
          deliveryStatus: r.status,
          sentAt: r.sent_at,
          openedAt: r.opened_at,
          clickedAt: r.clicked_at,
          repliedAt: r.replied_at,
          bouncedAt: r.bounced_at,
          errorMessage: r.error_message || '',
        }));

        const sms = smsRes.data || [];
        const activities = actRes.data || [];

        return {
          leadProfile: {
            id: lead.id,
            name: lead.full_name,
            company: lead.company,
            email: lead.email,
            phone: lead.phone,
            classification: normalizeLeadRole(lead),
            status: lead.status,
            pipelineStage: lead.pipeline_stage || lead.status,
            notes: lead.notes || '',
            nextAction: lead.custom_fields?.next_action || '',
            nextActionDate: lead.custom_fields?.next_action_date || lead.next_follow_up_at || null,
            lastContactedAt: lead.last_contacted_at,
          },
          interactionsFound: messages.length > 0 || calls.length > 0 || campaigns.length > 0 || sms.length > 0,
          emailMessagesCount: messages.length,
          emails: messages,
          callsCount: calls.length,
          calls,
          campaignsCount: campaigns.length,
          campaigns,
          smsCount: sms.length,
          sms,
          activitiesCount: activities.length,
          activities,
        };
      }

      case 'search_emails': {
        const { query = '', direction = 'ALL', status = '', limit = 15 } = input || {};
        const maxRows = Math.min(Number(limit) || 15, 40);

        let msgQ = supabaseAdmin
          .from('email_messages')
          .select('id, lead_id, direction, sender, recipient, subject, body_plain, status, sent_at, created_at')
          .order('sent_at', { ascending: false })
          .limit(maxRows);

        if (direction && direction !== 'ALL') msgQ = msgQ.eq('direction', direction);
        if (status) msgQ = msgQ.ilike('status', `%${status}%`);
        if (query) msgQ = msgQ.or(`recipient.ilike.%${query}%,sender.ilike.%${query}%,subject.ilike.%${query}%`);

        let recQ = supabaseAdmin
          .from('email_recipients')
          .select('id, campaign_id, lead_id, email, status, sent_at, opened_at, replied_at, bounced_at, error_message, email_campaigns(name)')
          .order('updated_at', { ascending: false })
          .limit(maxRows);

        if (status) recQ = recQ.ilike('status', `%${status}%`);
        if (query) recQ = recQ.ilike('email', `%${query}%`);

        const [msgRes, recRes] = await Promise.all([msgQ, recQ]);
        return {
          messagesCount: msgRes.data?.length || 0,
          messages: (msgRes.data || []).map((m) => ({
            id: m.id,
            leadId: m.lead_id,
            direction: m.direction,
            sender: m.sender,
            recipient: m.recipient,
            subject: m.subject,
            snippet: (m.body_plain || '').slice(0, 180),
            status: m.status,
            sentAt: m.sent_at || m.created_at,
          })),
          campaignDeliveriesCount: recRes.data?.length || 0,
          campaignDeliveries: (recRes.data || []).map((r) => ({
            email: r.email,
            campaignName: r.email_campaigns?.name || 'Campaign',
            status: r.status,
            sentAt: r.sent_at,
            openedAt: r.opened_at,
            repliedAt: r.replied_at,
            bouncedAt: r.bounced_at,
            errorMessage: r.error_message || '',
          })),
        };
      }

      case 'search_calls': {
        const { query = '', callbacksOnly = false, limit = 15 } = input || {};
        const maxRows = Math.min(Number(limit) || 15, 40);

        const { data: callRows, error } = await supabaseAdmin
          .from('calls')
          .select('id, lead_id, direction, from_number, to_number, duration, status, outcome, sentiment, notes, transcription, recording_url, created_at, leads(full_name, company, email, status)')
          .order('created_at', { ascending: false })
          .limit(100);

        if (error) return { error: error.message };

        const qLower = String(query || '').trim().toLowerCase();
        const filtered = (callRows || []).filter((c) => {
          const hay = [
            c.outcome,
            c.notes,
            c.transcription,
            c.status,
            c.leads?.company,
            c.leads?.full_name,
            c.leads?.email,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();

          if (callbacksOnly && !/(callback|call back|follow.?up|ring back|call again)/i.test(hay)) {
            return false;
          }
          if (qLower && !hay.includes(qLower)) return false;
          return true;
        });

        return {
          totalMatched: filtered.length,
          calls: filtered.slice(0, maxRows).map((c) => ({
            id: c.id,
            leadId: c.lead_id,
            company: c.leads?.company || 'Unknown',
            contactName: c.leads?.full_name || '',
            direction: c.direction,
            status: c.status,
            durationSeconds: c.duration || 0,
            outcome: c.outcome || '',
            sentiment: c.sentiment || 'neutral',
            notes: c.notes || '',
            transcription: (c.transcription || '').slice(0, 280),
            hasRecording: Boolean(c.recording_url),
            createdAt: c.created_at,
          })),
        };
      }

      case 'get_campaign_stats': {
        const { query = '', limit = 15 } = input || {};
        let campQ = supabaseAdmin
          .from('email_campaigns')
          .select('id, name, status, stats, created_at, updated_at')
          .not('status', 'in', '("SETTINGS","AI_CHAT_CONVERSATION")')
          .order('created_at', { ascending: false })
          .limit(Math.min(Number(limit) || 15, 40));

        if (query) campQ = campQ.ilike('name', `%${query}%`);

        const [campRes, recRes] = await Promise.all([
          campQ,
          supabaseAdmin.from('email_recipients').select('campaign_id, lead_id, status, sent_at, opened_at, clicked_at, replied_at, bounced_at, leads(status, score)').limit(2000),
        ]);

        const recByCamp = {};
        const qualifiedStages = new Set(['ENGAGED', 'TECHNICAL_EVALUATION', 'COMMERCIAL_DISCUSSION', 'TRIAL_ORDER', 'APPROVED_SUPPLIER', 'RECURRING_CUSTOMER']);
        (recRes.data || []).forEach((r) => {
          if (!r.campaign_id) return;
          if (!recByCamp[r.campaign_id]) {
            recByCamp[r.campaign_id] = { total: 0, sent: 0, delivered: 0, opened: 0, clicked: 0, replied: 0, bounced: 0, failed: 0, qualifiedLeads: 0 };
          }
          const b = recByCamp[r.campaign_id];
          b.total++;
          const st = String(r.status || '').toUpperCase();
          if (r.sent_at || ['SENT', 'DELIVERED', 'OPENED', 'CLICKED', 'REPLIED'].includes(st)) b.sent++;
          if (['DELIVERED', 'OPENED', 'CLICKED', 'REPLIED'].includes(st)) b.delivered++;
          if (r.opened_at || st === 'OPENED') b.opened++;
          if (r.clicked_at || st === 'CLICKED') b.clicked++;
          if (r.replied_at || st === 'REPLIED') b.replied++;
          if (r.bounced_at || st === 'BOUNCED') b.bounced++;
          if (st === 'FAILED') b.failed++;
          const leadStage = String(r.leads?.status || '').toUpperCase();
          if (qualifiedStages.has(leadStage) || (Number(r.leads?.score) || 0) >= 80) b.qualifiedLeads++;
        });

        const camps = campRes.data || [];
        return {
          campaignsCount: camps.length,
          campaigns: camps.map((c) => ({
            id: c.id,
            name: c.name,
            status: c.status,
            type: c.campaign_type || 'standard',
            metrics: recByCamp[c.id] || {
              total: c.stats?.total || 0,
              sent: c.stats?.sent || 0,
              delivered: c.stats?.delivered || 0,
              opened: c.stats?.opened || 0,
              clicked: c.stats?.clicked || 0,
              replied: c.stats?.replied || 0,
              bounced: c.stats?.bounced || 0,
              failed: c.stats?.failed || 0,
              qualifiedLeads: 0,
            },
            createdAt: c.created_at,
          })),
        };
      }

      case 'get_pipeline_summary': {
        const [leadsRes, msgRes, callRes, campRes] = await Promise.all([
          supabaseAdmin.from('leads').select('id, status, pipeline_stage, score, custom_fields'),
          supabaseAdmin.from('email_messages').select('direction, status').limit(1000),
          supabaseAdmin.from('calls').select('status, outcome').limit(500),
          supabaseAdmin
            .from('email_campaigns')
            .select('id, status')
            .not('status', 'in', '("SETTINGS","AI_CHAT_CONVERSATION")'),
        ]);

        const leads = leadsRes.data || [];
        const stages = {};
        const qualifiedStages = new Set(['ENGAGED', 'TECHNICAL_EVALUATION', 'COMMERCIAL_DISCUSSION', 'TRIAL_ORDER', 'APPROVED_SUPPLIER', 'RECURRING_CUSTOMER']);
        let qualifiedCount = 0;

        leads.forEach((l) => {
          const s = String(l.status || l.pipeline_stage || 'NEW').toUpperCase();
          stages[s] = (stages[s] || 0) + 1;
          if (qualifiedStages.has(s) || (Number(l.score) || 0) >= 75) qualifiedCount++;
        });

        const classificationCounts = calculateClassificationCounts(leads);
        const msgs = msgRes.data || [];
        const outboundEmails = msgs.filter((m) => m.direction === 'outbound').length;
        const inboundReplies = msgs.filter((m) => m.direction === 'inbound').length;

        return {
          totalLeads: leads.length,
          qualifiedLeadsCount: qualifiedCount,
          classificationBreakdown: {
            All: classificationCounts.all,
            Buyer: classificationCounts.buyers,
            Seller: classificationCounts.sellers,
            'Buyer & Seller': classificationCounts.buyer_and_sellers,
            Unassigned: classificationCounts.unassigned,
          },
          stageBreakdown: stages,
          activityAnalytics: {
            totalCampaigns: campRes.data?.length || 0,
            totalOutboundEmails: outboundEmails,
            totalInboundReplies: inboundReplies,
            totalCallsLogged: callRes.data?.length || 0,
          },
        };
      }

      case 'get_follow_up_info': {
        const { classification = 'ALL', includeSequences = true } = input || {};
        const todayStr = new Date().toISOString().slice(0, 10);

        const [leadsRes, seqRes] = await Promise.all([
          supabaseAdmin
            .from('leads')
            .select('id, full_name, company, email, status, next_follow_up_at, last_contacted_at, custom_fields')
            .limit(300),
          includeSequences
            ? supabaseAdmin.from('email_sequences').select('id, name, description, is_active, steps, created_at').order('created_at', { ascending: false })
            : Promise.resolve({ data: [] }),
        ]);

        const scheduledFollowUps = [];
        const needingFollowUp = [];

        (leadsRes.data || []).forEach((l) => {
          const role = normalizeLeadRole(l);
          if (classification !== 'ALL' && role !== classification) return;

          const nextDate = l.custom_fields?.next_action_date || (l.next_follow_up_at ? String(l.next_follow_up_at).slice(0, 10) : null);
          const nextAction = l.custom_fields?.next_action || '';

          if (nextDate || nextAction) {
            scheduledFollowUps.push({
              leadId: l.id,
              company: l.company,
              contactName: l.full_name,
              classification: role,
              status: l.status,
              nextAction,
              nextActionDate: nextDate,
              isOverdue: Boolean(nextDate && nextDate < todayStr),
              isDueToday: Boolean(nextDate && nextDate === todayStr),
            });
          } else if (String(l.status || '').toUpperCase() === 'CONTACTED') {
            needingFollowUp.push({
              leadId: l.id,
              company: l.company,
              contactName: l.full_name,
              email: l.email,
              classification: role,
              lastContactedAt: l.last_contacted_at,
            });
          }
        });

        return {
          today: todayStr,
          scheduledFollowUpsCount: scheduledFollowUps.length,
          scheduledFollowUps: scheduledFollowUps.slice(0, 25),
          contactedNeedingFollowUpCount: needingFollowUp.length,
          contactedNeedingFollowUp: needingFollowUp.slice(0, 25),
          followUpSequences: (seqRes.data || []).map((s) => ({
            id: s.id,
            name: s.name,
            description: s.description,
            isActive: Boolean(s.is_active),
            stepsCount: Array.isArray(s.steps) ? s.steps.length : 0,
            steps: s.steps || [],
          })),
        };
      }

      case 'search_documents_and_templates': {
        const { query = '' } = input || {};
        const qLower = String(query || '').trim().toLowerCase();

        const [templatesRes, settings, signatures] = await Promise.all([
          supabaseAdmin.from('email_templates').select('id, name, subject, category, created_at').limit(50),
          getWorkspaceSettings().catch(() => ({ stats: {} })),
          getAllSignaturesAsync().catch(() => []),
        ]);

        const docs = (settings?.stats?.custom_documents || []).filter(
          (d) => !qLower || `${d.name || ''} ${d.fileName || ''} ${d.category || ''}`.toLowerCase().includes(qLower)
        );
        const templates = (templatesRes.data || []).filter(
          (t) => !qLower || `${t.name || ''} ${t.subject || ''} ${t.category || ''}`.toLowerCase().includes(qLower)
        );
        const sigs = (signatures || []).filter(
          (s) => !qLower || `${s.name || ''} ${s.senderName || ''} ${s.senderEmail || ''}`.toLowerCase().includes(qLower)
        );

        return {
          documentsCount: docs.length,
          documents: docs.map((d) => ({
            id: d.id,
            name: d.name || d.fileName,
            fileType: d.fileType || d.mimeType || 'document',
            uploadedAt: d.uploadedAt || d.createdAt,
          })),
          templatesCount: templates.length,
          templates: templates.map((t) => ({
            id: t.id,
            name: t.name,
            subject: t.subject,
            category: t.category,
          })),
          signaturesCount: sigs.length,
          signatures: sigs.map((s) => ({
            id: s.id,
            name: s.name,
            isDefault: Boolean(s.isDefault),
            senderName: s.senderName || '',
            senderEmail: s.senderEmail || '',
          })),
        };
      }

      default:
        return { error: `Unknown CRM tool: ${name}` };
    }
  } catch (err) {
    console.error(`[MineTech AI Tool Error: ${name}]`, err);
    return { error: err.message || 'Tool execution failed' };
  }
}

/* ========================================================================== */
/* CLAUDE EXECUTION WITH CONTROLLED CONTEXT & MULTI-TURN TOOL USE             */
/* ========================================================================== */

export async function executeClaudeChat({
  messages = [],
  model = DEFAULT_MODEL_ID,
  systemPrompt = null,
  enableThinking = false,
  maxTokens = null,
  temperature = 0.7,
}) {
  const apiKey = (process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY || '').trim();
  if (!apiKey) {
    throw new Error('MineTech AI API key is not configured (ANTHROPIC_API_KEY).');
  }

  const validModels = Object.values(CLAUDE_MODELS).map((m) => m.id);
  const selectedModel = validModels.includes(model) ? model : DEFAULT_MODEL_ID;

  // Controlled context window: keep last MAX_CONTEXT_MESSAGES turns to avoid unbounded token growth
  const trimmedHistory = messages.length > MAX_CONTEXT_MESSAGES
    ? messages.slice(-MAX_CONTEXT_MESSAGES)
    : messages;

  let conversationMessages = trimmedHistory.map((msg) => ({
    role: msg.role === 'assistant' ? 'assistant' : 'user',
    content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
  }));

  // Anthropic requires first message to have role 'user'
  while (conversationMessages.length > 0 && conversationMessages[0].role !== 'user') {
    conversationMessages.shift();
  }

  if (conversationMessages.length === 0) {
    throw new Error('Chat request must include at least one user message.');
  }

  const effectiveSystemPrompt = systemPrompt || GENERAL_SYSTEM_PROMPT;

  const payload = {
    model: selectedModel,
    system: effectiveSystemPrompt,
    messages: conversationMessages,
    tools: CRM_READ_TOOLS,
    max_tokens: maxTokens || (enableThinking ? 8192 : 4096),
  };

  if (enableThinking && (selectedModel.includes('sonnet') || selectedModel.includes('opus'))) {
    payload.thinking = { type: 'enabled', budget_tokens: 1024 };
  } else {
    payload.temperature = temperature;
  }

  const startTime = Date.now();
  let currentTurn = 0;
  const maxToolTurns = 5;
  let finalData = null;
  let totalUsage = { input_tokens: 0, output_tokens: 0 };
  const toolsUsed = [];

  while (currentTurn < maxToolTurns) {
    currentTurn++;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), ANTHROPIC_TIMEOUT_MS);

    let res;
    try {
      res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } catch (fetchErr) {
      clearTimeout(timeoutId);
      if (fetchErr.name === 'AbortError') {
        throw new Error('MineTech AI request timed out. Please try again.');
      }
      throw fetchErr;
    } finally {
      clearTimeout(timeoutId);
    }

    if (!res.ok) {
      const errorJson = await res.json().catch(() => ({}));
      const errorMessage = errorJson.error?.message || `MineTech AI error (${res.status})`;
      throw new Error(`MineTech AI Error: ${errorMessage}`);
    }

    finalData = await res.json();
    if (finalData.usage) {
      totalUsage.input_tokens += finalData.usage.input_tokens || 0;
      totalUsage.output_tokens += finalData.usage.output_tokens || 0;
    }

    if (finalData.stop_reason !== 'tool_use') {
      break;
    }

    const toolUseBlocks = (finalData.content || []).filter((b) => b.type === 'tool_use');
    if (toolUseBlocks.length === 0) break;

    payload.messages.push({
      role: 'assistant',
      content: finalData.content,
    });

    const toolResultContent = [];
    for (const toolBlock of toolUseBlocks) {
      toolsUsed.push({ name: toolBlock.name, input: toolBlock.input || {} });
      const toolOutput = await executeCrmTool(toolBlock.name, toolBlock.input);
      toolResultContent.push({
        type: 'tool_result',
        tool_use_id: toolBlock.id,
        content: JSON.stringify(toolOutput),
      });
    }

    payload.messages.push({
      role: 'user',
      content: toolResultContent,
    });
  }

  const responseTimeMs = Date.now() - startTime;
  let replyText = '';
  let thinkingContent = '';

  if (Array.isArray(finalData?.content)) {
    for (const block of finalData.content) {
      if (block.type === 'text') {
        replyText += block.text;
      } else if (block.type === 'thinking') {
        thinkingContent += block.thinking;
      }
    }
  }

  return {
    content: replyText,
    thinking: thinkingContent || null,
    model: finalData?.model || selectedModel,
    usage: totalUsage,
    toolsUsed,
    responseTimeMs,
    stopReason: finalData?.stop_reason,
  };
}

/* ========================================================================== */
/* 100% SUPABASE-PERSISTENT CHAT STORAGE                                      */
/* Primary: chat_conversations & chat_messages tables                         */
/* Fallback (still 100% Supabase PostgreSQL): email_campaigns                 */
/*   with status = 'AI_CHAT_CONVERSATION' (excluded from all campaign views)  */
/* ========================================================================== */

let nativeChatTablesAvailable = null; // null = unknown, true/false cached

function isMissingTableError(error) {
  if (!error) return false;
  const msg = String(error.message || '').toLowerCase();
  return (
    error.code === 'PGRST205' ||
    error.code === '42P01' ||
    msg.includes('could not find the table') ||
    msg.includes('does not exist')
  );
}

function normalizeUserId(userId) {
  return userId && UUID_RE.test(String(userId)) ? String(userId) : null;
}

function mapCampaignRowToConversation(row) {
  const stats = row.stats || {};
  return {
    id: row.id,
    user_id: stats.user_id || row.created_by || null,
    organization_id: stats.organization_id || 'minetech-default',
    title: row.name || 'New Conversation',
    model: stats.model || DEFAULT_MODEL_ID,
    created_at: row.created_at,
    updated_at: row.updated_at || stats.updated_at || row.created_at,
    messages: Array.isArray(stats.messages) ? stats.messages : [],
  };
}

/**
 * List conversations for a user (sorted by updated_at DESC)
 */
export async function listConversations(userId = null) {
  const validUserId = normalizeUserId(userId);

  if (nativeChatTablesAvailable !== false) {
    let query = supabaseAdmin
      .from('chat_conversations')
      .select('id, user_id, title, model, created_at, updated_at')
      .order('updated_at', { ascending: false })
      .limit(100);

    if (validUserId) {
      query = query.or(`user_id.eq.${validUserId},user_id.is.null`);
    }

    const { data, error } = await query;
    if (!error && data) {
      nativeChatTablesAvailable = true;
      return data;
    }
    if (isMissingTableError(error)) {
      nativeChatTablesAvailable = false;
    } else if (error) {
      throw new Error(`Failed to list conversations: ${error.message}`);
    }
  }

  // Supabase PostgreSQL fallback storage
  let fbQuery = supabaseAdmin
    .from('email_campaigns')
    .select('id, name, created_by, stats, created_at, updated_at')
    .eq('status', 'AI_CHAT_CONVERSATION')
    .order('updated_at', { ascending: false })
    .limit(100);

  if (validUserId) {
    fbQuery = fbQuery.or(`created_by.eq.${validUserId},created_by.is.null`);
  }

  const { data: rows, error: fbErr } = await fbQuery;
  if (fbErr) {
    throw new Error(`Failed to list conversations from Supabase: ${fbErr.message}`);
  }

  return (rows || []).map((r) => {
    const conv = mapCampaignRowToConversation(r);
    return {
      id: conv.id,
      user_id: conv.user_id,
      organization_id: conv.organization_id,
      title: conv.title,
      model: conv.model,
      message_count: conv.messages.length,
      created_at: conv.created_at,
      updated_at: conv.updated_at,
    };
  });
}

/**
 * Create a new persistent conversation in Supabase
 */
export async function createConversation({
  title = 'New Conversation',
  model = DEFAULT_MODEL_ID,
  userId = null,
  organizationId = 'minetech-default',
}) {
  const now = new Date().toISOString();
  const validUserId = normalizeUserId(userId);
  const cleanTitle = String(title || 'New Conversation').trim().slice(0, 120) || 'New Conversation';

  if (nativeChatTablesAvailable !== false) {
    const { data, error } = await supabaseAdmin
      .from('chat_conversations')
      .insert({
        title: cleanTitle,
        model: model || DEFAULT_MODEL_ID,
        user_id: validUserId,
        created_at: now,
        updated_at: now,
      })
      .select('*')
      .single();

    if (!error && data) {
      nativeChatTablesAvailable = true;
      return { ...data, messages: [] };
    }
    if (isMissingTableError(error)) {
      nativeChatTablesAvailable = false;
    } else if (error) {
      throw new Error(`Failed to create conversation: ${error.message}`);
    }
  }

  // Supabase PostgreSQL fallback storage
  const { data: inserted, error: fbErr } = await supabaseAdmin
    .from('email_campaigns')
    .insert({
      name: cleanTitle,
      status: 'AI_CHAT_CONVERSATION',
      subject: cleanTitle,
      body_html: '',
      body_plain: '',
      created_by: validUserId,
      stats: {
        is_ai_chat: true,
        user_id: validUserId,
        organization_id: organizationId,
        model: model || DEFAULT_MODEL_ID,
        messages: [],
        updated_at: now,
      },
      created_at: now,
      updated_at: now,
    })
    .select('*')
    .single();

  if (fbErr || !inserted) {
    throw new Error(`Failed to persist new conversation in Supabase: ${fbErr?.message || 'Unknown error'}`);
  }

  return mapCampaignRowToConversation(inserted);
}

/**
 * Get conversation by ID with all persisted messages
 */
export async function getConversation(conversationId, userId = null) {
  if (!conversationId || !UUID_RE.test(String(conversationId))) return null;
  const validUserId = normalizeUserId(userId);

  if (nativeChatTablesAvailable !== false) {
    const { data: conv, error: convErr } = await supabaseAdmin
      .from('chat_conversations')
      .select('*')
      .eq('id', conversationId)
      .maybeSingle();

    if (!convErr && conv) {
      nativeChatTablesAvailable = true;
      if (validUserId && conv.user_id && conv.user_id !== validUserId) {
        return null;
      }
      const { data: msgs, error: msgErr } = await supabaseAdmin
        .from('chat_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (msgErr) throw new Error(`Failed to load messages: ${msgErr.message}`);
      return {
        ...conv,
        messages: msgs || [],
      };
    }
    if (isMissingTableError(convErr)) {
      nativeChatTablesAvailable = false;
    } else if (convErr) {
      throw new Error(`Failed to load conversation: ${convErr.message}`);
    } else {
      return null;
    }
  }

  const { data: row, error: fbErr } = await supabaseAdmin
    .from('email_campaigns')
    .select('*')
    .eq('id', conversationId)
    .eq('status', 'AI_CHAT_CONVERSATION')
    .maybeSingle();

  if (fbErr) {
    throw new Error(`Failed to load conversation from Supabase: ${fbErr.message}`);
  }
  if (!row) return null;

  const conv = mapCampaignRowToConversation(row);
  if (validUserId && conv.user_id && conv.user_id !== validUserId) {
    return null;
  }
  return conv;
}

/**
 * Update conversation title and/or model
 */
export async function updateConversation(conversationId, { title, model } = {}, userId = null) {
  if (!conversationId || !UUID_RE.test(String(conversationId))) {
    throw new Error('Invalid conversation ID');
  }
  const now = new Date().toISOString();

  if (nativeChatTablesAvailable !== false) {
    const updates = { updated_at: now };
    if (title !== undefined) updates.title = String(title).trim().slice(0, 120);
    if (model !== undefined) updates.model = model;

    const { data, error } = await supabaseAdmin
      .from('chat_conversations')
      .update(updates)
      .eq('id', conversationId)
      .select('*')
      .single();

    if (!error && data) {
      nativeChatTablesAvailable = true;
      return data;
    }
    if (isMissingTableError(error)) {
      nativeChatTablesAvailable = false;
    } else if (error) {
      throw new Error(`Failed to update conversation: ${error.message}`);
    }
  }

  const existing = await getConversation(conversationId, userId);
  if (!existing) throw new Error('Conversation not found');

  const nextTitle = title !== undefined ? String(title).trim().slice(0, 120) : existing.title;
  const nextModel = model !== undefined ? model : existing.model;

  const { data: updated, error: fbErr } = await supabaseAdmin
    .from('email_campaigns')
    .update({
      name: nextTitle,
      subject: nextTitle,
      stats: {
        is_ai_chat: true,
        user_id: existing.user_id,
        organization_id: existing.organization_id || 'minetech-default',
        model: nextModel,
        messages: existing.messages || [],
        updated_at: now,
      },
      updated_at: now,
    })
    .eq('id', conversationId)
    .eq('status', 'AI_CHAT_CONVERSATION')
    .select('*')
    .single();

  if (fbErr || !updated) {
    throw new Error(`Failed to update conversation in Supabase: ${fbErr?.message || 'Unknown error'}`);
  }
  return mapCampaignRowToConversation(updated);
}

export async function renameConversation(conversationId, title, userId = null) {
  return await updateConversation(conversationId, { title }, userId);
}

export async function getConversationMessages(conversationId, userId = null) {
  const conv = await getConversation(conversationId, userId);
  return conv ? conv.messages || [] : [];
}

/**
 * Permanently delete conversation and all its messages
 */
export async function deleteConversation(conversationId, userId = null) {
  if (!conversationId || !UUID_RE.test(String(conversationId))) {
    throw new Error('Invalid conversation ID');
  }

  if (nativeChatTablesAvailable !== false) {
    const { error: msgErr } = await supabaseAdmin
      .from('chat_messages')
      .delete()
      .eq('conversation_id', conversationId);

    const { error } = await supabaseAdmin
      .from('chat_conversations')
      .delete()
      .eq('id', conversationId);

    if (!error && !msgErr) {
      nativeChatTablesAvailable = true;
      return { success: true };
    }
    if (isMissingTableError(error) || isMissingTableError(msgErr)) {
      nativeChatTablesAvailable = false;
    } else {
      throw new Error(`Failed to delete conversation: ${(error || msgErr)?.message}`);
    }
  }

  const { error: fbErr } = await supabaseAdmin
    .from('email_campaigns')
    .delete()
    .eq('id', conversationId)
    .eq('status', 'AI_CHAT_CONVERSATION');

  if (fbErr) {
    throw new Error(`Failed to delete conversation from Supabase: ${fbErr.message}`);
  }
  return { success: true };
}

/**
 * Persist a message to Supabase (never silently swallows write errors)
 */
export async function saveChatMessage({
  conversationId,
  role,
  content,
  model = null,
  thinking = null,
  toolCalls = null,
  tokensUsed = null,
}) {
  if (!conversationId || !UUID_RE.test(String(conversationId))) {
    throw new Error('Valid conversationId is required to save chat message');
  }
  const now = new Date().toISOString();

  if (nativeChatTablesAvailable !== false) {
    const { data, error } = await supabaseAdmin
      .from('chat_messages')
      .insert({
        conversation_id: conversationId,
        role,
        content,
        model,
        tokens_used: tokensUsed,
        created_at: now,
      })
      .select('*')
      .single();

    if (!error && data) {
      nativeChatTablesAvailable = true;
      await supabaseAdmin
        .from('chat_conversations')
        .update({ updated_at: now })
        .eq('id', conversationId);
      return data;
    }
    if (isMissingTableError(error)) {
      nativeChatTablesAvailable = false;
    } else if (error) {
      throw new Error(`Failed to save chat message: ${error.message}`);
    }
  }

  // Supabase PostgreSQL fallback storage
  const { data: row, error: fetchErr } = await supabaseAdmin
    .from('email_campaigns')
    .select('*')
    .eq('id', conversationId)
    .eq('status', 'AI_CHAT_CONVERSATION')
    .maybeSingle();

  if (fetchErr || !row) {
    throw new Error(`Conversation not found in Supabase while saving message: ${fetchErr?.message || conversationId}`);
  }

  const stats = row.stats || {};
  const existingMsgs = Array.isArray(stats.messages) ? stats.messages : [];
  const newMsg = {
    id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    conversation_id: conversationId,
    role,
    content,
    model,
    thinking: thinking || null,
    tool_calls: Array.isArray(toolCalls) ? toolCalls : [],
    tokens_used: tokensUsed,
    created_at: now,
  };

  const nextMsgs = [...existingMsgs, newMsg];
  const { error: updateErr } = await supabaseAdmin
    .from('email_campaigns')
    .update({
      stats: {
        ...stats,
        is_ai_chat: true,
        messages: nextMsgs,
        updated_at: now,
      },
      updated_at: now,
    })
    .eq('id', conversationId)
    .eq('status', 'AI_CHAT_CONVERSATION');

  if (updateErr) {
    throw new Error(`Failed to persist chat message in Supabase: ${updateErr.message}`);
  }

  return newMsg;
}
