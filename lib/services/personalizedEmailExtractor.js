/**
 * MineTech Personalized Email Extractor Service
 * 
 * Ingests multi-email PDFs / documents containing company-specific outreach emails.
 * Separates individual emails, extracts company name, contact, subject, and body,
 * while STRICTLY PRESERVING the user's original writing (no auto-rewriting or tone altering).
 */

import { parseFileToText } from './templateIntelligenceService.js';

const ANTHROPIC_ENDPOINT = 'https://api.anthropic.com/v1/messages';

function getAnthropicKey() {
  return process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY || '';
}

/**
 * Clean and normalize text
 */
function cleanText(txt = '') {
  return txt.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
}

/**
 * Format plain text into clean HTML paragraphs while preserving line breaks
 */
export function formatBodyHtml(plainText = '') {
  if (!plainText) return '';
  if (plainText.trim().startsWith('<') && plainText.includes('</')) {
    return plainText; // already HTML
  }

  const paragraphs = plainText.split(/\n{2,}/);
  return paragraphs
    .map((p) => `<p>${p.trim().replace(/\n/g, '<br/>')}</p>`)
    .join('');
}

/**
 * Rule-based heuristic extractor for multi-email documents
 */
export function extractEmailsHeuristic(rawText = '') {
  const text = cleanText(rawText);
  if (!text) return [];

  // Patterns indicating true boundaries between distinct emails:
  // 1. Explicit dividers: ---, ===, ___, ***, Page X of Y, or Email/Draft/Message #N
  // 2. Clear new email starts preceded by a blank line or double line break
  const dividerRegex = /(?:\n\s*(?:---+|===+|___+|\*\*\*+|Page\s+\d+\s+of\s+\d+|Email\s*#?\s*\d+|Draft\s*#?\s*\d+)\s*\n)/i;

  let rawChunks = text.split(dividerRegex).map((c) => c.trim()).filter(Boolean);

  // If no divider matched, check if emails are separated by double newline followed by "Company:" or "Dear"
  if (rawChunks.length <= 1) {
    const multiCompMatches = [...text.matchAll(/(?:^|\n\s*\n)\s*(?:(?:Company|Client|Account)\s*:\s*|#+\s*Email\s*\d+)/gi)];
    if (multiCompMatches.length > 1) {
      rawChunks = [];
      for (let i = 0; i < multiCompMatches.length; i++) {
        const start = multiCompMatches[i].index;
        const end = (i + 1 < multiCompMatches.length) ? multiCompMatches[i + 1].index : text.length;
        rawChunks.push(text.substring(start, end).trim());
      }
    }
  }

  // If still single chunk, check if repeated "Subject:" occurrences exist preceded by blank lines
  if (rawChunks.length <= 1) {
    const subjectMatches = [...text.matchAll(/(?:^|\n\s*\n)\s*(?:Subject|Re)\s*:\s*/gi)];
    if (subjectMatches.length > 1) {
      rawChunks = [];
      for (let i = 0; i < subjectMatches.length; i++) {
        const start = subjectMatches[i].index;
        const end = (i + 1 < subjectMatches.length) ? subjectMatches[i + 1].index : text.length;
        rawChunks.push(text.substring(start, end).trim());
      }
    }
  }

  if (rawChunks.length === 0) {
    rawChunks = [text];
  }

  const extracted = [];

  rawChunks.forEach((chunk, index) => {
    if (!chunk || chunk.length < 20) return;

    let companyName = '';
    let contactName = '';
    let contactEmail = '';
    let subject = '';
    let body = chunk;
    let needsCorrection = false;
    const correctionNotes = [];

    const lines = chunk.split('\n').map((l) => l.trim());

    // 1. Detect Company: ...
    for (let i = 0; i < Math.min(lines.length, 8); i++) {
      const line = lines[i];
      const compMatch = line.match(/^(?:Company|Target Company|Client|Firm|Account)\s*:\s*(.+)$/i);
      if (compMatch) {
        companyName = compMatch[1].trim();
        lines.splice(i, 1);
        break;
      }
    }

    // 2. Detect Contact / To: ...
    for (let i = 0; i < Math.min(lines.length, 8); i++) {
      const line = lines[i];
      const contactMatch = line.match(/^(?:Contact|To|Attention|Attn|Recipient)\s*:\s*(.+)$/i);
      if (contactMatch) {
        const contactVal = contactMatch[1].trim();
        // Check if email embedded in contact
        const emailMatch = contactVal.match(/<([^>]+)>|([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
        if (emailMatch) {
          contactEmail = (emailMatch[1] || emailMatch[2]).toLowerCase().trim();
          contactName = contactVal.replace(emailMatch[0], '').replace(/[()<>]/g, '').trim();
        } else {
          contactName = contactVal;
        }
        lines.splice(i, 1);
        break;
      }
    }

    // 3. Detect Subject: ...
    for (let i = 0; i < Math.min(lines.length, 8); i++) {
      const line = lines[i];
      const subMatch = line.match(/^(?:Subject|Re|Title)\s*:\s*(.+)$/i);
      if (subMatch) {
        subject = subMatch[1].trim();
        lines.splice(i, 1);
        break;
      }
    }

    // 4. If no explicit Subject: header, detect "Dear [Name]" or use first strong line
    const remainingText = lines.join('\n').trim();
    if (!subject) {
      const firstLine = lines.find((l) => l.length > 0) || '';
      if (firstLine.length > 5 && firstLine.length < 80 && !firstLine.toLowerCase().startsWith('dear')) {
        subject = firstLine;
      } else {
        subject = companyName ? `Outbound Enquiry — ${companyName}` : `Personalized Outreach #${index + 1}`;
        needsCorrection = true;
        correctionNotes.push('Subject line was missing; placeholder created');
      }
    }

    // 5. If company name is missing, attempt to extract from body or email domain
    if (!companyName) {
      const dearMatch = remainingText.match(/Dear\s+([A-Za-z\s]+?)(?:,|\sat\s+([A-Za-z0-9\s.,-]+))/i);
      if (dearMatch) {
        if (dearMatch[2]) companyName = dearMatch[2].trim();
        if (!contactName && dearMatch[1]) contactName = dearMatch[1].trim();
      }

      const emailDomainMatch = remainingText.match(/@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
      if (!companyName && emailDomainMatch) {
        const dom = emailDomainMatch[1].toLowerCase();
        if (!dom.includes('mine-tech') && !dom.includes('gmail') && !dom.includes('outlook')) {
          companyName = dom.split('.')[0].toUpperCase();
        }
      }

      if (!companyName) {
        companyName = `Company #${index + 1}`;
        needsCorrection = true;
        correctionNotes.push('Company name could not be identified automatically');
      }
    }

    body = remainingText;

    extracted.push({
      id: `draft-${Date.now()}-${index + 1}`,
      company_name: companyName,
      contact_name: contactName || '',
      contact_email: contactEmail || '',
      subject: subject,
      body_plain: body,
      body_html: formatBodyHtml(body),
      original_text: chunk,
      confidence: needsCorrection ? 'medium' : 'high',
      needs_correction: needsCorrection,
      correction_notes: correctionNotes.length > 0 ? correctionNotes.join('; ') : null,
      selected: true,
      approval_status: 'pending_review', // pending_review | approved | blocked
      matched_lead: null,
      match_status: 'unmatched', // matched | needs_review | unmatched
    });
  });

  return extracted;
}

/**
 * MineTech AI-powered extractor using Claude Sonnet 5.5
 * Strictly extracts individual emails without altering words, tone, or style.
 */
export async function extractEmailsWithClaude(rawText = '', model = 'claude-sonnet-5-5') {
  const apiKey = getAnthropicKey();
  if (!apiKey) {
    console.warn('[Extractor] No Anthropic API key found. Falling back to heuristic extractor.');
    return extractEmailsHeuristic(rawText);
  }

  const prompt = `You are the MineTech AI Extraction Engine for B2B industrial mineral sales.
You have been provided with the raw extracted text of a PDF document containing multiple personalized outreach emails written for distinct companies.

YOUR MISSION:
Separate and extract each individual email into a structured JSON array.

CRITICAL INSTRUCTIONS (MANDATORY):
1. PRESERVE THE USER'S ORIGINAL WRITING EXACTLY. Do NOT rewrite, summarize, shorten, improve, modernize, or alter ANY words, grammar, greetings, or sentences. Extract the exact text verbatim.
2. Identify:
   - "company_name": Name of the target company the email is written for.
   - "contact_name": Person name if addressed or mentioned (e.g. "Dear Thomas Müller" -> "Thomas Müller"), or null.
   - "contact_email": Email address if present in header/body, or null.
   - "subject": The subject line of the email. If missing, extract the first clear headline or summarize what the email is about, and set "missing_subject": true.
   - "body_plain": The complete verbatim email body text, keeping paragraph breaks intact.
   - "body_html": The complete verbatim email body converted into clean HTML <p>...</p> tags with <br/> for line breaks.
   - "needs_correction": Boolean, true if company name or subject was ambiguous.
   - "correction_notes": String describing any extraction ambiguity (or null).
3. If an email spans multiple pages, combine it into one single email record.
4. If multiple emails are addressed to the same company, extract each one as a separate item in the array.

OUTPUT FORMAT:
Return ONLY a valid JSON array of objects with no conversational markdown, no code fences, no extra text.
Example format:
[
  {
    "company_name": "ABC Minerals GmbH",
    "contact_name": "Thomas Müller",
    "contact_email": "thomas@abcminerals.de",
    "subject": "Supply of High-Purity Bentonite & Bleaching Clay",
    "body_plain": "Dear Thomas,\\n\\nWe supply...",
    "body_html": "<p>Dear Thomas,</p><p>We supply...</p>",
    "needs_correction": false,
    "correction_notes": null
  }
]

DOCUMENT TEXT TO EXTRACT:
${rawText.slice(0, 80000)}`;

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
        max_tokens: 4096,
        temperature: 0.1, // low temperature for deterministic verbatim extraction
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) {
      console.warn(`[Extractor] Anthropic API returned HTTP ${res.status}. Falling back to heuristic.`);
      return extractEmailsHeuristic(rawText);
    }

    const json = await res.json();
    const rawContent = json?.content?.[0]?.text || '';

    // Extract JSON array
    let parsedArray = null;
    const jsonMatch = rawContent.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (jsonMatch) {
      try {
        parsedArray = JSON.parse(jsonMatch[0]);
      } catch (pe) {
        console.warn('[Extractor] JSON parse failed on Claude response:', pe.message);
      }
    }

    if (!Array.isArray(parsedArray) || parsedArray.length === 0) {
      console.warn('[Extractor] Claude did not return a valid array. Using heuristic extractor.');
      return extractEmailsHeuristic(rawText);
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
      approval_status: 'pending_review',
      matched_lead: null,
      match_status: 'unmatched',
    }));
  } catch (err) {
    console.error('[Extractor] Exception in extractEmailsWithClaude:', err);
    return extractEmailsHeuristic(rawText);
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

  // 2. Extract individual emails (uses Claude if key available, with heuristic fallback)
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
