import jwt from 'jsonwebtoken';
import { connectToDatabase } from '../db/mongoose.js';
import User from '../models/User.js';

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('FATAL: JWT_SECRET environment variable is not defined.');
  }
  return secret;
}

export function signToken(payload) {
  const secret = getJwtSecret();
  return jwt.sign(payload, secret, { expiresIn: '8h' });
}

export function verifyToken(token) {
  if (!token) return null;
  try {
    const secret = getJwtSecret();
    return jwt.verify(token, secret);
  } catch (err) {
    return null;
  }
}

/**
 * Fast authenticated user resolution from Authorization header or cookie
 */
export async function getAuthenticatedUser(request) {
  let token = null;

  const authHeader = request.headers?.get ? request.headers.get('authorization') : (request.headers?.authorization || (request.headers instanceof Map ? request.headers.get('authorization') : null));
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else {
    // Check cookie
    const cookieHeader = request.headers?.get ? request.headers.get('cookie') : (request.headers?.cookie || (request.headers instanceof Map ? request.headers.get('cookie') : null));
    if (cookieHeader) {
      const match = cookieHeader.match(/(?:^|;\s*)auth_token=([^;]+)/);
      if (match) {
        token = decodeURIComponent(match[1]);
      }
    }
  }

  if (!token) return null;

  const decoded = verifyToken(token);
  if (!decoded || !decoded.userId) return null;

  return {
    _id: decoded.userId,
    id: decoded.userId,
    name: decoded.name || 'MineTech Administrator',
    email: decoded.email,
    role: decoded.role || 'admin',
  };
}

let cachedAdmin = null;

/**
 * Ensure default administrator account exists in database
 * Returns the administrator user object (never returns null on repeated calls).
 */
export async function ensureDefaultAdmin() {
  if (cachedAdmin) return cachedAdmin;
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@8020aquisition.com').toLowerCase().trim();
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin2026!';

  try {
    await connectToDatabase();
    let existing = await User.findOne({ email: adminEmail });
    if (!existing) {
      existing = await User.findOne({ role: 'admin' });
    }

    if (!existing) {
      existing = await User.create({
        name: 'MineTech Admin',
        email: adminEmail,
        password: adminPassword,
        role: 'admin',
        approved: true,
        active: true,
      });
    }

    cachedAdmin = existing;
    return existing;
  } catch (err) {
    console.error('ensureDefaultAdmin non-fatal error:', err.message);
    // Return a safe memory fallback object so callers never throw null pointer errors
    return {
      id: '50be7386-1298-4611-b986-d72398e4575c',
      _id: '50be7386-1298-4611-b986-d72398e4575c',
      name: 'MineTech Admin',
      email: adminEmail,
      role: 'admin',
      dailyEmailLimit: 2500,
      centralSendingEmail: process.env.EMAIL_FROM || 'rauf@mine-tech.be',
      centralReplyTo: process.env.REPLY_TO || 'rauf@mine-tech.be',
    };
  }
}

export default {
  signToken,
  verifyToken,
  getAuthenticatedUser,
  ensureDefaultAdmin,
};
