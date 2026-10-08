/**
 * Policy / Safety Engine - DETERMINISTIC. No model calls. No network.
 *
 * This is the authority layer. Whatever Claude recommends, an action only proceeds if
 * `evaluatePolicy()` allows it. The function is pure (all state is passed in) so every rule
 * is unit-testable and nothing here can be influenced by prompt content.
 *
 * Returns: { allowed, reasons[], blockedBy[], requiresApproval, checks[] }
 */

import { getBrainConfig } from './config.js';
import { isValidEmail, normalizeText } from './safety.js';

/** Actions that cause an email to leave the building. */
export const SEND_ACTIONS = Object.freeze(['SEND_INITIAL_EMAIL', 'SEND_FOLLOW_UP', 'ANSWER_REPLY', 'REQUEST_MEETING']);

/** Actions that never contact the lead; always allowed (STOP_OUTREACH is always safe). */
export const NON_SEND_ACTIONS = Object.freeze(['WAIT', 'RESEARCH_MORE', 'CHANGE_STRATEGY', 'STOP_OUTREACH', 'MANUAL_REVIEW']);

export const BLOCK = Object.freeze({
  DNC: 'DNC',
  UNSUBSCRIBED: 'UNSUBSCRIBED',
  HARD_BOUNCE: 'HARD_BOUNCE',
  INVALID_EMAIL: 'INVALID_EMAIL',
  CAMPAIGN_INACTIVE: 'CAMPAIGN_INACTIVE',
  SEQUENCE_INVALID: 'SEQUENCE_INVALID',
  MAX_FOLLOW_UPS: 'MAX_FOLLOW_UPS',
  DUPLICATE_SEND: 'DUPLICATE_SEND',
  COOLDOWN: 'COOLDOWN',
  NO_PERMISSION: 'NO_PERMISSION',
  APPROVAL_REQUIRED: 'APPROVAL_REQUIRED',
  AUTONOMY_LEVEL: 'AUTONOMY_LEVEL',
  LEAD_STATE: 'LEAD_STATE',
});

const TERMINAL_STATUSES = new Set(['NOT_INTERESTED', 'LOST', 'CUSTOMER', 'RECURRING_CUSTOMER']);
const DNC_STATUSES = new Set(['DO_NOT_CONTACT', 'DNC']);
const READ_ONLY_ROLES = new Set(['viewer', 'readonly', 'read_only', 'guest']);
const ACTIVE_CAMPAIGN_STATUSES = new Set(['RUNNING']);

const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});

/* -------------------------------------------------------------------------- */
/* Hard-stop detection (shared with the decision engine)                      */
/* -------------------------------------------------------------------------- */

/**
 * Inspect a lead row and list every reason contact is forbidden. Authoritative.
 * @returns {{ dnc:boolean, unsubscribed:boolean, hardBounce:boolean, invalidEmail:boolean, blockers:string[] }}
 */
export function getHardStops(lead = {}, { messages = [] } = {}) {
  const custom = obj(lead.custom_fields || lead.customFields);
  const suppression = obj(lead.suppression);
  const status = String(lead.status || '').toUpperCase();
  const reason = String(lead.dnc_reason || lead.dncReason || '').toLowerCase();

  const flaggedDnc =
    Boolean(lead.is_dnc || lead.isDnc) ||
    DNC_STATUSES.has(status) ||
    Boolean(custom.do_not_contact || custom.opt_out) ||
    Boolean(suppression.isGlobalDnc || suppression.email);

  const unsubscribed = flaggedDnc && (/unsub|opt[\s_-]?out|remove|spam/.test(reason) || Boolean(custom.opt_out));
  const hardBounce =
    (flaggedDnc && /bounce/.test(reason)) ||
    messages.some((m) => String(m.status || '').toLowerCase() === 'bounced' && String(m.direction || '').toLowerCase() === 'outbound');
  const invalidEmail = !isValidEmail(lead.email || '');

  const blockers = [];
  if (flaggedDnc) blockers.push(BLOCK.DNC);
  if (unsubscribed) blockers.push(BLOCK.UNSUBSCRIBED);
  if (hardBounce) blockers.push(BLOCK.HARD_BOUNCE);
  if (invalidEmail) blockers.push(BLOCK.INVALID_EMAIL);

  return { dnc: flaggedDnc, unsubscribed, hardBounce, invalidEmail, blockers };
}

/* -------------------------------------------------------------------------- */
/* Duplicate detection                                                        */
/* -------------------------------------------------------------------------- */

const tokens = (text) => new Set(normalizeText(text).split(' ').filter((w) => w.length > 2));

export function textSimilarity(a, b) {
  const A = tokens(a);
  const B = tokens(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter += 1;
  return inter / (A.size + B.size - inter);
}

export function findDuplicate(candidate = {}, recentOutbound = [], { windowHours, now = new Date(), threshold = 0.85 } = {}) {
  const body = candidate.body || candidate.bodyText || candidate.bodyHtml || '';
  if (!normalizeText(body)) return null;
  const cutoff = now.getTime() - windowHours * 36e5;

  for (const sent of recentOutbound) {
    const at = new Date(sent.sent_at || sent.created_at || 0).getTime();
    if (at < cutoff) continue;
    const sentBody = sent.body_plain || sent.body_html || sent.body || '';
    if (normalizeText(sentBody) === normalizeText(body) || textSimilarity(sentBody, body) >= threshold) {
      return sent;
    }
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/* Main evaluation                                                            */
/* -------------------------------------------------------------------------- */

/**
 * @param {object} input
 * @param {string} input.action                One of NEXT_ACTIONS
 * @param {object} input.lead                  leads row
 * @param {object} [input.stats]               computeOutreachStats() output
 * @param {Array}  [input.messages]            recent email_messages (used for bounce + duplicate)
 * @param {object} [input.candidate]           { subject, body } about to be sent
 * @param {object} [input.campaign]            { status } when the send belongs to a campaign
 * @param {object} [input.sequence]            { status, currentStep, totalSteps } when sequence-driven
 * @param {'human'|'ai'} [input.actor]         who is executing (default human)
 * @param {object} [input.user]                { id, role } of the human executing
 * @param {object} [input.approval]            { approved, approvedBy } for AI-originated drafts
 * @param {'recommend'|'execute'} [input.phase]
 * @param {object} [input.config]              getBrainConfig() override
 * @param {Date}   [input.now]
 */
export function evaluatePolicy({
  action,
  lead,
  stats = {},
  messages = [],
  candidate = null,
  campaign = null,
  sequence = null,
  actor = 'human',
  user = null,
  approval = null,
  phase = 'recommend',
  config = getBrainConfig(),
  now = new Date(),
} = {}) {
  const checks = [];
  const add = (code, ok, detail) => checks.push({ code, ok, detail });

  if (!lead) {
    return { allowed: false, reasons: ['Lead not found'], blockedBy: [BLOCK.LEAD_STATE], requiresApproval: true, checks };
  }

  const isSend = SEND_ACTIONS.includes(action);
  const knownAction = isSend || NON_SEND_ACTIONS.includes(action);

  if (!knownAction) {
    return { allowed: false, reasons: [`Unknown action "${action}"`], blockedBy: [BLOCK.LEAD_STATE], requiresApproval: true, checks };
  }

  // Non-contact actions never need clearance. STOP_OUTREACH in particular must always work.
  if (!isSend) {
    return {
      allowed: true,
      reasons: [`${action} does not contact the lead`],
      blockedBy: [],
      requiresApproval: false,
      checks,
    };
  }

  const policy = config.policy;
  const hard = getHardStops(lead, { messages });
  const status = String(lead.status || '').toUpperCase();

  // 1-4: hard stops (always evaluated, in every phase)
  add(BLOCK.DNC, !hard.dnc, hard.dnc ? 'Lead is on the Do-Not-Contact list' : 'Not DNC');
  add(BLOCK.UNSUBSCRIBED, !hard.unsubscribed, hard.unsubscribed ? 'Lead has unsubscribed' : 'Not unsubscribed');
  add(BLOCK.HARD_BOUNCE, !hard.hardBounce, hard.hardBounce ? 'Previous email hard-bounced' : 'No hard bounce');
  add(BLOCK.INVALID_EMAIL, !hard.invalidEmail, hard.invalidEmail ? 'Lead email address is missing or invalid' : 'Valid email');

  // 5: campaign
  if (campaign) {
    const ok = ACTIVE_CAMPAIGN_STATUSES.has(String(campaign.status || '').toUpperCase());
    add(BLOCK.CAMPAIGN_INACTIVE, ok, ok ? 'Campaign is active' : `Campaign status is ${campaign.status || 'unknown'}`);
  }

  // 6: sequence
  if (sequence) {
    const stepOk = Number.isFinite(sequence.totalSteps) ? (sequence.currentStep ?? 0) < sequence.totalSteps : true;
    const ok = String(sequence.status || '').toLowerCase() === 'active' && stepOk;
    add(BLOCK.SEQUENCE_INVALID, ok, ok ? 'Sequence is active' : 'Sequence is not active or has no remaining steps');
  }

  // 7: follow-up ceiling
  if (action === 'SEND_FOLLOW_UP') {
    const ok = (stats.followUpCount ?? 0) < policy.maxFollowUps;
    add(BLOCK.MAX_FOLLOW_UPS, ok, ok ? 'Under follow-up limit' : `Follow-up limit reached (${policy.maxFollowUps})`);
  }

  // 8: duplicate
  if (candidate) {
    const outbound = messages.filter((m) => String(m.direction || '').toLowerCase() === 'outbound');
    const dup = findDuplicate(candidate, outbound, { windowHours: policy.duplicateWindowHours, now });
    add(BLOCK.DUPLICATE_SEND, !dup, dup ? 'An identical or near-identical email was already sent recently' : 'Not a duplicate');
  }

  // 9: cooldown (not for a prompt answer to a lead who just replied)
  const answeringReply = action === 'ANSWER_REPLY' && stats.unansweredInbound;
  if (!answeringReply && typeof stats.hoursSinceLastOutbound === 'number') {
    const ok = stats.hoursSinceLastOutbound >= policy.cooldownHours;
    add(
      BLOCK.COOLDOWN,
      ok,
      ok ? 'Cooldown respected' : `Last email was ${Math.floor(stats.hoursSinceLastOutbound)}h ago (cooldown ${policy.cooldownHours}h)`
    );
  }

  // 12: lead state must permit this action
  let stateOk = true;
  let stateDetail = 'Lead state permits action';
  if (action === 'SEND_INITIAL_EMAIL' && (stats.outboundCount ?? 0) > 0) {
    stateOk = false;
    stateDetail = 'Lead has already been emailed; use a follow-up instead';
  } else if (action === 'SEND_FOLLOW_UP' && (stats.outboundCount ?? 0) === 0) {
    stateOk = false;
    stateDetail = 'Lead has not been emailed yet; send an initial email first';
  } else if (action === 'SEND_FOLLOW_UP' && stats.unansweredInbound) {
    stateOk = false;
    stateDetail = 'Lead has replied; answer the reply instead of following up';
  } else if (action === 'ANSWER_REPLY' && (stats.inboundCount ?? 0) === 0) {
    stateOk = false;
    stateDetail = 'There is no inbound reply to answer';
  } else if (action !== 'ANSWER_REPLY' && TERMINAL_STATUSES.has(status)) {
    stateOk = false;
    stateDetail = `Lead status ${status} does not permit proactive outreach`;
  }
  add(BLOCK.LEAD_STATE, stateOk, stateDetail);

  // Execution-only gates ----------------------------------------------------
  const requiresApproval = config.autonomyLevel < 2;

  if (phase === 'execute') {
    // 10: who is allowed to execute
    if (actor !== 'human') {
      add(BLOCK.AUTONOMY_LEVEL, false, 'AI Brain v1 is AI-assisted (Level 1); it cannot execute sends');
    }
    const role = String(user?.role || '').toLowerCase();
    const permitted = Boolean(user?.id) && !READ_ONLY_ROLES.has(role);
    add(BLOCK.NO_PERMISSION, permitted, permitted ? 'User may send email' : 'No authenticated user with send permission');

    // 11: AI-originated content must have explicit human approval
    if (requiresApproval) {
      const approved = Boolean(approval?.approved && approval?.approvedBy);
      add(BLOCK.APPROVAL_REQUIRED, approved, approved ? 'Human approval recorded' : 'Human approval is required before sending');
    }
  }

  const failed = checks.filter((c) => !c.ok);
  return {
    allowed: failed.length === 0,
    reasons: failed.map((c) => c.detail),
    blockedBy: [...new Set(failed.map((c) => c.code))],
    requiresApproval,
    checks,
  };
}

/* -------------------------------------------------------------------------- */
/* Convenience: assemble state from a loaded context                          */
/* -------------------------------------------------------------------------- */

/** Build evaluatePolicy() input from loadLeadContext() output. */
export function policyInputFromContext(ctx, extras = {}) {
  return {
    lead: ctx.lead,
    stats: ctx.stats,
    messages: ctx.messages,
    ...extras,
  };
}

/** Sequence info derivable from the lead record (matches sequenceEngine's storage). */
export function sequenceFromLead(lead = {}, totalSteps = null) {
  const custom = obj(lead.custom_fields);
  const seq = custom.emailSequence || custom.email_sequence;
  if (!seq) return null;
  return {
    status: seq.status,
    currentStep: seq.currentStep ?? 0,
    totalSteps: Number.isFinite(totalSteps) ? totalSteps : undefined,
  };
}
