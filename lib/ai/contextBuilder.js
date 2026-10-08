/**
 * Draft context builder - gathers EVERYTHING Claude needs to write a personalised email so the
 * user never has to type it.
 *
 * This is deliberately a thin composition layer. It reuses what already exists:
 *   - lead + message history + outreach stats ........ brain/contextBuilder.loadLeadContext
 *   - stored Claude research (ai_lead_intelligence) .. brain.getIntelligenceForContext (cached, no Claude call)
 *   - older study (leads.enrich_data.ai_intelligence)  compacted below, used as supporting context
 *   - campaign + objective ........................... email_recipients -> email_campaigns (read-only)
 *   - previous AI recommendation ..................... latest stored reply classification
 *   - MineTech playbook ............................... brain/playbook (added later by the prompt builder)
 *
 * Cost: one lead query, one message query (inside loadLeadContext) plus three small parallel
 * reads. No Claude call and no research is re-run here.
 */

import { loadLeadContext } from './brain/contextBuilder.js';
import { getHardStops } from './brain/policyEngine.js';
import { detectPromptInjection, detectStopSignals, stripQuotedReply } from './brain/safety.js';
import { ANALYSIS_STATUS } from './brain/schemas.js';

const clip = (value, max) => {
  if (value === null || value === undefined) return '';
  const text = String(value).replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
};

const list = (value, maxItems, maxLen) =>
  (Array.isArray(value) ? value : []).map((x) => clip(typeof x === 'object' ? x?.claim || x?.text || '' : x, maxLen)).filter(Boolean).slice(0, maxItems);

// The legacy analyser fills this in when Claude omits it. It is boilerplate, not research.
const LEGACY_DEFAULT_ANGLE = /^highlight reliable supply security/i;

/**
 * Compact the older per-lead study (kept in leads.enrich_data.ai_intelligence) so it can be reused
 * as supporting context. Pure.
 */
export function compactLegacyStudy(lead = {}) {
  const enrich = lead.enrich_data || lead.enrichData || {};
  const custom = lead.custom_fields || lead.customFields || {};
  const study = enrich.ai_intelligence || custom.ai_intelligence;
  if (!study || typeof study !== 'object' || !study.leadSummary) return null;

  const angle = clip(study.recommendedAngle, 300);
  return {
    status: String(study.status || 'CURRENT').toUpperCase(),
    summary: clip(study.leadSummary, 500),
    fit: clip(study.fitReason, 300),
    relevance: clip(study.relevance, 20),
    products: list(study.productsOfInterest, 6, 80),
    hooks: list(study.personalizationPoints, 4, 200),
    questions: list(study.questionsToConfirm, 4, 200),
    angle: angle && !LEGACY_DEFAULT_ANGLE.test(angle) ? angle : '',
    humanGuidance: clip(study.humanOverrideContext, 400),
  };
}

async function defaultDb() {
  const mod = await import('../supabase.js');
  return mod.supabaseAdmin;
}

/** Most recent campaign this lead belongs to (or the requested one). Never throws. */
export async function loadLeadCampaign(leadId, { campaignId = null, db = null } = {}) {
  try {
    const client = db || (await defaultDb());
    let q = client
      .from('email_recipients')
      .select('campaign_id, status, email_campaigns(id, name, subject, status, campaign_type, master_prompt)')
      .eq('lead_id', leadId);
    if (campaignId) q = q.eq('campaign_id', campaignId);
    const { data, error } = await q.order('scheduled_at', { ascending: false }).limit(1);
    if (error || !data?.length) return null;

    const row = data[0];
    const camp = Array.isArray(row.email_campaigns) ? row.email_campaigns[0] : row.email_campaigns;
    if (!camp) return null;
    return {
      id: camp.id || row.campaign_id,
      name: clip(camp.name, 120),
      subject: clip(camp.subject, 160),
      status: String(camp.status || '').toUpperCase(),
      type: clip(camp.campaign_type, 40),
      // master_prompt is the campaign objective written by the campaign owner.
      objective: clip(camp.master_prompt, 400),
      recipientStatus: String(row.status || '').toUpperCase(),
    };
  } catch {
    return null;
  }
}

/** Latest stored classification of an inbound reply, reused as the "previous AI recommendation". */
async function loadPreviousRecommendation(memory, leadId) {
  try {
    const rows = await memory.listDecisions(leadId, { kind: 'CLASSIFICATION', limit: 1 });
    const out = rows?.[0]?.output;
    const c = out?.classification;
    if (!c) return null;
    return {
      classification: c.classification || null,
      intent: clip(c.intent, 160),
      summary: clip(c.summary, 240),
      recommendedAction: c.recommendedAction || rows[0].recommended_action || null,
    };
  } catch {
    return null;
  }
}

/**
 * @returns {Promise<null | {
 *   lead, snapshot, thread, messages, stats, contextHash,
 *   latestInbound: { id, subject, body, at } | null,
 *   inboundInjectionSuspected: boolean,
 *   inboundSignals: { unsubscribe, hardBounce, outOfOffice, wrongPerson, notInterested },
 *   hardStops, intelligence: { status, data, analyzedAt }, legacyStudy, campaign,
 *   previousRecommendation, researchAdvice: { needed:boolean, reason:string|null }
 * }>}
 */
export async function buildDraftContext(leadId, { threadId = null, campaignId = null } = {}, deps = {}) {
  const { brain, loadContext = loadLeadContext, db = null, now = new Date() } = deps;
  if (!brain) throw new Error('buildDraftContext requires a brain instance');

  const ctx = await loadContext(leadId, { db, threadId, now });
  if (!ctx) return null;

  // Everything below is independent, so it runs in parallel.
  const [intel, campaign, previousRecommendation] = await Promise.all([
    brain.getIntelligenceForContext(ctx).catch(() => ({ status: ANALYSIS_STATUS.NOT_ANALYZED, intelligence: null })),
    loadLeadCampaign(leadId, { campaignId, db }),
    loadPreviousRecommendation(brain.memory, leadId),
  ]);

  const legacyStudy = compactLegacyStudy(ctx.lead);

  const inboundRow = ctx.latestInbound ? ctx.messages.find((m) => m.id === ctx.latestInbound.id) || ctx.latestInbound : null;
  const inboundBody = inboundRow ? stripQuotedReply(inboundRow.body_plain || '') : '';
  const latestInbound = inboundRow
    ? { id: inboundRow.id, threadId: inboundRow.thread_id || null, subject: clip(inboundRow.subject, 200), body: clip(inboundBody, 2000), at: inboundRow.sent_at || inboundRow.created_at || null }
    : null;

  const injection = detectPromptInjection(`${inboundRow?.subject || ''}\n${inboundBody}`);
  const stop = inboundRow
    ? detectStopSignals({ text: inboundRow.body_plain || '', subject: inboundRow.subject || '', from: inboundRow.sender || '' })
    : {};

  // Research advice: recommend analysis when nothing usable is stored. We never run it
  // implicitly (that would be a second Claude call and slow the command down).
  const usable = intel.status === ANALYSIS_STATUS.READY || intel.status === ANALYSIS_STATUS.STALE;
  const legacyUsable = legacyStudy && legacyStudy.status !== 'OUTDATED';
  let researchAdvice = { needed: false, reason: null };
  if (!usable && !legacyUsable) {
    researchAdvice = { needed: true, reason: 'No stored research for this lead yet. The draft uses CRM fields only.' };
  } else if (intel.status === ANALYSIS_STATUS.STALE || (!usable && legacyStudy?.status === 'OUTDATED')) {
    researchAdvice = { needed: true, reason: 'Stored research is out of date because the lead changed since it was analysed.' };
  }

  return {
    lead: ctx.lead,
    snapshot: ctx.snapshot,
    thread: ctx.thread,
    messages: ctx.messages,
    stats: ctx.stats,
    contextHash: ctx.contextHash,
    latestInbound,
    inboundInjectionSuspected: injection.suspected,
    inboundSignals: {
      unsubscribe: Boolean(stop.unsubscribe),
      hardBounce: Boolean(stop.hardBounce),
      outOfOffice: Boolean(stop.outOfOffice),
      wrongPerson: Boolean(stop.wrongPerson),
      notInterested: Boolean(stop.notInterested),
    },
    hardStops: getHardStops(ctx.lead, { messages: ctx.messages }),
    intelligence: {
      status: intel.status,
      data: usable ? intel.intelligence : null,
      analyzedAt: intel.analyzedAt || null,
    },
    legacyStudy,
    campaign,
    previousRecommendation,
    researchAdvice,
  };
}
