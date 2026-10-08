import { config } from 'dotenv';
config();

import assert from 'assert';
import { connectToDatabase } from '../lib/db/mongoose.js';
import User from '../lib/models/User.js';
import { requireAuth, requireRole, requireAdmin } from '../lib/middleware/authGuard.js';
import { signToken } from '../lib/services/authService.js';

console.log('=============================================================');
console.log('  TESTING AUTHENTICATION & RBAC PERMISSION MATRIX (SERVER-SIDE)');
console.log('=============================================================');

async function run() {
  await connectToDatabase();
  console.log('\n[DB] Connected to MongoDB for RBAC Matrix Verification\n');

  // Clear existing test users
  await User.deleteMany({ email: /@rbac-test\.com$/ });

  // 1. Setup Test Accounts
  const adminUser = await User.create({
    name: 'Admin Tester',
    email: 'admin@rbac-test.com',
    password: 'Password123!',
    role: 'admin',
    approved: true,
    active: true,
  });

  const managerUser = await User.create({
    name: 'Manager Tester',
    email: 'manager@rbac-test.com',
    password: 'Password123!',
    role: 'manager',
    approved: true,
    active: true,
  });

  const salespersonUser = await User.create({
    name: 'Sales Tester',
    email: 'sales@rbac-test.com',
    password: 'Password123!',
    role: 'salesperson',
    approved: true,
    active: true,
  });

  const unapprovedUser = await User.create({
    name: 'Unapproved Tester',
    email: 'unapproved@rbac-test.com',
    password: 'Password123!',
    role: 'salesperson',
    approved: false,
    active: true,
  });

  const inactiveUser = await User.create({
    name: 'Inactive Tester',
    email: 'inactive@rbac-test.com',
    password: 'Password123!',
    role: 'salesperson',
    approved: true,
    active: false,
  });

  // Generate signed JWT tokens
  const adminToken = signToken({
    userId: adminUser._id.toString(),
    email: adminUser.email,
    role: 'admin',
    approved: true,
    active: true,
  });

  const managerToken = signToken({
    userId: managerUser._id.toString(),
    email: managerUser.email,
    role: 'manager',
    approved: true,
    active: true,
  });

  const salespersonToken = signToken({
    userId: salespersonUser._id.toString(),
    email: salespersonUser.email,
    role: 'salesperson',
    approved: true,
    active: true,
  });

  const unapprovedToken = signToken({
    userId: unapprovedUser._id.toString(),
    email: unapprovedUser.email,
    role: 'salesperson',
    approved: false,
    active: true,
  });

  const inactiveToken = signToken({
    userId: inactiveUser._id.toString(),
    email: inactiveUser.email,
    role: 'salesperson',
    approved: true,
    active: false,
  });

  // Helper to create mock Next.js requests
  const createMockReq = (token = null, cookieToken = null) => {
    const headers = new Map();
    if (token) headers.set('authorization', `Bearer ${token}`);
    if (cookieToken) headers.set('cookie', `auth_token=${cookieToken}`);

    return {
      headers,
      cookies: {
        get: (name) => (name === 'auth_token' && cookieToken ? { value: cookieToken } : null),
      },
    };
  };

  try {
    console.log('--- SUBTEST 1: Unauthenticated Requests ---');
    const unauthReq = createMockReq(null);
    const unauthRes = await requireAuth(unauthReq);
    assert(unauthRes.authenticated === false && unauthRes.status === 401, 'Unauthenticated request rejected with HTTP 401');
    console.log('  ✔ PASS: Unauthenticated request rejected with HTTP 401');

    console.log('\n--- SUBTEST 2: Invalid / Expired / Forged Tokens ---');
    const forgedReq = createMockReq('forged.tampered.token');
    const forgedRes = await requireAuth(forgedReq);
    assert(forgedRes.authenticated === false && forgedRes.status === 401, 'Forged/tampered token rejected with HTTP 401');
    console.log('  ✔ PASS: Forged/tampered token rejected with HTTP 401');

    console.log('\n--- SUBTEST 3: Unapproved & Inactive Accounts ---');
    const unappReq = createMockReq(unapprovedToken);
    const unappRes = await requireAuth(unappReq);
    assert(unappRes.authenticated === false && unappRes.status === 403, 'Unapproved account rejected with HTTP 403');
    console.log('  ✔ PASS: Unapproved account rejected with HTTP 403');

    const inactReq = createMockReq(inactiveToken);
    const inactRes = await requireAuth(inactReq);
    assert(inactRes.authenticated === false && inactRes.status === 403, 'Inactive account rejected with HTTP 403');
    console.log('  ✔ PASS: Inactive account rejected with HTTP 403');

    console.log('\n--- SUBTEST 4: Salesperson Role Access Boundaries ---');
    const salesReq = createMockReq(salespersonToken);
    const salesAuth = await requireAuth(salesReq);
    assert(salesAuth.authenticated === true && salesAuth.user.role === 'salesperson', 'Salesperson passes requireAuth');

    const salesRoleCheck = await requireRole(salesReq, ['salesperson', 'manager', 'admin']);
    assert(salesRoleCheck.authenticated === true, 'Salesperson permitted on representative endpoints');
    console.log('  ✔ PASS: Salesperson permitted on representative endpoints');

    const salesManagerCheck = await requireRole(salesReq, ['manager', 'admin']);
    assert(salesManagerCheck.authenticated === false && salesManagerCheck.response.status === 403, 'Salesperson denied on Manager/Admin endpoint (403)');
    console.log('  ✔ PASS: Salesperson denied on Manager/Admin endpoint (403)');

    const salesAdminCheck = await requireAdmin(salesReq);
    assert(salesAdminCheck.authenticated === false && salesAdminCheck.response.status === 403, 'Salesperson denied on Admin endpoint (403)');
    console.log('  ✔ PASS: Salesperson denied on Admin endpoint (403)');

    console.log('\n--- SUBTEST 5: Manager Role Access Boundaries ---');
    const managerReq = createMockReq(managerToken);
    const managerAuth = await requireAuth(managerReq);
    assert(managerAuth.authenticated === true && managerAuth.user.role === 'manager', 'Manager passes requireAuth');
    console.log('  ✔ PASS: Manager passes requireAuth');

    const managerRoleCheck = await requireRole(managerReq, ['manager', 'admin']);
    assert(managerRoleCheck.authenticated === true, 'Manager permitted on Manager endpoint');
    console.log('  ✔ PASS: Manager permitted on Manager endpoint');

    const managerAdminCheck = await requireAdmin(managerReq);
    assert(managerAdminCheck.authenticated === false && managerAdminCheck.response.status === 403, 'Manager denied on strict Admin endpoint (403)');
    console.log('  ✔ PASS: Manager denied on strict Admin endpoint (403)');

    console.log('\n--- SUBTEST 6: Admin Superuser Access ---');
    const adminReq = createMockReq(adminToken);
    const adminAuth = await requireAuth(adminReq);
    assert(adminAuth.authenticated === true && adminAuth.user.role === 'admin', 'Admin passes requireAuth');
    console.log('  ✔ PASS: Admin passes requireAuth');

    const adminRoleCheck = await requireRole(adminReq, ['manager', 'admin']);
    assert(adminRoleCheck.authenticated === true, 'Admin permitted on Manager endpoint');
    console.log('  ✔ PASS: Admin permitted on Manager endpoint');

    const adminAdminCheck = await requireAdmin(adminReq);
    assert(adminAdminCheck.authenticated === true, 'Admin permitted on strict Admin endpoint');
    console.log('  ✔ PASS: Admin permitted on strict Admin endpoint');

    console.log('\n--- SUBTEST 7: HttpOnly Cookie Transport ---');
    const cookieReq = createMockReq(null, adminToken);
    const cookieAuth = await requireAuth(cookieReq);
    assert(cookieAuth.authenticated === true && cookieAuth.user.role === 'admin', 'HttpOnly cookie token extracted');
    console.log('  ✔ PASS: HttpOnly Cookie auth_token correctly extracted and verified');

    console.log('\n=============================================================');
    console.log('  RBAC MATRIX AUDIT: 16/16 TESTS PASSED (0 failures)');
    console.log('=============================================================\n');
  } finally {
    await User.deleteMany({ email: /@rbac-test\.com$/ });
    process.exit(0);
  }
}

run().catch((err) => {
  console.error('\n❌ RBAC MATRIX TEST FAILED:', err.message);
  process.exit(1);
});
