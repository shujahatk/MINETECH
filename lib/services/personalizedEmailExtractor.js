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
 * Unwraps artificial PDF line breaks within paragraphs while strictly preserving
 * real paragraph breaks, greetings, headings, bullet lists, and sign-offs.
 */
export function unwrapPdfLineArtifacts(text = '') {
  if (!text) return '';

  // 1. Split into distinct paragraph blocks (separated by 2 or more newlines)
  const blocks = text.split(/\n{2,}/);

  const cleanedBlocks = blocks.map((block) => {
    const rawLines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    if (rawLines.length === 0) return '';

    const mergedLines = [];
    let currentLine = rawLines[0];

    for (let i = 1; i < rawLines.length; i++) {
      const line = rawLines[i];
      const prevLine = rawLines[i - 1];

      // Check if current line is a bullet point, numbered list, or explicit heading
      const isBulletOrNum = /^[-*•–—\d\.)]\s+/i.test(line);
      // Check if previous line ended with a colon, e.g. "Requirements:", "Note:"
      const prevEndsWithColon = /[:]$/.test(prevLine);
      // Check if current line or previous line is a greeting or sign-off
      const isGreeting = /^(?:Dear|Hi|Hello|Good\s+(?:morning|afternoon|evening))\b/i.test(line);
      const isSignOff = /^(?:Best\s+regards|Kind\s+regards|Warm\s+regards|Regards|Sincerely|Thanks|Thank\s+you|Cheers)\b/i.test(line);
      const prevIsGreeting = /^(?:Dear|Hi|Hello|Good\s+(?:morning|afternoon|evening))\b/i.test(prevLine);
      const prevIsSignOff = /^(?:Best\s+regards|Kind\s+regards|Warm\s+regards|Regards|Sincerely|Thanks|Thank\s+you|Cheers)\b/i.test(prevLine);

      if (isBulletOrNum || prevEndsWithColon || isGreeting || isSignOff || prevIsGreeting || prevIsSignOff) {
        mergedLines.push(currentLine);
        currentLine = line;
      } else {
        // Artificial line wrap: merge with space
        if (/[-–—]$/.test(currentLine)) {
          currentLine = currentLine.slice(0, -1) + line;
        } else {
          currentLine = currentLine + ' ' + line;
        }
      }
    }
    mergedLines.push(currentLine);

    return mergedLines.join('\n');
  });

  return cleanedBlocks.filter(Boolean).join('\n\n');
}

/**
 * Format plain text into clean, professional email HTML paragraphs
 * Uses standard Arial/Helvetica B2B email typography
 */
export function formatBodyHtml(plainText = '') {
  if (!plainText) return '';
  if (plainText.trim().startsWith('<') && plainText.includes('</')) {
    return plainText; // already HTML
  }

  const unwrapped = unwrapPdfLineArtifacts(plainText);
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
    const lines = chunk.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return;

    let companyName = '';
    let contactName = '';
    let contactEmail = '';
    let subject = '';
    let bodyStartIndex = 0;
    let needsCorrection = false;
    const correctionNotes = [];

    // 1. Inspect first line for heading (e.g. "1. Solmax Geosynthetics – Gaston Krusel")
    const headerLine = lines[0];
    if (/^\d{1,3}[\.\)]\s+|(?:Email|Draft|Message)\s*#?\s*\d+/i.test(headerLine)) {
      const cleanHeader = headerLine
        .replace(/^\d{1,3}[\.\)]\s*/, '')
        .replace(/^(?:Email|Draft|Message)\s*#?\s*\d+[:\.\-]?\s*/i, '')
        .trim();

      // Split company and contact by dash (–, —, -) surrounded by spaces, or colon
      const parts = cleanHeader.split(/\s+[-–—|:]\s+/);
      if (parts.length >= 2) {
        companyName = parts[0].trim();
        contactName = parts.slice(1).join(' - ').trim();
      } else {
        companyName = cleanHeader;
      }
      bodyStartIndex = 1;
    }

    // 2. Scan lines for To: and Subject:
    let subjectLineIdx = -1;
    for (let j = bodyStartIndex; j < Math.min(lines.length, bodyStartIndex + 6); j++) {
      const line = lines[j];

      // Inline To: ... Subject: ... on the same line
      const inlineMatch = line.match(/^To\s*:\s*([^\s]+@[^\s]+|\S+)\s+(?:Subject|Re|Title)\s*:\s*(.+)$/i);
      if (inlineMatch) {
        if (!contactEmail) contactEmail = inlineMatch[1].trim();
        subject = inlineMatch[2].trim();
        subjectLineIdx = j;
        bodyStartIndex = Math.max(bodyStartIndex, j + 1);
        break;
      }

      // Standalone To: ...
      const toOnly = line.match(/^(?:Contact|To|Attention|Attn|Recipient)\s*:\s*(.+)$/i);
      if (toOnly && !contactEmail) {
        const val = toOnly[1].trim();
        const emailMatch = val.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
        if (emailMatch) {
          contactEmail = emailMatch[1].toLowerCase().trim();
          const cleanName = val.replace(emailMatch[0], '').replace(/[()<>]/g, '').trim();
          if (cleanName && !contactName) contactName = cleanName;
        } else if (!contactName) {
          contactName = val;
        }
        bodyStartIndex = Math.max(bodyStartIndex, j + 1);
      }

      // Standalone Subject: ...
      const subjOnly = line.match(/^(?:Subject|Re|Title)\s*:\s*(.+)$/i);
      if (subjOnly && !subject) {
        subject = subjOnly[1].trim();
        subjectLineIdx = j;
        bodyStartIndex = Math.max(bodyStartIndex, j + 1);
      }
    }

    // 3. Check for wrapped multi-line subject before greeting line
    if (subjectLineIdx >= 0) {
      let nextIdx = subjectLineIdx + 1;
      while (
        nextIdx < lines.length &&
        !/^Dear/i.test(lines[nextIdx]) &&
        !/^Hi\b/i.test(lines[nextIdx]) &&
        !/^Hello\b/i.test(lines[nextIdx]) &&
        !/^Good\s+morning/i.test(lines[nextIdx])
      ) {
        if (lines[nextIdx].length < 75 && !lines[nextIdx].includes(':')) {
          subject += ' ' + lines[nextIdx];
          bodyStartIndex = Math.max(bodyStartIndex, nextIdx + 1);
          nextIdx++;
        } else {
          break;
        }
      }
    }

    // 4. Extract body text, unwrap artificial PDF line breaks, and normalize greetings
    const rawBodyText = chunk.split('\n').slice(bodyStartIndex).join('\n');
    let bodyPlain = unwrapPdfLineArtifacts(rawBodyText);
    bodyPlain = bodyPlain.replace(/^Dear([A-Z])/gm, 'Dear $1');
    const bodyHtml = formatBodyHtml(bodyPlain);

    // 5. Fallback identification for contactName from greeting if still empty
    if (!contactName) {
      const greetingMatch = bodyPlain.match(/(?:Dear|Hi|Hello)\s+([A-Za-z\s.,-]+?)(?:,|\n|$)/i);
      if (greetingMatch) {
        contactName = greetingMatch[1].trim();
      }
    }

    // 6. Fallback identification for companyName from body if still empty
    if (!companyName) {
      const compMatch = bodyPlain.match(/(?:at|for|with)\s+([A-Za-z0-9\s.,-]+?)(?:\s+(?:plant|works|facility|business|team|operations|purchasing)|\s*[,.])/i);
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

    if (!subject) {
      subject = `Personalized Outreach #${emailNumber}`;
      needsCorrection = true;
      correctionNotes.push('Subject line was missing; placeholder created');
    }

    // 7. Assign attachments according to document instructions or default brochure
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
      body_plain: bodyPlain,
      body_html: formatBodyHtml(bodyPlain),
      original_text: chunk,
      assigned_attachments: assignedAttachments,
      confidence: needsCorrection ? 'medium' : 'high',
      needs_correction: needsCorrection,
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
1. PRESERVE THE USER'S ORIGINAL WRITING EXACTLY. Do NOT rewrite, summarize, shorten, improve, modernize, or alter ANY words, grammar, greetings, or sentences. Extract the exact text verbatim.
2. DO NOT DROP OR SKIP ANY EMAILS. If there are 24 emails in the document, you MUST extract all 24 emails.
3. For each email identify:
   - "company_name": Name of the target company the email is written for.
   - "contact_name": Person name if addressed or mentioned, or null.
   - "contact_email": Email address if present (e.g. from To:), or null.
   - "subject": The full subject line of the email.
   - "body_plain": The complete verbatim email body text, keeping paragraph breaks intact.
   - "body_html": The complete verbatim email body converted into clean HTML <p>...</p> tags with <br/> for line breaks.
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

    return parsedArray.map((item, idx) => ({
      id: `draft-${Date.now()}-${idx + 1}`,
      company_name: (item.company_name || `Company #${idx + 1}`).trim(),
      contact_name: (item.contact_name || '').trim(),
      contact_email: (item.contact_email || '').toLowerCase().trim(),
      subject: (item.subject || `Personalized Outreach #${idx + 1}`).trim(),
      body_plain: (item.body_plain || '').trim(),
      body_html: item.body_html || formatBodyHtml(item.body_plain || ''),
      original_text: item.body_plain || '',
      confidence: item.needs_correction ? 'medium' : 'high',
      needs_correction: Boolean(item.needs_correction),
      correction_notes: item.correction_notes || null,
      selected: true,
      approval_status: 'needs_review',
      matched_lead: null,
      match_status: 'unmatched',
      assigned_attachments: heuristicDrafts[idx]?.assigned_attachments || [],
    }));
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

  // 2. Extract individual emails (uses Claude Sonnet 5.5 + heuristic validation)
  const drafts = await extractEmailsWithClaude(rawText);

  // 3. Compile extraction summary statistics
  const summary = {
    totalIdentified: drafts.length,
    successfullyExtracted: drafts.filter((d) => !d.needs_correction).length,
    requiringManualCorrection: drafts.filter((d) => d.needs_correction).length,
    missingSubjectCount: drafts.filter((d) => !d.subject || d.subject.startsWith('Personalized Outreach #')).length,
    rawTextLength: rawText.length,
  };

  return {
    drafts,
    summary,
    rawTextPreview: rawText.slice(0, 500),
  };
}
