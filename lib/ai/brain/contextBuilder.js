/**
 * Context Builder - turns CRM rows into compact, injection-safe prompt context.
 *
 * Responsibilities
 *  - Normalise a lead into a small snapshot (token-efficient, limited history).
 *  - Hash the *material* fields so intelligence can be cached and invalidated precisely.
 *  - Render untrusted data inside escaped XML fences.
 *  - Load everything needed from Supabase in two bounded queries (never per-page-load).
 *
 * The pure functions (buildLeadSnapshot, computeContextHash, buildThreadContext, render*)
 * have no I/O so they can be unit-tested without a database.
 */

import crypto from 'crypto';
import { getBrainConfig, PROMPT_VERSIONS } from './config.js';
import { PLAYBOOK_VERSION } from './playbook.js';
import { escapeForFence, stripQuotedReply } from './safety.js';

const clip = (value, max) => {
  if (value === null || value === undefined) return '';
  const text = String(value).replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
};

const asObject = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});

/* -------------------------------------------------------------------------- */
/* Lead snapshot                                                              */
/* -------------------------------------------------------------------------- */

export function buildLeadSnapshot(lead = {}, limits = getBrainConfig().limits) {
  const custom = asObject(lead.custom_fields || lead.customFields);
  const enrich = asObject(lead.enrich_data || lead.enrichData);
  const f = limits.maxFieldChars;

  const conversation = asObject(enrich.conversation_intelligence || custom.conversation_intelligence);
  const legacyStudy = asObject(enrich.ai_intelligence || custom.ai_intelligence);

  return {
    id: lead.id || null,
    company: clip(lead.company, 160),
    contactName: clip(lead.full_name || lead.fullName || [lead.first_name, lead.last_name].filter(Boolean).join(' '), 120),
    firstName: clip(lead.first_name || lead.firstName, 60),
    jobTitle: clip(lead.job_title || lead.jobTitle, 120),
    industry: clip(lead.industry || lead.niche || custom.industry, 160),
    companyType: clip(custom.company_type || custom.companyType, 120),
    country: clip(lead.country || custom.country, 80),
    city: clip(lead.city || custom.city, 80),
    website: clip(lead.website, 200),
    products: clip(
      custom.product_category ||
        custom.productCategory ||
        custom.product_grade ||
        (Array.isArray(lead.tags) ? lead.tags.join(', ') : ''),
      f
    ),
    application: clip(lead.application || custom.application, f),
    requiredSpecifications: clip(custom.required_specifications || custom.requiredSpecifications, f),
    notes: clip(lead.notes || custom.commercial_notes || custom.commercialNotes, f),
    evidence: clip(enrich.rawEvidence || custom.evidence, f),
    status: lead.status || 'NEW',
    pipelineStage: lead.pipeline_stage || lead.pipelineStage || null,
    score: Number.isFinite(Number(lead.score)) ? Number(lead.score) : null,
    // Facts a human or the reply analyser already confirmed. Treated as stronger than model output.
    confirmedFacts: (Array.isArray(conversation.confirmedFacts) ? conversation.confirmedFacts : [])
      .slice(0, 8)
      .map((x) => clip(x, 200)),
    // Prior (legacy) study is used only as light context, never as ground truth.
    legacyStudySummary: clip(legacyStudy.leadSummary, 400),
    humanGuidance: clip(
      legacyStudy.humanOverrideContext || conversation.humanOverrideContext || '',
      f
    ),
  };
}

/** Fields whose change should invalidate cached lead intelligence. */
const MATERIAL_FIELDS = [
  'company',
  'jobTitle',
  'industry',
  'companyType',
  'country',
  'city',
  'website',
  'products',
  'application',
  'requiredSpecifications',
  'notes',
  'evidence',
  'humanGuidance',
];

export function computeContextHash(snapshot, { latestInboundId = null } = {}) {
  const payload = {
    f: MATERIAL_FIELDS.map((k) => String(snapshot?.[k] || '').toLowerCase()),
    facts: (snapshot?.confirmedFacts || []).map((x) => x.toLowerCase()),
    inbound: latestInboundId || null,
    prompt: PROMPT_VERSIONS.leadIntelligence,
    playbook: PLAYBOOK_VERSION,
  };
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

export function renderLeadFence(snapshot) {
  const e = escapeForFence;
  const facts = (snapshot.confirmedFacts || []).map((x) => `    <fact>${e(x)}</fact>`).join('\n');
  return [
    '<untrusted_lead_data>',
    `  <company>${e(snapshot.company)}</company>`,
    `  <contact_name>${e(snapshot.contactName)}</contact_name>`,
    `  <job_title>${e(snapshot.jobTitle)}</job_title>`,
    `  <industry>${e(snapshot.industry)}</industry>`,
    `  <company_type>${e(snapshot.companyType)}</company_type>`,
    `  <location>${e([snapshot.city, snapshot.country].filter(Boolean).join(', '))}</location>`,
    `  <website>${e(snapshot.website)}</website>`,
    `  <products_or_materials>${e(snapshot.products)}</products_or_materials>`,
    `  <application>${e(snapshot.application)}</application>`,
    `  <required_specifications>${e(snapshot.requiredSpecifications)}</required_specifications>`,
    `  <crm_notes>${e(snapshot.notes)}</crm_notes>`,
    `  <evidence>${e(snapshot.evidence)}</evidence>`,
    `  <crm_status>${e(snapshot.status)}</crm_status>`,
    facts ? `  <confirmed_facts>\n${facts}\n  </confirmed_facts>` : '  <confirmed_facts/>',
    snapshot.legacyStudySummary
      ? `  <previous_study_summary>${e(snapshot.legacyStudySummary)}</previous_study_summary>`
      : '',
    snapshot.humanGuidance ? `  <salesperson_guidance>${e(snapshot.humanGuidance)}</salesperson_guidance>` : '',
    '</untrusted_lead_data>',
  ]
    .filter(Boolean)
    .join('\n');
}

/* -------------------------------------------------------------------------- */
/* Thread context                                                             */
/* -------------------------------------------------------------------------- */

/**
 * @param {Array<{id?:string, direction:string, subject?:string, body_plain?:string, sent_at?:string, created_at?:string}>} messages
 */
export function buildThreadContext(messages = [], limits = getBrainConfig().limits) {
  const sorted = [...messages]
    .filter(Boolean)
    .sort((a, b) => new Date(a.sent_at || a.created_at || 0) - new Date(b.sent_at || b.created_at || 0))
    .slice(-limits.maxThreadMessages);

  return sorted.map((m) => {
    const inbound = String(m.direction || '').toLowerCase() === 'inbound';
    const body = inbound ? stripQuotedReply(m.body_plain || '') : String(m.body_plain || '');
    return {
      id: m.id || null,
      direction: inbound ? 'inbound' : 'outbound',
      subject: clip(m.subject, 200),
      body: clip(body, limits.maxMessageChars),
      at: m.sent_at || m.created_at || null,
    };
  });
}

export function renderThreadFence(thread = []) {
  if (!thread.length) return '<thread_history/>';
  const items = thread
    .map(
      (m, i) =>
        `  <message n="${i + 1}" direction="${m.direction}" at="${escapeForFence(m.at || '')}">\n` +
        `    <subject>${escapeForFence(m.subject)}</subject>\n` +
        `    <body>${escapeForFence(m.body)}</body>\n` +
        '  </message>'
    )
    .join('\n');
  return `<thread_history>\n${items}\n</thread_history>`;
}

/* -------------------------------------------------------------------------- */
/* Outreach stats (pure)                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Derive counts/timestamps used by the policy engine and decision engine.
 * `messages` must include direction + timestamps (bodies optional).
 */
export function computeOutreachStats(messages = [], now = new Date()) {
  const outbound = messages.filter((m) => String(m.direction).toLowerCase() === 'outbound');
  const inbound = messages.filter((m) => String(m.direction).toLowerCase() === 'inbound');
  const ts = (m) => new Date(m.sent_at || m.created_at || 0).getTime();

  const lastOutboundAt = outbound.length ? new Date(Math.max(...outbound.map(ts))).toISOString() : null;
  const lastInboundAt = inbound.length ? new Date(Math.max(...inbound.map(ts))).toISOString() : null;

  const repliedAfterLastOutbound =
    lastInboundAt && (!lastOutboundAt || new Date(lastInboundAt) > new Date(lastOutboundAt));

  return {
    outboundCount: outbound.length,
    inboundCount: inbound.length,
    // First outbound is the initial email, every later one counts as a follow-up.
    followUpCount: Math.max(0, outbound.length - 1),
    lastOutboundAt,
    lastInboundAt,
    unansweredInbound: Boolean(repliedAfterLastOutbound),
    hoursSinceLastOutbound: lastOutboundAt ? (now.getTime() - new Date(lastOutboundAt).getTime()) / 36e5 : null,
    now: now.toISOString(),
  };
}

/* -------------------------------------------------------------------------- */
/* Loaders (Supabase)                                                         */
/* -------------------------------------------------------------------------- */

async function defaultDb() {
  const mod = await import('../../supabase.js');
  return mod.supabaseAdmin;
}

/**
 * Load a lead plus bounded message history. Two queries, no N+1, no blobs.
 * `db` is injectable for tests.
 */
export async function loadLeadContext(leadId, { threadId = null, db = null, now = new Date(), light = false } = {}) {
  const client = db || (await defaultDb());
  const limits = getBrainConfig().limits;

  const { data: lead, error } = await client.from('leads').select('*').eq('id', leadId).maybeSingle();
  if (error) throw new Error(`Failed to load lead: ${error.message}`);
  if (!lead) return null;

  // `light` skips message bodies: enough for staleness hashing and policy stats, cheap for GETs.
  const query = client
    .from('email_messages')
    .select(
      light
        ? 'id, thread_id, direction, status, sent_at, created_at'
        : 'id, thread_id, direction, sender, subject, body_plain, status, sent_at, created_at'
    )
    .eq('lead_id', leadId)
    .order('sent_at', { ascending: false })
    .limit(light ? 100 : 24);

  const { data: rows, error: msgErr } = await query;
  const allMessages = msgErr ? [] : rows || [];

  const snapshot = buildLeadSnapshot(lead, limits);
  // Stats are lead-wide; the prompt thread is optionally narrowed to one conversation.
  const threadRows = threadId ? allMessages.filter((m) => m.thread_id === threadId) : allMessages;
  const thread = light ? [] : buildThreadContext(threadRows.slice(0, limits.maxThreadMessages), limits);
  const stats = computeOutreachStats(allMessages, now);
  const latestInbound = allMessages.find((m) => String(m.direction).toLowerCase() === 'inbound') || null;

  return {
    lead,
    snapshot,
    thread,
    messages: allMessages,
    stats,
    latestInbound,
    contextHash: computeContextHash(snapshot, { latestInboundId: latestInbound?.id }),
  };
}
