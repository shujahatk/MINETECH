/**
 * Centralized Prompt Templates for MineTech Campaign Management
 * 
 * Supports:
 * A. Initial Outreach
 * B. Follow-up Emails
 * C. Personalized B2B Outreach
 * D. Professional Introduction
 * E. Meeting Requests
 * F. Re-engagement Campaigns
 */

import { ensureMineTechSignatureHtml, ensureMineTechSignatureText } from '../utils/signature.js';

export const CAMPAIGN_TEMPLATE_TYPES = {
  INITIAL_OUTREACH: 'initial_outreach',
  FOLLOW_UP: 'follow_up',
  PERSONALIZED_B2B: 'personalized_b2b',
  PROFESSIONAL_INTRO: 'professional_intro',
  MEETING_REQUEST: 'meeting_request',
  RE_ENGAGEMENT: 're_engagement',
};

const JSON_OUTPUT_DIRECTIVE = `
CRITICAL FORMATTING REQUIREMENT:
You MUST respond ONLY with a single valid JSON object containing exactly two keys: "subject" and "bodyHtml".
Do NOT include backticks, markdown headers, conversational filler, or text outside the JSON.
Example valid response:
{"subject": "Low-Iron Kaolin supply for {{company}}", "bodyHtml": "<p>Hi {{firstName}},</p><p>Message text here...</p><p>Regards,<br/>Abdullah Rauf - Head of Sales</p>"}`;

export const CAMPAIGN_PROMPT_TEMPLATES = {
  [CAMPAIGN_TEMPLATE_TYPES.INITIAL_OUTREACH]: {
    id: CAMPAIGN_TEMPLATE_TYPES.INITIAL_OUTREACH,
    name: 'Initial Outreach',
    description: 'Direct, value-first introduction to MineTech mineral supply and processing capabilities.',
    defaultObjective: 'Evaluate mineral supply specifications and schedule a brief introductory call',
    systemInstruction: `You are a senior commercial sales manager for MineTech Resources BV (industrial minerals: high-purity kaolin, calcined chamotte, bauxite, bentonite, bleaching clay).
Write a focused, professional cold B2B outreach email (70-120 words).
Focus on product consistency, technical data sheet (TDS) certification, and European supply security.
Keep language natural and executive-grade.
Tone: Direct, consultative, authentic.
Merge tags to retain when helpful: {{firstName}}, {{company}}, {{jobTitle}}.
MANDATORY SIGN-OFF: You must conclude the email with:
Regards,<br/>Abdullah Rauf - Head of Sales
${JSON_OUTPUT_DIRECTIVE}`,
    userPromptTemplate: (lead, instructions) => `Prospect:
Company: ${lead.company || 'your team'}
Contact: ${lead.fullName || lead.firstName || 'there'} (${lead.jobTitle || 'Commercial Executive'})
Industry: ${lead.industry || lead.niche || 'Manufacturing / Processing'}

Campaign Instructions:
${instructions || 'Introduce MineTech high-grade industrial mineral solutions with guaranteed assay consistency.'}

Generate a concise cold email with a clear, low-friction call to action (e.g. 5-minute introductory call or review of technical specifications). Output as JSON with keys "subject" and "bodyHtml".`,
  },

  [CAMPAIGN_TEMPLATE_TYPES.FOLLOW_UP]: {
    id: CAMPAIGN_TEMPLATE_TYPES.FOLLOW_UP,
    name: 'Follow-Up Email',
    description: 'Polite, value-additive follow-up referencing prior outreach without guilt or pressure.',
    defaultObjective: 'Reconnect with prospect regarding technical requirements or grade availability',
    systemInstruction: `You are a consultative account executive for MineTech Resources BV.
Write a courteous, concise follow-up email (50-90 words).
Acknowledge they are busy, offer additional technical clarity or sample evaluation options, and do not use generic guilt trips like "just checking in" or "bumping this to the top of your inbox".
Tone: Professional, patient, solution-oriented.
MANDATORY SIGN-OFF:
Regards,<br/>Abdullah Rauf - Head of Sales
${JSON_OUTPUT_DIRECTIVE}`,
    userPromptTemplate: (lead, instructions) => `Prospect:
Company: ${lead.company || 'your team'}
Contact: ${lead.fullName || lead.firstName || 'there'} (${lead.jobTitle || 'Executive'})

Campaign Instructions:
${instructions || 'Follow up on our previous note regarding industrial mineral supply parameters and laboratory sample testing.'}

Generate a follow-up email. Output as JSON with keys "subject" and "bodyHtml".`,
  },

  [CAMPAIGN_TEMPLATE_TYPES.PERSONALIZED_B2B]: {
    id: CAMPAIGN_TEMPLATE_TYPES.PERSONALIZED_B2B,
    name: 'Personalized B2B Outreach',
    description: 'Deeply tailored message connecting prospect operational focus with specific mineral grades.',
    defaultObjective: 'Engage prospect on specific grade specifications (calcined kaolin, chamotte, bentonite)',
    systemInstruction: `You are an industrial technical sales specialist for MineTech Resources BV.
Write a personalized B2B outreach email (80-130 words) tailored to the prospect's specific operational and material requirements.
Reference the prospect's company and sector naturally without fabricating unverified claims.
Emphasize chemical assay consistency, low iron content where applicable, certified TDS, and European warehousing.
Tone: Technical, authoritative, respectful.
MANDATORY SIGN-OFF:
Regards,<br/>Abdullah Rauf - Head of Sales
${JSON_OUTPUT_DIRECTIVE}`,
    userPromptTemplate: (lead, instructions) => `Prospect Information:
Company: ${lead.company || 'your team'}
Contact: ${lead.fullName || lead.firstName || 'there'}
Job Title: ${lead.jobTitle || 'Technical Director'}
Industry: ${lead.industry || 'Ceramics, Refractories & Industrial Manufacturing'}

Campaign Instructions:
${instructions || 'Tailor to their production requirements with emphasis on certified technical assays and European supply logistics.'}

Output as JSON with keys "subject" and "bodyHtml".`,
  },

  [CAMPAIGN_TEMPLATE_TYPES.PROFESSIONAL_INTRO]: {
    id: CAMPAIGN_TEMPLATE_TYPES.PROFESSIONAL_INTRO,
    name: 'Professional Introduction',
    description: 'Executive-level corporate introduction highlighting warehouse footprint and supply reliability.',
    defaultObjective: 'Establish supplier qualification dialogue with European procurement',
    systemInstruction: `You are a commercial director at MineTech Resources BV.
Write an executive-to-executive introduction email (70-110 words) presenting MineTech's industrial mineral distribution platform and central logistics hub in Lamswaarde, the Netherlands.
Maintain high corporate professionalism, avoiding pushy sales jargon.
Tone: Sophisticated, business-first, strategic.
MANDATORY SIGN-OFF:
Regards,<br/>Abdullah Rauf - Head of Sales
${JSON_OUTPUT_DIRECTIVE}`,
    userPromptTemplate: (lead, instructions) => `Prospect Information:
Company: ${lead.company || 'your team'}
Contact: ${lead.fullName || lead.firstName || 'there'} (${lead.jobTitle || 'Procurement Leader'})

Campaign Instructions:
${instructions || 'Present MineTech European warehousing and strategic mineral supply reliability.'}

Output as JSON with keys "subject" and "bodyHtml".`,
  },

  [CAMPAIGN_TEMPLATE_TYPES.MEETING_REQUEST]: {
    id: CAMPAIGN_TEMPLATE_TYPES.MEETING_REQUEST,
    name: 'Meeting Request',
    description: 'Specific, low-friction invitation to a brief 10-minute technical review call.',
    defaultObjective: 'Secure a brief discovery or technical review call',
    systemInstruction: `You are an outbound specialist for MineTech Resources BV.
Write a clear, low-friction meeting invitation (60-100 words).
State the exact purpose of the discussion (reviewing raw material specifications or comparing assay sheets).
Propose specific availability or a brief 10-minute check-in without demanding lengthy commitments.
Tone: Crisp, respectful of their time, direct.
MANDATORY SIGN-OFF:
Regards,<br/>Abdullah Rauf - Head of Sales
${JSON_OUTPUT_DIRECTIVE}`,
    userPromptTemplate: (lead, instructions) => `Prospect Information:
Company: ${lead.company || 'your team'}
Contact: ${lead.fullName || lead.firstName || 'there'} (${lead.jobTitle || 'Operations Head'})

Campaign Instructions:
${instructions || 'Request a brief 10-minute call to compare current mineral grade benchmarks against MineTech specs.'}

Output as JSON with keys "subject" and "bodyHtml".`,
  },

  [CAMPAIGN_TEMPLATE_TYPES.RE_ENGAGEMENT]: {
    id: CAMPAIGN_TEMPLATE_TYPES.RE_ENGAGEMENT,
    name: 'Re-Engagement Campaign',
    description: 'Gentle re-activation for dormant leads or uncompleted conversations.',
    defaultObjective: 'Check if mineral procurement timing or quarterly requirements have changed',
    systemInstruction: `You are an account manager at MineTech Resources BV.
Write a polite, low-pressure re-engagement email (50-80 words).
Inquire whether procurement cycles for the upcoming quarter are open for new supplier qualification.
Keep the message succinct and easy to respond to with a simple one-sentence reply.
Tone: Friendly, non-intrusive, concise.
MANDATORY SIGN-OFF:
Regards,<br/>Abdullah Rauf - Head of Sales
${JSON_OUTPUT_DIRECTIVE}`,
    userPromptTemplate: (lead, instructions) => `Prospect Information:
Company: ${lead.company || 'your team'}
Contact: ${lead.fullName || lead.firstName || 'there'} (${lead.jobTitle || 'Commercial Contact'})

Campaign Instructions:
${instructions || 'Re-open dialogue for upcoming quarterly mineral supply and contract review.'}

Output as JSON with keys "subject" and "bodyHtml".`,
  },
};

/**
 * Defensive and multi-format extractor for Claude outputs.
 * Parses JSON, markdown-fenced JSON, embedded JSON, or structured Subject/Body text.
 */
export function extractSubjectAndBody(text) {
  if (!text || typeof text !== 'string') return null;

  const trimmed = text.trim();

  // 1. Clean markdown code fences if present
  const cleaned = trimmed
    .replace(/^```(?:json)?\s*/im, '')
    .replace(/\s*```$/m, '')
    .trim();

  // 2. Direct JSON Parse
  try {
    const parsed = JSON.parse(cleaned);
    if (parsed && typeof parsed === 'object') {
      const subject = parsed.subject || parsed.Subject;
      const body = parsed.bodyHtml || parsed.body_html || parsed.body || parsed.bodyText || parsed.body_plain;
      if (subject && body) {
        return { subject: String(subject).trim(), bodyHtml: String(body).trim() };
      }
    }
  } catch (e) {}

  // 3. Regex JSON block extraction inside text
  const jsonMatch = text.match(/\{[\s\S]*?"subject"\s*:\s*"[\s\S]*?"body(?:Html|_html)?"\s*:\s*"[\s\S]*?"\s*\}/i);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.subject && (parsed.bodyHtml || parsed.body_html || parsed.body)) {
        return {
          subject: String(parsed.subject).trim(),
          bodyHtml: String(parsed.bodyHtml || parsed.body_html || parsed.body).trim(),
        };
      }
    } catch (e2) {}
  }

  // 4. Plain text extraction with Subject: or **Subject:**
  const subjectMatch = text.match(/^\s*(?:\*\*)?Subject(?:\*\*)?:\s*(.+)$/im);
  if (subjectMatch) {
    const subject = subjectMatch[1].replace(/^\*\*|\*\*$/g, '').trim();
    // Body is everything after the subject line
    const bodyRaw = text.replace(/^\s*(?:\*\*)?Subject(?:\*\*)?:\s*.+$/im, '').trim();
    if (subject && bodyRaw) {
      const bodyHtml = bodyRaw.startsWith('<p') || bodyRaw.startsWith('<div')
        ? bodyRaw
        : `<p>${bodyRaw.replace(/\n\s*\n/g, '</p><p>').replace(/\n/g, '<br/>')}</p>`;
      return { subject, bodyHtml };
    }
  }

  return null;
}

/**
 * Validates generated email output
 */
export function validateGeneratedEmail(rawOutput) {
  if (!rawOutput) {
    return { valid: false, error: 'Output is empty' };
  }

  let extracted = null;
  if (typeof rawOutput === 'string') {
    extracted = extractSubjectAndBody(rawOutput);
  } else if (typeof rawOutput === 'object') {
    if (rawOutput.subject && (rawOutput.bodyHtml || rawOutput.body)) {
      extracted = {
        subject: String(rawOutput.subject).trim(),
        bodyHtml: String(rawOutput.bodyHtml || rawOutput.body).trim(),
      };
    } else {
      extracted = extractSubjectAndBody(JSON.stringify(rawOutput));
    }
  }

  if (!extracted || !extracted.subject || !extracted.bodyHtml) {
    return { valid: false, error: 'Could not extract valid subject and email body from AI response' };
  }

  const subject = extracted.subject.trim();
  const body = extracted.bodyHtml.trim();

  if (subject.length < 3) {
    return { valid: false, error: 'Generated email subject is too short' };
  }
  if (body.length < 25) {
    return { valid: false, error: 'Generated email body is empty or too short' };
  }

  // Check for broken placeholder leaks
  const placeholderRegex = /undefined|null|\[object Object\]|\{\{\s*undefined\s*\}\}/i;
  if (placeholderRegex.test(subject) || placeholderRegex.test(body)) {
    return { valid: false, error: 'Generated email contains unparsed placeholder artifacts' };
  }

  const cleanHtml = ensureMineTechSignatureHtml(body);
  const cleanText = ensureMineTechSignatureText(cleanHtml.replace(/<[^>]+>/g, '\n').replace(/\n{3,}/g, '\n\n'));

  return {
    valid: true,
    subject,
    bodyHtml: cleanHtml,
    bodyText: cleanText,
  };
}

/**
 * Lists all available campaign prompt templates with metadata
 */
export function listCampaignPromptTemplates() {
  return Object.values(CAMPAIGN_PROMPT_TEMPLATES).map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    defaultObjective: t.defaultObjective,
  }));
}

/**
 * Retrieves a prompt template by ID with safe fallback to Initial Outreach
 */
export function getCampaignPromptTemplate(templateId) {
  return CAMPAIGN_PROMPT_TEMPLATES[templateId] || CAMPAIGN_PROMPT_TEMPLATES[CAMPAIGN_TEMPLATE_TYPES.INITIAL_OUTREACH];
}

export default {
  CAMPAIGN_TEMPLATE_TYPES,
  CAMPAIGN_PROMPT_TEMPLATES,
  listCampaignPromptTemplates,
  getCampaignPromptTemplate,
  extractSubjectAndBody,
  validateGeneratedEmail,
};
