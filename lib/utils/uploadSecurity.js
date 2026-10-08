/**
 * File Upload Validation & CSV Injection Sanitization
 */

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB limit
const ALLOWED_MIME_TYPES = [
  'text/csv',
  'application/vnd.ms-excel',
  'text/plain',
  'application/json',
  'image/jpeg',
  'image/png',
  'image/webp',
];

/**
 * Validates uploaded file size and MIME type
 */
export function validateUploadedFile(file, options = {}) {
  const maxSize = options.maxSizeBytes || MAX_FILE_SIZE_BYTES;
  const allowedTypes = options.allowedMimeTypes || ALLOWED_MIME_TYPES;

  if (!file) {
    return { valid: false, error: 'No file provided' };
  }

  const fileSize = file.size || (typeof file.length === 'number' ? file.length : 0);
  if (fileSize > maxSize) {
    return {
      valid: false,
      error: `File exceeds maximum allowed size limit of ${Math.round(maxSize / (1024 * 1024))}MB`,
    };
  }

  const fileType = (file.type || '').toLowerCase();
  if (fileType && !allowedTypes.includes(fileType)) {
    return {
      valid: false,
      error: `Disallowed file type: ${fileType}. Allowed types: ${allowedTypes.join(', ')}`,
    };
  }

  return { valid: true };
}

/**
 * Neutralizes CSV Formula Injection (DDE / Command Execution)
 * Characters: =, +, -, @, \t, \r at the start of a cell
 */
export function sanitizeCsvValue(val) {
  if (typeof val !== 'string') return val;
  const trimmed = val.trim();
  if (/^[=+\-@\t\r]/.test(trimmed)) {
    // Prefix with single quote to force spreadsheet programs to interpret as string literal
    return `'${trimmed}`;
  }
  return trimmed;
}

/**
 * Sanitize an entire CSV row object
 */
export function sanitizeCsvRow(row) {
  if (!row || typeof row !== 'object') return row;
  const sanitized = {};
  for (const [key, value] of Object.entries(row)) {
    sanitized[key] = sanitizeCsvValue(value);
  }
  return sanitized;
}

export default {
  validateUploadedFile,
  sanitizeCsvValue,
  sanitizeCsvRow,
  MAX_FILE_SIZE_BYTES,
  ALLOWED_MIME_TYPES,
};
