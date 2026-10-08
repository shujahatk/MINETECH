/**
 * XSS Sanitization & HTML Escaping Utilities
 */

const HTML_ENTITIES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#x60;',
};

/**
 * Escape raw text to prevent XSS injection
 */
export function escapeHtml(str) {
  if (!str || typeof str !== 'string') return '';
  return str.replace(/[&<>"'`/]/g, (char) => HTML_ENTITIES[char] || char);
}

/**
 * Strip dangerous executable script tags, event handlers, and javascript: links
 */
export function sanitizeHtml(html) {
  if (!html || typeof html !== 'string') return '';

  return html
    // Remove script tags and contents
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Remove iframe, object, embed tags
    .replace(/<\/?(iframe|object|embed|applet|meta|link|base)[^>]*>/gi, '')
    // Remove inline javascript event attributes (onclick, onload, onerror, etc.)
    .replace(/\s+on\w+\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi, '')
    // Remove javascript: and vbscript: URIs
    .replace(/href\s*=\s*['"]\s*(?:javascript|vbscript|data):[^'"]*['"]/gi, 'href="#"')
    .replace(/src\s*=\s*['"]\s*(?:javascript|vbscript):[^'"]*['"]/gi, 'src=""');
}

/**
 * Deep sanitization of an object's string properties
 */
export function sanitizeObjectStrings(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObjectStrings(item));
  }

  const cleaned = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      cleaned[key] = value.trim();
    } else if (typeof value === 'object' && value !== null) {
      cleaned[key] = sanitizeObjectStrings(value);
    } else {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

export default {
  escapeHtml,
  sanitizeHtml,
  sanitizeObjectStrings,
};
