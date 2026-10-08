/**
 * Deterministic text-safety primitives. NO model calls in this file.
 *
 * These rules are the authority for stop-contact decisions. Claude can add nuance
 * (e.g. distinguishing NOT_NOW from OBJECTION) but it can never downgrade a deterministic
 * UNSUBSCRIBE / BOUNCE result, and it never decides whether someone may be contacted.
 */

/* -------------------------------------------------------------------------- */
/* Prompt-injection hygiene                                                   */
/* -------------------------------------------------------------------------- */

/** Escape angle brackets so untrusted text can never open/close our XML fences. */
export function escapeForFence(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Wrap untrusted content in a named fence after escaping. */
export function fence(tag, value, maxChars = 2000) {
  const text = String(value ?? '').slice(0, maxChars);
  return `<${tag}>\n${escapeForFence(text)}\n</${tag}>`;
}

const INJECTION_PATTERNS = [
  /\bignore\s+(?:all\s+|any\s+|the\s+|your\s+)?(?:previous|prior|above|earlier|preceding)\b[^.\n]{0,40}\b(?:instructions?|prompts?|rules?|context)\b/i,
  /\bdisregard\s+(?:all\s+|any\s+|the\s+|your\s+)?(?:previous|prior|above|earlier)?\s*(?:instructions?|prompts?|rules?)\b/i,
  /\bforget\s+(?:everything|all|your)\b[^.\n]{0,30}\b(?:instructions?|rules?|above)\b/i,
  /\b(?:reveal|show|print|output|repeat)\b[^.\n]{0,40}\b(?:system\s+prompt|api[\s_-]?key|secret|credentials?|password|your\s+instructions)\b/i,
  /\byou\s+are\s+now\b[^.\n]{0,40}\b(?:an?\s+)?(?:assistant|ai|model|bot|dan|admin|developer)\b/i,
  /\bnew\s+(?:system\s+)?instructions?\s*:/i,
  /\b(?:system|assistant|developer)\s*(?:prompt|message)\s*:/i,
  /\boverride\b[^.\n]{0,30}\b(?:policy|rules?|safety|dnc|do[\s-]?not[\s-]?contact|instructions?)\b/i,
  /\b(?:send|forward)\b[^.\n]{0,30}\b(?:this|the)?\s*(?:email|message)\b[^.\n]{0,30}\bto\s+all\b/i,
  /<\/?\s*(?:untrusted|system|instructions?|assistant)[\w_-]*/i,
  /\bclassify\s+(?:this|it|the\s+(?:email|message|reply))\s+as\b/i,
];

/**
 * Heuristic detector for text that is trying to instruct the AI. A hit never blocks the
 * message; it forces human review and makes the Brain refuse to auto-draft.
 */
export function detectPromptInjection(text = '') {
  const input = String(text || '');
  if (!input) return { suspected: false, matches: [] };
  const matches = [];
  for (const pattern of INJECTION_PATTERNS) {
    const hit = input.match(pattern);
    if (hit) matches.push(hit[0].slice(0, 80));
  }
  return { suspected: matches.length > 0, matches };
}

/* -------------------------------------------------------------------------- */
/* Quoted-reply stripping                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Remove quoted history so we only inspect what the sender actually wrote. Without this,
 * a footer or the quoted original in a reply could trigger false stop signals.
 */
export function stripQuotedReply(text = '') {
  const lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
  const kept = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const trimmed = line.trim();
    if (/^on\s.{5,200}\swrote:?$/i.test(trimmed)) break;
    if (/^-{2,}\s*(original message|forwarded message)\s*-{2,}$/i.test(trimmed)) break;
    if (/^_{5,}$/.test(trimmed)) break;
    // Outlook-style header block: "From: ..." followed by Sent/Date/To/Subject
    if (/^from:\s.+/i.test(trimmed) && /^(sent|date|to|subject):/i.test((lines[i + 1] || '').trim())) break;
    if (trimmed.startsWith('>')) continue;
    kept.push(line);
  }
  return kept.join('\n').trim();
}

/* -------------------------------------------------------------------------- */
/* Stop-contact signals (deterministic)                                       */
/* -------------------------------------------------------------------------- */

const UNSUBSCRIBE_PATTERNS = [
  /\bunsubscribe\b/i,
  /\bopt[\s-]?out\b/i,
  /\bremove\s+(?:me|us|my\s+(?:email|address|name))\b/i,
  /\btake\s+(?:me|us)\s+off\b/i,
  /\b(?:stop|quit|cease|discontinue)\s+(?:emailing|e-mailing|contacting|sending|messaging|writing|mailing)\b/i,
  /\bdo\s+not\s+(?:contact|email|e-mail|message|write\s+to)\s+(?:me|us)\b/i,
  /\bdon'?t\s+(?:contact|email|e-mail|message|write\s+to)\s+(?:me|us)\b/i,
  /\bdo\s+not\s+contact\b/i,
  /\bno\s+more\s+(?:emails?|e-mails?|messages?)\b/i,
  /\bnever\s+(?:contact|email|e-mail)\s+(?:me|us)\s+again\b/i,
  /\bremove\s+(?:me|us)\s+from\b/i,
  /\b(?:spam|gdpr)\b.{0,60}\b(?:delete|erase|remove)\b/i,
];

const UNSUBSCRIBE_NEGATION = /\b(?:don'?t|do\s+not|never|not|no\s+need\s+to)\s+(?:want\s+to\s+|wish\s+to\s+|plan\s+to\s+)?(?:unsubscribe|opt[\s-]?out)\b/i;

const NOT_INTERESTED_PATTERNS = [
  /\bnot\s+(?:really\s+)?interested\b/i,
  /\bno\s+(?:thanks|thank\s+you)\b/i,
  /\bwe\s+(?:do\s+not|don'?t)\s+(?:need|require|buy|purchase|use)\b/i,
  /\bnot\s+a\s+(?:fit|match)\b/i,
];

const HARD_BOUNCE_PATTERNS = [
  /\buser\s+unknown\b/i,
  /\baddress\s+(?:not\s+found|rejected)\b/i,
  /\bno\s+such\s+(?:user|recipient|mailbox)\b/i,
  /\brecipient\s+(?:address\s+)?rejected\b/i,
  /\bmailbox\s+(?:not\s+found|does\s+not\s+exist|unavailable)\b/i,
  /\bdoes\s+not\s+exist\b/i,
  /\b550[\s-]5\.[01]\.[0-9]\b/,
  /\b5\.1\.[01]\b/,
  /\bunknown\s+recipient\b/i,
];

const SOFT_BOUNCE_PATTERNS = [/\bmailbox\s+(?:is\s+)?full\b/i, /\bquota\s+exceeded\b/i, /\btemporar(?:y|ily)\b.{0,40}\b(?:failure|unavailable|deferred)\b/i];

const NDR_SENDER = /(?:mailer-daemon|postmaster|mail\s+delivery\s+(?:system|subsystem))/i;
const NDR_SUBJECT = /(?:undeliver|delivery\s+status\s+notification|delivery\s+(?:has\s+)?failed|returned\s+mail|failure\s+notice|mail\s+delivery\s+failed)/i;

const OOO_PATTERNS = [
  /\bout\s+of\s+(?:the\s+)?office\b/i,
  /\bautomatic\s+reply\b/i,
  /\bauto[\s-]?reply\b/i,
  /\bautoreply\b/i,
  /\b(?:i\s+am|i'?m|we\s+are|we'?re)\s+(?:currently\s+)?(?:on\s+(?:annual\s+|maternity\s+|paternity\s+)?(?:leave|vacation|holiday)|away\s+(?:from|until))\b/i,
  /\bwill\s+(?:be\s+)?(?:back|return(?:ing)?)\s+(?:on|in|after)\b/i,
];

const WRONG_PERSON_PATTERNS = [
  /\bwrong\s+(?:person|contact|address|department)\b/i,
  /\b(?:i\s+am|i'?m)\s+no\s+longer\s+(?:with|at|working)\b/i,
  /\bno\s+longer\s+(?:works?|employed)\s+(?:at|with|here)\b/i,
  /\bleft\s+the\s+company\b/i,
  /\bnot\s+the\s+right\s+(?:person|contact)\b/i,
];

const matchesAny = (patterns, text) => patterns.some((p) => p.test(text));

/**
 * Inspect an inbound message and return deterministic stop signals.
 *
 * Only the sender's own text is inspected (quoted history stripped). `unsubscribe` and
 * `hardBounce` are authoritative: callers must treat them as policy facts, not as model
 * suggestions.
 */
export function detectStopSignals({ text = '', subject = '', from = '' } = {}) {
  const ownText = stripQuotedReply(text);
  const haystack = `${subject}\n${ownText}`;

  const isNdrSender = NDR_SENDER.test(String(from || ''));
  const isNdrSubject = NDR_SUBJECT.test(String(subject || ''));
  const bounceBodyHit = matchesAny(HARD_BOUNCE_PATTERNS, `${subject}\n${text}`);
  const softBounceHit = matchesAny(SOFT_BOUNCE_PATTERNS, `${subject}\n${text}`);

  const looksLikeNdr = isNdrSender || (isNdrSubject && (bounceBodyHit || softBounceHit));
  const hardBounce = looksLikeNdr && bounceBodyHit && !softBounceHit;
  const softBounce = looksLikeNdr && !hardBounce;

  const unsubscribe =
    !looksLikeNdr && matchesAny(UNSUBSCRIBE_PATTERNS, haystack) && !UNSUBSCRIBE_NEGATION.test(haystack);

  const outOfOffice = !looksLikeNdr && !unsubscribe && matchesAny(OOO_PATTERNS, haystack);
  const notInterested = !unsubscribe && !looksLikeNdr && matchesAny(NOT_INTERESTED_PATTERNS, ownText);
  const wrongPerson = !unsubscribe && !looksLikeNdr && matchesAny(WRONG_PERSON_PATTERNS, ownText);

  let classification = null;
  if (hardBounce || softBounce) classification = 'BOUNCE_OR_INVALID';
  else if (unsubscribe) classification = 'UNSUBSCRIBE';
  else if (outOfOffice) classification = 'OUT_OF_OFFICE';

  return {
    unsubscribe,
    hardBounce,
    softBounce,
    outOfOffice,
    notInterested,
    wrongPerson,
    /** Present only for signals that are authoritative on their own. */
    classification,
    /** True when contact must stop regardless of what the model says. */
    mustStop: unsubscribe || hardBounce,
  };
}

/* -------------------------------------------------------------------------- */
/* Draft audit (deterministic guard on model-written copy)                    */
/* -------------------------------------------------------------------------- */

const DRAFT_RISK_PATTERNS = [
  { code: 'PRICE_CLAIM', re: /(?:[$€£]\s?\d|\b\d[\d.,]*\s?(?:usd|eur|gbp|dollars?|euros?)\b|\bper\s+(?:ton|tonne|mt|kg)\b)/i, message: 'Mentions a price' },
  { code: 'GUARANTEE', re: /\bguarantee[sd]?\b/i, message: 'Uses a guarantee' },
  { code: 'CERTIFICATION', re: /\b(?:certified|certification|iso\s?\d{3,5}|reach\s+registered)\b/i, message: 'Mentions a certification' },
  { code: 'STOCK_OR_LEAD_TIME', re: /\b(?:in\s+stock|ready\s+stock|lead[\s-]?time\s+of\s+\d|deliver(?:y|ed)?\s+within\s+\d)/i, message: 'States stock or delivery time' },
  { code: 'CAPACITY_CLAIM', re: /\b\d[\d,.]*\s?(?:mt|tons?|tonnes)\s+(?:per|a|\/)\s?(?:month|year|week)\b/i, message: 'States a capacity or volume' },
  { code: 'URGENCY', re: /\b(?:limited\s+time|act\s+now|last\s+chance|expires?\s+(?:today|soon))\b/i, message: 'Uses false urgency' },
  { code: 'PLACEHOLDER', re: /\[[A-Za-z][A-Za-z ]{1,30}\]/, message: 'Contains an unfilled placeholder' },
  { code: 'PROMPT_LEAK', re: /<\/?\s*(?:untrusted|system|thread_history|lead_intelligence)[\w_-]*/i, message: 'Contains internal prompt markup' },
];

/**
 * Flag risky statements in a model-written draft. Never edits or blocks - it returns
 * warnings the human sees before approving, and the Brain lowers draft confidence.
 */
export function auditDraft(text = '', { wordingToAvoid = [] } = {}) {
  const input = String(text || '');
  const warnings = [];
  for (const rule of DRAFT_RISK_PATTERNS) {
    const hit = input.match(rule.re);
    if (hit) warnings.push({ code: rule.code, message: rule.message, excerpt: hit[0].slice(0, 60) });
  }
  const lower = input.toLowerCase();
  for (const word of wordingToAvoid) {
    if (lower.includes(String(word).toLowerCase())) {
      warnings.push({ code: 'AVOID_WORDING', message: `Uses discouraged wording`, excerpt: word });
    }
  }
  return warnings;
}

/** Remove any sign-off the model added; MineTech appends its own signature at send time. */
export function stripModelSignature(text = '') {
  return String(text || '')
    .replace(/\n+\s*(?:best regards|kind regards|regards|sincerely|best|cheers|thanks|thank you)[,!]?\s*\n[\s\S]{0,80}$/i, '')
    .trim();
}

/* -------------------------------------------------------------------------- */
/* Misc                                                                       */
/* -------------------------------------------------------------------------- */

const EMAIL_RE = /^[^\s@<>()[\]\\,;:]+@[^\s@<>()[\]\\,;:]+\.[A-Za-z]{2,}$/;

export function isValidEmail(email) {
  return typeof email === 'string' && EMAIL_RE.test(email.trim());
}

export function normalizeText(value = '') {
  return String(value || '')
    .toLowerCase()
    .replace(/<[^>]+>/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
