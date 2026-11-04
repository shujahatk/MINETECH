import crypto from 'crypto';

/**
 * Safe email-configuration diagnostics.
 *
 * Everything returned or logged here is non-secret: sender address/domain, which environment variable
 * supplied it, deployment environment, and a short one-way SHA-256 fingerprint of the Resend API key
 * (lets you compare the key used in Vercel with the key in your Resend dashboard / local .env without
 * ever exposing the key). The API key itself is never returned, logged or included in an error.
 *
 * This module intentionally does NOT import emailService.js (emailService imports this file).
 */

// Mirrors the resolution order in getEmailConfig() (lib/services/emailService.js).
export const SENDER_ENV_CHAIN = ['EMAIL_FROM', 'RESEND_FROM_EMAIL', 'DEFAULT_FROM_EMAIL'];
export const HARDCODED_DEFAULT_SENDER = 'rauf@mine-tech.be';

export function extractAddress(value = '') {
  const str = String(value || '').trim();
  const angle = str.match(/<([^>]+)>/);
  return (angle ? angle[1] : str).trim();
}

export function domainOf(value = '') {
  const addr = extractAddress(value);
  const at = addr.lastIndexOf('@');
  return at === -1 ? '' : addr.slice(at + 1).trim().toLowerCase();
}

export function fingerprintSecret(secret = '') {
  const s = String(secret || '').trim();
  if (!s) return null;
  return crypto.createHash('sha256').update(s).digest('hex').slice(0, 8);
}

/** Which env var (or the hard-coded default) actually supplies the From address. */
export function resolveSenderSource(env = process.env) {
  for (const name of SENDER_ENV_CHAIN) {
    if (env[name]) return { source: name, value: String(env[name]).trim() };
  }
  return { source: 'hard-coded default', value: HARDCODED_DEFAULT_SENDER };
}

/**
 * Non-secret snapshot of how the deployed app will send email.
 */
export function getEmailEnvironmentReport(env = process.env) {
  const { source, value: senderValue } = resolveSenderSource(env);
  const senderAddress = extractAddress(senderValue);
  const senderDomain = domainOf(senderValue);
  const replyToRaw = (env.REPLY_TO || senderValue || '').trim();
  const replyToDomain = domainOf(replyToRaw);

  const apiKey = String(env.RESEND_API_KEY || '').trim();
  const smtpPassword = String(env.RESEND_SMTP_PASSWORD || '').trim();

  const warnings = [];

  // Sender env vars that are set but never used because an earlier one wins.
  SENDER_ENV_CHAIN.forEach((name) => {
    if (name === source || !env[name]) return;
    const other = String(env[name]).trim();
    if (domainOf(other) !== senderDomain) {
      warnings.push(
        `${name} is set to a different domain ("${domainOf(other) || other}") but is IGNORED because ${source} takes precedence.`
      );
    }
  });

  if (/^["']|["']$/.test(String(env[source] || '').trim())) {
    warnings.push(`${source} contains literal quote characters; remove them in the Vercel value field.`);
  }
  if (/[<>]/.test(senderValue)) {
    warnings.push(`${source} contains a display name / angle brackets; it must be a bare address (use EMAIL_FROM_NAME for the name).`);
  }
  if (replyToDomain && replyToDomain !== senderDomain) {
    warnings.push(`Reply-To domain (${replyToDomain}) differs from sender domain (${senderDomain}). This is allowed by Resend but check it is intended.`);
  }
  if (!apiKey) {
    warnings.push('RESEND_API_KEY is not set in this environment.');
  } else if (!apiKey.startsWith('re_')) {
    warnings.push('RESEND_API_KEY does not start with "re_".');
  }
  if (apiKey && smtpPassword && apiKey !== smtpPassword) {
    warnings.push('RESEND_SMTP_PASSWORD differs from RESEND_API_KEY (they are different keys). Sending uses RESEND_API_KEY only.');
  }
  if (env.NODE_ENV === 'production' && env.VERCEL_ENV && env.VERCEL_ENV !== 'production') {
    warnings.push(`Running as VERCEL_ENV=${env.VERCEL_ENV}: Vercel uses the Preview/Development env var values here, not Production.`);
  }
  if (senderDomain === 'resend.dev') {
    warnings.push('Sender uses resend.dev (testing domain): it can only deliver to your own Resend account email.');
  }

  return {
    environment: {
      nodeEnv: env.NODE_ENV || null,
      vercelEnv: env.VERCEL_ENV || null,
      vercelRegion: env.VERCEL_REGION || null,
      deployedCommit: env.VERCEL_GIT_COMMIT_SHA ? String(env.VERCEL_GIT_COMMIT_SHA).slice(0, 7) : null,
    },
    sender: {
      address: senderAddress,
      domain: senderDomain,
      source,
      displayName: (env.EMAIL_FROM_NAME || '').trim() || null,
      replyTo: extractAddress(replyToRaw) || null,
      replyToDomain: replyToDomain || null,
      sourceEnvVarsSet: SENDER_ENV_CHAIN.filter((n) => Boolean(env[n])),
    },
    apiKey: {
      envVar: 'RESEND_API_KEY',
      present: Boolean(apiKey),
      startsWithRe: apiKey.startsWith('re_'),
      length: apiKey.length,
      fingerprint: fingerprintSecret(apiKey),
    },
    warnings,
  };
}

/**
 * Compact, non-secret context attached to every Resend failure log line.
 */
export function getSendLogContext(senderEmail, env = process.env) {
  const report = getEmailEnvironmentReport(env);
  return {
    senderDomain: domainOf(senderEmail) || report.sender.domain,
    senderEnvSource: report.sender.source,
    nodeEnv: report.environment.nodeEnv,
    vercelEnv: report.environment.vercelEnv,
    deployedCommit: report.environment.deployedCommit,
    apiKeyEnvVar: report.apiKey.envVar,
    apiKeyFingerprint: report.apiKey.fingerprint,
    apiKeyLength: report.apiKey.length,
  };
}

/**
 * Structured log line for a failed Resend API call. Never includes secrets or message content.
 */
export function logResendFailure({ httpStatus, errJson = {}, senderEmail, attempt }, env = process.env, logger = console) {
  const entry = {
    httpStatus,
    resendErrorName: errJson?.name || null,
    resendMessage: errJson?.message || null,
    attempt: typeof attempt === 'number' ? attempt + 1 : null,
    ...getSendLogContext(senderEmail, env),
  };
  logger.error(`[EmailService][ResendError] ${JSON.stringify(entry)}`);
  return entry;
}

/**
 * Lists the domains visible to the API key (read-only GET /domains) and compares them with the sender
 * domain. This answers "does the Resend team that owns THIS key have the domain, and is it verified?".
 */
export async function checkResendDomains({ apiKey, senderDomain, fetchImpl = globalThis.fetch } = {}) {
  const result = {
    ok: false,
    httpStatus: null,
    senderDomain: senderDomain || null,
    senderDomainFound: false,
    senderDomainStatus: null,
    domains: [],
    hasMore: false,
    error: null,
    diagnosis: [],
  };

  if (!apiKey) {
    result.diagnosis.push('No RESEND_API_KEY in this environment; cannot query Resend.');
    return result;
  }

  let res;
  try {
    res = await fetchImpl('https://api.resend.com/domains', {
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    result.error = { name: 'network_error', message: err.message };
    result.diagnosis.push(`Could not reach Resend: ${err.message}`);
    return result;
  }

  result.httpStatus = res.status;
  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    result.error = { name: body?.name || null, message: body?.message || `HTTP ${res.status}` };
    if (res.status === 401 && /restricted/i.test(`${body?.name} ${body?.message}`)) {
      result.diagnosis.push(
        'This key is a "Sending access" key, which cannot list domains. That is fine for sending; verify the domain via an actual send or use a Full-access key just for this check.'
      );
    } else if (res.status === 401 || res.status === 403) {
      result.diagnosis.push('Resend rejected this API key. It is invalid, revoked, or from another account.');
    } else {
      result.diagnosis.push(`Resend returned HTTP ${res.status}: ${result.error.message}`);
    }
    return result;
  }

  const list = Array.isArray(body?.data) ? body.data : [];
  result.ok = true;
  result.hasMore = Boolean(body?.has_more);
  result.domains = list.map((d) => ({
    name: String(d.name || '').toLowerCase(),
    status: d.status || null,
    region: d.region || null,
    createdAt: d.created_at || null,
  }));

  const wanted = String(senderDomain || '').toLowerCase();
  const match = result.domains.find((d) => d.name === wanted);
  result.senderDomainFound = Boolean(match);
  result.senderDomainStatus = match?.status || null;

  if (!wanted) {
    result.diagnosis.push('No sender domain could be determined.');
  } else if (match && match.status === 'verified') {
    result.diagnosis.push(
      `"${wanted}" IS verified for the Resend team that owns this key. If production still returns 403, the production deployment is NOT using this key: compare apiKey.fingerprint with the one in the production 403 log line and redeploy after fixing the Vercel variable.`
    );
  } else if (match) {
    result.diagnosis.push(
      `"${wanted}" exists for this key's team but its status is "${match.status}", not "verified". Finish the DNS records in Resend and wait for verification.`
    );
  } else {
    const related = result.domains.filter((d) => d.name.endsWith(`.${wanted}`) || wanted.endsWith(`.${d.name}`));
    const names = result.domains.map((d) => `${d.name} (${d.status})`).join(', ') || 'none';
    result.diagnosis.push(
      `This API key's Resend team has NO domain named "${wanted}". Domains it can see: ${names}. The key most likely belongs to a different Resend account/team than the one where "${wanted}" was verified; create the key in the team that owns the domain and update RESEND_API_KEY in Vercel.`
    );
    if (related.length) {
      result.diagnosis.push(
        `Related domain(s) found: ${related.map((d) => d.name).join(', ')}. Resend matches the exact domain in the From address, so either verify "${wanted}" itself or set EMAIL_FROM to an address on a verified domain.`
      );
    }
  }

  if (result.hasMore) {
    result.diagnosis.push('Resend reported more domains than were returned (paginated); the domain may exist on a later page.');
  }

  return result;
}