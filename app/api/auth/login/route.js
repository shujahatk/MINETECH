import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/mongoose';
import User from '@/lib/models/User';
import { signToken, ensureDefaultAdmin } from '@/lib/services/authService';
import { checkRateLimit, recordFailedAttempt, resetLoginAttempts } from '@/lib/services/rateLimiter';
import { isHoneypotTriggered } from '@/lib/utils/botProtection';
import { isValidEmail } from '@/lib/utils/validators';
import { sanitizeApiResponse } from '@/lib/utils/responseFilter';

export const dynamic = 'force-dynamic';

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

    // 1. Check brute force rate limit
    const rateCheck = checkRateLimit(clientIp);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: rateCheck.message,
          retryAfter: rateCheck.retryAfterSeconds,
        },
        { status: 429 }
      );
    }

    const body = await request.json();

    // 2. Honeypot Bot Trap Check
    if (isHoneypotTriggered(body)) {
      console.warn(`[Security] Bot honeypot triggered from IP: ${clientIp}`);
      return NextResponse.json(
        { success: false, error: 'Invalid authentication request.' },
        { status: 400 }
      );
    }

    const { email, password } = body;

    if (!email || !password || typeof email !== 'string' || typeof password !== 'string' || !isValidEmail(email)) {
      return NextResponse.json(
        { success: false, error: 'Valid email and password are required.' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    await connectToDatabase();
    await ensureDefaultAdmin();

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      recordFailedAttempt(clientIp);
      return NextResponse.json(
        { success: false, error: 'Invalid email or password.' },
        { status: 401 }
      );
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      recordFailedAttempt(clientIp);
      return NextResponse.json(
        { success: false, error: 'Invalid email or password.' },
        { status: 401 }
      );
    }

    // 2. Check approval & active status
    if (user.role !== 'admin' && user.role !== 'owner' && !user.approved) {
      return NextResponse.json(
        { success: false, error: 'Account pending administrator approval. Please contact your manager.' },
        { status: 403 }
      );
    }

    if (user.active === false) {
      return NextResponse.json(
        { success: false, error: 'Account has been deactivated. Please contact your administrator.' },
        { status: 403 }
      );
    }

    // 3. Reset rate limiter and update last login
    resetLoginAttempts(clientIp);
    user.lastLogin = new Date();
    await user.save();

    // 4. Generate JWT token
    const tokenPayload = {
      userId: user._id.toString(),
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role || 'salesperson',
      approved: user.approved !== false,
      active: user.active !== false,
    };

    const token = signToken(tokenPayload);

    // 5. Construct response with secure HttpOnly cookie
    const response = NextResponse.json({
      success: true,
      message: 'Authentication successful',
      token,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role || 'salesperson',
        dailyCallTarget: user.dailyCallTarget || 50,
        dailyEmailLimit: user.dailyEmailLimit || 200,
      },
    });

    response.cookies.set({
      name: 'auth_token',
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 8 * 60 * 60, // 8 hours
      path: '/',
    });

    return response;
  } catch (err) {
    console.error('[Login API Error]:', err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
