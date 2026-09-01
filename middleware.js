import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_token_key_change_me_8020';
const encodedSecret = new TextEncoder().encode(JWT_SECRET);

const PUBLIC_PATHS = [
  '/login',
  '/api/auth/login',
  '/api/auth/logout',
];

async function verifyTokenStrict(token) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, encodedSecret);
    return payload;
  } catch (err) {
    return null;
  }
}

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  // 1. Allow static assets, next internal files, and public webhooks
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.startsWith('/api/webhooks') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // 2. Extract and cryptographically verify auth token
  const token = request.cookies.get('auth_token')?.value || request.headers.get('authorization')?.replace('Bearer ', '');
  const verifiedPayload = await verifyTokenStrict(token);
  const isAuthenticated = Boolean(verifiedPayload && verifiedPayload.userId);

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
    applySecurityHeaders(res);
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
      applySecurityHeaders(res);
      return res;
    }

    // Web page: redirect to /login
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    const res = NextResponse.redirect(loginUrl);
    applySecurityHeaders(res);
    return res;
  }

  // 7. Authenticated user accessing protected route: allow with security headers
  const response = NextResponse.next();
  applySecurityHeaders(response);
  return response;
}

function applySecurityHeaders(response) {
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-XSS-Protection', '1; mode=block');
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
