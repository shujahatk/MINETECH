// In-memory brute force & rate limiting cache for login protection
const loginAttempts = new Map(); // IP -> { count, firstAttempt, lockedUntil }

const MAX_FAILED_ATTEMPTS = 5;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes window
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes lockout

/**
 * Checks if an IP is currently locked out due to excessive failed login attempts
 */
export function checkRateLimit(ip) {
  const now = Date.now();
  const record = loginAttempts.get(ip);

  if (!record) return { allowed: true, remaining: MAX_FAILED_ATTEMPTS };

  // Check if locked out
  if (record.lockedUntil && record.lockedUntil > now) {
    const remainingSecs = Math.ceil((record.lockedUntil - now) / 1000);
    const remainingMins = Math.ceil(remainingSecs / 60);
    return {
      allowed: false,
      locked: true,
      retryAfterSeconds: remainingSecs,
      message: `Too many failed login attempts. Your IP has been temporarily locked out for security. Try again in ${remainingMins} minute${remainingMins > 1 ? 's' : ''}.`,
    };
  }

  // Reset window if expired
  if (now - record.firstAttempt > ATTEMPT_WINDOW_MS) {
    loginAttempts.delete(ip);
    return { allowed: true, remaining: MAX_FAILED_ATTEMPTS };
  }

  const remaining = Math.max(0, MAX_FAILED_ATTEMPTS - record.count);
  return { allowed: true, remaining };
}

/**
 * Records a failed login attempt for an IP
 */
export function recordFailedAttempt(ip) {
  const now = Date.now();
  const record = loginAttempts.get(ip);

  if (!record || now - record.firstAttempt > ATTEMPT_WINDOW_MS) {
    loginAttempts.set(ip, {
      count: 1,
      firstAttempt: now,
      lockedUntil: null,
    });
    return { remaining: MAX_FAILED_ATTEMPTS - 1, locked: false };
  }

  record.count += 1;

  if (record.count >= MAX_FAILED_ATTEMPTS) {
    record.lockedUntil = now + LOCKOUT_DURATION_MS;
    console.warn(`[Security] IP ${ip} has been LOCKED OUT for 15 minutes after ${record.count} failed login attempts.`);
    return {
      remaining: 0,
      locked: true,
      message: 'Too many failed login attempts. Access has been temporarily locked for 15 minutes.',
    };
  }

  return {
    remaining: MAX_FAILED_ATTEMPTS - record.count,
    locked: false,
  };
}

/**
 * Resets failed attempts after successful login
 */
export function resetLoginAttempts(ip) {
  loginAttempts.delete(ip);
}
