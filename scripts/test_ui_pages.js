import jwt from 'jsonwebtoken';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-for-dev-only-change-in-production';

const adminToken = jwt.sign(
  {
    userId: 'admin-001',
    id: 'admin-001',
    email: 'admin@8020outbound.com',
    role: 'admin',
    name: 'MineTech Administrator',
  },
  JWT_SECRET,
  { expiresIn: '8h' }
);

const routes = [
  { path: '/login', expected: 200, unauth: true },
  { path: '/leads', expected: 200 },
  { path: '/workstation', expected: 200 },
  { path: '/email/inbox', expected: 200 },
  { path: '/email/blasts', expected: 200 },
  { path: '/email/compose', expected: 200 },
  { path: '/email/templates', expected: 200 },
  { path: '/email/sequences', expected: 200 },
  { path: '/settings', expected: 200 },
  { path: '/analytics', expected: 200 },
  { path: '/command-center', expected: 200 },
];

async function verifyUiRoutes() {
  console.log('Testing Next.js UI Routes rendering for Single Admin...\n');
  let allPass = true;

  for (const r of routes) {
    try {
      const headers = r.unauth
        ? {}
        : {
            Cookie: `auth_token=${adminToken}`,
            Authorization: `Bearer ${adminToken}`,
          };

      const res = await fetch(`${BASE_URL}${r.path}`, { headers });
      const text = await res.text();
      const hasError = text.includes('Application error') || text.includes('Internal Server Error');
      const pass = res.status === r.expected && !hasError;

      if (!pass) allPass = false;
      const statusIcon = pass ? '✅ [PASS]' : '❌ [FAIL]';
      console.log(`  ${statusIcon} Page: ${r.path} -> HTTP ${res.status} (${text.length} bytes rendered)`);
    } catch (err) {
      allPass = false;
      console.log(`  ❌ [FAIL] Page: ${r.path} -> Error: ${err.message}`);
    }
  }

  // Verify that an unauthenticated request to a protected page redirects to /login
  const unauthReq = await fetch(`${BASE_URL}/workstation`, { redirect: 'manual' });
  const isRedirect = unauthReq.status === 307 || unauthReq.status === 302 || unauthReq.status === 308;
  const location = unauthReq.headers.get('location') || '';
  const redirectPass = isRedirect && location.includes('/login');
  console.log(`\n  ${redirectPass ? '✅ [PASS]' : '❌ [FAIL]'} Unauthenticated visit to /workstation redirects to /login (Status: ${unauthReq.status}, Location: ${location})`);

  // Verify non-admin (salesperson) visit to /workstation redirects to /login
  const salesToken = jwt.sign(
    { userId: 'sales-001', role: 'salesperson', email: 'sales@minetech.com' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
  const salesReq = await fetch(`${BASE_URL}/workstation`, {
    headers: { Cookie: `auth_token=${salesToken}` },
    redirect: 'manual',
  });
  const salesRedirect = (salesReq.status === 307 || salesReq.status === 302) && (salesReq.headers.get('location') || '').includes('/login');
  console.log(`  ${salesRedirect ? '✅ [PASS]' : '❌ [FAIL]'} Non-admin / Salesperson visit to /workstation strictly blocked and redirected to /login (Status: ${salesReq.status})`);

  process.exit(allPass && redirectPass && salesRedirect ? 0 : 1);
}

verifyUiRoutes();
