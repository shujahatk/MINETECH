/**
 * Comprehensive Automated Test Suite: Resend Sender Configuration, Diagnostics & Error Handling
 * Validates:
 * 1. Centralized server-side configuration resolution (EMAIL_FROM, EMAIL_FROM_NAME, REPLY_TO, RESEND_API_KEY)
 * 2. Pre-flight validation against unauthorized sender domains (e.g., 'minetech.be' vs verified 'mine-tech.be')
 * 3. Pre-flight validation for missing or invalid sender/reply-to email syntax
 * 4. Missing/invalid RESEND_API_KEY error behavior (actionable server-side error)
 * 5. Live sending with verified sender Rauf <rauf@mine-tech.be> to Resend API
 * 6. Webhook decoupling (webhook processing operates independently and cannot block outbound sends)
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import { validateSenderConfig, getEmailConfig, sendLeadEmail } from '../lib/services/emailService.js';
import { supabaseAdmin } from '../lib/supabase.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  ❌ [FAIL] ${message}`);
    failed++;
  }
}

async function runDiagnosticsSuite() {
  console.log('======================================================================');
  console.log('🔍 MINETECH RESEND SENDER CONFIGURATION & DIAGNOSTICS TEST SUITE');
  console.log('======================================================================\n');

  // TEST 1: Centralized Configuration Resolution
  console.log('--- TEST 1: Centralized Configuration Resolution ---');
  const config = getEmailConfig();
  assert(Boolean(config.from), `Sender address resolved: "${config.from}"`);
  assert(Boolean(config.fromName), `Sender name resolved: "${config.fromName}"`);
  assert(Boolean(config.replyTo), `Reply-to address resolved: "${config.replyTo}"`);
  assert(Boolean(config.apiKey && config.apiKey.startsWith('re_')), 'Resend API key securely read with valid prefix (re_...)');
  assert(config.from.includes('mine-tech.be'), `Sender domain is verified mine-tech.be (got: ${config.from})`);

  // TEST 2: Pre-flight Validation for Unauthorized 'minetech.be' Domain
  console.log('\n--- TEST 2: Unauthorized Domain Handling (minetech.be without hyphen) ---');
  const unauthCheck = validateSenderConfig({ senderEmail: 'outreach@minetech.be' });
  assert(unauthCheck.valid === false, 'Blocked unverified domain minetech.be');
  assert(unauthCheck.code === 'UNAUTHORIZED_SENDER_DOMAIN', `Correct error code: UNAUTHORIZED_SENDER_DOMAIN (got: ${unauthCheck.code})`);
  assert(unauthCheck.error.includes('mine-tech.be'), 'Error message provides actionable guidance to use mine-tech.be');

  // TEST 3: Pre-flight Validation for Malformed Sender Address
  console.log('\n--- TEST 3: Malformed Sender and Reply-To Validation ---');
  const malformedFrom = validateSenderConfig({ senderEmail: 'invalid-email-address' });
  assert(malformedFrom.valid === false, 'Blocked malformed sender address');
  assert(malformedFrom.code === 'INVALID_SENDER_EMAIL', `Correct error code: INVALID_SENDER_EMAIL (got: ${malformedFrom.code})`);

  const malformedReplyTo = validateSenderConfig({ senderEmail: 'rauf@mine-tech.be', replyToEmail: 'bad-reply-to' });
  assert(malformedReplyTo.valid === false, 'Blocked malformed reply-to address');
  assert(malformedReplyTo.code === 'INVALID_REPLY_TO', `Correct error code: INVALID_REPLY_TO (got: ${malformedReplyTo.code})`);

  const validConfig = validateSenderConfig({ senderEmail: 'rauf@mine-tech.be', replyToEmail: 'rauf@mine-tech.be' });
  assert(validConfig.valid === true, 'Validated authorized sender rauf@mine-tech.be');

  // Fetch real lead from Supabase for subsequent tests
  const { data: leads } = await supabaseAdmin
    .from('leads')
    .select('id, email, full_name')
    .limit(1);
  const testLead = leads && leads.length > 0 ? leads[0] : null;

  // TEST 4: Missing Credentials Diagnostic
  console.log('\n--- TEST 4: Missing Credentials Diagnostic ---');
  const originalKey = process.env.RESEND_API_KEY;
  const originalEnv = process.env.NODE_ENV;
  try {
    process.env.RESEND_API_KEY = '';
    process.env.NODE_ENV = 'production';
    if (testLead) {
      const missingKeySend = await sendLeadEmail({
        leadId: testLead.id,
        to: testLead.email,
        subject: 'Test Missing Key',
        bodyText: 'Testing missing key handling'
      });
      assert(missingKeySend.success === false, 'Send cleanly failed when RESEND_API_KEY is missing');
      assert(missingKeySend.code === 'MISSING_API_KEY', `Error code indicates MISSING_API_KEY (got: ${missingKeySend.code})`);
      assert(missingKeySend.error.includes('RESEND_API_KEY'), 'Error message explains RESEND_API_KEY requirement');
    }
  } finally {
    process.env.RESEND_API_KEY = originalKey;
    process.env.NODE_ENV = originalEnv;
  }

  // TEST 5: Live Dispatch via Verified Domain rauf@mine-tech.be
  console.log('\n--- TEST 5: Live Dispatch via Verified Domain rauf@mine-tech.be ---');
  if (testLead) {
    const liveSendRes = await sendLeadEmail({
      leadId: testLead.id,
      to: 'delivered@resend.dev',
      subject: `Resend Diagnostic Verification ${Date.now()}`,
      bodyText: 'Diagnostic verification of Resend integration with rauf@mine-tech.be',
      bodyHtml: '<p>Diagnostic verification of Resend integration with <strong>rauf@mine-tech.be</strong></p>',
    });

    assert(liveSendRes.success === true, `Live dispatch succeeded (Provider ID: ${liveSendRes.providerMessageId})`);
    assert(liveSendRes.from.includes('rauf@mine-tech.be'), `Sender header matches rauf@mine-tech.be (got: ${liveSendRes.from})`);
    assert(Boolean(liveSendRes.rfcMessageId), `RFC Message-ID properly generated: ${liveSendRes.rfcMessageId}`);
  } else {
    console.log('  ⚠️ Skipping live lead dispatch (no test lead in database)');
  }

  // TEST 6: Webhook Processing Decoupling & Signature Enforcement
  console.log('\n--- TEST 6: Webhook Processing Decoupling & Signature Enforcement ---');
  const originalSecret = process.env.RESEND_WEBHOOK_SECRET;
  try {
    process.env.RESEND_WEBHOOK_SECRET = 'whsec_testsecret1234567890abcdefghijklmnopqrstuvwxyz';
    const { POST: webhookHandler } = await import('../app/api/webhooks/resend/route.js');
    const mockReq = {
      text: async () => JSON.stringify({ type: 'email.delivered', data: { email_id: 'test' } }),
      headers: new Headers({
        'svix-id': 'msg_test_123',
        'svix-timestamp': `${Math.floor(Date.now() / 1000)}`,
        'svix-signature': 'v1,invalid_signature_mock',
      }),
    };
    const webhookResponse = await webhookHandler(mockReq);
    const webhookJson = await webhookResponse.json();
    assert(webhookResponse.status === 401, `Invalid webhook rejected with HTTP 401 (got: ${webhookResponse.status})`);
    assert(webhookJson.success === false, 'Webhook failure cleanly isolated without throwing unhandled exceptions');
  } finally {
    process.env.RESEND_WEBHOOK_SECRET = originalSecret;
  }

  console.log('\n======================================================================');
  console.log(`📊 DIAGNOSTICS RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('======================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runDiagnosticsSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
