import jwt from 'jsonwebtoken';
import { connectToDatabase } from '@/lib/db/mongoose';
import User from '@/lib/models/User';

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_token_key_change_me_8020';

export function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '2h' });
}

export function verifyToken(token) {
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

/**
 * Fast synchronous-first authenticated user resolution in <1ms
 */
export async function getAuthenticatedUser(request) {
  let token = null;

  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else {
    // Check cookie
    const cookieHeader = request.headers.get('cookie');
    if (cookieHeader) {
      const match = cookieHeader.match(/auth_token=([^;]+)/);
      if (match) {
        token = match[1];
      }
    }
  }

  if (!token) return null;

  const decoded = verifyToken(token);
  if (!decoded || !decoded.userId) return null;

  // Immediate payload return (0ms latency)
  return {
    _id: decoded.userId,
    id: decoded.userId,
    name: decoded.name || 'Admin User',
    email: decoded.email || process.env.ADMIN_EMAIL || 'admin@8020outbound.com',
    role: decoded.role || 'admin',
  };
}

export async function ensureDefaultAdmin() {
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@8020outbound.com').toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || 'AdminPassword2026!';

  try {
    await connectToDatabase();
    const existing = await User.findOne({ email: adminEmail });
    if (!existing) {
      const admin = await User.create({
        name: 'Sales Master',
        email: adminEmail,
        password: adminPassword,
        role: 'admin',
      });
      return admin;
    }
    return existing;
  } catch (err) {
    return {
      _id: 'local-admin-id',
      name: 'Admin User',
      email: adminEmail,
      role: 'admin',
    };
  }
}
