/**
 * Centralized Input Validation Utilities
 */

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const E164_PHONE_REGEX = /^\+?[1-9]\d{1,14}$/;

export function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  return EMAIL_REGEX.test(email.trim());
}

export function isValidUuid(id) {
  if (!id || typeof id !== 'string') return false;
  return UUID_REGEX.test(id.trim());
}

export function isValidPhone(phone) {
  if (!phone || typeof phone !== 'string') return false;
  const digitsOnly = phone.replace(/\D/g, '');
  return digitsOnly.length >= 7 && digitsOnly.length <= 15;
}

export function sanitizePagination(page, limit, maxLimit = 100) {
  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.min(maxLimit, Math.max(1, parseInt(limit, 10) || 20));
  const offset = (p - 1) * l;
  return { page: p, limit: l, offset };
}

export function validateStringLength(str, min = 0, max = 255) {
  if (typeof str !== 'string') return false;
  const len = str.trim().length;
  return len >= min && len <= max;
}

export function validateLeadPayload(payload) {
  const errors = [];
  if (!payload || typeof payload !== 'object') {
    return { valid: false, errors: ['Invalid lead payload format'] };
  }

  if (payload.email && !isValidEmail(payload.email)) {
    errors.push('Invalid email address format');
  }

  if (payload.phone && !isValidPhone(payload.phone)) {
    errors.push('Invalid phone number format');
  }

  if (payload.first_name && !validateStringLength(payload.first_name, 1, 100)) {
    errors.push('First name exceeds maximum length of 100 characters');
  }

  if (payload.last_name && !validateStringLength(payload.last_name, 0, 100)) {
    errors.push('Last name exceeds maximum length of 100 characters');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export default {
  isValidEmail,
  isValidUuid,
  isValidPhone,
  sanitizePagination,
  validateStringLength,
  validateLeadPayload,
};
