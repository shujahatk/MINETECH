/**
 * Field Sanitizer to prevent mass assignment / field tampering
 */

const PROTECTED_FIELDS = new Set([
  'id',
  '_id',
  'role',
  'is_admin',
  'isAdmin',
  'approved',
  'is_approved',
  'created_at',
  'createdAt',
  'user_id',
  'password_hash',
]);

/**
 * Filter an update payload against an allowed whitelist of fields,
 * strictly stripping any unauthorized / tampering fields.
 */
export function filterAllowedFields(payload, allowedFields) {
  if (!payload || typeof payload !== 'object') return {};

  const allowedSet = new Set(allowedFields);
  const filtered = {};

  for (const [key, value] of Object.entries(payload)) {
    if (allowedSet.has(key) && !PROTECTED_FIELDS.has(key)) {
      filtered[key] = value;
    }
  }

  return filtered;
}

/**
 * Strips protected fields from a payload
 */
export function stripProtectedFields(payload) {
  if (!payload || typeof payload !== 'object') return {};

  const clean = {};
  for (const [key, value] of Object.entries(payload)) {
    if (!PROTECTED_FIELDS.has(key)) {
      clean[key] = value;
    }
  }

  return clean;
}

export default {
  filterAllowedFields,
  stripProtectedFields,
  PROTECTED_FIELDS,
};
