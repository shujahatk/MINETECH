import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

function getEncodedSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;
  return new TextEncoder().encode(secret);
}

const PUBLIC_PATHS = [
  '/login',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/system/health',
];

const SUSPICIOUS_BOT_USER_AGENTS = [
  /sqlmap/i,
  /nikto/i,
  /masscan/i,
  /acunetix/i,
  /havij/i,
  /zgrab/i,
  /wpscan/i,
  /dirbuster/i,
  /gobuster/i,
];

async function verifyTokenStrict(token) {
  if (!token) return null;
  const encodedSecret = getEncodedSecret();
  if (!encodedSecret) return null;
  try {
    const { payload } = await jwtVerify(token, encodedSecret);
    return payload;
  } catch (err) {
    return null;
  }
}

function applySecurityAndCors(response, request) {
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  const requestOrigin = request?.headers?.get('origin');
  const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || process.env.NEXT_PUBLIC_APP_URL || '').split(',').map((o) => o.trim());

  if (requestOrigin && (allowedOrigins.includes('*') || allowedOrigins.includes(requestOrigin))) {
    response.headers.set('Access-Control-Allow-Origin', requestOrigin);
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  }
}

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  // 0. Force HTTPS in Production (for live domain deployments, exclude localhost)
  if (process.env.NODE_ENV === 'production') {
    const host = request.headers.get('host') || '';
    const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1') || host.includes('[::1]');
    if (!isLocalhost) {
      const proto = request.headers.get('x-forwarded-proto');
      if (proto && proto === 'http') {
        const httpsUrl = new URL(request.url);
        httpsUrl.protocol = 'https:';
        return NextResponse.redirect(httpsUrl, 301);
      }
    }
  }

  // 0.1 Block Suspicious Automated Scanners
  const ua = request.headers.get('user-agent') || '';
  if (SUSPICIOUS_BOT_USER_AGENTS.some((pattern) => pattern.test(ua))) {
    return new NextResponse('Forbidden: Automated Scanner Blocked', { status: 403 });
  }

  // Handle CORS OPTIONS preflight
  if (request.method === 'OPTIONS') {
    const preflightRes = new NextResponse(null, { status: 204 });
    applySecurityAndCors(preflightRes, request);
    return preflightRes;
  }

  // 1. Allow static assets, next internal files, and public webhooks
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.startsWith('/api/webhooks') ||
    pathname.includes('.')
  ) {
    const res = NextResponse.next();
    applySecurityAndCors(res, request);
    return res;
  }

  // 2. Extract and cryptographically verify auth token
  const token = request.cookies.get('auth_token')?.value || request.headers.get('authorization')?.replace('Bearer ', '');
  const verifiedPayload = await verifyTokenStrict(token);
  const isAuthenticated = Boolean(verifiedPayload && (verifiedPayload.userId || verifiedPayload.id));

  // 3. Intelligent root path routing
  if (pathname === '/') {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL('/workstation', request.url));
    } else {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('callbackUrl', '/');
      return NextResponse.redirect(loginUrl);
    }
  }

  // 4. If authenticated user visits /login -> redirect to /workstation
  if (pathname === '/login' && isAuthenticated) {
    return NextResponse.redirect(new URL('/workstation', request.url));
  }

  const isPublicPath = PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(path + '/'));

  // 5. If public path, allow through with security headers
  if (isPublicPath) {
    const res = NextResponse.next();
    applySecurityAndCors(res, request);
    return res;
  }

  // 6. If unauthenticated user attempts to access protected routes:
  if (!isAuthenticated) {
    // API endpoint: return 401 JSON
    if (pathname.startsWith('/api/')) {
      const res = NextResponse.json(
        { success: false, message: 'Unauthorized. Valid authentication session required.' },
        { status: 401 }
      );
      applySecurityAndCors(res, request);
      return res;
    }

    // Web page: redirect to /login
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    const res = NextResponse.redirect(loginUrl);
    applySecurityAndCors(res, request);
    return res;
  }

  // 7. Single-Admin constraint: Non-admin / Agent tokens are strictly forbidden
  const userRole = (verifiedPayload?.role || '').toLowerCase();
  const isAdmin = userRole === 'admin' || userRole === 'owner';
  if (!isAdmin) {
    if (pathname.startsWith('/api/')) {
      const res = NextResponse.json(
        { success: false, error: 'Forbidden: Single-Admin system only permits administrator access.' },
        { status: 403 }
      );
      applySecurityAndCors(res, request);
      return res;
    }

    const loginUrl = new URL('/login', request.url);
    const res = NextResponse.redirect(loginUrl);
    applySecurityAndCors(res, request);
    return res;
  }

  // 7.1 Legacy telephony pages (/twilio/*) are retired from the UI. The pages, API routes,
  // webhooks and data are untouched; set NEXT_PUBLIC_TELEPHONY_ENABLED=true to re-open them.
  if (
    process.env.NEXT_PUBLIC_TELEPHONY_ENABLED !== 'true' &&
    (pathname === '/twilio' || pathname.startsWith('/twilio/'))
  ) {
    const res = NextResponse.redirect(new URL('/workstation', request.url));
    applySecurityAndCors(res, request);
    return res;
  }

  // 8. Authenticated admin accessing protected route: allow with security headers
  const response = NextResponse.next();
  applySecurityAndCors(response, request);
  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)',
  ],
};
