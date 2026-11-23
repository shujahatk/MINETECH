/**
 * MineTech Personalized Email Extractor Service
 * 
 * Ingests multi-email PDFs / documents containing company-specific outreach emails.
 * Separates individual emails, extracts company name, contact, subject, and body,
 * while STRICTLY PRESERVING the user's original writing (no auto-rewriting or tone altering).
 */

import { parseFileToText } from './templateIntelligenceService.js';
import { PRECONFIGURED_DOCUMENTS } from './documentLibraryService.js';

const ANTHROPIC_ENDPOINT = 'https://api.anthropic.com/v1/messages';

function getAnthropicKey() {
  return process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY || '';
}

/**
 * Clean document text: strip recurring page footers, page headers, and line-feed artifacts
 */
export function cleanDocumentText(txt = '') {
  let cleaned = txt.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();

  // Strip page footers and headers (e.g. "Page 1 of 13", "Page 2", "MineTech Wave 1 – Final Email Drafts 1–24")
  cleaned = cleaned.replace(/(?:\n|^)\s*(?:Page\s+\d+\s+of\s+\d+|Page\s+\d+|\d+\s*\/\s*\d+)\s*(?:\n|$)/gi, '\n');
  cleaned = cleaned.replace(/(?:\n|^)\s*MineTech\s+Wave[^\n]*\s*(?:\n|$)/gi, '\n');
  cleaned = cleaned.replace(/\n*--\s*\d+\s*of\s*\d+\s*--\n*/gi, '\n');

  return cleaned.trim();
}

/**
 * Intelligent Paragraph Normalizer for PDF Email Extraction
 * Reconstructs continuous sentences from artificial PDF line breaks
 * while strictly preserving 100% of the original words, punctuation,
 * numbers, technical measurements (e.g. 0.5–2.0 mm, 18.0 mL, 600%),
 * casing, and grammatical intent.
 * 
 * Accurately distinguishes between:
 * - Artificial line breaks caused by PDF page width
 * - Intentional paragraph breaks
 * - Greetings (Dear ..., Hi ...)
 * - Closing sign-offs (Kind regards ..., Sincerely ...)
 * - Lists and bullet points
 */
export function normalizeEmailParagraphs(text = '') {
  if (!text || typeof text !== 'string') return '';

  const clean = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  const rawLines = clean.split('\n').map((l) => l.trim()).filter(Boolean);
  if (rawLines.length === 0) return '';

  const GREETING_RE = /^(?:Dear\s+|Hi\s+|Hello\s+|Good\s+(?:morning|afternoon|evening)\b)/i;
  const SIGNOFF_RE = /^(?:(?:Kind|Best|Warm)?\s*regards|Sincerely|Cheers|Thanks|Thank\s+you|Yours\s+truly)\b/i;
  const BULLET_RE = /^[-*•–—\d\.)]\s+/;
  const HEADER_RE = /^(?:To|From|Subject|Re|Attention|Attn|Company|Date):\s*/i;

  const paragraphs = [];
  let curPara = [];

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    const prev = curPara.length > 0 ? curPara[curPara.length - 1] : null;

    if (!prev) {
      curPara.push(line);
      continue;
    }

    // Structural boundaries that always start a new paragraph
    const isGreeting = GREETING_RE.test(line);
    const prevIsGreeting = GREETING_RE.test(prev);
    const isSignOff = SIGNOFF_RE.test(line);
    const prevIsSignOff = SIGNOFF_RE.test(prev);
    const isList = BULLET_RE.test(line);
    const prevIsList = BULLET_RE.test(prev);
    const isHeader = HEADER_RE.test(line);
    const prevIsHeader = HEADER_RE.test(prev);

    // Sentence continuation signals
    const startsWithLower = /^[a-z]/.test(line);
    const prevEndsWithComma = /[,]$/.test(prev);
    const prevEndsWithHyphen = /[-–—]$/.test(prev);
    const prevEndsWithColon = /[:]$/.test(prev);
    const prevEndsWithTerminal = /[.!?]$/.test(prev);

    // 1. Line starting with lowercase is ALWAYS sentence continuation
    if (startsWithLower) {
      curPara.push(line);
      continue;
    }

    // 2. Mid-sentence punctuation on previous line (comma, hyphen, open bracket)
    if ((prevEndsWithComma && !prevIsGreeting && !prevIsSignOff) || prevEndsWithHyphen || /[([]$/.test(prev)) {
      curPara.push(line);
      continue;
    }

    // 3. Previous line didn't end with sentence terminator, colon, greeting, or sign-off
    if (!prevEndsWithTerminal && !prevEndsWithColon && !prevIsGreeting && !prevIsSignOff && !prevIsHeader) {
      curPara.push(line);
      continue;
    }

    // 4. Greetings, sign-offs, lists, and headers always start a new paragraph
    if (isGreeting || prevIsGreeting || isSignOff || prevIsSignOff || isList || prevIsList || isHeader || prevIsHeader) {
      paragraphs.push(curPara);
      curPara = [line];
      continue;
    }

    // 5. Terminal punctuation: start a new paragraph
    paragraphs.push(curPara);
    curPara = [line];
  }

  if (curPara.length > 0) {
    paragraphs.push(curPara);
  }

  // Join lines within each paragraph
  return paragraphs
    .map((pLines) => {
      let result = pLines[0];
      for (let j = 1; j < pLines.length; j++) {
        const prev = pLines[j - 1];
        const cur = pLines[j];
        if (/[-–—]$/.test(prev)) {
          if (/^[A-Z0-9]/.test(cur)) {
            // Keep hyphen for compound proper nouns or alphanumeric terms (e.g. Niedersachsen/Sachsen-Anhalt, 3-MCPD)
            result = result + cur;
          } else {
            result = result.slice(0, -1) + cur;
          }
        } else {
          result = result + ' ' + cur;
        }
      }
      return result;
    })
    .join('\n\n');
}

/**
 * Check if text contains artificial line wraps that would be fixed by normalization
 */
export function hasLineWrapArtifacts(text = '') {
  if (!text || typeof text !== 'string') return false;
  const normalized = normalizeEmailParagraphs(text);
  return normalized !== text.trim();
}

/**
 * Backward compatibility alias for unwrapPdfLineArtifacts
 */
export const unwrapPdfLineArtifacts = normalizeEmailParagraphs;

/**
 * Format plain text into clean, professional email HTML paragraphs
 * Uses standard Arial/Helvetica B2B email typography
 */
export function formatBodyHtml(plainText = '') {
  if (!plainText) return '';
  if (plainText.trim().startsWith('<') && plainText.includes('</')) {
    return plainText; // already HTML
  }

  const unwrapped = normalizeEmailParagraphs(plainText);
  const paragraphs = unwrapped.split(/\n{2,}/);

  return paragraphs
    .map((p) => {
      const cleanP = p.trim().replace(/\n/g, '<br/>');
      return `<p style="margin: 0 0 16px 0; font-family: Arial, Helvetica, sans-serif; font-size: 14px; line-height: 1.6; color: #1e293b;">${cleanP}</p>`;
    })
    .join('');
}

/**
 * Detect global attachment instructions in document preamble
 * (e.g. "Attach MineTech_Company.pdf and MineTech_Bentonite.pdf to every email, except email 8 (company brochure only).")
 */
export function extractAttachmentInstructions(text = '') {
  const attachMatch = text.match(/Attach\s+([^\n]+?)\s+to\s+every\s+email(?:,\s*except\s+email\s+(\d+)\s*\(([^)]+)\))?/i);
  if (!attachMatch) return null;

  const rawDocs = attachMatch[1];
  const exceptionEmailNum = attachMatch[2] ? parseInt(attachMatch[2], 10) : null;
  const exceptionNote = attachMatch[3] || '';

  const defaultAttachments = [];
  if (/Company/i.test(rawDocs)) {
    const doc = PRECONFIGURED_DOCUMENTS.find((d) => d.id === 'doc-brochure-minetech');
    if (doc) defaultAttachments.push(doc);
  }
  if (/Bentonite/i.test(rawDocs)) {
    const doc = PRECONFIGURED_DOCUMENTS.find((d) => d.id === 'doc-bentonite-profiles');
    if (doc) defaultAttachments.push(doc);
  }
  if (/Bleaching/i.test(rawDocs)) {
    const doc = PRECONFIGURED_DOCUMENTS.find((d) => d.id === 'doc-bleaching-clay-specs');
    if (doc) defaultAttachments.push(doc);
  }

  return {
    rawInstruction: attachMatch[0],
    defaultAttachments,
    exceptionEmailNum,
    exceptionNote,
  };
}

/**
 * Enhanced, multi-strategy extractor for multi-email documents.
 * Correctly identifies all emails across page boundaries without truncating or skipping.
 */
export function extractEmailsHeuristic(rawText = '') {
  const cleaned = cleanDocumentText(rawText);
  if (!cleaned) return [];

  const attachRule = extractAttachmentInstructions(cleaned);

  // Separate document preamble (e.g. document title, global instructions) before Email 1
  let text = cleaned;
  const firstEmailIndex = text.search(/(?:^|\n)\s*(?:1[\.\)]\s+[A-Za-z0-9]|(?:Email|Draft|Message)\s*#?1[:\.\-]?\s*)/i);
  if (firstEmailIndex > 0) {
    text = text.slice(firstEmailIndex).trim();
  }

  // Multi-Strategy Boundary Splitting:
  let rawChunks = [];

  // Strategy 1: Numbered email headers (e.g. "1. Solmax...", "2. Bauer...", "Email 1", "Draft 1", "#1")
  const numPattern = /(?:^|\n)\s*(?=\d{1,3}[\.\)]\s+[A-Za-z0-9]|(?:Email|Draft|Message)\s*#?\s*\d+[:\.\-]?\s*)/gi;
  const numChunks = text.split(numPattern).map((c) => c.trim()).filter((c) => c.length > 20);
  const validNumChunks = numChunks.filter((c) => /^\d{1,3}[\.\)]\s+|(?:Email|Draft|Message)\s*#?\s*\d+/i.test(c));

  if (validNumChunks.length >= 2) {
    rawChunks = validNumChunks;
  } else {
    // Strategy 2: Repeating To: headers preceded by newlines
    const toPattern = /(?:^|\n)\s*(?=To\s*:\s*[^\s]+@[^\s]+)/gi;
    const toChunks = text.split(toPattern).map((c) => c.trim()).filter((c) => c.length > 20);
    if (toChunks.length >= 2) {
      rawChunks = toChunks;
    } else {
      // Strategy 3: Repeating Company: headers
      const compPattern = /(?:^|\n\s*\n)\s*(?=(?:Company|Client|Account)\s*:\s*)/gi;
      const compChunks = text.split(compPattern).map((c) => c.trim()).filter((c) => c.length > 20);
      if (compChunks.length >= 2) {
        rawChunks = compChunks;
      } else {
        // Strategy 4: Explicit dividers (---, ===, ___, ***)
        const divPattern = /(?:\n\s*(?:---+|===+|___+|\*\*\*+)\s*\n)/i;
        rawChunks = text.split(divPattern).map((c) => c.trim()).filter((c) => c.length > 20);
      }
    }
  }

  if (rawChunks.length === 0) {
    rawChunks = [text];
  }

  const extracted = [];

  rawChunks.forEach((chunk, index) => {
    const emailNumber = index + 1;
    const raw = (chunk || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
    const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return;

    let companyName = '';
    let contactName = '';
    let contactEmail = '';
    let subject = '';
    let bodyPlain = '';
    let needsCorrection = false;
    const correctionNotes = [];

    // Extract email address anywhere in the text if present
    const emailMatch = raw.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    if (emailMatch) {
      contactEmail = emailMatch[1].toLowerCase().trim();
    }

    // 1. Parse Subject Line (Mandatory: Verbatim extraction, zero AI rewriting)
    // Matches Subject:, Subject Line:, SUBJECT —, SUBJECT -, Re:, Title:
    const SUBJ_LABEL = /(?:^|\n|\s)(?:Subject\s*Line|Subject|SUBJECT|Re|Title)\s*[:—\-]\s*/i;
    const subjMatch = raw.match(SUBJ_LABEL);

    let bodyAfterSubject = '';
    if (subjMatch) {
      const textAfterLabel = raw.slice(subjMatch.index + subjMatch[0].length);
      // Boundary where subject ends and body begins
      const BOUNDARY_REGEX = /(?:\n\s*\n|\n(?=(?:Dear\b|Hi\b|Hello\b|Good\s+(?:morning|afternoon|evening))\b)|(?<=[a-z0-9)\]\-])\s+(?=\b(?:Dear\b|Hi\b|Hello\b|I\s+was\b|I\s+am\b|I'm\b|I’m\b|I\s+wanted\b|I\s+came\b|I\s+noticed\b|I\s+understand\b|I\s+realise\b|I\s+realize\b|I\s+wondered\b|I\s+thought\b|I'm\s+getting\b|I\s+am\s+reaching\b|Given\b|As\s+we\b)\b))/i;

      const splitIdx = textAfterLabel.search(BOUNDARY_REGEX);
      let rawSubject = '';
      if (splitIdx >= 0) {
        rawSubject = textAfterLabel.slice(0, splitIdx).trim();
        bodyAfterSubject = textAfterLabel.slice(splitIdx).trim();
      } else {
        const firstNewline = textAfterLabel.indexOf('\n');
        if (firstNewline >= 0) {
          rawSubject = textAfterLabel.slice(0, firstNewline).trim();
          bodyAfterSubject = textAfterLabel.slice(firstNewline).trim();
        } else {
          rawSubject = textAfterLabel.trim();
          bodyAfterSubject = '';
        }
      }

      subject = rawSubject
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
    } else {
      // Subject could not be confidently identified: flag for review
      subject = '';
      needsCorrection = true;
      correctionNotes.push('Subject line was missing; please enter subject');
    }

    // 2. Parse Company & Contact from header line (e.g. "1. Solmax Geosynthetics – Gaston Krusel")
    const headerLine = lines[0];
    if (/^\d{1,3}[\.\)]\s+|(?:Email|Draft|Message)\s*#?\s*\d+/i.test(headerLine)) {
      let headingPart = headerLine
        .replace(/^\d{1,3}[\.\)]\s*/, '')
        .replace(/^(?:Email|Draft|Message)\s*#?\s*\d+[:\.\-]?\s*/i, '')
        .trim();

      // Strip out any To:, Subject:, or email that may have merged onto line 0
      headingPart = headingPart.replace(/\s+(?:To|Contact|Attn|Attention)\s*[:—\-].*$/i, '');
      headingPart = headingPart.replace(/\s+(?:Subject\s*Line|Subject|SUBJECT|Re|Title)\s*[:—\-].*$/i, '');
      headingPart = headingPart.replace(/\s+[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}.*$/, '');

      const parts = headingPart.split(/\s+[-–—|:]\s+/);
      if (parts.length >= 2) {
        companyName = parts[0].trim();
        contactName = parts.slice(1).join(' - ').trim();
      } else {
        companyName = headingPart.trim();
      }
    }

    // Fallback for contactName if empty
    if (!contactName) {
      const toMatch = raw.match(/(?:To|Contact|Attn|Attention|Recipient)\s*[:—\-]\s*([^\n]+)/i);
      if (toMatch) {
        let val = toMatch[1].trim();
        val = val.replace(/\s+(?:Subject|Re|Title)\s*[:—\-].*$/i, '');
        if (emailMatch) val = val.replace(emailMatch[0], '');
        val = val.replace(/[()<>]/g, '').trim();
        if (val && !val.includes(':')) contactName = val;
      }
    }
    if (!contactName) {
      const greetingMatch = raw.match(/(?:Dear|Hi|Hello)\s+([A-Za-z\s.,-]+?)(?:,|\n|$)/i);
      if (greetingMatch) {
        contactName = greetingMatch[1].trim();
      }
    }

    // Fallback for companyName if empty
    if (!companyName) {
      const compMatch = raw.match(/(?:Company|Client|Account)\s*[:—\-]\s*([^\n]+)/i);
      if (compMatch) {
        companyName = compMatch[1].trim();
      } else if (contactEmail) {
        const domain = contactEmail.split('@')[1] || '';
        companyName = domain.split('.')[0].toUpperCase();
      } else {
        companyName = `Company #${emailNumber}`;
        needsCorrection = true;
        correctionNotes.push('Company name could not be identified automatically');
      }
    }

    // 3. Reconstruct Body Text (excluding the subject line completely)
    let bodySource = bodyAfterSubject || lines.slice(1).join('\n');

    // Strip any residual header metadata lines from top of body
    bodySource = bodySource
      .replace(/^(?:(?:To|Contact|Attn|Attention|Subject|Re|Title|Company)\s*[:—\-][^\n]*\n*)+/i, '')
      .trim();

    bodyPlain = normalizeEmailParagraphs(bodySource);
    bodyPlain = bodyPlain.replace(/^Dear([A-Z])/gm, 'Dear $1');
    const bodyHtml = formatBodyHtml(bodyPlain);

    // 4. Assign attachments according to document instructions or default brochure
    let assignedAttachments = [];
    if (attachRule) {
      if (attachRule.exceptionEmailNum === emailNumber && /brochure\s*only/i.test(attachRule.exceptionNote)) {
        const brochure = PRECONFIGURED_DOCUMENTS.find((d) => d.id === 'doc-brochure-minetech');
        assignedAttachments = brochure ? [brochure] : [];
      } else {
        assignedAttachments = [...attachRule.defaultAttachments];
      }
    }

    extracted.push({
      id: `draft-${Date.now()}-${emailNumber}`,
      index: emailNumber,
      company_name: companyName,
      contact_name: contactName || '',
      contact_email: contactEmail || '',
      subject: subject,
      extracted_subject: subject,
      edited_subject: subject,
      body_plain: bodyPlain,
      extracted_body_plain: bodyPlain,
      edited_body_plain: bodyPlain,
      body_html: bodyHtml,
      original_text: chunk,
      assigned_attachments: assignedAttachments,
      confidence: needsCorrection || !subject ? 'medium' : 'high',
      needs_correction: Boolean(needsCorrection || !subject),
      subject_needs_review: !subject,
      correction_notes: correctionNotes.length > 0 ? correctionNotes.join('; ') : null,
      selected: true,
      approval_status: 'needs_review',
      matched_lead: null,
      match_status: 'unmatched',
    });
  });

  return extracted;
}

/**
 * MineTech AI-powered extractor using Claude Sonnet 5.5
 * Strictly extracts individual emails without altering words, tone, or style.
 */
export async function extractEmailsWithClaude(rawText = '', model = 'claude-sonnet-5-5') {
  // First run high-precision heuristic extractor as ground truth / baseline
  const heuristicDrafts = extractEmailsHeuristic(rawText);

  const apiKey = getAnthropicKey();
  if (!apiKey) {
    return heuristicDrafts;
  }

  const prompt = `You are the MineTech AI Extraction Engine for B2B industrial mineral sales.
You have been provided with the text of a document containing multiple personalized outreach emails written for distinct companies.

YOUR MISSION:
Extract EVERY single individual email into a structured JSON array.

CRITICAL INSTRUCTIONS (MANDATORY):
1. PRESERVE THE USER'S ORIGINAL WRITING EXACTLY. Do NOT rewrite, summarize, shorten, improve, modernize, or alter ANY words, grammar, greetings, technical specifications (e.g. 0.5–2.0 mm, 18.0 mL, 600%), or numbers. Extract the exact text verbatim.
2. In 'body_plain', reconstruct natural paragraphs. Sentences within paragraphs must be continuous and must NOT be broken across multiple lines by PDF line wrapping. Separate paragraphs with double newlines (\n\n). Do NOT insert blank lines inside a single sentence.
3. DO NOT DROP OR SKIP ANY EMAILS. If there are 24 emails in the document, you MUST extract all 24 emails.
4. For each email identify:
   - "company_name": Name of the target company the email is written for.
   - "contact_name": Person name if addressed or mentioned, or null.
   - "contact_email": Email address if present (e.g. from To:), or null.
   - "subject": The full subject line of the email.
   - "body_plain": The complete verbatim email body text, keeping natural paragraphs continuous.
   - "body_html": The complete verbatim email body converted into clean HTML <p>...</p> tags with Arial typography.
   - "needs_correction": Boolean, true if company name or subject was ambiguous.
   - "correction_notes": String describing any extraction ambiguity (or null).

OUTPUT FORMAT:
Return ONLY a valid JSON array of objects with no conversational markdown, no code fences, no extra text.
Example format:
[
  {
    "company_name": "Solmax Geosynthetics",
    "contact_name": "Gaston Krusel",
    "contact_email": "gkruesel@solmax.com",
    "subject": "Sodium bentonite granules for GCL production – Rechlin",
    "body_plain": "Dear Gaston Krusel,\\n\\nThe BENTOLINER clay liners...",
    "body_html": "<p>Dear Gaston Krusel,</p><p>The BENTOLINER clay liners...</p>",
    "needs_correction": false,
    "correction_notes": null
  }
]

DOCUMENT TEXT TO EXTRACT:
${cleanDocumentText(rawText).slice(0, 100000)}`;

  try {
    const res = await fetch(ANTHROPIC_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: model === 'claude-opus-5-5' ? 'claude-opus-5-5' : 'claude-sonnet-5-5',
        max_tokens: 8192,
        // NOTE: temperature is omitted as latest Anthropic models deprecate it
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) {
      console.warn(`[Extractor] Anthropic API returned HTTP ${res.status}. Using heuristic extraction (${heuristicDrafts.length} emails).`);
      return heuristicDrafts;
    }

    const json = await res.json();
    const rawContent = json?.content?.[0]?.text || '';

    let parsedArray = null;
    const jsonMatch = rawContent.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (jsonMatch) {
      try {
        parsedArray = JSON.parse(jsonMatch[0]);
      } catch (pe) {
        console.warn('[Extractor] JSON parse failed on Claude response:', pe.message);
      }
    }

    // Safety check: If Claude returned fewer emails than heuristic found, use heuristic to avoid dropping emails!
    if (!Array.isArray(parsedArray) || parsedArray.length < heuristicDrafts.length) {
      console.warn(`[Extractor] Claude returned ${parsedArray?.length || 0} emails while heuristic identified ${heuristicDrafts.length}. Using heuristic extraction to guarantee zero email loss.`);
      return heuristicDrafts;
    }

    return parsedArray.map((item, idx) => {
      const cleanPlain = normalizeEmailParagraphs(item.body_plain || '');
      return {
        id: `draft-${Date.now()}-${idx + 1}`,
        company_name: (item.company_name || `Company #${idx + 1}`).trim(),
        contact_name: (item.contact_name || '').trim(),
        contact_email: (item.contact_email || '').toLowerCase().trim(),
        subject: (item.subject || `Personalized Outreach #${idx + 1}`).trim(),
        body_plain: cleanPlain,
        body_html: formatBodyHtml(cleanPlain),
        original_text: item.body_plain || '',
        confidence: item.needs_correction ? 'medium' : 'high',
        needs_correction: Boolean(item.needs_correction),
        correction_notes: item.correction_notes || null,
        selected: true,
        approval_status: 'needs_review',
        matched_lead: null,
        match_status: 'unmatched',
        assigned_attachments: heuristicDrafts[idx]?.assigned_attachments || [],
      };
    });
  } catch (err) {
    console.error('[Extractor] Exception in extractEmailsWithClaude:', err);
    return heuristicDrafts;
  }
}

/**
 * Main ingestion entry point: parses file buffer (PDF/DOCX/TXT) and extracts personalized emails
 */
export async function ingestPersonalizedEmails(fileBuffer, fileName = '', mimeType = '') {
  // 1. Parse document to raw text
  const rawText = await parseFileToText(fileBuffer, fileName, mimeType);
  if (!rawText || rawText.trim().length === 0) {
    throw new Error('No readable text could be extracted from the uploaded document.');
  }

  // 2. Extract individual emails using 100% deterministic, verbatim extractor (zero AI rewriting, punctuation & casing preserved)
  const drafts = extractEmailsHeuristic(rawText);

  // 3. Compile extraction summary statistics
  const summary = {
    totalIdentified: drafts.length,
    successfullyExtracted: drafts.filter((d) => !d.needs_correction && d.subject).length,
    requiringManualCorrection: drafts.filter((d) => d.needs_correction || !d.subject).length,
    missingSubjectCount: drafts.filter((d) => !d.subject).length,
    rawTextLength: rawText.length,
  };

  return {
    drafts,
    summary,
    rawTextPreview: rawText.slice(0, 500),
  };
}
