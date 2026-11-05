/**
 * MineTech Template Intelligence Service
 * 
 * Ingests, parses, splits, classifies, and manages prewritten email templates.
 * Supports:
 * - Direct text / paste
 * - TXT, DOCX, PDF, CSV, XLSX, XLS
 * - Intelligent multi-draft splitting
 * - Claude-powered semantic classification (Recipient Role, Product, Commercial Objective, Sequence Stage)
 * - Dynamic merge tags detection and preview
 * - Persistent storage in Supabase
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const mammoth = require('mammoth');
const pdf = require('pdf-parse');
import * as XLSX from 'xlsx';
import { supabaseAdmin } from '../supabase.js';
import { getAllProducts, detectProductsInText } from './productTaxonomyService.js';
export { unpackTemplateMetadata } from './campaignMatchingEngine.js';

const ANTHROPIC_ENDPOINT = 'https://api.anthropic.com/v1/messages';

function getAnthropicKey() {
  return process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY || '';
}

/**
 * Standard supported merge tags
 */
export const SUPPORTED_MERGE_TAGS = [
  { tag: '{{company_name}}', aliases: ['{{company}}', '{{Company}}', '{{companyName}}'], label: 'Company Name', fallback: 'your company' },
  { tag: '{{first_name}}', aliases: ['{{firstName}}', '{{First Name}}'], label: 'First Name', fallback: 'Colleague' },
  { tag: '{{last_name}}', aliases: ['{{lastName}}', '{{Last Name}}'], label: 'Last Name', fallback: '' },
  { tag: '{{product_name}}', aliases: ['{{product}}', '{{Product}}', '{{mineral}}'], label: 'Product Name', fallback: 'industrial minerals' },
  { tag: '{{country}}', aliases: ['{{Country}}', '{{location}}'], label: 'Country', fallback: '' },
  { tag: '{{sender_name}}', aliases: ['{{senderName}}'], label: 'Sender Name', fallback: 'Abdullah Rauf' },
  { tag: '{{sender_company}}', aliases: ['{{senderCompany}}'], label: 'Sender Company', fallback: 'MineTech Resources BV' }
];

/**
 * Parse text from different file formats into raw string or structured rows
 */
export async function parseFileToText(buffer, fileName = '', mimeType = '') {
  const ext = (fileName.split('.').pop() || '').toLowerCase();

  if (ext === 'docx') {
    const result = await mammoth.extractRawText({ buffer });
    return result.value || '';
  }

  if (ext === 'pdf') {
    const data = await pdf(buffer);
    return data.text || '';
  }

  if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    // If rows have Subject and Body columns, return structured rows
    if (rows.length > 0) {
      const firstRow = rows[0];
      const hasSubject = Object.keys(firstRow).some((k) => /subject|title|header/i.test(k));
      const hasBody = Object.keys(firstRow).some((k) => /body|content|text|message|email/i.test(k));

      if (hasSubject || hasBody) {
        return { isTabular: true, rows };
      }
    }

    // Otherwise convert sheet to plain text
    return XLSX.utils.sheet_to_txt(sheet);
  }

  // Default plain text (TXT or pasted text)
  return buffer.toString('utf-8');
}

/**
 * Separate a single raw text string containing multiple draft emails into individual templates
 */
export function splitMultiDraftText(rawText = '') {
  if (!rawText || typeof rawText !== 'string') return [];

  // If already structured with clear separators
  const separatorRegex = /(?:\n\s*(?:---+|===+|___+|\*\*\*+)\s*\n)|(?:\n\s*(?:Template|Email|Draft)\s*#?\s*\d+[\s:.-]+)/i;
  
  let chunks = rawText.split(separatorRegex).map((c) => c.trim()).filter(Boolean);

  // If no separator matched, check if multiple "Subject:" occurrences exist
  if (chunks.length <= 1) {
    const subjectMatches = [...rawText.matchAll(/(?:^|\n)\s*(?:Subject|Re):\s*/gi)];
    if (subjectMatches.length > 1) {
      chunks = [];
      for (let i = 0; i < subjectMatches.length; i++) {
        const start = subjectMatches[i].index;
        const end = (i + 1 < subjectMatches.length) ? subjectMatches[i + 1].index : rawText.length;
        chunks.push(rawText.substring(start, end).trim());
      }
    }
  }

  // If still single chunk, return as 1 template
  if (chunks.length === 0) chunks = [rawText.trim()];

  return chunks.map((chunk, idx) => {
    return extractSubjectAndBody(chunk, `Prewritten Template ${idx + 1}`);
  });
}

/**
 * Extract Subject and Body from an email draft text
 */
export function extractSubjectAndBody(text = '', defaultName = 'New Email Template') {
  let subject = '';
  let body = '';
  let name = defaultName;

  const lines = text.split('\n');
  let subjectLineIndex = -1;

  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const line = lines[i].trim();
    const match = line.match(/^(?:Subject|Re|Title|Headline)\s*:\s*(.+)$/i);
    if (match) {
      subject = match[1].trim();
      subjectLineIndex = i;
      break;
    }
  }

  if (subjectLineIndex !== -1) {
    body = lines.slice(subjectLineIndex + 1).join('\n').trim();
    name = subject.slice(0, 50);
  } else {
    // If no explicit Subject: header, use the first non-empty line as subject if it looks like a headline
    const firstLine = lines.find((l) => l.trim().length > 0) || defaultName;
    if (firstLine.length < 80 && !firstLine.toLowerCase().startsWith('dear') && !firstLine.toLowerCase().startsWith('hi')) {
      subject = firstLine.trim();
      body = lines.slice(lines.indexOf(firstLine) + 1).join('\n').trim();
      name = subject.slice(0, 50);
    } else {
      subject = defaultName;
      body = text.trim();
    }
  }

  return {
    name,
    subject: subject || defaultName,
    body: body || text.trim(),
    body_plain: body || text.trim(),
    body_html: `<p>${(body || text.trim()).replace(/\n\n+/g, '</p><p>').replace(/\n/g, '<br/>')}</p>`
  };
}

/**
 * Heuristic classifier for template when offline or as fallback
 */
export function heuristicClassifyTemplate({ name = '', subject = '', body = '' }) {
  const corpus = `${name} ${subject} ${body}`.toLowerCase();
  const detectedProducts = detectProductsInText(corpus);

  let recipientType = 'general';
  let commercialObjective = 'general_outreach';
  let sequenceStage = 'initial_outreach';

  // Recipient type detection
  if (
    corpus.includes('supplier') ||
    corpus.includes('sourcing') ||
    corpus.includes('we are looking to purchase') ||
    corpus.includes('quote your best price') ||
    corpus.includes('supply capability') ||
    corpus.includes('we source') ||
    corpus.includes('producer of')
  ) {
    recipientType = 'potential_supplier';
    commercialObjective = 'supplier_sourcing';
  } else if (
    corpus.includes('buyer') ||
    corpus.includes('we can supply') ||
    corpus.includes('our capabilities for bleaching') ||
    corpus.includes('supply of kaolin') ||
    corpus.includes('high activity bleaching') ||
    corpus.includes('offer high grade') ||
    corpus.includes('provide bentonite')
  ) {
    recipientType = 'prospective_buyer';
    commercialObjective = 'buyer_introduction';
  } else if (corpus.includes('partner') || corpus.includes('distributor') || corpus.includes('trading')) {
    recipientType = 'trading_partner';
    commercialObjective = 'partnership';
  }

  // Sequence detection
  if (corpus.includes('following up') || corpus.includes('second email') || corpus.includes('bump')) {
    sequenceStage = 'first_follow_up';
    commercialObjective = 'follow_up';
  } else if (corpus.includes('final follow') || corpus.includes('last attempt') || corpus.includes('close your file')) {
    sequenceStage = 'final_follow_up';
  }

  const primaryProduct = detectedProducts[0]?.product?.name || 'Industrial Minerals';

  // Detect merge variables
  const detectedVariables = [];
  for (const m of SUPPORTED_MERGE_TAGS) {
    if (corpus.includes(m.tag.toLowerCase())) {
      detectedVariables.push(m.tag);
    }
    for (const alias of m.aliases || []) {
      if (corpus.includes(alias.toLowerCase()) && !detectedVariables.includes(m.tag)) {
        detectedVariables.push(m.tag);
      }
    }
  }

  return {
    recipient_type: recipientType,
    product_category: primaryProduct,
    commercial_objective: commercialObjective,
    sequence_stage: sequenceStage,
    detected_variables: detectedVariables,
    confidence: detectedProducts.length > 0 ? 'medium' : 'low',
    reason: `Classified via copy semantics (detected: ${primaryProduct}, role: ${recipientType}, objective: ${commercialObjective})`
  };
}

/**
 * Classify email template using Claude AI
 */
export async function classifyTemplateWithClaude({
  name = '',
  subject = '',
  body = '',
  model = 'claude-sonnet-5-5'
}) {
  const apiKey = getAnthropicKey();
  if (!apiKey || !apiKey.startsWith('sk-ant')) {
    return heuristicClassifyTemplate({ name, subject, body });
  }

  const availableProducts = getAllProducts().map((p) => p.name);

  const systemPrompt = `You are the Lead Commercial Campaign Strategist for MineTech Resources (Belgium & Netherlands), an international industrial minerals trading & sourcing company.

Analyze the uploaded prewritten B2B email template and determine its exact business purpose, target audience, and campaign positioning.

AVAILABLE PRODUCTS: ${JSON.stringify(availableProducts)}

TAXONOMY & CLASSIFICATION RULES:
1. "recipient_type":
   - "prospective_buyer": MineTech is offering minerals to a company that uses/buys them (e.g., offering bleaching clay to oil refiners).
   - "potential_supplier": MineTech is seeking to purchase/source raw minerals from a producer/miner/exporter.
   - "existing_customer": Communication with established client.
   - "existing_supplier": Communication with established supplier.
   - "trading_partner": Seeking brokerage, distribution, or agency partnership.
   - "general": Broad company overview.
   CRITICAL DISTINCTION: Buying and Sourcing are opposite commercial flows. Check whether MineTech is SELLING/OFFERING (Buyer template) or INQUIRING/SOURCING (Supplier template).

2. "product_category": The primary mineral focus from ["Bleaching Clay", "Bentonite", "Kaolin", "Fire Clay", "Ball Clay", or "General Industrial Minerals"].

3. "commercial_objective": One of:
   - "buyer_introduction"
   - "supplier_sourcing"
   - "product_pricing_offer"
   - "technical_spec_request"
   - "partnership_proposal"
   - "follow_up"
   - "meeting_request"
   - "general_announcement"

4. "sequence_stage":
   - "initial_outreach" (First touch / introduction)
   - "first_follow_up" (Day 3-5 gentle check-in)
   - "second_follow_up" (Day 7-10 value-add)
   - "final_follow_up" (Breakup / closure)
   - "general"

5. "detected_variables": Array of merge tags identified in the template (e.g., ["{{company_name}}", "{{first_name}}"]).

OUTPUT FORMAT: Strict JSON object ONLY. No markdown wrappers.
{
  "recipient_type": "prospective_buyer" | "potential_supplier" | "existing_customer" | "existing_supplier" | "trading_partner" | "general",
  "product_category": string,
  "commercial_objective": string,
  "sequence_stage": string,
  "detected_variables": string[],
  "confidence": "high" | "medium" | "low",
  "reason": string
}`;

  const userPrompt = `Classify this prewritten email template:
Name: "${name}"
Subject: "${subject}"
Body:
${body}`;

  try {
    const candidateModels = [model, 'claude-sonnet-5-5', 'claude-opus-5-5'];
    const chosenModel = candidateModels.find(Boolean) || 'claude-sonnet-5-5';

    const reqBody = {
      model: chosenModel,
      max_tokens: 1200,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }]
    };

    const res = await fetch(ANTHROPIC_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(reqBody)
    });

    if (res.ok) {
      const data = await res.json();
      const text = (data.content || [])
        .filter((b) => b?.type === 'text' || typeof b?.text === 'string')
        .map((b) => b.text)
        .join('')
        .trim();

      const cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*$/gi, '').trim();
      const parsed = JSON.parse(cleaned);

      return {
        recipient_type: parsed.recipient_type || 'prospective_buyer',
        product_category: parsed.product_category || 'Bleaching Clay',
        commercial_objective: parsed.commercial_objective || 'buyer_introduction',
        sequence_stage: parsed.sequence_stage || 'initial_outreach',
        detected_variables: Array.isArray(parsed.detected_variables) ? parsed.detected_variables : [],
        confidence: ['high', 'medium', 'low'].includes(parsed.confidence) ? parsed.confidence : 'high',
        reason: parsed.reason || 'Classified by Claude AI model'
      };
    }
  } catch (err) {
    console.warn('[TemplateIntel Service]: Claude classification fallback:', err.message);
  }

  return heuristicClassifyTemplate({ name, subject, body });
}

/**
 * Ingest, classify, and persist template in Supabase
 */
export async function createAndClassifyTemplate({
  name,
  subject,
  body,
  bodyHtml,
  userId = null,
  model = 'claude-sonnet-5-5'
}) {
  const classification = await classifyTemplateWithClaude({ name, subject, body, model });

  // Pack metadata safely into variables array and category string for Supabase schema compatibility
  const metadataTag = `meta:${JSON.stringify({
    recipient_type: classification.recipient_type,
    product_category: classification.product_category,
    commercial_objective: classification.commercial_objective,
    sequence_stage: classification.sequence_stage,
    confidence: classification.confidence,
    reason: classification.reason
  })}`;

  const cleanVariables = Array.from(new Set([...(classification.detected_variables || []), metadataTag]));

  const payload = {
    name: name || subject || 'New Template',
    subject: subject || 'No Subject',
    body_plain: body || '',
    body_html: bodyHtml || `<p>${(body || '').replace(/\n\n+/g, '</p><p>').replace(/\n/g, '<br/>')}</p>`,
    category: classification.product_category || 'Industrial Minerals',
    variables: cleanVariables,
    created_by: userId
  };

  const { data, error } = await supabaseAdmin
    .from('email_templates')
    .insert(payload)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to save template to Supabase: ${error.message}`);
  }

  return {
    ...data,
    classification
  };
}

/**
 * Resolve merge tags against a lead record with sensible fallbacks
 */
export function interpolateTemplate(content = '', lead = {}, sender = {}) {
  if (!content || typeof content !== 'string') return '';

  let interpolated = content;

  const company = lead.company || lead.company_name || 'your company';
  const firstName = lead.first_name || (lead.full_name ? lead.full_name.split(' ')[0] : 'Colleague');
  const lastName = lead.last_name || '';
  const product = lead.product || lead.mineral || lead.materials || 'industrial minerals';
  const country = lead.country || lead.location?.country || '';
  const senderName = sender.name || 'Abdullah Rauf';
  const senderCompany = sender.company || 'MineTech Resources BV';

  const replacements = {
    '{{company_name}}': company,
    '{{company}}': company,
    '{{Company}}': company,
    '{{companyName}}': company,
    '{{first_name}}': firstName,
    '{{firstName}}': firstName,
    '{{First Name}}': firstName,
    '{{last_name}}': lastName,
    '{{lastName}}': lastName,
    '{{product_name}}': product,
    '{{product}}': product,
    '{{Product}}': product,
    '{{country}}': country,
    '{{Country}}': country,
    '{{sender_name}}': senderName,
    '{{senderName}}': senderName,
    '{{sender_company}}': senderCompany,
    '{{senderCompany}}': senderCompany
  };

  for (const [tag, value] of Object.entries(replacements)) {
    interpolated = interpolated.replaceAll(tag, value);
  }

  return interpolated;
}
