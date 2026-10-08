/**
 * Bot Protection, Honeypot & Malicious User-Agent Filter
 */

const SUSPICIOUS_BOT_USER_AGENTS = [
  /sqlmap/i,
  /nikto/i,
  /masscan/i,
  /acunetix/i,
  /havij/i,
  /zgrab/i,
  /nmap/i,
  /wpscan/i,
  /dirbuster/i,
  /gobuster/i,
  /python-requests/i,
];

/**
 * Checks if a honeypot field has been filled in (bots typically fill hidden fields)
 */
export function isHoneypotTriggered(body, honeypotField = '_hp_trap') {
  if (!body || typeof body !== 'object') return false;
  const val = body[honeypotField] || body.website_url_hp || body.bot_trap;
  return Boolean(val && String(val).trim().length > 0);
}

/**
 * Checks if request User-Agent matches known aggressive scanning tools
 */
export function isSuspiciousScanner(request) {
  const ua = (
    request?.headers?.get?.('user-agent') ||
    request?.headers?.['user-agent'] ||
    ''
  ).toLowerCase();

  if (!ua) return false;

  return SUSPICIOUS_BOT_USER_AGENTS.some((pattern) => pattern.test(ua));
}

export default {
  isHoneypotTriggered,
  isSuspiciousScanner,
};
