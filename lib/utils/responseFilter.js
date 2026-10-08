/**
 * Response Filter to trim sensitive fields and secrets before returning API responses
 */

const SENSITIVE_PATTERNS = [
  /password/i,
  /secret/i,
  /auth_token/i,
  /service_role/i,
  /jwt_/i,
  /api_key/i,
  /apikey/i,
  /private_key/i,
];

function isSensitiveKey(key) {
  const lower = key.toLowerCase();
  return SENSITIVE_PATTERNS.some((pattern) => pattern.test(lower));
}

/**
 * Strips sensitive keys recursively from objects/arrays
 */
export function sanitizeApiResponse(data) {
  if (!data || typeof data !== 'object') return data;

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeApiResponse(item));
  }

  const sanitized = {};
  for (const [key, value] of Object.entries(data)) {
    if (isSensitiveKey(key)) {
      continue; // omit sensitive field
    }

    if (value && typeof value === 'object') {
      sanitized[key] = sanitizeApiResponse(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

export default {
  sanitizeApiResponse,
};
