import jwt from 'jsonwebtoken';

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('FATAL: JWT_SECRET environment variable is not defined. Insecure fallbacks are strictly prohibited.');
  }
  return secret;
}

/**
 * Extract auth token from Authorization header or auth_token cookie
 */
export function extractAuthToken(request) {
  if (!request) return null;

  // 1. Authorization header
  const authHeader = request.headers?.get
    ? request.headers.get('authorization')
    : request.headers?.authorization || (request.headers instanceof Map ? request.headers.get('authorization') : null);

  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }

  // 2. Next.js cookies API
  if (request.cookies?.get) {
    const cookieVal =
      request.cookies.get('auth_token')?.value ||
      (typeof request.cookies.get === 'function' ? request.cookies.get('auth_token') : null);
    if (cookieVal) return typeof cookieVal === 'object' ? cookieVal.value : cookieVal;
  }

  // 3. Raw cookie header string
  const cookieHeader = request.headers?.get
    ? request.headers.get('cookie')
    : request.headers?.cookie || (request.headers instanceof Map ? request.headers.get('cookie') : null);

  if (cookieHeader) {
    const match = cookieHeader.match(/(?:^|;\s*)auth_token=([^;]+)/);
    if (match) return decodeURIComponent(match[1]);
  }

  return null;
}

function jsonResponse(data, status = 200) {
  if (typeof Response !== 'undefined') {
    const res = new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
    res.authenticated = false;
    res.response = res;
    return res;
  }
  return { authenticated: false, status, response: { status, data }, data };
}

/**
 * Require valid authenticated user session (any valid role)
 */
export async function requireAuth(request) {
  try {
    const token = extractAuthToken(request);
    if (!token) {
      return jsonResponse({ success: false, error: 'Unauthorized: Authentication session required' }, 401);
    }

    const secret = getJwtSecret();
    const payload = jwt.verify(token, secret);
    const userId = payload.userId || payload.id || payload._id || payload.sub;

    if (!payload || !userId) {
      return jsonResponse({ success: false, error: 'Unauthorized: Invalid authentication token' }, 401);
    }

    // Single-Admin system constraint: only administrator accounts are authorized
    const userRole = (payload.role || '').toLowerCase();
    if (userRole !== 'admin' && userRole !== 'owner') {
      return jsonResponse({ success: false, error: 'Forbidden: Single-Admin system only permits administrator access.' }, 403);
    }

    const user = {
      id: userId,
      _id: userId,
      userId,
      email: payload.email,
      role: 'admin',
      name: payload.name || 'MineTech Administrator',
      approved: true,
      active: true,
    };

    return {
      authenticated: true,
      user,
    };
  } catch (err) {
    return jsonResponse({ success: false, error: `Authentication Error: ${err.message}` }, 401);
  }
}

/**
 * Require specific role permission (e.g. ['admin', 'manager'])
 */
export async function requireRole(requestOrRoles, allowedRoles = ['admin']) {
  // Support both (request, ['admin']) and (['admin'])(request) curry signatures
  if (Array.isArray(requestOrRoles)) {
    const roles = requestOrRoles;
    return async (req) => requireRole(req, roles);
  }

  const request = requestOrRoles;
  const auth = await requireAuth(request);
  if (!auth.authenticated || auth instanceof Response) {
    return auth;
  }

  const userRole = (auth.user?.role || '').toLowerCase();
  const normalizedRoles = allowedRoles.map((r) => r.toLowerCase());

  // 'admin' and 'owner' have global access
  if (userRole === 'admin' || userRole === 'owner') {
    return auth;
  }

  if (!normalizedRoles.includes(userRole)) {
    return jsonResponse(
      { success: false, error: `Forbidden: Insufficient privileges (Requires: ${allowedRoles.join(' or ')})` },
      403
    );
  }

  return auth;
}

/**
 * Require Admin role strictly
 */
export async function requireAdmin(request) {
  return requireRole(request, ['admin', 'owner']);
}

export default {
  extractAuthToken,
  requireAuth,
  requireRole,
  requireAdmin,
};
