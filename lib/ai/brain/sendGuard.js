/**
 * Send guard for AI-originated drafts.
 *
 * The AI Brain only drafts. When a human sends one of those drafts through an existing send
 * route, the route calls `guardAiDraftSend()` first. It verifies the draft is real, belongs to
 * the lead, was not already sent or rejected, and then runs the full execute-phase policy
 * (DNC, unsubscribe, bounce, duplicate, cooldown, sequence/campaign state, approval).
 * The authenticated human pressing Send is the approval.
 *
 * Routes that are NOT sending an AI draft (no aiDecisionId) are completely unaffected.
 */

import { getBrain } from './MineTechBrain.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const stripHtml = (html = '') => String(html).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * @returns {Promise<{ ok: true, decision: object|null } | { ok: false, status: number, message: string, blockedBy?: string[] }>}
 */
export async function guardAiDraftSend({ aiDecisionId, leadId, subject = '', bodyText = '', bodyHtml = '', user, brain = null }) {
  if (!aiDecisionId) return { ok: true, decision: null };

  if (!UUID_RE.test(String(aiDecisionId))) {
    return { ok: false, status: 400, message: 'Invalid aiDecisionId' };
  }

  const b = brain || getBrain();
  const decision = await b.memory.getDecision(aiDecisionId);
  if (!decision) return { ok: false, status: 404, message: 'AI draft not found' };

  if (!['EMAIL_DRAFT', 'REPLY_DRAFT'].includes(decision.kind) || decision.lead_id !== leadId) {
    return { ok: false, status: 400, message: 'AI draft does not match this lead' };
  }
  if (decision.status === 'SENT') {
    return { ok: false, status: 409, message: 'This AI draft was already sent', blockedBy: ['DUPLICATE_SEND'] };
  }
  if (['REJECTED', 'DISMISSED'].includes(decision.status)) {
    return { ok: false, status: 409, message: 'This AI draft was rejected', blockedBy: ['APPROVAL_REQUIRED'] };
  }

  const policy = await b.checkSendPolicy(leadId, {
    action: decision.kind === 'REPLY_DRAFT' ? 'ANSWER_REPLY' : decision.recommended_action || 'SEND_FOLLOW_UP',
    candidate: { subject, body: bodyText || stripHtml(bodyHtml) },
    user: { id: user?.id || user?._id, role: user?.role },
    approval: { approved: true, approvedBy: user?.id || user?._id },
  });

  if (!policy.allowed) {
    return { ok: false, status: 409, message: `Blocked by send policy: ${policy.reasons.join('; ')}`, blockedBy: policy.blockedBy };
  }

  return { ok: true, decision };
}

/** Best-effort learning-history write after a successful send. Never throws. */
export function recordAiDraftSent({ aiDecisionId, bodyText = '', bodyHtml = '', userId = null, brain = null }) {
  if (!aiDecisionId) return Promise.resolve();
  const b = brain || getBrain();
  return b
    .recordFeedback(aiDecisionId, { action: 'SENT', finalText: bodyText || stripHtml(bodyHtml), userId })
    .catch((err) => console.warn('[AI Brain] Failed to record sent feedback:', err.message));
}
