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
import zlib from 'zlib';
import * as XLSX from 'xlsx';
import { supabaseAdmin } from '../supabase.js';
import { getAllProducts, detectProductsInText } from './productTaxonomyService.js';
import { unpackTemplateMetadata } from './campaignMatchingEngine.js';
export { unpackTemplateMetadata };

const ANTHROPIC_ENDPOINT = 'https://api.anthropic.com/v1/messages';
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // 15 MB
const ALLOWED_EXTENSIONS = new Set(['txt', 'md', 'text', 'docx', 'pdf', 'csv', 'xlsx', 'xls', 'json']);
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getAnthropicKey() {
  return process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY || '';
}

/**
 * Polyfill browser canvas geometry globals required by pdfjs-dist / pdf-parse v2 in serverless Node runtimes
 */
function ensurePdfPolyfills() {
  if (typeof globalThis.DOMMatrix === 'undefined') {
    globalThis.DOMMatrix = class DOMMatrix {
      constructor() {
        this.a = 1;
        this.b = 0;
        this.c = 0;
        this.d = 1;
        this.e = 0;
        this.f = 0;
        this.is2D = true;
        this.isIdentity = true;
      }
      multiply() { return this; }
      translate() { return this; }
      scale() { return this; }
      rotate() { return this; }
      invertSelf() { return this; }
      multiplySelf() { return this; }
      preMultiplySelf() { return this; }
      translateSelf() { return this; }
      scaleSelf() { return this; }
      rotateSelf() { return this; }
      transformPoint(p) { return p || { x: 0, y: 0, z: 0, w: 1 }; }
    };
  }
  if (typeof globalThis.ImageData === 'undefined') {
    globalThis.ImageData = class ImageData {
      constructor(width, height) {
        this.width = width || 1;
        this.height = height || 1;
        this.data = new Uint8ClampedArray(this.width * this.height * 4);
      }
    };
  }
  if (typeof globalThis.Path2D === 'undefined') {
    globalThis.Path2D = class Path2D {
      addPath() { }
      closePath() { }
      moveTo() { }
      lineTo() { }
      bezierCurveTo() { }
      quadraticCurveTo() { }
      arc() { }
      arcTo() { }
      ellipse() { }
      rect() { }
    };
  }
}

/**
 * Ensure the PDF.js fake worker handler is registered on globalThis.pdfjsWorker
 * so pdf-parse v2 / pdfjs-dist does not attempt dynamic file-system worker imports
 * in Vercel serverless environments (/var/task).
 */
async function ensurePdfWorkerLoaded() {
  if (globalThis.pdfjsWorker?.WorkerMessageHandler) {
    return;
  }
  try {
    const workerMod = await import('pdfjs-dist/legacy/build/pdf.worker.mjs');
    if (workerMod?.WorkerMessageHandler) {
      globalThis.pdfjsWorker = { WorkerMessageHandler: workerMod.WorkerMessageHandler };
    }
  } catch (_) {
    // Fallback handled by extractRawPdfFallback if worker cannot load
  }
}

function unescapePdfString(str) {
  return str
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\\\/g, '\\')
    .replace(/\\([0-7]{1,3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)));
}

function extractTextFromPdfStreamContent(content) {
  const lines = [];
  // Match BT ... ET text blocks, or fall back to full stream content
  const blocks = [];
  const btEtRegex = /\bBT\b([\s\S]*?)\bET\b/g;
  let blockMatch;
  while ((blockMatch = btEtRegex.exec(content)) !== null) {
    blocks.push(blockMatch[1]);
  }
  if (blocks.length === 0) {
    blocks.push(content);
  }

  for (const block of blocks) {
    const blockParts = [];
    // Match either (...) Tj, (...) ', or [...] TJ
    const tokenRegex = /\(([^()\\]*(?:\\.[^()\\]*)*)\)\s*(?:Tj|')|\[([\s\S]*?)\]\s*TJ/g;
    let m;
    while ((m = tokenRegex.exec(block)) !== null) {
      if (m[1] !== undefined) {
        blockParts.push(unescapePdfString(m[1]));
      } else if (m[2] !== undefined) {
        let tjLine = '';
        const itemRegex = /\(([^()\\]*(?:\\.[^()\\]*)*)\)|(-?\d+(?:\.\d+)?)/g;
        let item;
        while ((item = itemRegex.exec(m[2])) !== null) {
          if (item[1] !== undefined) {
            tjLine += unescapePdfString(item[1]);
          } else if (item[2] !== undefined) {
            const kerning = parseFloat(item[2]);
            if (kerning < -120) {
              tjLine += ' ';
            }
          }
        }
        if (tjLine) {
          blockParts.push(tjLine);
        }
      }
    }
    if (blockParts.length > 0) {
      lines.push(blockParts.join('\n'));
    }
  }

  return lines.join('\n').trim();
}

/**
 * Extract readable text strings from raw and FlateDecode-compressed PDF streams as a fallback
 */
function extractRawPdfFallback(buffer) {
  const raw = buffer.toString('latin1');
  const extractedChunks = [];

  // 1. Decompress any stream ... endstream blocks (FlateDecode) and extract text operators
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let sm;
  while ((sm = streamRegex.exec(raw)) !== null) {
    const streamBytes = Buffer.from(sm[1], 'latin1');
    let decoded = null;
    try {
      decoded = zlib.inflateSync(streamBytes).toString('latin1');
    } catch (_) {
      try {
        decoded = zlib.inflateRawSync(streamBytes).toString('latin1');
      } catch (__) {
        decoded = sm[1];
      }
    }
    if (decoded) {
      const text = extractTextFromPdfStreamContent(decoded);
      if (text) {
        extractedChunks.push(text);
      }
    }
  }

  if (extractedChunks.length > 0) {
    return extractedChunks.join('\n\n').trim();
  }

  // 2. Direct uncompressed stream scan
  return extractTextFromPdfStreamContent(raw);
}

/**
 * Advanced Spatial PDF Text Extractor
 * Uses pdfjs-dist coordinate tracking to accurately reconstruct natural paragraphs.
 * Measures vertical spacing (y-axis coordinate gaps) between visual lines:
 * - Within-paragraph line wraps (~14-19pt gap) are joined into continuous sentences.
 * - Intentional paragraph breaks (gap >= 21.0pt) and structural elements
 *   (greetings, sign-offs, list items, numbered email headers) are preserved as distinct paragraphs.
 */
export async function extractPdfTextWithSpatialParagraphs(buffer) {
  ensurePdfPolyfills();
  await ensurePdfWorkerLoaded();

  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
    disableFontFace: true,
  }).promise;

  const pageTexts = [];

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const textContent = await page.getTextContent();
    const items = (textContent.items || []).filter((it) => it.str && it.str.trim().length > 0);

    if (items.length === 0) continue;

    // Sort items top-to-bottom (y desc), then left-to-right (x asc)
    const sorted = [...items].sort((a, b) => {
      if (Math.abs(a.transform[5] - b.transform[5]) > 3) {
        return b.transform[5] - a.transform[5];
      }
      return a.transform[4] - b.transform[4];
    });

    // Group items into visual lines
    let curY = null;
    let curLine = [];
    const visualLines = [];

    for (const it of sorted) {
      const y = it.transform[5];
      if (curY === null || Math.abs(y - curY) <= 3) {
        curLine.push(it);
        if (curY === null) curY = y;
      } else {
        const text = curLine.map((i) => i.str).join(' ').replace(/\s+/g, ' ').trim();
        // Skip recurring headers and footers
        if (!text.match(/^Page\s+\d+\s+of\s+\d+$/i) && !text.match(/^MineTech\s+Wave[^\n]*$/i)) {
          visualLines.push({ y: curY, text });
        }
        curLine = [it];
        curY = y;
      }
    }
    if (curLine.length > 0) {
      const text = curLine.map((i) => i.str).join(' ').replace(/\s+/g, ' ').trim();
      if (!text.match(/^Page\s+\d+\s+of\s+\d+$/i) && !text.match(/^MineTech\s+Wave[^\n]*$/i)) {
        visualLines.push({ y: curY, text });
      }
    }

    // Group visual lines into paragraphs based on Y-gap
    const pageParagraphs = [];
    let currentPara = [];

    for (let i = 0; i < visualLines.length; i++) {
      const line = visualLines[i];
      const prevLine = i > 0 ? visualLines[i - 1] : null;

      const isEmailHeader = /^\d{1,3}[\.\)]\s+[A-Za-z0-9]/.test(line.text) || /^(?:Email|Draft|Message)\s*#?\s*\d+/i.test(line.text);
      const isToHeader = /^(?:To|Contact|Attention|Attn|Recipient)\s*[:—\-]/i.test(line.text);
      const isSubjectHeader = /^(?:Subject\s*Line|Subject|SUBJECT|Re|Title)\s*[:—\-]/i.test(line.text);
      const isCompanyHeader = /^(?:Company|Client|Account)\s*[:—\-]/i.test(line.text);
      const isGreeting = /^(?:Dear|Hi|Hello|Good\s+(?:morning|afternoon|evening))\b/i.test(line.text);
      const isSignOff = /^(?:(?:Kind|Best|Warm)?\s*regards|Sincerely|Cheers|Thanks|Thank\s+you)\b/i.test(line.text);
      const isList = /^[-*•–—\d\.)]\s+/.test(line.text);

      const gap = prevLine ? prevLine.y - line.y : 50;

      // In standard typography, line gap is ~14-19pt; paragraph gap is >= 21.0pt
      const isGapBreak = gap >= 21.0;
      const isStructuralBreak = isEmailHeader || isToHeader || isSubjectHeader || isCompanyHeader || isGreeting || isSignOff || isList;

      if (prevLine && (isGapBreak || isStructuralBreak)) {
        if (currentPara.length > 0) {
          pageParagraphs.push(currentPara);
        }
        currentPara = [line.text];
      } else {
        currentPara.push(line.text);
      }
    }
    if (currentPara.length > 0) {
      pageParagraphs.push(currentPara);
    }

    // Unify wrapped lines inside each paragraph
    const paragraphStrings = pageParagraphs.map((pLines) => {
      let unified = pLines[0];
      for (let j = 1; j < pLines.length; j++) {
        const prev = pLines[j - 1];
        const cur = pLines[j];
        if (/[-–—]$/.test(prev)) {
          if (/^[A-Z0-9]/.test(cur)) {
            // Keep hyphen for proper nouns or alphanumeric terms
            unified = unified + cur;
          } else {
            unified = unified.slice(0, -1) + cur;
          }
        } else {
          unified = unified + ' ' + cur;
        }
      }
      return unified;
    });

    pageTexts.push(paragraphStrings.join('\n\n'));
  }

  return pageTexts.join('\n\n');
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
  if (!buffer || buffer.length === 0) {
    throw new Error('Uploaded file is empty. Please provide a file with email template content.');
  }

  if (buffer.length > MAX_UPLOAD_BYTES) {
    throw new Error('Uploaded file exceeds the 15 MB size limit.');
  }

  const hasExtension = fileName.includes('.');
  const ext = hasExtension ? (fileName.split('.').pop() || '').toLowerCase().trim() : '';

  if (ext && !ALLOWED_EXTENSIONS.has(ext)) {
    throw new Error(`Unsupported file format ".${ext}". Supported formats: TXT, DOCX, PDF, CSV, XLSX, XLS.`);
  }

  if (ext === 'docx') {
    const req = createRequire(import.meta.url);
    const mammoth = req('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    return (result?.value || '').trim();
  }

  if (ext === 'pdf') {
    ensurePdfPolyfills();
    await ensurePdfWorkerLoaded();

    // 1. Primary Strategy: Spatial paragraph extraction preserving continuous sentences and true paragraph gaps
    try {
      const spatialText = await extractPdfTextWithSpatialParagraphs(buffer);
      if (spatialText && spatialText.trim().length > 50) {
        return spatialText.trim();
      }
    } catch (spatialErr) {
      console.warn('[PDF] Spatial paragraph extraction fallback:', spatialErr.message);
    }

    // 2. Secondary Strategy: Standard pdf-parse
    try {
      const req = createRequire(import.meta.url);
      const pdfModule = req('pdf-parse');
      if (typeof pdfModule === 'function') {
        const data = await pdfModule(buffer);
        const cleaned = (data?.text || '').replace(/\n*--\s*\d+\s*of\s*\d+\s*--\n*/gi, '\n\n').trim();
        if (cleaned) return cleaned;
      }
      if (typeof pdfModule?.PDFParse === 'function') {
        const parser = new pdfModule.PDFParse({ data: new Uint8Array(buffer) });
        try {
          const data = await parser.getText();
          const cleaned = (data?.text || '').replace(/\n*--\s*\d+\s*of\s*\d+\s*--\n*/gi, '\n\n').trim();
          if (cleaned) return cleaned;
        } finally {
          if (typeof parser.destroy === 'function') {
            await parser.destroy().catch(() => { });
          }
        }
      }
    } catch (pdfErr) {
      const fallbackText = extractRawPdfFallback(buffer);
      if (fallbackText) return fallbackText;
      throw new Error(`Could not parse PDF file: ${pdfErr.message}`);
    }
    return extractRawPdfFallback(buffer);
  }

  if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames?.[0];
    if (!sheetName) {
      throw new Error('Spreadsheet contains no sheets or readable rows.');
    }
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
    return XLSX.utils.sheet_to_txt(sheet).trim();
  }

  // Check for binary null bytes in plain-text fallback
  const sampleLength = Math.min(buffer.length, 512);
  for (let i = 0; i < sampleLength; i++) {
    if (buffer[i] === 0) {
      throw new Error('File appears to be a binary or corrupted document. Please upload TXT, DOCX, PDF, CSV, or XLSX.');
    }
  }

  // Default plain text (TXT, MD, JSON, or pasted text)
  return buffer.toString('utf-8').trim();
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
        reason: parsed.reason || 'Classified by MineTech AI'
      };
    }
  } catch (err) {
    console.warn('[TemplateIntel Service]: MineTech AI classification fallback:', err.message);
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
  category = null,
  userId = null,
  model = 'claude-sonnet-5-5'
}) {
  const cleanBody = (body || '').trim();
  const cleanSubject = (subject || name || 'No Subject').trim();
  const cleanName = (name || cleanSubject || 'New Template').trim();

  if (!cleanBody && !bodyHtml) {
    throw new Error('Template body content cannot be empty.');
  }

  const classification = await classifyTemplateWithClaude({
    name: cleanName,
    subject: cleanSubject,
    body: cleanBody,
    model
  });

  const resolvedCategory = category && category.trim()
    ? category.trim()
    : (classification.product_category || 'Industrial Minerals');

  // Pack metadata safely into variables array and category string for Supabase schema compatibility
  const metadataTag = `meta:${JSON.stringify({
    recipient_type: classification.recipient_type,
    product_category: resolvedCategory,
    commercial_objective: classification.commercial_objective,
    sequence_stage: classification.sequence_stage,
    confidence: classification.confidence,
    reason: classification.reason
  })}`;

  const cleanVariables = Array.from(new Set([...(classification.detected_variables || []), metadataTag]));
  const safeUserId = userId && UUID_REGEX.test(String(userId).trim()) ? String(userId).trim() : null;

  const payload = {
    name: cleanName,
    subject: cleanSubject,
    body_plain: cleanBody,
    body_html: bodyHtml || `<p>${cleanBody.replace(/\n\n+/g, '</p><p>').replace(/\n/g, '<br/>')}</p>`,
    category: resolvedCategory,
    variables: cleanVariables,
    created_by: safeUserId
  };

  // Deduplication check: if a template with the exact same subject and body_plain already exists, update it
  const { data: existing } = await supabaseAdmin
    .from('email_templates')
    .select('id')
    .eq('subject', cleanSubject)
    .eq('body_plain', cleanBody)
    .limit(1)
    .maybeSingle();

  let data = null;
  let error = null;

  if (existing?.id) {
    const updateRes = await supabaseAdmin
      .from('email_templates')
      .update({
        name: payload.name,
        body_html: payload.body_html,
        category: payload.category,
        variables: payload.variables,
        updated_at: new Date().toISOString()
      })
      .eq('id', existing.id)
      .select()
      .single();
    data = updateRes.data;
    error = updateRes.error;
  } else {
    let insertRes = await supabaseAdmin
      .from('email_templates')
      .insert(payload)
      .select()
      .single();

    // If userId is not present in public.users (foreign key constraint), retry with created_by: null
    if (insertRes.error && payload.created_by && /foreign key|uuid|created_by/i.test(insertRes.error.message)) {
      insertRes = await supabaseAdmin
        .from('email_templates')
        .insert({ ...payload, created_by: null })
        .select()
        .single();
    }

    data = insertRes.data;
    error = insertRes.error;
  }

  if (error) {
    throw new Error(`Failed to save template to Supabase: ${error.message}`);
  }

  const unpacked = unpackTemplateMetadata(data);
  return {
    ...data,
    ...unpacked,
    classification: {
      ...classification,
      product_category: resolvedCategory
    }
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
