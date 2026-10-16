/**
 * Formatting and label helpers for MineTech Design System
 */

export function formatNumber(num) {
  if (num === null || num === undefined) return '0';
  return Number(num).toLocaleString('en-US');
}

export function formatCurrency(amount, currency = 'USD') {
  if (amount === null || amount === undefined) return '$0';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatPercent(ratio, decimals = 1) {
  if (ratio === null || ratio === undefined) return '0%';
  return `${(Number(ratio) * 100).toFixed(decimals)}%`;
}

export function formatDuration(seconds) {
  if (!seconds || isNaN(seconds)) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function formatDate(dateString) {
  if (!dateString) return '—';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return dateString;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export const STATUS_LABELS = {
  NEW: 'New Lead',
  CONTACTED: 'Contacted',
  ENGAGED: 'Engaged',
  TECHNICAL_EVALUATION: 'Technical Evaluation',
  COMMERCIAL_DISCUSSION: 'Commercial Discussion',
  TRIAL_ORDER: 'Trial Order',
  APPROVED_SUPPLIER: 'Approved Supplier',
  RECURRING_CUSTOMER: 'Recurring Customer',
  ON_HOLD: 'On Hold',
  LOST: 'Lost',
  DO_NOT_CONTACT: 'Do Not Contact',
};

export function getStatusLabel(status) {
  return STATUS_LABELS[status] || status;
}
