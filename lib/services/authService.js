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

let defaultAdminEnsured = false;

/**
 * Ensure default administrator account exists in database
 */
export async function ensureDefaultAdmin() {
  if (defaultAdminEnsured) return null;
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@minetech.com').toLowerCase().trim();
  const adminPassword = process.env.ADMIN_PASSWORD;

  try {
    await connectToDatabase();
    const existing = await User.findOne({ email: adminEmail });
    if (!existing) {
      if (!adminPassword) {
        console.warn('[AuthService] ADMIN_PASSWORD not configured. Skipping default admin auto-creation.');
        defaultAdminEnsured = true;
        return null;
      }
      const admin = await User.create({
        name: 'MineTech Admin',
        email: adminEmail,
        password: adminPassword,
        role: 'admin',
        approved: true,
        active: true,
      });
      defaultAdminEnsured = true;
      return admin;
    }
    defaultAdminEnsured = true;
    return existing;
  } catch (err) {
    console.error('ensureDefaultAdmin non-fatal error:', err.message);
    return null;
  }
}

export default {
  signToken,
  verifyToken,
  getAuthenticatedUser,
  ensureDefaultAdmin,
};
