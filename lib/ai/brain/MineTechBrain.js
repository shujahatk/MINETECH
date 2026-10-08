/**
 * MineTechBrain - orchestrator for the AI decision layer.
 *
 *   Lead / Reply -> Context Builder -> Claude (via AIProvider) -> Structured Decision
 *        -> Policy / Safety Engine -> MineTech action (human) -> Supabase audit + learning
 *
 * Autonomy LEVEL 1: this class analyses, classifies, recommends and drafts. It has no
 * method that sends an email, changes DNC in the permissive direction, edits config, or
 * deletes data. The only write it makes to a lead is the protective stop-contact rule.
 *
 * Every collaborator is injectable so the whole pipeline is testable without network/DB.
 */

import { getBrainConfig, PROMPT_VERSIONS } from './config.js';
import { getPlaybook } from './playbook.js';
import { loadLeadContext, computeContextHash } from './contextBuilder.js';
import {
  buildLeadIntelligencePrompt,
  buildEmailPersonalizationPrompt,
  buildReplyClassificationPrompt,
  buildReplyDraftPrompt,
  JSON_REPAIR_NOTICE,
} from './prompts.js';
import {
  ANALYSIS_STATUS,
  SchemaError,
  extractJson,
  validateLeadIntelligence,
  validateEmailDraft,
  validateReplyClassification,
  validateReplyDraft,
} from './schemas.js';
import { detectStopSignals, detectPromptInjection, auditDraft, stripModelSignature, stripQuotedReply } from './safety.js';
import { evaluatePolicy, getHardStops, sequenceFromLead } from './policyEngine.js';
import { recommendNextAction } from './decisionEngine.js';
import { MemoryService } from './memoryService.js';
import { enforceInboundStopSignals } from './stopContact.js';
import { AIProviderError } from '../providers/AIProvider.js';
import { getAIProvider } from '../providers/index.js';
import { MODEL_NOT_CONFIGURED_MESSAGE } from '../modelConfig.js';

const NO_DRAFT_CLASSES = new Set(['UNSUBSCRIBE', 'BOUNCE_OR_INVALID', 'OUT_OF_OFFICE', 'NOT_INTERESTED', 'WRONG_PERSON']);

export class MineTechBrain {
  constructor({
    provider = null,
    memory = null,
    config = null,
    playbook = null,
    loadContext = loadLeadContext,
    stopEnforcer = enforceInboundStopSignals,
    now = () => new Date(),
    db = null,
  } = {}) {
    this._provider = provider;
    this.config = config || getBrainConfig();
    this.playbook = playbook || getPlaybook();
    this.memory = memory || new MemoryService({ db, now });
    this.loadContext = loadContext;
    this.stopEnforcer = stopEnforcer;
    this.now = now;
    this.db = db;
  }

  get provider() {
    return this._provider || getAIProvider();
  }

  /* ------------------------------------------------------------------------ */
  /* Core: one structured Claude request with validation + single repair retry */
  /* ------------------------------------------------------------------------ */

  async #askJson({ system, messages, maxTokens, validate }) {
    const provider = this.provider;
    if (!provider.isConfigured()) {
      throw new AIProviderError('AI provider is not configured', { code: 'NOT_CONFIGURED' });
    }

    const attempts = 1 + this.config.provider.maxJsonRepairAttempts;
    let lastError = null;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const outgoing =
        attempt === 0
          ? messages
          : messages.map((m, i) => (i === messages.length - 1 ? { ...m, content: `${m.content}\n\n${JSON_REPAIR_NOTICE}` } : m));

      const result = await provider.complete({ system, messages: outgoing, maxTokens });
      try {
        const value = validate(extractJson(result.text));
        return { value, model: result.model, usage: result.usage, attempts: attempt + 1 };
      } catch (err) {
        if (!(err instanceof SchemaError)) throw err;
        lastError = err;
      }
    }
    throw lastError;
  }

  /**
   * Public wrapper over the single-request structured call (validation + one JSON repair retry).
   * Used by the short-command drafting service so it shares the provider, config and safety
   * behaviour of the rest of the Brain instead of re-implementing them.
   */
  askStructured(args) {
    return this.#askJson(args);
  }

  /**
   * Stored intelligence + freshness for an already-loaded context. Read-only, never calls
   * Claude, and avoids a second lead/message load.
   */
  async getIntelligenceForContext(ctx) {
    const stored = await this.memory.getIntelligence(ctx.lead.id);
    return this.#shapeIntelligence(stored, ctx.contextHash);
  }

  /* ------------------------------------------------------------------------ */
  /* Lead intelligence                                                        */
  /* ------------------------------------------------------------------------ */

  /** Read-only: cached intelligence + freshness. Never calls Claude. */
  async getIntelligenceState(leadId) {
    const ctx = await this.loadContext(leadId, { db: this.db, now: this.now(), light: true });
    if (!ctx) return null;
    const stored = await this.memory.getIntelligence(leadId);
    return this.#shapeIntelligence(stored, ctx.contextHash);
  }

  #shapeIntelligence(stored, currentHash) {
    if (!stored) return { status: ANALYSIS_STATUS.NOT_ANALYZED, intelligence: null };

    let status = stored.status;
    if (status === ANALYSIS_STATUS.PENDING) {
      const age = this.now().getTime() - new Date(stored.updatedAt || 0).getTime();
      if (age > this.config.limits.pendingStaleAfterMs) status = ANALYSIS_STATUS.FAILED;
    }
    if (status === ANALYSIS_STATUS.READY && stored.sourceHash !== currentHash) status = ANALYSIS_STATUS.STALE;

    return {
      status,
      intelligence: stored.data,
      model: stored.model,
      promptVersion: stored.promptVersion,
      analyzedAt: stored.analyzedAt,
      updatedAt: stored.updatedAt,
      error: status === ANALYSIS_STATUS.FAILED ? stored.error || 'Analysis did not complete' : null,
    };
  }

  /**
   * Analyze a lead (human-triggered). Reuses cached output unless the lead materially changed
   * or `force` is set.
   */
  async analyzeLead(leadId, { force = false } = {}) {
    if (!this.config.enabled) return { status: 'DISABLED', intelligence: null };

    const ctx = await this.loadContext(leadId, { db: this.db, now: this.now(), light: false });
    if (!ctx) throw new Error('Lead not found');

    const stored = await this.memory.getIntelligence(leadId);
    const current = this.#shapeIntelligence(stored, ctx.contextHash);

    if (!force) {
      if (current.status === ANALYSIS_STATUS.READY) return { ...current, cached: true };
      if (current.status === ANALYSIS_STATUS.PENDING) return { ...current, cached: true };
      // Do not hammer Claude after a recent failure on unchanged input.
      if (
        current.status === ANALYSIS_STATUS.FAILED &&
        stored?.sourceHash === ctx.contextHash &&
        this.now().getTime() - new Date(stored.updatedAt || 0).getTime() < this.config.limits.failedRetryAfterMs
      ) {
        return { ...current, cached: true };
      }
    }

    if (!this.provider.isConfigured()) {
      return {
        status: ANALYSIS_STATUS.FAILED,
        intelligence: stored?.data || null,
        error: MODEL_NOT_CONFIGURED_MESSAGE,
        code: 'NOT_CONFIGURED',
      };
    }

    await this.memory.markPending(leadId, { sourceHash: ctx.contextHash });

    try {
      const prompt = buildLeadIntelligencePrompt({ snapshot: ctx.snapshot, playbook: this.playbook });
      const { value, model } = await this.#askJson({ ...prompt, validate: validateLeadIntelligence });

      await this.memory.saveIntelligence(leadId, {
        data: value,
        sourceHash: ctx.contextHash,
        promptVersion: PROMPT_VERSIONS.leadIntelligence,
        model,
      });

      return {
        status: ANALYSIS_STATUS.READY,
        intelligence: value,
        model,
        analyzedAt: this.now().toISOString(),
        cached: false,
      };
    } catch (err) {
      const message = err instanceof SchemaError ? 'Claude returned an invalid analysis. Try again.' : err.message || 'Analysis failed';
      await this.memory.saveFailure(leadId, { error: message, sourceHash: ctx.contextHash }).catch(() => {});
      return {
        status: ANALYSIS_STATUS.FAILED,
        // Keep any previous good study visible; never fabricate a replacement.
        intelligence: stored?.data || null,
        error: message,
        code: err.code || (err instanceof SchemaError ? 'INVALID_JSON' : 'ERROR'),
      };
    }
  }

  /* ------------------------------------------------------------------------ */
  /* Email personalization                                                    */
  /* ------------------------------------------------------------------------ */

  async personalizeEmail(leadId, { objective = 'Open a conversation', kind = 'INITIAL', userId = null, threadId = null } = {}) {
    if (!this.config.enabled) return { status: 'DISABLED' };

    const ctx = await this.loadContext(leadId, { db: this.db, threadId, now: this.now() });
    if (!ctx) throw new Error('Lead not found');

    const action = kind === 'FOLLOW_UP' ? 'SEND_FOLLOW_UP' : 'SEND_INITIAL_EMAIL';
    const policy = evaluatePolicy({
      action,
      lead: ctx.lead,
      stats: ctx.stats,
      messages: ctx.messages,
      sequence: sequenceFromLead(ctx.lead),
      phase: 'recommend',
      config: this.config,
      now: this.now(),
    });

    // Never spend tokens drafting for someone who must not be contacted.
    const hard = getHardStops(ctx.lead, { messages: ctx.messages });
    if (hard.blockers.length) {
      return { status: 'BLOCKED', policy, reason: policy.reasons.join('; ') };
    }

    const stored = await this.memory.getIntelligence(leadId);
    const intel = this.#shapeIntelligence(stored, ctx.contextHash);
    const intelligence = intel.intelligence || null;

    try {
      const prompt = buildEmailPersonalizationPrompt({
        snapshot: ctx.snapshot,
        intelligence,
        thread: ctx.thread,
        playbook: this.playbook,
        objective,
        kind,
        pipelineStatus: ctx.snapshot.status,
      });
      const { value, model } = await this.#askJson({ ...prompt, validate: validateEmailDraft });

      const body = stripModelSignature(value.body);
      const warnings = auditDraft(`${value.subject}\n${body}`, { wordingToAvoid: this.playbook.wordingToAvoid });
      const confidence = Math.max(0, Math.round((value.confidence - Math.min(0.4, warnings.length * 0.1)) * 100) / 100);
      const draft = { ...value, body, confidence };

      const saved = await this.memory.recordDecision({
        leadId,
        threadId,
        kind: 'EMAIL_DRAFT',
        output: { ...draft, warnings, usedIntelligence: Boolean(intelligence) },
        draftText: body,
        recommendedAction: action,
        confidence,
        policy,
        model,
        promptVersion: PROMPT_VERSIONS.emailPersonalization,
        createdBy: userId,
      });

      return {
        status: 'READY',
        draft,
        warnings,
        policy,
        usedIntelligence: Boolean(intelligence),
        decisionId: saved.id,
        requiresApproval: true,
      };
    } catch (err) {
      return this.#failure(err);
    }
  }

  /* ------------------------------------------------------------------------ */
  /* Reply classification                                                     */
  /* ------------------------------------------------------------------------ */

  /**
   * Classify the latest (or a specific) inbound email and recommend a next action.
   * Deterministic stop rules run first and are authoritative.
   */
  async classifyReply(leadId, { messageId = null, threadId = null, text = null, subject = null, from = null, userId = null, force = false } = {}) {
    if (!this.config.enabled) return { status: 'DISABLED' };

    const ctx = await this.loadContext(leadId, { db: this.db, threadId, now: this.now() });
    if (!ctx) throw new Error('Lead not found');

    const inboundRow = messageId
      ? ctx.messages.find((m) => m.id === messageId)
      : ctx.latestInbound
      ? ctx.messages.find((m) => m.id === ctx.latestInbound.id)
      : null;

    const inbound = {
      id: inboundRow?.id || messageId || null,
      subject: subject ?? inboundRow?.subject ?? '',
      body: text ?? stripQuotedReply(inboundRow?.body_plain || ''),
      raw: text ?? inboundRow?.body_plain ?? '',
      from: from ?? inboundRow?.sender ?? '',
    };

    if (!inbound.body || !String(inbound.body).trim()) {
      return { status: 'NO_MESSAGE', reason: 'There is no inbound message to classify.' };
    }

    // Cached per inbound message + prompt version (no repeat Claude spend).
    if (!force && inbound.id) {
      const cached = await this.memory.findDecisionForMessage(inbound.id, 'CLASSIFICATION');
      if (cached && cached.prompt_version === PROMPT_VERSIONS.replyClassification && cached.output?.classification) {
        return { status: 'READY', cached: true, decisionId: cached.id, ...cached.output };
      }
    }

    const signals = detectStopSignals({ text: inbound.raw, subject: inbound.subject, from: inbound.from });
    const injection = detectPromptInjection(`${inbound.subject}\n${inbound.body}`);

    // Authoritative suppression for unambiguous unsubscribe replies.
    let suppression = { applied: false };
    if (signals.unsubscribe) {
      try {
        suppression = await this.stopEnforcer({
          lead: ctx.lead,
          text: inbound.raw,
          subject: inbound.subject,
          from: inbound.from,
          messageId: inbound.id,
          db: this.db,
          now: this.now(),
        });
      } catch (err) {
        suppression = { applied: false, error: err.message };
      }
    }

    let classification;
    let model = null;
    let source = 'claude';
    let degraded = false;

    if (signals.classification && signals.classification !== 'OUT_OF_OFFICE') {
      classification = this.#deterministicClassification(signals);
      source = 'rules';
    } else if (signals.classification === 'OUT_OF_OFFICE') {
      classification = this.#deterministicClassification(signals);
      source = 'rules';
    } else {
      try {
        const prompt = buildReplyClassificationPrompt({
          snapshot: ctx.snapshot,
          thread: ctx.thread.filter((m) => m.id !== inbound.id),
          inbound: { subject: inbound.subject, body: inbound.body },
          playbook: this.playbook,
        });
        const asked = await this.#askJson({ ...prompt, validate: validateReplyClassification });
        classification = asked.value;
        model = asked.model;
      } catch {
        // Claude down / invalid JSON: use what the sender's own words prove, nothing more.
        classification = this.#fallbackClassification(signals);
        source = 'rules';
        degraded = true;
      }
    }

    // Deterministic facts can only tighten the model's output.
    if (signals.notInterested && ['INTERESTED', 'MEETING_REQUEST'].includes(classification.classification)) {
      classification = {
        ...classification,
        classification: 'OTHER',
        recommendedAction: 'MANUAL_REVIEW',
        draftReplyNeeded: false,
        confidence: Math.min(classification.confidence, 0.4),
        summary: `${classification.summary} (mixed signals: also says not interested)`,
      };
    }
    if (NO_DRAFT_CLASSES.has(classification.classification)) {
      classification = { ...classification, draftReplyNeeded: false, shouldStopSequence: classification.classification !== 'OUT_OF_OFFICE' || classification.shouldStopSequence };
    }
    if (['UNSUBSCRIBE', 'BOUNCE_OR_INVALID', 'NOT_INTERESTED', 'WRONG_PERSON'].includes(classification.classification)) {
      classification = { ...classification, shouldStopSequence: true };
    }

    const securityFlags = [];
    if (injection.suspected) {
      securityFlags.push('PROMPT_INJECTION_SUSPECTED');
      // The model may have been steered; do not trust its recommendation or draft need.
      classification = {
        ...classification,
        recommendedAction: 'MANUAL_REVIEW',
        draftReplyNeeded: false,
        shouldUpdatePipeline: false,
        suggestedPipelineStage: null,
        confidence: Math.min(classification.confidence, 0.5),
      };
    }

    const recommendation = recommendNextAction({
      lead: ctx.lead,
      stats: ctx.stats,
      messages: ctx.messages,
      intelligence: null,
      classification,
      injectionSuspected: injection.suspected,
      config: this.config,
      now: this.now(),
    });

    const output = {
      classification,
      recommendation,
      securityFlags,
      suppression: suppression.applied ? { applied: true, reason: suppression.reason } : { applied: false },
      source,
      degraded,
      messageId: inbound.id,
    };

    const saved = await this.memory.recordDecision({
      leadId,
      threadId: inboundRow?.thread_id || threadId,
      messageId: inbound.id,
      kind: 'CLASSIFICATION',
      output,
      recommendedAction: recommendation.action,
      classification: classification.classification,
      confidence: classification.confidence,
      policy: recommendation.policy,
      stopReason: signals.mustStop ? classification.classification : null,
      model,
      promptVersion: PROMPT_VERSIONS.replyClassification,
      createdBy: userId,
    });

    return { status: 'READY', cached: false, decisionId: saved.id, ...output };
  }

  /** Read-only: the stored classification for a message (latest inbound by default). No Claude call. */
  async getCachedClassification(leadId, { messageId = null } = {}) {
    let targetId = messageId;
    if (!targetId) {
      const ctx = await this.loadContext(leadId, { db: this.db, now: this.now(), light: true });
      targetId = ctx?.latestInbound?.id || null;
    }
    if (!targetId) return { status: 'NO_MESSAGE' };

    const cached = await this.memory.findDecisionForMessage(targetId, 'CLASSIFICATION');
    if (!cached?.output?.classification) return { status: 'NOT_ANALYZED', messageId: targetId };
    return { status: 'READY', cached: true, decisionId: cached.id, ...cached.output, feedback: { status: cached.status, useful: cached.useful } };
  }

  #deterministicClassification(signals) {
    if (signals.unsubscribe) {
      return {
        classification: 'UNSUBSCRIBE',
        sentiment: 'NEGATIVE',
        summary: 'Sender asked to be removed or not contacted again.',
        intent: 'Stop all contact',
        recommendedAction: 'STOP_OUTREACH',
        shouldStopSequence: true,
        shouldUpdatePipeline: true,
        suggestedPipelineStage: 'DO_NOT_CONTACT',
        draftReplyNeeded: false,
        confidence: 1,
      };
    }
    if (signals.hardBounce || signals.softBounce) {
      return {
        classification: 'BOUNCE_OR_INVALID',
        sentiment: 'NEUTRAL',
        summary: signals.hardBounce ? 'Delivery failed permanently (address invalid).' : 'Delivery failed temporarily.',
        intent: 'Delivery notification',
        recommendedAction: signals.hardBounce ? 'STOP_OUTREACH' : 'WAIT',
        shouldStopSequence: Boolean(signals.hardBounce),
        shouldUpdatePipeline: Boolean(signals.hardBounce),
        suggestedPipelineStage: signals.hardBounce ? 'DO_NOT_CONTACT' : null,
        draftReplyNeeded: false,
        confidence: 0.95,
      };
    }
    return {
      classification: 'OUT_OF_OFFICE',
      sentiment: 'NEUTRAL',
      summary: 'Automatic out-of-office reply.',
      intent: 'Auto-reply',
      recommendedAction: 'WAIT',
      shouldStopSequence: false,
      shouldUpdatePipeline: false,
      suggestedPipelineStage: null,
      draftReplyNeeded: false,
      confidence: 0.9,
    };
  }

  #fallbackClassification(signals) {
    if (signals.notInterested) {
      return {
        classification: 'NOT_INTERESTED',
        sentiment: 'NEGATIVE',
        summary: 'Sender indicated they are not interested.',
        intent: 'Decline',
        recommendedAction: 'STOP_OUTREACH',
        shouldStopSequence: true,
        shouldUpdatePipeline: true,
        suggestedPipelineStage: 'NOT_INTERESTED',
        draftReplyNeeded: false,
        confidence: 0.7,
      };
    }
    if (signals.wrongPerson) {
      return {
        classification: 'WRONG_PERSON',
        sentiment: 'NEUTRAL',
        summary: 'Sender indicated this is the wrong contact.',
        intent: 'Redirect',
        recommendedAction: 'MANUAL_REVIEW',
        shouldStopSequence: true,
        shouldUpdatePipeline: false,
        suggestedPipelineStage: null,
        draftReplyNeeded: false,
        confidence: 0.7,
      };
    }
    return {
      classification: 'OTHER',
      sentiment: 'NEUTRAL',
      summary: 'AI classification unavailable; review this reply manually.',
      intent: 'Unknown',
      recommendedAction: 'MANUAL_REVIEW',
      shouldStopSequence: false,
      shouldUpdatePipeline: false,
      suggestedPipelineStage: null,
      draftReplyNeeded: false,
      confidence: 0.2,
    };
  }

  /* ------------------------------------------------------------------------ */
  /* Reply drafting (never auto-sent)                                         */
  /* ------------------------------------------------------------------------ */

  async draftReply(leadId, { messageId = null, threadId = null, objective = '', userId = null } = {}) {
    if (!this.config.enabled) return { status: 'DISABLED' };

    const classified = await this.classifyReply(leadId, { messageId, threadId, userId });
    if (classified.status !== 'READY') return classified;

    const { classification, securityFlags = [] } = classified;
    if (securityFlags.length) {
      return { status: 'NOT_APPLICABLE', reason: 'The message looks like it contains instructions aimed at the AI; reply manually.', classification };
    }
    if (NO_DRAFT_CLASSES.has(classification.classification) || classification.classification === 'OTHER') {
      return { status: 'NOT_APPLICABLE', reason: `No reply is recommended for a ${classification.classification.toLowerCase().replace(/_/g, ' ')} message.`, classification };
    }

    const ctx = await this.loadContext(leadId, { db: this.db, threadId, now: this.now() });
    const policy = evaluatePolicy({
      action: 'ANSWER_REPLY',
      lead: ctx.lead,
      stats: ctx.stats,
      messages: ctx.messages,
      phase: 'recommend',
      config: this.config,
      now: this.now(),
    });
    if (!policy.allowed) {
      return { status: 'BLOCKED', policy, reason: policy.reasons.join('; '), classification };
    }

    const inboundRow = ctx.messages.find((m) => m.id === classified.messageId) || ctx.latestInbound;
    const inbound = {
      subject: inboundRow?.subject || '',
      body: stripQuotedReply(inboundRow?.body_plain || ''),
    };

    const stored = await this.memory.getIntelligence(leadId);
    const intelligence = this.#shapeIntelligence(stored, ctx.contextHash).intelligence;

    try {
      const prompt = buildReplyDraftPrompt({
        snapshot: ctx.snapshot,
        intelligence,
        thread: ctx.thread.filter((m) => m.id !== inboundRow?.id),
        inbound,
        classification,
        playbook: this.playbook,
        objective,
      });
      const { value, model } = await this.#askJson({ ...prompt, validate: validateReplyDraft });

      const reply = stripModelSignature(value.reply);
      const warnings = auditDraft(reply, { wordingToAvoid: this.playbook.wordingToAvoid });
      const confidence = Math.max(0, Math.round((value.confidence - Math.min(0.4, warnings.length * 0.1)) * 100) / 100);
      const draft = { ...value, reply, confidence };

      const saved = await this.memory.recordDecision({
        leadId,
        threadId: inboundRow?.thread_id || threadId,
        messageId: inboundRow?.id || null,
        kind: 'REPLY_DRAFT',
        output: { ...draft, warnings },
        draftText: reply,
        recommendedAction: 'ANSWER_REPLY',
        classification: classification.classification,
        confidence,
        policy,
        model,
        promptVersion: PROMPT_VERSIONS.replyDraft,
        createdBy: userId,
      });

      return { status: 'READY', draft, warnings, policy, classification, decisionId: saved.id, requiresApproval: true };
    } catch (err) {
      return this.#failure(err);
    }
  }

  /* ------------------------------------------------------------------------ */
  /* Next best action (deterministic, no Claude call)                         */
  /* ------------------------------------------------------------------------ */

  async recommend(leadId) {
    const ctx = await this.loadContext(leadId, { db: this.db, now: this.now(), light: true });
    if (!ctx) throw new Error('Lead not found');

    const stored = await this.memory.getIntelligence(leadId);
    const intel = this.#shapeIntelligence(stored, ctx.contextHash);

    // Reuse the classification already computed for the latest inbound, if any.
    let classification = null;
    if (ctx.latestInbound && ctx.stats.unansweredInbound) {
      const cached = await this.memory.findDecisionForMessage(ctx.latestInbound.id, 'CLASSIFICATION');
      classification = cached?.output?.classification || null;
    }

    return recommendNextAction({
      lead: ctx.lead,
      stats: ctx.stats,
      messages: ctx.messages,
      intelligence: intel.status === ANALYSIS_STATUS.READY || intel.status === ANALYSIS_STATUS.STALE ? intel.intelligence : null,
      classification,
      config: this.config,
      now: this.now(),
    });
  }

  /* ------------------------------------------------------------------------ */
  /* Policy check for executing a human-approved AI draft                     */
  /* ------------------------------------------------------------------------ */

  /**
   * Called by the send route when a human sends an AI-originated draft.
   * Runs the full execute-phase policy including the approval requirement.
   */
  async checkSendPolicy(leadId, { action = 'ANSWER_REPLY', candidate = null, user = null, approval = null, campaign = null, sequence = null } = {}) {
    const ctx = await this.loadContext(leadId, { db: this.db, now: this.now() });
    if (!ctx) return { allowed: false, reasons: ['Lead not found'], blockedBy: ['LEAD_STATE'], requiresApproval: true, checks: [] };

    return evaluatePolicy({
      action,
      lead: ctx.lead,
      stats: ctx.stats,
      messages: ctx.messages,
      candidate,
      campaign,
      sequence: sequence || sequenceFromLead(ctx.lead),
      actor: 'human',
      user,
      approval,
      phase: 'execute',
      config: this.config,
      now: this.now(),
    });
  }

  /* ------------------------------------------------------------------------ */
  /* Feedback                                                                 */
  /* ------------------------------------------------------------------------ */

  recordFeedback(decisionId, payload) {
    return this.memory.recordFeedback(decisionId, payload);
  }

  /* ------------------------------------------------------------------------ */

  /** Map a provider/schema error to the standard failure result without leaking details. */
  describeFailure(err) {
    return this.#failure(err);
  }

  #failure(err) {
    if (err instanceof AIProviderError) {
      return { status: 'FAILED', code: err.code, error: err.code === 'NOT_CONFIGURED' ? MODEL_NOT_CONFIGURED_MESSAGE : `AI is temporarily unavailable (${err.code.toLowerCase()}).` };
    }
    if (err instanceof SchemaError) {
      return { status: 'FAILED', code: 'INVALID_JSON', error: 'Claude returned an invalid response. Try again.' };
    }
    return { status: 'FAILED', code: 'ERROR', error: err.message || 'AI request failed' };
  }
}

// Shared instance for route handlers.
let sharedBrain = null;
export function getBrain() {
  if (!sharedBrain) sharedBrain = new MineTechBrain();
  return sharedBrain;
}
export function setBrain(brain) {
  sharedBrain = brain;
}

export { computeContextHash };
export default MineTechBrain;
