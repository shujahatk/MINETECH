/**
 * MineTech CRM — Unified Lead Classification Service
 * Single source of truth for Buyer, Seller, Buyer & Seller, and Unassigned lead classifications.
 * Shared across CRM table filters, Pipeline counters, and Kanban opportunity cards.
 */

export const LEAD_ROLES = ['Buyer', 'Seller', 'Buyer & Seller', 'Unassigned'];

export const ROLE_BADGE_STYLES = {
  Buyer: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/25',
  Seller: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/25',
  'Buyer & Seller': 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/25',
  Unassigned: 'bg-muted text-muted-foreground border-border',
};

export const ROLE_TEXT_COLORS = {
  ALL: 'text-foreground',
  Buyer: 'text-blue-600 dark:text-blue-400',
  Seller: 'text-purple-600 dark:text-purple-400',
  'Buyer & Seller': 'text-teal-600 dark:text-teal-400',
  Unassigned: 'text-muted-foreground',
};

/**
 * Normalizes any lead record, raw row, or custom_fields object into one of four canonical roles:
 * 'Buyer' | 'Seller' | 'Buyer & Seller' | 'Unassigned'
 */
export function normalizeLeadRole(leadOrRowOrCustomFields) {
  if (!leadOrRowOrCustomFields) return 'Unassigned';

  // Handle direct string input
  if (typeof leadOrRowOrCustomFields === 'string') {
    const trimmed = leadOrRowOrCustomFields.trim();
    const lower = trimmed.toLowerCase();

    if (
      lower === 'buyer & seller' ||
      lower === 'buyer and seller' ||
      lower === 'dual' ||
      lower === 'both' ||
      (lower.includes('buyer') && (lower.includes('seller') || lower.includes('supplier') || lower.includes('producer')))
    ) {
      return 'Buyer & Seller';
    }
    if (lower === 'buyer' || lower === 'buyers' || lower === 'purchaser' || lower === 'client' || lower === 'customer' || lower.includes('buyer')) {
      return 'Buyer';
    }
    if (
      lower === 'seller' ||
      lower === 'sellers' ||
      lower === 'supplier' ||
      lower === 'vendor' ||
      lower === 'producer' ||
      lower === 'processor' ||
      lower === 'mine' ||
      lower.includes('seller')
    ) {
      return 'Seller';
    }
    return 'Unassigned';
  }

  const obj = leadOrRowOrCustomFields;
  const cf = obj.custom_fields || obj.customFields || obj;

  // Extract candidate values in order of priority
  const candidates = [
    obj.leadRole,
    obj.classification,
    obj.role,
    obj.lead_role,
    cf.leadRole,
    cf.classification,
    cf.role,
    cf.lead_role,
    obj.cf_classification,
  ].filter(Boolean);

  for (const raw of candidates) {
    if (typeof raw !== 'string') continue;
    const trimmed = raw.trim();
    const lower = trimmed.toLowerCase();

    if (
      lower === 'buyer & seller' ||
      lower === 'buyer and seller' ||
      lower === 'dual' ||
      lower === 'both' ||
      (lower.includes('buyer') && (lower.includes('seller') || lower.includes('supplier') || lower.includes('producer')))
    ) {
      return 'Buyer & Seller';
    }
    if (lower === 'buyer' || lower === 'buyers' || lower === 'purchaser' || lower === 'client' || lower === 'customer' || lower.includes('buyer')) {
      return 'Buyer';
    }
    if (
      lower === 'seller' ||
      lower === 'sellers' ||
      lower === 'supplier' ||
      lower === 'vendor' ||
      lower === 'producer' ||
      lower === 'processor' ||
      lower === 'mine' ||
      lower.includes('seller')
    ) {
      return 'Seller';
    }
    if (lower === 'unassigned' || lower === 'unclassified' || lower === 'none' || lower === 'n/a' || lower === 'pending') {
      return 'Unassigned';
    }
  }

  // Fallback to keyword heuristics on company_type or supplier_type
  const typeField = (cf.supplier_type || cf.company_type || obj.supplier_type || obj.company_type || '').toLowerCase();
  if (typeField) {
    const isBuyer = typeField.includes('buyer') || typeField.includes('client') || typeField.includes('customer') || typeField.includes('purchaser') || typeField.includes('consumer');
    const isSeller = typeField.includes('seller') || typeField.includes('producer') || typeField.includes('processor') || typeField.includes('supplier') || typeField.includes('vendor') || typeField.includes('mine');

    if (isBuyer && isSeller) return 'Buyer & Seller';
    if (isBuyer) return 'Buyer';
    if (isSeller) return 'Seller';
  }

  return 'Unassigned';
}

/**
 * Computes exact classification totals from a list of leads
 */
export function calculateClassificationCounts(leads = []) {
  const counts = {
    all: leads.length,
    buyers: 0,
    sellers: 0,
    buyer_and_sellers: 0,
    unassigned: 0,
    unclassified: 0,
  };

  for (const lead of leads) {
    const role = normalizeLeadRole(lead);
    if (role === 'Buyer') counts.buyers++;
    else if (role === 'Seller') counts.sellers++;
    else if (role === 'Buyer & Seller') counts.buyer_and_sellers++;
    else counts.unassigned++;
  }
  counts.unclassified = counts.unassigned;

  return counts;
}

/**
 * PostgREST JSONB filter clauses for Supabase database queries
 * NOTE: Only references valid table columns and custom_fields JSONB paths.
 * Never references top-level columns that do not exist in the leads table.
 */
export const CLASSIFICATION_POSTGREST_FILTERS = {
  Buyer: 'custom_fields->>classification.eq.Buyer,custom_fields->>leadRole.eq.Buyer,custom_fields->>lead_role.eq.Buyer,custom_fields->>classification.ilike.buyer,custom_fields->>leadRole.ilike.buyer,and(custom_fields->>classification.is.null,custom_fields->>supplier_type.ilike.%buyer%)',
  Seller: 'custom_fields->>classification.eq.Seller,custom_fields->>leadRole.eq.Seller,custom_fields->>lead_role.eq.Seller,custom_fields->>classification.ilike.seller,custom_fields->>leadRole.ilike.seller,and(custom_fields->>classification.is.null,custom_fields->>supplier_type.ilike.%producer%),and(custom_fields->>classification.is.null,custom_fields->>supplier_type.ilike.%processor%),and(custom_fields->>classification.is.null,custom_fields->>supplier_type.ilike.%supplier%)',
  'Buyer & Seller': 'custom_fields->>classification.eq.Buyer & Seller,custom_fields->>classification.eq.Buyer and Seller,custom_fields->>leadRole.eq.Buyer & Seller,custom_fields->>lead_role.eq.Buyer & Seller',
  Unassigned: 'custom_fields->>classification.eq.Unassigned,custom_fields->>classification.eq.Unclassified,custom_fields->>leadRole.eq.Unassigned,custom_fields->>lead_role.eq.Unassigned,and(custom_fields->>classification.is.null,custom_fields->>leadRole.is.null,custom_fields->>supplier_type.not.ilike.%buyer%,custom_fields->>supplier_type.not.ilike.%producer%,custom_fields->>supplier_type.not.ilike.%supplier%)',
};
