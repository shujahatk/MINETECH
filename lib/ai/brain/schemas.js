/**
 * Structured-output contracts for the AI Brain.
 *
 * Claude output is untrusted input. Every payload is parsed and validated here before any
 * other code sees it. Validators NORMALISE (trim, clamp, coerce enums) and THROW
 * `SchemaError` when a required field is missing or unusable - callers then fall back to
 * a safe, non-fabricated result instead of passing garbage downstream.
 */

export const PRIORITIES = Object.freeze(['HOT', 'WARM', 'COLD']);
export const FIT_RATINGS = Object.freeze(['HIGH', 'MEDIUM', 'LOW', 'UNKNOWN']);

export const NEXT_ACTIONS = Object.freeze([
  'SEND_INITIAL_EMAIL',
  'SEND_FOLLOW_UP',
  'ANSWER_REPLY',
  'WAIT',
  'REQUEST_MEETING',
  'RESEARCH_MORE',
  'CHANGE_STRATEGY',
  'STOP_OUTREACH',
  'MANUAL_REVIEW',
]);

export const REPLY_CLASSES = Object.freeze([
  'INTERESTED',
  'MEETING_REQUEST',
  'QUESTION',
  'OBJECTION',
  'NOT_NOW',
  'NOT_INTERESTED',
  'WRONG_PERSON',
  'OUT_OF_OFFICE',
  'UNSUBSCRIBE',
  'BOUNCE_OR_INVALID',
  'OTHER',
]);

export const SENTIMENTS = Object.freeze(['POSITIVE', 'NEUTRAL', 'NEGATIVE']);

export const PIPELINE_STAGES = Object.freeze([
  // Mirrors lib/services/analyticsService.js stage vocabulary; the suggestion is advisory only.
  'NEW',
  'CONTACTED',
  'ENGAGED',
  'FOLLOW_UP',
  'NOT_INTERESTED',
  'DO_NOT_CONTACT',
]);

export const ANALYSIS_STATUS = Object.freeze({
  NOT_ANALYZED: 'NOT_ANALYZED',
  PENDING: 'PENDING',
  READY: 'READY',
  FAILED: 'FAILED',
  STALE: 'STALE',
});

export class SchemaError extends Error {
  constructor(message, issues = []) {
    super(message);
    this.name = 'SchemaError';
    this.issues = issues;
  }
}

/* -------------------------------------------------------------------------- */
/* JSON extraction                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Pull a JSON object out of a model response. Tolerates ```json fences and short
 * leading/trailing prose, but never "repairs" content - malformed JSON throws.
 */
export function extractJson(text) {
  if (typeof text !== 'string' || !text.trim()) {
    throw new SchemaError('Empty model response');
  }

  let candidate = text.trim();
  const fenced = candidate.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) candidate = fenced[1].trim();

  if (!candidate.startsWith('{')) {
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start === -1 || end <= start) throw new SchemaError('No JSON object found in model response');
    candidate = candidate.slice(start, end + 1);
  }

  try {
    const parsed = JSON.parse(candidate);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new SchemaError('Model response JSON is not an object');
    }
    return parsed;
  } catch (err) {
    if (err instanceof SchemaError) throw err;
    throw new SchemaError(`Model response is not valid JSON: ${err.message}`);
  }
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

const str = (value, max = 600) => {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\s+\n/g, '\n').trim().slice(0, max);
};

const strList = (value, { maxItems = 6, maxLen = 240 } = {}) => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => str(item, maxLen))
    .filter(Boolean)
    .slice(0, maxItems);
};

const upperEnum = (value, allowed, fallback = null) => {
  const normalised = String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
  return allowed.includes(normalised) ? normalised : fallback;
};

/** Accepts 0..1, 0..100, or low/medium/high and returns a number in [0,1]. */
export function normalizeConfidence(value) {
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    if (v === 'high') return 0.85;
    if (v === 'medium') return 0.6;
    if (v === 'low') return 0.3;
  }
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  const scaled = n > 1 ? n / 100 : n;
  return Math.min(1, Math.max(0, Math.round(scaled * 100) / 100));
}

const require_ = (cond, issues, message) => {
  if (!cond) issues.push(message);
};

/* -------------------------------------------------------------------------- */
/* Lead intelligence                                                          */
/* -------------------------------------------------------------------------- */

export function validateLeadIntelligence(raw) {
  const issues = [];
  if (!raw || typeof raw !== 'object') throw new SchemaError('Lead intelligence must be an object', ['not_object']);

  const fitRaw = raw.companyFit;
  const fit = {
    rating: upperEnum(typeof fitRaw === 'object' ? fitRaw?.rating : fitRaw, FIT_RATINGS, 'UNKNOWN'),
    reason: str(typeof fitRaw === 'object' ? fitRaw?.reason : '', 400),
  };

  const out = {
    summary: str(raw.summary, 700),
    companyFit: fit,
    needs: strList(raw.needs),
    painPoints: strList(raw.painPoints),
    salesAngles: strList(raw.salesAngles, { maxItems: 4 }),
    personalizationHooks: strList(raw.personalizationHooks, { maxItems: 4 }),
    priority: upperEnum(raw.priority, PRIORITIES),
    confidence: normalizeConfidence(raw.confidence),
    recommendedAction: upperEnum(raw.recommendedAction, NEXT_ACTIONS),
    reasoningSummary: str(raw.reasoningSummary, 500),
  };

  require_(out.summary.length >= 10, issues, 'summary missing');
  require_(out.priority, issues, 'priority must be HOT|WARM|COLD');
  require_(out.recommendedAction, issues, 'recommendedAction invalid');
  require_(out.reasoningSummary.length > 0, issues, 'reasoningSummary missing');

  if (issues.length) throw new SchemaError(`Invalid lead intelligence: ${issues.join('; ')}`, issues);
  return out;
}

/* -------------------------------------------------------------------------- */
/* Email personalization                                                      */
/* -------------------------------------------------------------------------- */

export function validateEmailDraft(raw) {
  const issues = [];
  if (!raw || typeof raw !== 'object') throw new SchemaError('Email draft must be an object', ['not_object']);

  const out = {
    subject: str(raw.subject, 200),
    body: str(raw.body, 4000),
    strategy: str(raw.strategy, 300),
    cta: str(raw.cta, 200),
    confidence: normalizeConfidence(raw.confidence),
  };

  require_(out.subject.length >= 3, issues, 'subject missing');
  require_(out.body.length >= 20, issues, 'body missing');
  require_(out.cta.length > 0, issues, 'cta missing');

  if (issues.length) throw new SchemaError(`Invalid email draft: ${issues.join('; ')}`, issues);
  return out;
}

/* -------------------------------------------------------------------------- */
/* Reply classification                                                       */
/* -------------------------------------------------------------------------- */

export function validateReplyClassification(raw) {
  const issues = [];
  if (!raw || typeof raw !== 'object') throw new SchemaError('Classification must be an object', ['not_object']);

  const out = {
    classification: upperEnum(raw.classification, REPLY_CLASSES),
    sentiment: upperEnum(raw.sentiment, SENTIMENTS, 'NEUTRAL'),
    summary: str(raw.summary, 400),
    intent: str(raw.intent, 300),
    recommendedAction: upperEnum(raw.recommendedAction, NEXT_ACTIONS, 'MANUAL_REVIEW'),
    shouldStopSequence: Boolean(raw.shouldStopSequence),
    shouldUpdatePipeline: Boolean(raw.shouldUpdatePipeline),
    suggestedPipelineStage: upperEnum(raw.suggestedPipelineStage, PIPELINE_STAGES, null),
    draftReplyNeeded: Boolean(raw.draftReplyNeeded),
    confidence: normalizeConfidence(raw.confidence),
  };

  require_(out.classification, issues, 'classification invalid');
  require_(out.summary.length > 0, issues, 'summary missing');

  if (issues.length) throw new SchemaError(`Invalid classification: ${issues.join('; ')}`, issues);
  return out;
}

/* -------------------------------------------------------------------------- */
/* Reply draft                                                                */
/* -------------------------------------------------------------------------- */

export function validateReplyDraft(raw) {
  const issues = [];
  if (!raw || typeof raw !== 'object') throw new SchemaError('Reply draft must be an object', ['not_object']);

  const out = {
    reply: str(raw.reply, 4000),
    objective: str(raw.objective, 300),
    recommendedNextStep: str(raw.recommendedNextStep, 300),
    confidence: normalizeConfidence(raw.confidence),
  };

  require_(out.reply.length >= 10, issues, 'reply missing');
  require_(out.objective.length > 0, issues, 'objective missing');

  if (issues.length) throw new SchemaError(`Invalid reply draft: ${issues.join('; ')}`, issues);
  return out;
}
