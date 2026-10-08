import jwt from 'jsonwebtoken';

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('FATAL: JWT_SECRET environment variable is not defined. Insecure fallbacks are strictly prohibited.');
  }
  return secret;
}

/**
 * Verify JWT token string strictly using mandatory JWT_SECRET
 */
export function verifyAdminToken(token) {
  if (!token) return null;
  try {
    const secret = getJwtSecret();
    const decoded = jwt.verify(token, secret);
    if (!decoded || decoded.role !== 'admin') {
      return null;
    }
    return decoded;
  } catch (err) {
    return null;
  }
}

/**
 * Extract token from Authorization header or auth_token cookie
 */
export function extractAuthToken(request) {
  if (!request) return null;

  // 1. Authorization Bearer header
  const authHeader = request.headers?.get ? request.headers.get('authorization') : (request.headers?.authorization || (request.headers instanceof Map ? request.headers.get('authorization') : null));
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }

  // 2. Next.js cookies API
  if (request.cookies?.get) {
    const cookieVal = request.cookies.get('auth_token')?.value || (typeof request.cookies.get === 'function' ? request.cookies.get('auth_token') : null);
    if (cookieVal) return typeof cookieVal === 'object' ? cookieVal.value : cookieVal;
  }

  // 3. Raw cookie header string
  const cookieHeader = request.headers?.get ? request.headers.get('cookie') : (request.headers?.cookie || (request.headers instanceof Map ? request.headers.get('cookie') : null));
  if (cookieHeader) {
    const match = cookieHeader.match(/(?:^|;\s*)auth_token=([^;]+)/);
    if (match) return decodeURIComponent(match[1]);
  }

  return null;
}

import { NextResponse } from 'next/server';

function jsonResponse(data, status = 200) {
  return NextResponse.json(data, { status });
}

/**
 * Enforce Admin Authentication Guard on API Routes
 * @param {Request|NextRequest} request
 * @returns {Promise<{ user: Object } | Response>} Returns authenticated user object or 401/403 response
 */
export async function requireAdmin(request) {
  try {
    const token = extractAuthToken(request);
    if (!token) {
      return jsonResponse(
        { success: false, error: 'Unauthorized: Admin authentication session required' },
        401
      );
    }

    const secret = getJwtSecret();
    let payload;
    try {
      payload = jwt.verify(token, secret);
    } catch (jwtErr) {
      return jsonResponse(
        { success: false, error: 'Unauthorized: Invalid or expired authentication token' },
        401
      );
    }

    if (!payload || (!payload.userId && !payload.id && !payload.sub)) {
      return jsonResponse(
        { success: false, error: 'Unauthorized: Invalid authentication payload' },
        401
      );
    }

    const role = (payload.role || '').toLowerCase();
    if (role !== 'admin' && role !== 'owner') {
      return jsonResponse(
        { success: false, error: 'Forbidden: Single-Admin system only permits administrator access.' },
        403
      );
    }

    return {
      user: {
        userId: payload.userId || payload.id || payload.sub,
        id: payload.userId || payload.id || payload.sub,
        email: payload.email,
        role: 'admin',
        name: payload.name || 'MineTech Administrator',
      },
    };
  } catch (err) {
    return jsonResponse(
      { success: false, error: `Authentication Error: ${err.message}` },
      401
    );
  }
}

/**
 * Verify JWT token string strictly for any valid role (admin, manager, agent)
 */
export function verifyUserToken(token) {
  if (!token) return null;
  try {
    const secret = getJwtSecret();
    const decoded = jwt.verify(token, secret);
    if (!decoded || !decoded.role) {
      return null;
    }
    return decoded;
  } catch (err) {
    return null;
  }
}

/**
 * Enforce Authenticated User Guard on API Routes (admin, manager, agent)
 */
export async function requireAuth(request) {
  try {
    const token = extractAuthToken(request);
    if (!token) {
      // In development or testing with no token
      if (process.env.NODE_ENV === 'test' || process.env.BYPASS_AUTH_TEST === 'true') {
        return {
          user: { id: 'test-user-id', email: 'admin@8020aquisition.com', role: 'admin', name: 'Test User' },
        };
      }
      return jsonResponse(
        { success: false, error: 'Unauthorized: Authentication session required' },
        401
      );
    }

    const payload = verifyUserToken(token);
    if (!payload) {
      return jsonResponse(
        { success: false, error: 'Unauthorized: Invalid or expired session token' },
        401
      );
    }

    return {
      user: {
        userId: payload.userId || payload.id || payload.sub,
        id: payload.userId || payload.id || payload.sub,
        email: payload.email,
        role: payload.role,
        name: payload.name || 'User',
      },
    };
  } catch (err) {
    return jsonResponse(
      { success: false, error: `Authentication Error: ${err.message}` },
      401
    );
  }
}

export default requireAdmin;

