import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/mongoose';
import User from '@/lib/models/User';
import { signToken, ensureDefaultAdmin } from '@/lib/services/authService';
import { checkRateLimit, recordFailedAttempt, resetLoginAttempts } from '@/lib/services/rateLimiter';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

const DUMMY_HASH = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

function getClientIp(request) {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return '127.0.0.1';
}

export async function POST(request) {
  try {
    const clientIp = getClientIp(request);

    // 1. Check rate limit
    const rateCheck = checkRateLimit(clientIp);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          message: rateCheck.message,
          retryAfter: rateCheck.retryAfterSeconds,
        },
        { status: 429 }
      );
    }

    const { email, password } = await request.json();

    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      return NextResponse.json(
        { success: false, message: 'Valid email and password are required.' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    const envAdminEmail = (process.env.ADMIN_EMAIL || 'admin@8020outbound.com').toLowerCase().trim();
    const envAdminPassword = process.env.ADMIN_PASSWORD || 'AdminPassword2026!';

    let user = null;
    let isMatch = false;

    // Check database first
    try {
      await connectToDatabase();
      await ensureDefaultAdmin();
      user = await User.findOne({ email: normalizedEmail });
      if (user) {
        isMatch = await user.matchPassword(password);
      }
    } catch (dbErr) {
      // Offline fallback
    }

    // Fallback check against configured admin credentials in .env if DB not connected or user matches
    if (!isMatch && normalizedEmail === envAdminEmail && password === envAdminPassword) {
      isMatch = true;
      user = {
        _id: 'local-admin-id',
        name: 'Admin User',
        email: envAdminEmail,
        role: 'admin',
      };
    }

    if (!isMatch) {
      // Timing attack protection
      await bcrypt.compare(password, DUMMY_HASH);
      const attemptResult = recordFailedAttempt(clientIp);

      if (attemptResult.locked) {
        return NextResponse.json(
          { success: false, message: 'Too many failed login attempts. IP locked for 15 minutes.' },
          { status: 429 }
        );
      }

      return NextResponse.json(
        {
          success: false,
          message: `Invalid email or password. (${attemptResult.remaining} attempt${attemptResult.remaining === 1 ? '' : 's'} remaining)`,
        },
        { status: 401 }
      );
    }

    // Reset rate limiter on successful login
    resetLoginAttempts(clientIp);

    const token = signToken({
      userId: (user._id || user.id || 'local-admin-id').toString(),
      email: user.email,
      name: user.name,
      role: user.role || 'admin',
    });

    const response = NextResponse.json({
      success: true,
      user: {
        id: user._id || user.id,
        name: user.name,
        email: user.email,
        role: user.role || 'admin',
      },
      token,
    });

    // Secure HTTP-only session cookie (24 hours standard session lifetime)
    response.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24, // 24 hours
    });

    return response;
  } catch (err) {
    console.error('[Auth Login] Error:', err);
    return NextResponse.json({ success: false, message: 'Authentication error' }, { status: 500 });
  }
}
