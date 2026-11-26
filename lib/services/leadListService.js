import { supabaseAdmin } from '../supabase.js';
import { deriveTemperature, TEMPERATURES, TEMPERATURE_FILTERS } from '../leads/temperature.js';

/**
 * Leads list service — optimised for the Leads table.
 *
 *  - Server-side filtering, sorting and pagination (never loads the whole table).
 *  - Selects only the columns the table renders; JSON fields are projected with
 *    `custom_fields->>key` so large blobs (AI studies, contacts) never leave the database.
 *  - One request returns the page and the exact total (no second count round-trip).
 *  - Owner names come from a short-lived cache; last-contact comes from one aggregate lookup
 *    for the whole page (no N+1).
 *  - Degrades gracefully when optional columns (next_follow_up_at, last_contacted_at) have not
 *    been migrated yet.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const CORE_COLUMNS =
  'id, first_name, last_name, full_name, email, company, job_title, status, score, tags, is_dnc, assigned_to, created_at, updated_at';
const OPTIONAL_COLUMNS = 'next_follow_up_at, last_contacted_at';
const JSON_PROJECTION = [
  'cf_priority:custom_fields->>priority',
  'cf_next_action:custom_fields->>next_action',
  'cf_next_action_date:custom_fields->>next_action_date',
  'cf_owner:custom_fields->>assigned_salesperson',
  'cf_product:custom_fields->>product_category',
  'cf_materials:custom_fields->>materials',
  'cf_country:custom_fields->>country',
  'cf_classification:custom_fields->>classification',
  'cf_supplier_type:custom_fields->>supplier_type',
  'cf_company_type:custom_fields->>company_type',
].join(', ');

export const SORT_COLUMNS = {
  name: 'full_name',
  fullName: 'full_name',
  company: 'company',
  email: 'email',
  status: 'status',
  priority: 'score',
  score: 'score',
  leadScore: 'score',
  createdAt: 'created_at',
  created_at: 'created_at',
  updatedAt: 'updated_at',
  updated_at: 'updated_at',
};

const HEAVY_CUSTOM_FIELD_KEYS = new Set(['ai_intelligence', 'conversation_intelligence', 'contacts']);

/* ------------------------------------------------------------------ */
/* Parameter normalisation (pure, unit-tested)                          */
/* ------------------------------------------------------------------ */

function clampInt(value, fallback, min, max) {
  const n = parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** Strip characters that would break PostgREST filter syntax or act as wildcards. */
export function sanitizeSearch(value = '') {
  return String(value ?? '')
    .replace(/[,()%*\\"'`;:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100);
}

function sanitizeToken(value = '', max = 60) {
  return String(value ?? '')
    .replace(/[,()%*\\"'`;:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function addDays(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

export function normalizeLeadListParams(raw = {}) {
  const get = (k) => (typeof raw.get === 'function' ? raw.get(k) : raw[k]);

  const status = String(get('status') || '').trim().toUpperCase();
  const temperature = String(get('temperature') || '').trim().toUpperCase();
  const owner = String(get('owner') || '').trim();
  const campaign = String(get('campaign') || '').trim();
  const followUp = String(get('followUp') || '').trim().toLowerCase();
  const classification = String(get('classification') || '').trim();
  const product = sanitizeToken(get('product') || '');
  const today = String(get('today') || '').trim();
  const view = String(get('view') || '').trim().toLowerCase() === 'board' ? 'board' : 'table';
  const sortBy = SORT_COLUMNS[get('sortBy')] ? get('sortBy') : 'createdAt';
  const sortDir = String(get('sortDir') || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';

  return {
    page: clampInt(get('page'), 1, 1, 100000),
    limit: clampInt(get('limit'), 25, 1, 100),
    search: sanitizeSearch(get('search')),
    status: /^[A-Z_]{2,40}$/.test(status) && status !== 'ALL' ? status : '',
    temperature: TEMPERATURES.includes(temperature) ? temperature : '',
    owner: UUID_RE.test(owner) ? owner : '',
    campaign: UUID_RE.test(campaign) ? campaign : '',
    campaignQuery: !UUID_RE.test(campaign) && campaign && campaign !== 'ALL' ? sanitizeSearch(campaign) : '',
    followUp: ['overdue', 'today', 'week', 'none'].includes(followUp) ? followUp : '',
    classification: ['Buyer', 'Seller', 'Buyer & Seller', 'Unassigned', 'Unclassified'].includes(classification)
      ? (classification === 'Unclassified' ? 'Unassigned' : classification)
      : '',
    today: DATE_RE.test(today) ? today : new Date().toISOString().slice(0, 10),
    product: product && product.toUpperCase() !== 'ALL' ? product : '',
    ai: '',
    tag: sanitizeToken(get('tag') || '', 40),
    view,
    sortBy,
    sortDir,
  };
}

/* ------------------------------------------------------------------ */
/* Query building                                                       */
/* ------------------------------------------------------------------ */

const BUYER_FILTER_OR = 'custom_fields->>classification.eq.Buyer,custom_fields->>leadRole.eq.Buyer,custom_fields->>lead_role.eq.Buyer,custom_fields->>classification.ilike.buyer,custom_fields->>leadRole.ilike.buyer,and(custom_fields->>classification.is.null,custom_fields->>supplier_type.ilike.%buyer%)';
const SELLER_FILTER_OR = 'custom_fields->>classification.eq.Seller,custom_fields->>leadRole.eq.Seller,custom_fields->>lead_role.eq.Seller,custom_fields->>classification.ilike.seller,custom_fields->>leadRole.ilike.seller,and(custom_fields->>classification.is.null,custom_fields->>supplier_type.ilike.%producer%),and(custom_fields->>classification.is.null,custom_fields->>supplier_type.ilike.%processor%),and(custom_fields->>classification.is.null,custom_fields->>supplier_type.ilike.%supplier%)';
const BUYER_SELLER_FILTER_OR = 'custom_fields->>classification.eq.Buyer & Seller,custom_fields->>classification.eq.Buyer and Seller,custom_fields->>leadRole.eq.Buyer & Seller,custom_fields->>lead_role.eq.Buyer & Seller';

/** Applies the normalised filter spec to a Supabase query builder. Returns the builder. */
export function applyLeadFilters(query, spec) {
  let q = query;

  if (spec.status) q = q.eq('status', spec.status);
  if (spec.owner) q = q.eq('assigned_to', spec.owner);
  if (spec.tag) q = q.contains('tags', [spec.tag]);
  if (spec.product) {
    const p = spec.product;
    q = q.or(`custom_fields->>product_category.ilike.%${p}%,custom_fields->>materials.ilike.%${p}%`);
  }
  if (spec.campaign) {
    q = q.eq('email_recipients.campaign_id', spec.campaign);
  } else if (Array.isArray(spec.campaignIds) && spec.campaignIds.length > 0) {
    q = q.in('email_recipients.campaign_id', spec.campaignIds);
  }

  if (spec.temperature) q = q.or(TEMPERATURE_FILTERS[spec.temperature]);

  if (spec.followUp) {
    const col = 'custom_fields->>next_action_date';
    if (spec.followUp === 'overdue') {
      q = q.lt(col, spec.today);
    } else if (spec.followUp === 'today') {
      q = q.gte(col, spec.today).lt(col, addDays(spec.today, 1));
    } else if (spec.followUp === 'week') {
      q = q.gte(col, spec.today).lt(col, addDays(spec.today, 8));
    } else if (spec.followUp === 'none') {
      q = q.or(`${col}.is.null,${col}.eq.`);
    }
  }

  if (spec.classification === 'Buyer') {
    q = q.or(BUYER_FILTER_OR);
  } else if (spec.classification === 'Seller') {
    q = q.or(SELLER_FILTER_OR);
  } else if (spec.classification === 'Buyer & Seller') {
    q = q.or(BUYER_SELLER_FILTER_OR);
  } else if (spec.classification === 'Unassigned' || spec.classification === 'Unclassified') {
    q = q.or('custom_fields->>classification.eq.Unassigned,custom_fields->>classification.eq.Unclassified,custom_fields->>leadRole.eq.Unassigned,custom_fields->>lead_role.eq.Unassigned,and(custom_fields->>classification.is.null,custom_fields->>leadRole.is.null,custom_fields->>supplier_type.not.ilike.%buyer%,custom_fields->>supplier_type.not.ilike.%producer%,custom_fields->>supplier_type.not.ilike.%supplier%)');
  }

  if (spec.search) {
    const s = spec.search;
    q = q.or(`full_name.ilike.%${s}%,email.ilike.%${s}%,company.ilike.%${s}%`);
  }

  return q;
}

function buildSelect(spec, tier) {
  const hasCampaign = Boolean(spec.campaign || (Array.isArray(spec.campaignIds) && spec.campaignIds.length > 0));
  const campaignJoin = hasCampaign ? ', email_recipients!inner(campaign_id)' : '';
  if (spec.view === 'board') {
    return tier === 1
      ? `${CORE_COLUMNS}, ${OPTIONAL_COLUMNS}, custom_fields${campaignJoin}`
      : `${CORE_COLUMNS}, custom_fields${campaignJoin}`;
  }
  return tier === 1
    ? `${CORE_COLUMNS}, ${OPTIONAL_COLUMNS}, ${JSON_PROJECTION}${campaignJoin}`
    : `${CORE_COLUMNS}, custom_fields${campaignJoin}`;
}

function runPageQuery(spec, tier, page) {
  const offset = (page - 1) * spec.limit;
  const ascending = spec.sortDir === 'asc';
  let q = supabaseAdmin.from('leads').select(buildSelect(spec, tier), { count: 'exact' });
  q = applyLeadFilters(q, spec);
  return q
    .order(SORT_COLUMNS[spec.sortBy], { ascending, nullsFirst: false })
    .order('id', { ascending: true })
    .range(offset, offset + spec.limit - 1);
}

/* ------------------------------------------------------------------ */
/* Lookups (cached / batched)                                           */
/* ------------------------------------------------------------------ */

let userNameCache = { at: 0, map: {}, list: [] };
const USER_CACHE_MS = 60_000;

async function loadUsers() {
  if (Date.now() - userNameCache.at < USER_CACHE_MS) return userNameCache;
  const { data } = await supabaseAdmin.from('users').select('id, name, email').limit(200);
  const map = {};
  const list = [];
  (data || []).forEach((u) => {
    const label = u.name || u.email || 'User';
    map[u.id] = label;
    list.push({ id: u.id, name: label });
  });
  userNameCache = { at: Date.now(), map, list };
  return userNameCache;
}

let lastContactRpcMissing = false;

/**
 * Latest outbound email touch per lead for one page of leads — a single aggregate lookup.
 * Uses the `leads_last_contact` RPC when migrated, otherwise two bounded queries.
 */
export async function getLastContactMap(ids = []) {
  const map = new Map();
  if (!ids.length) return map;

  const keep = (leadId, ts) => {
    if (!leadId || !ts) return;
    const prev = map.get(leadId);
    if (!prev || new Date(ts) > new Date(prev)) map.set(leadId, ts);
  };

  if (!lastContactRpcMissing) {
    const { data, error } = await supabaseAdmin.rpc('leads_last_contact', { p_lead_ids: ids });
    if (!error && Array.isArray(data)) {
      data.forEach((r) => keep(r.lead_id, r.last_contacted_at));
      return map;
    }
    if (error && (error.code === 'PGRST202' || error.code === '42883' || /could not find the function/i.test(error.message || ''))) {
      lastContactRpcMissing = true;
    }
  }

  const cap = Math.min(1000, ids.length * 6);
  const [msgs, recs] = await Promise.all([
    supabaseAdmin
      .from('email_messages')
      .select('lead_id, sent_at, created_at')
      .in('lead_id', ids)
      .eq('direction', 'outbound')
      .order('created_at', { ascending: false })
      .limit(cap),
    supabaseAdmin
      .from('email_recipients')
      .select('lead_id, sent_at')
      .in('lead_id', ids)
      .not('sent_at', 'is', null)
      .order('sent_at', { ascending: false })
      .limit(cap),
  ]);
  (msgs.data || []).forEach((m) => keep(m.lead_id, m.sent_at || m.created_at));
  (recs.data || []).forEach((r) => keep(r.lead_id, r.sent_at));
  return map;
}

/* ------------------------------------------------------------------ */
/* Row mapping (pure, unit-tested)                                      */
/* ------------------------------------------------------------------ */

function slimCustomFields(cf = {}) {
  const out = {};
  Object.keys(cf).forEach((k) => {
    if (!HEAVY_CUSTOM_FIELD_KEYS.has(k)) out[k] = cf[k];
  });
  return out;
}

export function mapLeadListRow(row, { ownerNames = {}, lastContact = null, view = 'table' } = {}) {
  const cf = row.custom_fields || {};
  const priorityRaw = row.cf_priority ?? cf.priority ?? '';
  const nextAction = row.cf_next_action ?? cf.next_action ?? cf.nextAction ?? '';
  const nextActionDate =
    row.cf_next_action_date ?? cf.next_action_date ?? cf.nextActionDate ?? row.next_follow_up_at ?? null;
  const score = row.score === null || row.score === undefined ? null : Number(row.score);

  const first = row.first_name || '';
  const last = row.last_name || '';
  const name = row.full_name || `${first} ${last}`.trim() || row.company || row.email || 'Unnamed lead';

  let lastContactedAt = lastContact || null;
  if (row.last_contacted_at && (!lastContactedAt || new Date(row.last_contacted_at) > new Date(lastContactedAt))) {
    lastContactedAt = row.last_contacted_at;
  }

  const ownerName =
    (row.assigned_to && ownerNames[row.assigned_to]) || row.cf_owner || cf.assigned_salesperson || '';

  const productCategory = row.cf_product || row.cf_materials || cf.product_category || cf.productCategory || cf.materials || '';
  const country = row.cf_country || cf.country || '';
  const slim = slimCustomFields(cf);

  const rawClass = row.classification || row.cf_classification || cf.classification || cf.lead_role || cf.leadRole || cf.role;
  let classification = 'Unassigned';
  if (rawClass === 'Buyer' || rawClass === 'Seller' || rawClass === 'Buyer & Seller') {
    classification = rawClass;
  } else if (rawClass === 'Unclassified' || rawClass === 'Unassigned') {
    classification = 'Unassigned';
  } else {
    const st = (row.cf_supplier_type || cf.supplier_type || cf.company_type || '').toLowerCase();
    if (st.includes('buyer') && (st.includes('seller') || st.includes('producer') || st.includes('supplier'))) {
      classification = 'Buyer & Seller';
    } else if (st.includes('buyer') || st.includes('client') || st.includes('customer') || st.includes('purchaser')) {
      classification = 'Buyer';
    } else if (st.includes('producer') || st.includes('processor') || st.includes('supplier') || st.includes('vendor') || st.includes('mine')) {
      classification = 'Seller';
    }
  }

  const base = {
    id: row.id,
    _id: row.id,
    name,
    fullName: name,
    firstName: first,
    lastName: last,
    company: row.company || '',
    email: row.email || '',
    phone: row.phone || '',
    jobTitle: row.job_title || '',
    classification,
    leadRole: classification,
    role: classification,
    status: row.status || 'NEW',
    score,
    temperature: deriveTemperature({ priority: priorityRaw, score }),
    priority: String(priorityRaw || '').toUpperCase() || null,
    tags: row.tags || [],
    isDnc: Boolean(row.is_dnc),
    ownerId: row.assigned_to || null,
    ownerName,
    lastContactedAt,
    nextAction: nextAction || '',
    nextActionDate: nextActionDate || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    productCategory,
    country,
    customFields: slim,
    custom_fields: slim,
  };

  if (view !== 'board') return base;

  return {
    ...base,
    priority: base.temperature, // Kanban cards badge off this field; keep it consistent with the table
    pipelineStage: base.status,
    productGrade: cf.product_grade || cf.productGrade || '',
    application: cf.application || cf.industry_application || '',
    sampleStatus: cf.sample_status || cf.sampleStatus || '',
    trialStatus: cf.trial_status || cf.trialStatus || '',
    opportunityStatus: cf.opportunity_status || cf.opportunityStatus || 'ACTIVE',
    nextFollowUpAt: row.next_follow_up_at || null,
  };
}

/* ------------------------------------------------------------------ */
/* Public API                                                           */
/* ------------------------------------------------------------------ */

export async function getLeadsList(rawParams = {}) {
  const spec = normalizeLeadListParams(rawParams);

  // If a text query was passed for campaign, resolve to campaign IDs
  if (spec.campaignQuery && !spec.campaign) {
    const { data: matchedCamps } = await supabaseAdmin
      .from('email_campaigns')
      .select('id')
      .ilike('name', `%${spec.campaignQuery}%`)
      .limit(50);
    const ids = (matchedCamps || []).map((c) => c.id);
    if (ids.length === 1) {
      spec.campaign = ids[0];
    } else if (ids.length > 1) {
      spec.campaignIds = ids;
    } else {
      spec.campaignIds = ['00000000-0000-0000-0000-000000000000'];
    }
  }

  let page = spec.page;
  let pageReset = false;

  let result = await runPageQuery(spec, 1, page);

  // Optional columns not migrated yet -> retry with the always-present column set.
  if (result.error && result.error.code !== 'PGRST103') {
    result = await runPageQuery(spec, 2, page);
  }

  // Requested page is past the end (e.g. filter narrowed the set) -> fall back to page 1.
  if (result.error && result.error.code === 'PGRST103' && page > 1) {
    page = 1;
    pageReset = true;
    result = await runPageQuery(spec, 1, page);
    if (result.error) result = await runPageQuery(spec, 2, page);
  }

  if (result.error) {
    const err = new Error(result.error.message || 'Could not load leads');
    err.code = result.error.code;
    throw err;
  }

  const rawRows = result.data || [];
  // Ensure strict deduplication by lead id
  const seenIds = new Set();
  const rows = [];
  for (const r of rawRows) {
    if (!seenIds.has(r.id)) {
      seenIds.add(r.id);
      rows.push(r);
    }
  }

  const total = result.count ?? rows.length;

  // Build classification count queries, scoped to campaign if filtered
  let allCountQ = supabaseAdmin.from('leads').select('*', { count: 'exact', head: true });
  let buyerCountQ = supabaseAdmin.from('leads').select('*', { count: 'exact', head: true }).or(BUYER_FILTER_OR);
  let sellerCountQ = supabaseAdmin.from('leads').select('*', { count: 'exact', head: true }).or(SELLER_FILTER_OR);
  let buyerSellerCountQ = supabaseAdmin.from('leads').select('*', { count: 'exact', head: true }).or(BUYER_SELLER_FILTER_OR);

  if (spec.campaign && UUID_RE.test(spec.campaign)) {
    allCountQ = supabaseAdmin.from('leads').select('*, email_recipients!inner(campaign_id)', { count: 'exact', head: true }).eq('email_recipients.campaign_id', spec.campaign);
    buyerCountQ = supabaseAdmin.from('leads').select('*, email_recipients!inner(campaign_id)', { count: 'exact', head: true }).eq('email_recipients.campaign_id', spec.campaign).or(BUYER_FILTER_OR);
    sellerCountQ = supabaseAdmin.from('leads').select('*, email_recipients!inner(campaign_id)', { count: 'exact', head: true }).eq('email_recipients.campaign_id', spec.campaign).or(SELLER_FILTER_OR);
    buyerSellerCountQ = supabaseAdmin.from('leads').select('*, email_recipients!inner(campaign_id)', { count: 'exact', head: true }).eq('email_recipients.campaign_id', spec.campaign).or(BUYER_SELLER_FILTER_OR);
  } else if (Array.isArray(spec.campaignIds) && spec.campaignIds.length > 0) {
    allCountQ = supabaseAdmin.from('leads').select('*, email_recipients!inner(campaign_id)', { count: 'exact', head: true }).in('email_recipients.campaign_id', spec.campaignIds);
    buyerCountQ = supabaseAdmin.from('leads').select('*, email_recipients!inner(campaign_id)', { count: 'exact', head: true }).in('email_recipients.campaign_id', spec.campaignIds).or(BUYER_FILTER_OR);
    sellerCountQ = supabaseAdmin.from('leads').select('*, email_recipients!inner(campaign_id)', { count: 'exact', head: true }).in('email_recipients.campaign_id', spec.campaignIds).or(SELLER_FILTER_OR);
    buyerSellerCountQ = supabaseAdmin.from('leads').select('*, email_recipients!inner(campaign_id)', { count: 'exact', head: true }).in('email_recipients.campaign_id', spec.campaignIds).or(BUYER_SELLER_FILTER_OR);
  }

  const [users, lastContactMap, allCountRes, buyerCountRes, sellerCountRes, buyerSellerCountRes] = await Promise.all([
    loadUsers(),
    getLastContactMap(rows.map((r) => r.id)),
    allCountQ,
    buyerCountQ,
    sellerCountQ,
    buyerSellerCountQ,
  ]);

  const totalAll = allCountRes?.count ?? total;
  const totalBuyers = buyerCountRes?.count ?? 0;
  const totalSellers = sellerCountRes?.count ?? 0;
  const totalBuyerAndSellers = buyerSellerCountRes?.count ?? 0;
  const totalUnassigned = Math.max(0, totalAll - totalBuyers - totalSellers - totalBuyerAndSellers);
  const classificationCounts = {
    all: totalAll,
    buyers: totalBuyers,
    sellers: totalSellers,
    buyer_and_sellers: totalBuyerAndSellers,
    unassigned: totalUnassigned,
    unclassified: totalUnassigned,
  };

  const leads = rows.map((row) =>
    mapLeadListRow(row, {
      ownerNames: users.map,
      lastContact: lastContactMap.get(row.id) || null,
      view: spec.view,
    })
  );

  return {
    leads,
    total,
    classificationCounts,
    pagination: {
      total,
      page,
      limit: spec.limit,
      totalPages: Math.max(1, Math.ceil(total / spec.limit)),
      pageReset,
    },
  };
}

let filterOptionsCache = { at: 0, data: null };

export function invalidateFilterOptionsCache() {
  filterOptionsCache = { at: 0, data: null };
}

/** Owners + campaigns for the filter dropdowns. Cached for a minute — it is not per-row data. */
export async function getLeadFilterOptions() {
  if (filterOptionsCache.data && Date.now() - filterOptionsCache.at < USER_CACHE_MS) {
    return filterOptionsCache.data;
  }
  const [users, campaignsRes, recipientsRes] = await Promise.all([
    loadUsers(),
    supabaseAdmin
      .from('email_campaigns')
      .select('id, name, status, created_at')
      .order('created_at', { ascending: false })
      .limit(200),
    supabaseAdmin
      .from('email_recipients')
      .select('campaign_id'),
  ]);

  const recMap = {};
  (recipientsRes.data || []).forEach((r) => {
    if (r.campaign_id) {
      recMap[r.campaign_id] = (recMap[r.campaign_id] || 0) + 1;
    }
  });

  const data = {
    owners: users.list,
    campaigns: (campaignsRes.data || []).map((c) => ({
      id: c.id,
      name: c.name || 'Untitled campaign',
      status: c.status || 'DRAFT',
      createdAt: c.created_at,
      leadCount: recMap[c.id] || 0,
      totalLeads: recMap[c.id] || 0,
    })),
  };
  filterOptionsCache = { at: Date.now(), data };
  return data;
}

/** Small per-lead summary for the drawer: campaigns the lead is in + last contact. */
export async function getLeadSummary(leadId) {
  const [recipients, lastContactMap, aiRes, usersCache] = await Promise.all([
    supabaseAdmin
      .from('email_recipients')
      .select('campaign_id, status, sent_at, opened_at, clicked_at, replied_at, bounced_at, created_at')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .limit(20),
    getLastContactMap([leadId]),
    // Tiny AI snapshot (three JSON keys, not the whole study) so the drawer can show study status without loading it
    supabaseAdmin
      .from('leads')
      .select(
        'assigned_to, ai_status:enrich_data->ai_intelligence->>status, ai_relevance:enrich_data->ai_intelligence->>relevance, ai_summary:enrich_data->ai_intelligence->>leadSummary'
      )
      .eq('id', leadId)
      .maybeSingle(),
    loadUsers(),
  ]);
  const ai = aiRes.data || {};

  const rows = recipients.data || [];
  const campaignIds = [...new Set(rows.map((r) => r.campaign_id).filter(Boolean))];
  let campaignMap = {};
  if (campaignIds.length) {
    const { data: camps } = await supabaseAdmin
      .from('email_campaigns')
      .select('id, name, status')
      .in('id', campaignIds);
    campaignMap = Object.fromEntries((camps || []).map((c) => [c.id, c]));
  }

  return {
    lastContactedAt: lastContactMap.get(leadId) || null,
    ownerName: (ai.assigned_to && usersCache.map[ai.assigned_to]) || '',
    ai: ai.ai_summary
      ? {
          status: ai.ai_status || 'CURRENT',
          relevance: ai.ai_relevance || '',
          summary: String(ai.ai_summary).slice(0, 400),
        }
      : null,
    campaigns: rows.map((r) => ({
      id: r.campaign_id,
      name: campaignMap[r.campaign_id]?.name || 'Campaign',
      campaignStatus: campaignMap[r.campaign_id]?.status || '',
      recipientStatus: r.status,
      sentAt: r.sent_at,
      openedAt: r.opened_at,
      clickedAt: r.clicked_at,
      repliedAt: r.replied_at,
      bouncedAt: r.bounced_at,
    })),
  };
}

export default { getLeadsList, getLeadFilterOptions, getLeadSummary, getLastContactMap };
