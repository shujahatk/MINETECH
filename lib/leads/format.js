/** Small pure formatting helpers for the Leads UI (safe on server and client). */

const DATE_PREFIX = /^(\d{4})-(\d{2})-(\d{2})/;

export function localDateString(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Whole-day difference between a stored date and `today` (YYYY-MM-DD).
 * Uses the stored YYYY-MM-DD prefix so display matches the server-side follow-up filters.
 * Returns null when the date is missing/invalid. Negative = overdue.
 */
export function dayDiff(value, today = localDateString()) {
  const m = DATE_PREFIX.exec(String(value || ''));
  const t = DATE_PREFIX.exec(today);
  if (!m || !t) return null;
  const a = Date.UTC(+m[1], +m[2] - 1, +m[3]);
  const b = Date.UTC(+t[1], +t[2] - 1, +t[3]);
  return Math.round((a - b) / 86_400_000);
}

export function formatShortDate(value) {
  const m = DATE_PREFIX.exec(String(value || ''));
  if (!m) return '';
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

export function formatDateTime(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function timeAgo(value, now = Date.now()) {
  if (!value) return '';
  const t = new Date(value).getTime();
  if (Number.isNaN(t)) return '';
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 60) return 'Just now';
  const min = Math.floor(s / 60);
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  if (d < 30) return `${Math.floor(d / 7)}w ago`;
  if (d < 365) return `${Math.floor(d / 30)}mo ago`;
  return `${Math.floor(d / 365)}y ago`;
}

export function initials(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return ((parts[0][0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

export const STATUS_LABELS = {
  NEW: 'New',
  CONTACTED: 'Contacted',
  ENGAGED: 'Engaged',
  TECHNICAL_EVALUATION: 'Technical evaluation',
  COMMERCIAL_DISCUSSION: 'Commercial discussion',
  TRIAL_ORDER: 'Trial order',
  APPROVED_SUPPLIER: 'Approved supplier',
  RECURRING_CUSTOMER: 'Recurring customer',
  ON_HOLD: 'On hold',
  LOST: 'Lost',
  DO_NOT_CONTACT: 'Do not contact',
};

export function statusLabel(status = '') {
  return STATUS_LABELS[status] || String(status).replaceAll('_', ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

export const STATUS_OPTIONS = Object.keys(STATUS_LABELS);

/**
 * Convert the full lead DTO returned by PUT /api/leads/:id into the compact patch the table row needs,
 * so an edit updates the list locally instead of refetching it. Only defined values are returned.
 */
export function rowPatchFromDetail(u = {}) {
  const cf = u.customFields || u.custom_fields || {};
  const name = u.fullName || u.name || `${u.firstName || ''} ${u.lastName || ''}`.trim();
  const patch = {
    status: u.status,
    company: u.company,
    email: u.email,
    jobTitle: u.jobTitle,
    firstName: u.firstName,
    lastName: u.lastName,
    tags: u.tags,
    score: u.score === undefined || u.score === null ? undefined : Number(u.score),
    temperature: u.temperature,
    priority: cf.priority ? String(cf.priority).toUpperCase() : undefined,
    nextAction: cf.next_action || cf.nextAction || '',
    nextActionDate: cf.next_action_date || cf.nextActionDate || u.nextFollowUpAt || null,
    isDnc: u.isDnc === undefined ? undefined : Boolean(u.isDnc),
    updatedAt: u.updated_at,
    // Board-card fields (only when explicitly stored, so we never invent values)
    productCategory: cf.product_category,
    productGrade: cf.product_grade,
    application: cf.application,
    country: cf.country,
    sampleStatus: cf.sample_status,
    trialStatus: cf.trial_status,
  };
  if (name) {
    patch.name = name;
    patch.fullName = name;
  }
  Object.keys(patch).forEach((k) => patch[k] === undefined && delete patch[k]);
  return patch;
}
