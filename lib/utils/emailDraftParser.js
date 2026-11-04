/**
 * Email draft extractor to detect and parse when Claude produces an email in conversation
 */
export function extractEmailDraft(content) {
  if (!content || typeof content !== 'string') return null;

  // Match Subject: ...
  const subjectMatch = content.match(/(?:^|\n)(?:\*{0,2})Subject:(?:\*{0,2})\s*([^\n]+)/i);
  if (!subjectMatch) return null;

  const subject = subjectMatch[1].replace(/^\*+|\*+$/g, '').trim();
  const subjectEndPos = subjectMatch.index + subjectMatch[0].length;
  let rawBody = content.substring(subjectEndPos).trim();

  // Strip code fences if wrapped
  rawBody = rawBody.replace(/^```(?:markdown|email|text)?\n?/i, '').replace(/\n?```$/i, '').trim();

  // Strip "Body:" header if present
  const bodyHeaderMatch = rawBody.match(/^(?:\*{0,2})Body:(?:\*{0,2})\s*\n?/i);
  if (bodyHeaderMatch) {
    rawBody = rawBody.substring(bodyHeaderMatch[0].length).trim();
  }

  // Ensure minimum length to avoid false positives on casual mentions
  if (subject && rawBody && rawBody.length > 20) {
    return { subject, body: rawBody };
  }
  return null;
}

