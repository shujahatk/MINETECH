/**
 * Draft command service - the single entry point for "type 2-4 words, get a personalised email".
 *
 *   { leadId, instruction }
 *     -> interpret the short command (pure)
 *     -> build the full context ONCE (lead, stored research, campaign, thread, status, playbook)
 *     -> resolve it against what is true about the lead (no fake follow-ups, no replies to nobody)
 *     -> hard-stop / safety checks (DNC, unsubscribe, bounce, hostile inbound)
 *     -> ONE Claude request
 *     -> validated + audited + stored draft for a human to review
 *
 * Claude drafts only. Nothing in this module sends or modifies lead data.
 */

import { getBrain } from './brain/MineTechBrain.js';
import { MODEL_NOT_CONFIGURED_MESSAGE } from './modelConfig.js';
import { interpretCommand, resolveCommand } from './commandInterpreter.js';
import { buildDraftContext } from './contextBuilder.js';
import { generateEmailDraft, intentCodeFor } from './emailDraftService.js';

const DRAFT_KINDS = new Set(['EMAIL_DRAFT', 'REPLY_DRAFT']);

function blockedMessage(hard) {
  if (hard.unsubscribed) return 'This lead has unsubscribed. MineTech will not draft or send emails to them.';
  if (hard.hardBounce) return 'The last email to this lead hard-bounced. MineTech will not draft emails to this address.';
  if (hard.invalidEmail && !hard.dnc) return 'This lead has no valid email address.';
  return 'This lead is on the Do-Not-Contact list. MineTech will not draft or send emails to them.';
}

/** Which stored research the draft actually used (shown to the user so the context is never a black box). */
function describeResearch(context) {
  if (context.intelligence.data) {
    return { source: 'AI_BRAIN', status: context.intelligence.status, analyzedAt: context.intelligence.analyzedAt };
  }
  if (context.legacyStudy) return { source: 'LEGACY_STUDY', status: context.legacyStudy.status, analyzedAt: null };
  return { source: 'NONE', status: context.intelligence.status, analyzedAt: null };
}

function describeUsedContext(context, plan) {
  const used = [];
  const research = describeResearch(context);
  if (research.source === 'AI_BRAIN') used.push('Claude research');
  else if (research.source === 'LEGACY_STUDY') used.push('Earlier lead study');
  if (context.campaign?.name) used.push(`Campaign: ${context.campaign.name}`);
  const { outboundCount, inboundCount } = context.stats;
  if (outboundCount) used.push(`${outboundCount} sent email${outboundCount === 1 ? '' : 's'}`);
  if (inboundCount) used.push(`${inboundCount} repl${inboundCount === 1 ? 'y' : 'ies'}`);
  if (context.snapshot.status) used.push(`Status: ${String(context.snapshot.status).toLowerCase()}`);
  if (plan.kind === 'REPLY' && context.previousRecommendation) used.push('Earlier AI recommendation');
  return used;
}

async function findLatestStoredDraft(brain, leadId) {
  try {
    const rows = await brain.memory.listDecisions(leadId, { limit: 6 });
    const row = rows.find((r) => DRAFT_KINDS.has(r.kind) && ['SUGGESTED', 'EDITED', 'APPROVED'].includes(r.status));
    if (!row) return null;
    const subject = row.output?.subject || '';
    const body = row.draft_final || row.draft_original || '';
    return body ? { subject, body } : null;
  } catch {
    return null;
  }
}

const cleanDraft = (draft) => {
  if (!draft || typeof draft !== 'object') return null;
  const body = String(draft.body || '').slice(0, 6000).trim();
  if (!body) return null;
  return { subject: String(draft.subject || '').slice(0, 300).trim(), body };
};

/**
 * @param {{ leadId:string, instruction?:string, threadId?:string|null, campaignId?:string|null,
 *           currentDraft?:{subject?:string, body?:string}|null, surface?:'compose'|'reply', userId?:string|null }} input
 * @param {{ brain?: object, now?: Date, db?: object }} [deps]
 */
export async function runDraftCommand(input, deps = {}) {
  const { leadId, threadId = null, campaignId = null, surface = 'compose', userId = null } = input;
  const brain = deps.brain || getBrain();

  if (!brain.config.enabled) return { status: 'DISABLED', error: 'The AI assistant is turned off for this workspace.' };

  // Cheap guard before any database work: no API key means no draft.
  if (!brain.provider.isConfigured()) {
    return { status: 'FAILED', code: 'NOT_CONFIGURED', error: MODEL_NOT_CONFIGURED_MESSAGE };
  }

  const command = interpretCommand(input.instruction);
  let currentDraft = cleanDraft(input.currentDraft);

  const context = await buildDraftContext(leadId, { threadId, campaignId }, { brain, db: deps.db || null, now: deps.now || new Date() });
  if (!context) return { status: 'NOT_FOUND', error: 'Lead not found.' };

  // Authoritative stops first. These never reach Claude.
  if (context.hardStops.blockers.length) {
    return {
      status: 'BLOCKED',
      code: 'DO_NOT_CONTACT',
      error: blockedMessage(context.hardStops),
      blockedBy: context.hardStops.blockers,
    };
  }

  // "Make it shorter" with nothing on screen: fall back to the last stored AI draft for this lead.
  if (!currentDraft && command.intent === 'REVISE') {
    currentDraft = await findLatestStoredDraft(brain, leadId);
  }

  const plan = resolveCommand(command, {
    outboundCount: context.stats.outboundCount,
    inboundCount: context.stats.inboundCount,
    unansweredInbound: context.stats.unansweredInbound,
    hasDraft: Boolean(currentDraft),
    surface,
  });

  if (plan.blocked) {
    return { status: 'NOT_APPLICABLE', code: plan.code, error: plan.message, suggestion: plan.suggestion };
  }

  const notices = [...plan.notices];

  if (plan.kind === 'REPLY') {
    const sig = context.inboundSignals;
    if (!context.latestInbound) {
      return { status: 'NOT_APPLICABLE', code: 'NO_INBOUND_REPLY', error: 'This lead has not replied yet, so there is nothing to answer.' };
    }
    if (sig.unsubscribe || sig.hardBounce) {
      return {
        status: 'BLOCKED',
        code: 'STOP_SIGNAL',
        error: sig.unsubscribe
          ? 'Their last message asks to stop contact. MineTech will not draft a reply; mark them Do Not Contact.'
          : 'Their last message is a delivery failure notice, not a reply. Check the address instead.',
      };
    }
    if (sig.outOfOffice || sig.wrongPerson) {
      return {
        status: 'NOT_APPLICABLE',
        code: 'AUTOMATED_OR_WRONG_PERSON',
        error: sig.outOfOffice
          ? 'Their last message is an out-of-office reply. Follow up after they are back instead.'
          : 'Their last message says this is the wrong contact. Find the right person rather than replying.',
      };
    }
    if (context.inboundInjectionSuspected) {
      return {
        status: 'NOT_APPLICABLE',
        code: 'SUSPICIOUS_MESSAGE',
        error: 'Their message contains text that looks aimed at an AI. Please read it and reply manually.',
      };
    }
    if (sig.notInterested) notices.push('They said they are not interested. Keep any reply short and respectful, or leave it.');
  }

  if (context.researchAdvice.needed) notices.push(context.researchAdvice.reason);

  const result = await generateEmailDraft({
    brain,
    context,
    plan,
    instruction: command.raw,
    currentDraft,
    userId,
    threadId,
    now: deps.now || new Date(),
  });

  if (result.status !== 'READY') return result;

  return {
    ...result,
    plan: { intent: intentCodeFor(plan), kind: plan.kind, revised: plan.revise, styles: plan.styles },
    notices,
    research: { ...describeResearch(context), recommendAnalysis: context.researchAdvice.needed, advice: context.researchAdvice.reason },
    usedContext: describeUsedContext(context, plan),
    lead: { id: context.lead.id, email: context.lead.email || null },
  };
}
