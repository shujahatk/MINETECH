/**
 * Short-command interpreter. PURE: no I/O, no model calls, fully unit-testable.
 *
 * Turns a 2-4 word instruction such as "short follow up" or "make it warmer" into a structured
 * command, then resolves it against what is actually true about the lead (is there a previous
 * email? did they reply?) so the system never produces a fake follow-up or an unanswerable reply.
 *
 *   interpretCommand("short follow up")
 *     -> { intent: 'FOLLOW_UP', styles: ['SHORTER'], note: '', ambiguous: false }
 *   resolveCommand(command, state)
 *     -> { kind: 'FOLLOW_UP', styles, focus, notices } | { blocked: true, code, message, suggestion }
 *
 * The user's text is also forwarded to Claude (fenced, as the salesperson's direction) so small
 * extras like "mention samples" still work; but it can only steer tone and content, never
 * override the safety rules, which live in the system prompt and the policy engine.
 */

export const QUICK_COMMANDS = Object.freeze({
  INITIAL: 'draft intro email',
  FOLLOW_UP: 'short follow up',
  REPLY: 'reply',
  MEETING: 'meeting follow up',
  SHORTER: 'make shorter',
  WARMER: 'warmer',
  DIRECT: 'more direct',
});

export const INTENTS = Object.freeze({
  INITIAL: 'INITIAL',
  FOLLOW_UP: 'FOLLOW_UP',
  FINAL_FOLLOW_UP: 'FINAL_FOLLOW_UP',
  REPLY: 'REPLY',
  REPLY_OBJECTION: 'REPLY_OBJECTION',
  REPLY_QUESTION: 'REPLY_QUESTION',
  REPLY_POSITIVE: 'REPLY_POSITIVE',
  MEETING: 'MEETING',
  REVISE: 'REVISE',
});

export const STYLES = Object.freeze({
  SHORTER: 'SHORTER',
  DIRECT: 'DIRECT',
  WARMER: 'WARMER',
  PROFESSIONAL: 'PROFESSIONAL',
  LESS_SALESY: 'LESS_SALESY',
  STRONGER_CTA: 'STRONGER_CTA',
});

const STYLE_PATTERNS = [
  [STYLES.LESS_SALESY, /\bless salesy\b|\bless sales\b|\bnot (so |too )?salesy\b|\bnot (so |too )?pushy\b|\bsoften\b|\bmore natural\b|\bless pushy\b/],
  [STYLES.STRONGER_CTA, /\b(stronger|clearer|firmer|better|sharper) (cta|call to action|ask|close)\b|\bclear(er)? ask\b|\bpush for\b/],
  [STYLES.SHORTER, /\b(shorter|shorten|short|concise|brief(er)?|trim|tighten|cut (it )?down|compress)\b/],
  [STYLES.DIRECT, /\b(direct|blunt|straight|to the point|straightforward|punchier)\b/],
  [STYLES.WARMER, /\b(warm(er)?|friendl(y|ier)|more personal|softer tone|more human|kinder)\b/],
  [STYLES.PROFESSIONAL, /\b(professional|formal|more polished|polish)\b/],
];

// Order matters: the most specific intents are tested first.
const INTENT_PATTERNS = [
  [INTENTS.FINAL_FOLLOW_UP, /\b(final|last|closing)\b.*\b(follow[\s-]?up|nudge|reminder|email|chase)\b|\bbreak[\s-]?up (email|message)\b/],
  [INTENTS.MEETING, /\b(meeting|call|demo|schedule|book(ing)?|calendar|catch[\s-]?up)\b/],
  [INTENTS.REPLY_OBJECTION, /\b(objection|push[\s-]?back|concern|hesitat\w*|too expensive|price (concern|objection)|not sure)\b/],
  [INTENTS.REPLY_QUESTION, /\b(answer|respond to|reply to)\b.*\b(question|query|asked)\b|\btheir question\b|\bthey asked\b/],
  [INTENTS.REPLY_POSITIVE, /\b(reply|respond)\b.*\b(positive(ly)?|interested|yes|accept|good news)\b|\bpositive repl(y|ies)\b|\bthank(s| them)\b.*\binterest\b/],
  [INTENTS.REPLY, /^\s*(please )?(reply|respond|answer)\b|\b(reply|respond|answer) (to|them|back|now)\b|\bwrite (a )?repl(y|ies)\b/],
  [INTENTS.FOLLOW_UP, /\bfollow[\s-]?up\b|\bfollow[\s-]?ups\b|\bnudge\b|\bbump\b|\bcheck[\s-]?in\b|\bcircle back\b|\bremind(er)?\b|\bchase\b|\bfollowup\b/],
  [INTENTS.INITIAL, /\b(intro(duction|duce)?|first (outreach|email|touch|message|contact)|cold( (intro|email|outreach))?|initial( email| outreach)?|new (email|outreach)|opening (email|message)|outreach|write (an )?email|draft (an )?email)\b/],
];

const normalise = (text) =>
  String(text || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * @param {string} instruction
 * @returns {{ raw:string, intent:string|null, styles:string[], note:string, ambiguous:boolean }}
 */
export function interpretCommand(instruction) {
  const raw = String(instruction || '').trim().slice(0, 300);
  const text = normalise(raw);

  const styles = [];
  for (const [style, re] of STYLE_PATTERNS) {
    if (re.test(text)) styles.push(style);
  }

  let intent = null;
  for (const [candidate, re] of INTENT_PATTERNS) {
    if (re.test(text)) {
      intent = candidate;
      break;
    }
  }

  // "make it shorter" / "warmer" with no intent word is a revision of the current draft.
  const ambiguous = !intent && styles.length === 0;
  if (!intent && styles.length > 0) intent = INTENTS.REVISE;

  return { raw, intent, styles, note: raw, ambiguous };
}

/**
 * Decide what to actually draft, given the real state of the lead.
 *
 * @param {ReturnType<typeof interpretCommand>} command
 * @param {{ outboundCount:number, inboundCount:number, unansweredInbound:boolean, hasDraft:boolean, surface?:'compose'|'reply' }} state
 * @returns {{ blocked:false, kind:'INITIAL'|'FOLLOW_UP'|'REPLY', revise:boolean, final:boolean, focus:string|null, meeting:boolean, styles:string[], notices:string[] }
 *          | { blocked:true, code:string, message:string, suggestion:string|null }}
 */
export function resolveCommand(command, state) {
  const { outboundCount = 0, inboundCount = 0, unansweredInbound = false, hasDraft = false, surface = 'compose' } = state || {};
  const notices = [];
  const styles = command.styles || [];

  // 1) What the user asked for (or the safest inference when ambiguous).
  let intent = command.intent;
  let inferred = false;

  if (!intent || intent === INTENTS.REVISE) {
    if (intent === INTENTS.REVISE && hasDraft) {
      // Revise keeps the kind of the draft on screen; the surface/state decide which kind that is.
      const kind = surface === 'reply' || unansweredInbound ? 'REPLY' : outboundCount > 0 ? 'FOLLOW_UP' : 'INITIAL';
      if (kind === 'REPLY' && inboundCount === 0) {
        return { blocked: true, code: 'NO_INBOUND_REPLY', message: 'There is no reply from this lead to answer yet.', suggestion: QUICK_COMMANDS.FOLLOW_UP };
      }
      return { blocked: false, kind, revise: true, final: false, focus: null, meeting: false, styles, notices };
    }
    // No draft to revise, or nothing recognisable: infer from the thread.
    inferred = true;
    intent = unansweredInbound ? INTENTS.REPLY : outboundCount > 0 ? INTENTS.FOLLOW_UP : INTENTS.INITIAL;
    if (command.intent === INTENTS.REVISE) notices.push('There was no draft to edit, so a fresh one was written.');
    else if (command.ambiguous && command.raw) notices.push(`Not sure what "${command.raw}" means, so I picked the safest option for this lead.`);
  }

  const isReply = [INTENTS.REPLY, INTENTS.REPLY_OBJECTION, INTENTS.REPLY_QUESTION, INTENTS.REPLY_POSITIVE].includes(intent);
  const focusByIntent = {
    [INTENTS.REPLY_OBJECTION]: 'OBJECTION',
    [INTENTS.REPLY_QUESTION]: 'QUESTION',
    [INTENTS.REPLY_POSITIVE]: 'POSITIVE',
  };

  // 2) Meeting: a reply when they wrote last, otherwise a follow-up. Never a first email.
  if (intent === INTENTS.MEETING) {
    if (unansweredInbound) {
      return { blocked: false, kind: 'REPLY', revise: false, final: false, focus: 'MEETING', meeting: true, styles, notices };
    }
    if (outboundCount === 0) {
      return {
        blocked: true,
        code: 'NO_PRIOR_EMAIL',
        message: 'This lead has not been emailed yet, so there is nothing to follow up on. Start with an intro email.',
        suggestion: QUICK_COMMANDS.INITIAL,
      };
    }
    return { blocked: false, kind: 'FOLLOW_UP', revise: false, final: false, focus: 'MEETING', meeting: true, styles, notices };
  }

  // 3) Replies need something to reply to.
  if (isReply) {
    if (inboundCount === 0) {
      return {
        blocked: true,
        code: 'NO_INBOUND_REPLY',
        message: 'This lead has not replied yet, so there is nothing to answer.',
        suggestion: outboundCount > 0 ? QUICK_COMMANDS.FOLLOW_UP : QUICK_COMMANDS.INITIAL,
      };
    }
    return { blocked: false, kind: 'REPLY', revise: false, final: false, focus: focusByIntent[intent] || null, meeting: false, styles, notices };
  }

  // 4) Follow-ups need a previous email, and are wrong if the lead already wrote back.
  if (intent === INTENTS.FOLLOW_UP || intent === INTENTS.FINAL_FOLLOW_UP) {
    if (outboundCount === 0) {
      return {
        blocked: true,
        code: 'NO_PRIOR_EMAIL',
        message: 'This lead has not been emailed yet, so there is nothing to follow up on. Start with an intro email.',
        suggestion: QUICK_COMMANDS.INITIAL,
      };
    }
    if (unansweredInbound) {
      notices.push('They replied last, so this is a reply rather than a follow-up.');
      return { blocked: false, kind: 'REPLY', revise: false, final: false, focus: null, meeting: false, styles, notices };
    }
    return { blocked: false, kind: 'FOLLOW_UP', revise: false, final: intent === INTENTS.FINAL_FOLLOW_UP, focus: null, meeting: false, styles, notices };
  }

  // 5) Initial email. Allowed even after earlier emails (the user asked), but flagged.
  if (outboundCount > 0 && !inferred) {
    notices.push(`This lead was already emailed ${outboundCount} time${outboundCount === 1 ? '' : 's'}. A follow-up may fit better.`);
  }
  if (unansweredInbound && !inferred) {
    notices.push('This lead has replied. Consider replying instead of sending a new intro.');
  }
  return { blocked: false, kind: 'INITIAL', revise: false, final: false, focus: null, meeting: false, styles, notices };
}