/**
 * MineTech Company Intelligence Engine
 * 
 * Powered by Claude (claude-sonnet-5-5 / claude-opus-5-5).
 * Intelligently analyzes company identity, determines buyer/supplier relationship,
 * identifies relevant industrial products, assigns explainable confidence, and caches profiles.
 */

import { supabaseAdmin } from '../supabase.js';
import { getAllProducts, detectProductsInText } from './productTaxonomyService.js';

const ANTHROPIC_ENDPOINT = 'https://api.anthropic.com/v1/messages';

function getAnthropicKey() {
  return process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY || '';
}

// In-memory LRU-style cache for company intelligence: keyed by normalizedDomain or normalizedCompany
const companyIntelCache = new Map();

/**
 * Extract clean corporate domain from email or website
 */
export function extractCorporateDomain(email = '', website = '') {
  if (website) {
    try {
      const url = website.startsWith('http') ? website : `https://${website}`;
      const parsed = new URL(url);
      const host = parsed.hostname.replace(/^www\./, '').toLowerCase().trim();
      if (host && !isGenericEmailHost(host)) return host;
    } catch {}
  }

  if (email && email.includes('@')) {
    const domain = email.split('@')[1]?.toLowerCase().trim();
    if (domain && !isGenericEmailHost(domain)) {
      return domain;
    }
  }

  return null;
}

function isGenericEmailHost(domain = '') {
  const generic = [
    'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com',
    'aol.com', 'zoho.com', 'protonmail.com', 'mail.com', 'yandex.com', 'live.com'
  ];
  return generic.includes(domain.toLowerCase().trim());
}

/**
 * Helper to normalize string keys
 */
function getCacheKey(companyName = '', domain = '') {
  const cleanComp = (companyName || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  const cleanDom = (domain || '').toLowerCase().replace(/[^a-z0-9.]+/g, '');
  return `${cleanComp}__${cleanDom}`;
}

/**
 * Heuristic fallback classifier when offline or as pre-check
 */
export function heuristicClassifyCompany({ companyName = '', email = '', industry = '', notes = '', website = '' }) {
  const textCorpus = `${companyName} ${email} ${industry} ${notes} ${website}`.toLowerCase();
  const detectedProducts = detectProductsInText(textCorpus);

  let relationshipTypes = [];
  let isBuyer = false;
  let isSupplier = false;
  let isTrading = false;

  // Buyer signals
  if (
    textCorpus.includes('purchasing') ||
    textCorpus.includes('procurement') ||
    textCorpus.includes('refiner') ||
    textCorpus.includes('edible oil') ||
    textCorpus.includes('ceramics') ||
    textCorpus.includes('sanitaryware') ||
    textCorpus.includes('foundry') ||
    textCorpus.includes('drilling') ||
    textCorpus.includes('steel') ||
    textCorpus.includes('refractory manufacturer') ||
    textCorpus.includes('tile factory')
  ) {
    isBuyer = true;
  }

  // Supplier signals
  if (
    textCorpus.includes('mining') ||
    textCorpus.includes('miner') ||
    textCorpus.includes('quarry') ||
    textCorpus.includes('producer') ||
    textCorpus.includes('processor') ||
    textCorpus.includes('exporter') ||
    textCorpus.includes('calcined') ||
    textCorpus.includes('deposit') ||
    textCorpus.includes('clay supply') ||
    textCorpus.includes('bentonite supply') ||
    textCorpus.includes('minerals producer')
  ) {
    isSupplier = true;
  }

  // Trading signals
  if (
    textCorpus.includes('trading') ||
    textCorpus.includes('distributor') ||
    textCorpus.includes('broker') ||
    textCorpus.includes('import export') ||
    textCorpus.includes('import-export') ||
    textCorpus.includes('commodities')
  ) {
    isTrading = true;
  }

  if (isBuyer) relationshipTypes.push('prospective_buyer');
  if (isSupplier) relationshipTypes.push('potential_supplier');
  if (isTrading) relationshipTypes.push('trading_partner');

  if (relationshipTypes.length === 0) {
    relationshipTypes.push('requires_review');
  }

  const relevantProducts = detectedProducts.map((p) => p.product.name);
  const confidence = (detectedProducts.length > 0 && relationshipTypes.length > 0 && !relationshipTypes.includes('requires_review'))
    ? 'medium'
    : 'low';

  return {
    company_name: companyName,
    domain: extractCorporateDomain(email, website),
    relationship_types: relationshipTypes,
    buyer_seller_status: isBuyer && isSupplier ? 'Both' : (isBuyer ? 'Buyer' : (isSupplier ? 'Seller' : 'Unclassified')),
    relevant_products: relevantProducts.length > 0 ? relevantProducts : ['Industrial Minerals'],
    industry: industry || (detectedProducts[0]?.product?.category || 'Industrial Minerals & Clays'),
    confidence,
    reason: `Heuristic classification based on keyword signals: ${detectedProducts.map(p => p.reasons.join(', ')).filter(Boolean).join('; ') || 'Limited profile cues'}`,
    evidence_sources: ['company_name', 'email_domain', 'industry_cues'],
    requires_review: confidence === 'low',
    assessed_at: new Date().toISOString()
  };
}

/**
 * Identify and classify a company using Claude AI with full context
 */
export async function analyzeCompanyWithClaude({
  companyName = '',
  email = '',
  website = '',
  industry = '',
  notes = '',
  existingClassification = '',
  model = 'claude-sonnet-5-5'
}) {
  const corporateDomain = extractCorporateDomain(email, website);
  const cacheKey = getCacheKey(companyName, corporateDomain);

  // Check cache first
  if (companyIntelCache.has(cacheKey)) {
    return { ...companyIntelCache.get(cacheKey), fromCache: true };
  }

  const apiKey = getAnthropicKey();
  if (!apiKey || !apiKey.startsWith('sk-ant')) {
    // Graceful fallback to heuristic classification if API key not available
    const heuristic = heuristicClassifyCompany({ companyName, email, industry, notes, website });
    companyIntelCache.set(cacheKey, heuristic);
    return heuristic;
  }

  const availableProducts = getAllProducts().map((p) => ({
    name: p.name,
    category: p.category,
    applications: p.buyerApplications.slice(0, 5),
    supplierKeywords: p.supplierKeywords.slice(0, 4)
  }));

  const systemPrompt = `You are the Lead Commercial Intelligence Analyst for MineTech Resources (Belgium & Netherlands), an international B2B trading and sourcing company specializing in industrial minerals (Bleaching Clay, Bentonite, Kaolin, Fire Clay, Ball Clay).

Your task is to analyze a B2B company record and classify its commercial relationship to MineTech Resources.

AVAILABLE INDUSTRIAL PRODUCTS:
${JSON.stringify(availableProducts, null, 2)}

CLASSIFICATION RULES:
1. "relationship_types": Array containing one or more of:
   - "prospective_buyer" (Company uses/buys these industrial minerals for refining, ceramics, foundry, drilling, etc.)
   - "potential_supplier" (Company mines, produces, processes, or exports clays/minerals that MineTech can source)
   - "existing_customer" (Already an active client)
   - "existing_supplier" (Already an active supplier)
   - "trading_partner" (Intermediary, distributor, broker, or general mineral trading company)
   - "requires_review" (Insufficient evidence to classify)
   Note: DUAL-ROLE COMPANIES ARE ALLOWED (e.g., a company can be both a prospective buyer of Kaolin and a potential supplier of Bentonite).
2. "buyer_seller_status": "Buyer", "Seller", "Both", or "Unclassified".
3. "relevant_products": Array of exact product names from: ["Bleaching Clay", "Bentonite", "Kaolin", "Fire Clay", "Ball Clay", or other specific mineral].
4. "confidence": "high", "medium", or "low".
   - "high": Strong direct evidence in name, domain, or industry.
   - "medium": Plausible inference based on sector or application.
   - "low": Ambiguous or minimal signals.
5. "reason": Concise 1-2 sentence business justification explaining why this company was classified as a buyer or supplier for the specific product.

OUTPUT FORMAT: Strict valid JSON object ONLY. No markdown fences.
{
  "company_name": string,
  "domain": string,
  "relationship_types": string[],
  "buyer_seller_status": "Buyer" | "Seller" | "Both" | "Unclassified",
  "relevant_products": string[],
  "industry": string,
  "confidence": "high" | "medium" | "low",
  "reason": string,
  "evidence_sources": string[],
  "requires_review": boolean
}`;

  const userPrompt = `Analyze this company:
Company Name: "${companyName || 'Unknown'}"
Email: "${email || 'N/A'}"
Corporate Domain: "${corporateDomain || 'N/A'}"
Website: "${website || 'N/A'}"
Industry / Field: "${industry || 'N/A'}"
Notes / History: "${notes || 'N/A'}"
Existing Classification: "${existingClassification || 'N/A'}"`;

  try {
    const candidateModels = [model, 'claude-sonnet-5-5', 'claude-opus-5-5'];
    const chosenModel = candidateModels.find(Boolean) || 'claude-sonnet-5-5';

    const reqBody = {
      model: chosenModel,
      max_tokens: 1500,
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

      const result = {
        company_name: parsed.company_name || companyName,
        domain: parsed.domain || corporateDomain,
        relationship_types: Array.isArray(parsed.relationship_types) ? parsed.relationship_types : ['prospective_buyer'],
        buyer_seller_status: parsed.buyer_seller_status || (parsed.relationship_types?.includes('potential_supplier') ? 'Seller' : 'Buyer'),
        relevant_products: Array.isArray(parsed.relevant_products) && parsed.relevant_products.length > 0
          ? parsed.relevant_products
          : ['Industrial Minerals'],
        industry: parsed.industry || industry || 'Industrial Minerals',
        confidence: ['high', 'medium', 'low'].includes(parsed.confidence) ? parsed.confidence : 'medium',
        reason: parsed.reason || 'Classified based on company profile and product alignment',
        evidence_sources: parsed.evidence_sources || ['name', 'domain'],
        requires_review: parsed.requires_review !== undefined ? parsed.requires_review : (parsed.confidence === 'low'),
        assessed_at: new Date().toISOString()
      };

      companyIntelCache.set(cacheKey, result);
      return result;
    }
  } catch (err) {
    console.warn('[CompanyIntel Engine]: Claude invocation fallback to heuristic:', err.message);
  }

  // Fallback if Claude invocation failed
  const fallback = heuristicClassifyCompany({ companyName, email, industry, notes, website });
  companyIntelCache.set(cacheKey, fallback);
  return fallback;
}

/**
 * Batch classify multiple leads with concurrency control & Supabase persistence
 */
export async function batchAnalyzeCompanies(leads = [], { concurrency = 5, model = 'claude-sonnet-5-5' } = {}) {
  const results = [];
  const queue = [...leads];

  const worker = async () => {
    while (queue.length > 0) {
      const lead = queue.shift();
      if (!lead) break;

      try {
        const intel = await analyzeCompanyWithClaude({
          companyName: lead.company || lead.company_name || lead.full_name,
          email: lead.email,
          website: lead.website,
          industry: lead.industry || lead.niche,
          notes: lead.notes,
          existingClassification: lead.classification,
          model
        });

        // Persist to lead if lead.id exists
        if (lead.id) {
          const customFields = { ...(lead.custom_fields || {}), company_intelligence: intel };
          await supabaseAdmin
            .from('leads')
            .update({
              custom_fields: customFields,
              classification: intel.buyer_seller_status,
              updated_at: new Date().toISOString()
            })
            .eq('id', lead.id);
        }

        results.push({ leadId: lead.id, lead, intelligence: intel });
      } catch (e) {
        console.error(`[batchAnalyzeCompanies] Error on lead ${lead.id || lead.email}:`, e);
      }
    }
  };

  const workers = Array.from({ length: Math.min(concurrency, leads.length) }, () => worker());
  await Promise.all(workers);

  return results;
}

