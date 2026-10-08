/**
 * Decision Engine - Next Best Action.
 *
 * The recommendation is produced by deterministic rules over CRM facts, enriched by what
 * Claude already concluded (lead intelligence, reply classification). Claude's suggestion can
 * only make the outcome MORE conservative (e.g. "needs manual review"), never less - so a
 * hallucinated or injected "send now" cannot create a send. Every candidate action is then
 * run through the policy engine and downgraded if it is not allowed.
 *
 * Pure function: no I/O, no model calls.
 */

import { getBrainConfig } from './config.js';
import { BLOCK, SEND_ACTIONS, evaluatePolicy, getHardStops } from './policyEngine.js';

/** Higher = more conservative (less likely to contact the lead). */
const CONSERVATISM = Object.freeze({
  STOP_OUTREACH: 5,
  MANUAL_REVIEW: 4,
  WAIT: 3,
  RESEARCH_MORE: 2,
  CHANGE_STRATEGY: 2,
  SEND_INITIAL_EMAIL: 0,
  SEND_FOLLOW_UP: 0,
  ANSWER_REPLY: 0,
  REQUEST_MEETING: 0,
});

const hoursFromNow = (hours, now) => new Date(now.getTime() + hours * 36e5).toISOString();

function fromClassification(classification, now) {
  const c = classification.classification;
  switch (c) {
    case 'UNSUBSCRIBE':
      return { action: 'STOP_OUTREACH', reason: 'Lead asked to be removed; contact must stop.', confidence: 1 };
    case 'BOUNCE_OR_INVALID':
      return { action: 'STOP_OUTREACH', reason: 'Email bounced or address is invalid.', confidence: 1 };
    case 'NOT_INTERESTED':
      return { action: 'STOP_OUTREACH', reason: 'Lead said they are not interested.', confidence: Math.max(0.8, classification.confidence || 0) };
    case 'WRONG_PERSON':
      return { action: 'MANUAL_REVIEW', reason: 'Reply says this is the wrong contact; find the right person before any further outreach.', confidence: 0.8 };
    case 'OUT_OF_OFFICE':
      return { action: 'WAIT', reason: 'Automatic out-of-office reply; retry after they are back.', confidence: 0.9, timing: { when: hoursFromNow(24 * 7, now), label: 'in about a week' } };
    case 'NOT_NOW':
      return { action: 'WAIT', reason: 'Lead is interested later, not now.', confidence: 0.8, timing: { when: hoursFromNow(24 * 30, now), label: 'in about a month' } };
    case 'MEETING_REQUEST':
      return { action: 'ANSWER_REPLY', reason: 'Lead asked for a meeting or call; reply with next steps.', confidence: Math.max(0.7, classification.confidence || 0) };
    case 'INTERESTED':
    case 'QUESTION':
    case 'OBJECTION':
      return { action: 'ANSWER_REPLY', reason: `Lead replied (${c.toLowerCase().replace('_', ' ')}); a human-approved answer is the next step.`, confidence: classification.confidence || 0.7 };
    default:
      return { action: 'MANUAL_REVIEW', reason: 'Reply does not fit a clear category; review manually.', confidence: classification.confidence || 0.5 };
  }
}

/**
 * @param {object} input
 * @param {object} input.lead
 * @param {object} input.stats                 computeOutreachStats() output
 * @param {Array}  [input.messages]
 * @param {object|null} [input.intelligence]   validated lead intelligence (or null)
 * @param {object|null} [input.classification] classification of the latest unanswered inbound reply
 * @param {boolean} [input.injectionSuspected]
 * @param {object} [input.config]
 * @param {Date}   [input.now]
 */
export function recommendNextAction({
  lead,
  stats = {},
  messages = [],
  intelligence = null,
  classification = null,
  injectionSuspected = false,
  config = getBrainConfig(),
  now = new Date(),
} = {}) {
  const policyCfg = config.policy;
  const hard = getHardStops(lead || {}, { messages });
  const status = String(lead?.status || '').toUpperCase();

  let pick;

  // 1. Authoritative hard stops
  if (hard.dnc || hard.hardBounce) {
    pick = {
      action: 'STOP_OUTREACH',
      reason: hard.unsubscribed
        ? 'Lead unsubscribed; do not contact.'
        : hard.hardBounce
        ? 'Email hard-bounced; do not contact.'
        : 'Lead is marked Do-Not-Contact.',
      confidence: 1,
    };
  } else if (hard.invalidEmail) {
    pick = { action: 'MANUAL_REVIEW', reason: 'Lead has no valid email address; fix the contact data first.', confidence: 1 };
  } else if (injectionSuspected) {
    // 2. Untrusted content tried to instruct the AI
    pick = {
      action: 'MANUAL_REVIEW',
      reason: 'The latest message appears to contain instructions aimed at the AI; review it manually.',
      confidence: 0.95,
    };
  } else if (classification && stats.unansweredInbound) {
    // 3. React to the latest unanswered reply
    pick = fromClassification(classification, now);
  } else if (stats.unansweredInbound) {
    pick = { action: 'ANSWER_REPLY', reason: 'Lead replied and has not been answered yet.', confidence: 0.7 };
  } else if (status === 'NOT_INTERESTED' || status === 'LOST') {
    pick = { action: 'STOP_OUTREACH', reason: `Lead status is ${status}.`, confidence: 0.9 };
  } else if (['CUSTOMER', 'RECURRING_CUSTOMER'].includes(status)) {
    pick = { action: 'MANUAL_REVIEW', reason: 'Existing customer; handle through the account owner, not outbound.', confidence: 0.9 };
  } else if ((stats.outboundCount ?? 0) === 0) {
    // 4. Never contacted
    if (!intelligence) {
      pick = { action: 'RESEARCH_MORE', reason: 'No lead intelligence yet; analyze the lead before the first email.', confidence: 0.7 };
    } else if (intelligence.companyFit?.rating === 'LOW' && (intelligence.confidence ?? 0) >= 0.6) {
      pick = { action: 'MANUAL_REVIEW', reason: 'Analysis rates this lead a poor fit; confirm before reaching out.', confidence: intelligence.confidence };
    } else if (intelligence.priority === 'COLD' && (intelligence.confidence ?? 0) < 0.5) {
      pick = { action: 'RESEARCH_MORE', reason: 'Too little information to personalize; enrich the lead first.', confidence: 0.6 };
    } else {
      pick = {
        action: 'SEND_INITIAL_EMAIL',
        reason: `${intelligence.priority || 'Qualified'} lead never contacted; a personalized first email is the next step.`,
        confidence: Math.min(0.95, 0.5 + (intelligence.confidence ?? 0) * 0.45),
      };
    }
  } else {
    // 5. Contacted, no reply
    const followUps = stats.followUpCount ?? 0;
    const hours = stats.hoursSinceLastOutbound;
    if (followUps >= policyCfg.maxFollowUps) {
      pick =
        intelligence && intelligence.priority !== 'COLD'
          ? { action: 'CHANGE_STRATEGY', reason: `${followUps} follow-ups sent without a reply; change channel or angle instead of emailing again.`, confidence: 0.75 }
          : { action: 'STOP_OUTREACH', reason: `${followUps} follow-ups sent without a reply on a low-priority lead.`, confidence: 0.8 };
    } else if (typeof hours === 'number' && hours < policyCfg.cooldownHours) {
      pick = {
        action: 'WAIT',
        reason: `Last email was ${Math.floor(hours)}h ago; wait out the ${policyCfg.cooldownHours}h cooldown.`,
        confidence: 0.9,
        timing: {
          when: new Date(new Date(stats.lastOutboundAt).getTime() + policyCfg.cooldownHours * 36e5).toISOString(),
          label: `after ${policyCfg.cooldownHours}h cooldown`,
        },
      };
    } else {
      pick = {
        action: 'SEND_FOLLOW_UP',
        reason: `No reply after ${stats.outboundCount} email${stats.outboundCount === 1 ? '' : 's'}; a follow-up is due.`,
        confidence: 0.7,
      };
    }
  }

  // Claude may only push the decision toward MORE caution.
  const modelSuggestion = classification?.recommendedAction || intelligence?.recommendedAction || null;
  const modelConfidence = classification?.confidence ?? intelligence?.confidence ?? 0;
  let adoptedModel = false;
  if (
    modelSuggestion &&
    modelSuggestion in CONSERVATISM &&
    CONSERVATISM[modelSuggestion] > CONSERVATISM[pick.action] &&
    modelConfidence >= 0.6
  ) {
    // A model-only "stop" is softened to a human review: only deterministic facts or the
    // lead's own words may end outreach on their own.
    const adopted = modelSuggestion === 'STOP_OUTREACH' ? 'MANUAL_REVIEW' : modelSuggestion;
    if (CONSERVATISM[adopted] > CONSERVATISM[pick.action]) {
      pick = {
        action: adopted,
        reason: `AI analysis suggests ${modelSuggestion.replace(/_/g, ' ').toLowerCase()} instead of ${pick.action
          .replace(/_/g, ' ')
          .toLowerCase()}; routed for human review.`,
        confidence: modelConfidence,
      };
      adoptedModel = true;
    }
  }

  // Policy gate: a recommended send must actually be allowed.
  let policy = evaluatePolicy({ action: pick.action, lead, stats, messages, phase: 'recommend', config, now });
  let downgradedFrom = null;

  if (SEND_ACTIONS.includes(pick.action) && !policy.allowed) {
    downgradedFrom = pick.action;
    const blocked = policy.blockedBy;
    let fallback;
    if (blocked.some((b) => [BLOCK.DNC, BLOCK.UNSUBSCRIBED, BLOCK.HARD_BOUNCE].includes(b))) {
      fallback = { action: 'STOP_OUTREACH', reason: `Policy blocked ${pick.action}: ${policy.reasons.join('; ')}` };
    } else if (blocked.includes(BLOCK.COOLDOWN)) {
      fallback = { action: 'WAIT', reason: `Policy blocked ${pick.action}: ${policy.reasons.join('; ')}` };
    } else if (blocked.includes(BLOCK.MAX_FOLLOW_UPS)) {
      fallback = { action: 'CHANGE_STRATEGY', reason: `Policy blocked ${pick.action}: ${policy.reasons.join('; ')}` };
    } else {
      fallback = { action: 'MANUAL_REVIEW', reason: `Policy blocked ${pick.action}: ${policy.reasons.join('; ')}` };
    }
    pick = { ...pick, ...fallback, confidence: Math.min(pick.confidence ?? 0.8, 0.9) };
    policy = evaluatePolicy({ action: pick.action, lead, stats, messages, phase: 'recommend', config, now });
  }

  return {
    action: pick.action,
    reason: pick.reason,
    confidence: Math.round((pick.confidence ?? 0.5) * 100) / 100,
    timing: pick.timing || (SEND_ACTIONS.includes(pick.action) ? { when: now.toISOString(), label: 'now (after human approval)' } : null),
    draft: null,
    policy: { allowed: policy.allowed, reasons: policy.reasons, blockedBy: policy.blockedBy, requiresApproval: policy.requiresApproval },
    requiresApproval: SEND_ACTIONS.includes(pick.action),
    downgradedFrom,
    modelSuggestion,
    adoptedModelCaution: adoptedModel,
  };
}
