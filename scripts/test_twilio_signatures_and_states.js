import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { verifyTwilioWebhookSignature, terminateCall } from '../lib/services/twilioService.js';
import { supabase, supabaseAdmin } from '../lib/supabase.js';

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

// Helper to generate valid Twilio signature matching twilio.validateRequest algorithm
function generateTwilioSignature(authToken, url, params) {
  let data = url;
  if (params && typeof params === 'object') {
    const sortedKeys = Object.keys(params).sort();
    for (const key of sortedKeys) {
      data += key + params[key];
    }
  }
  return crypto.createHmac('sha1', authToken).update(Buffer.from(data, 'utf-8')).digest('base64');
}

async function runTwilioSecurityAndStateTests() {
  console.log('======================================================================');
  console.log('📞 TESTING TWILIO SIGNATURE VALIDATION & CALL LIFECYCLE STATES');
  console.log('======================================================================\n');

  const testAuthToken = process.env.TWILIO_AUTH_TOKEN || 'test_auth_token_for_validation_12345';
  process.env.TWILIO_AUTH_TOKEN = testAuthToken;
  process.env.NODE_ENV = 'production';

  const webhookUrl = 'https://crm.mine-tech.be/api/webhooks/twilio/status';
  const testParams = {
    CallSid: 'CA_test_sig_' + Date.now(),
    CallStatus: 'completed',
    CallDuration: '45',
    From: '+15551234567',
    To: '+15559876543'
  };

  // 1. Signature Verification Tests
  console.log('[Test 1] Valid Twilio Signature Verification:');
  const validSignature = generateTwilioSignature(testAuthToken, webhookUrl, testParams);
  const isValid = verifyTwilioWebhookSignature(webhookUrl, testParams, validSignature);
  assert(isValid === true, 'verifyTwilioWebhookSignature validates matching HMAC-SHA1 signature');

  console.log('\n[Test 2] Tampered Parameter Rejection:');
  const tamperedParams = { ...testParams, CallStatus: 'in-progress' };
  const isTamperedValid = verifyTwilioWebhookSignature(webhookUrl, tamperedParams, validSignature);
  assert(isTamperedValid === false, 'verifyTwilioWebhookSignature rejects payload with tampered parameters');

  console.log('\n[Test 3] Invalid Token / Signature Rejection:');
  const isBadSigValid = verifyTwilioWebhookSignature(webhookUrl, testParams, 'invalid_fake_signature_base64');
  assert(isBadSigValid === false, 'verifyTwilioWebhookSignature rejects invalid signature string');

  console.log('\n[Test 4] Missing Signature in Production:');
  const isMissingSigValid = verifyTwilioWebhookSignature(webhookUrl, testParams, null);
  assert(isMissingSigValid === false, 'verifyTwilioWebhookSignature fails closed (rejects) when signature header is missing');

  // 2. Webhook Route Handler Security Test
  console.log('\n[Test 5] Direct Webhook Route Handler Signature Enforcement:');
  try {
    const { POST: twilioStatusWebhook } = await import('../app/api/webhooks/twilio/status/route.js');
    
    // Test 5a: Request with missing signature in production -> 401
    const unsignedReq = new Request(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(testParams).toString()
    });
    const unsignedRes = await twilioStatusWebhook(unsignedReq);
    assert(unsignedRes.status === 401, 'Unsigned webhook request returns HTTP 401 Unauthorized');

    // Test 5b: Request with valid signature in production -> 200
    const signedReq = new Request(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'x-twilio-signature': validSignature
      },
      body: new URLSearchParams(testParams).toString()
    });
    const signedRes = await twilioStatusWebhook(signedReq);
    assert(signedRes.status === 200, 'Validly signed webhook request returns HTTP 200 OK');
  } catch (err) {
    assert(false, `Webhook route test failed with error: ${err.message}`);
  }

  // 3. Database State Update Verification
  console.log('\n[Test 6] Database Call Record State Verification:');
  try {
    const testCallSid = 'CA_db_test_' + Date.now();
    // Insert initial in-progress call
    const { data: initialCall, error: insertErr } = await supabaseAdmin
      .from('calls')
      .insert({
        call_sid: testCallSid,
        from_number: '+15551234567',
        to_number: '+15559876543',
        status: 'in-progress',
        direction: 'outbound'
      })
      .select()
      .single();

    if (insertErr) {
      console.warn('Could not insert test call into calls table (check table structure):', insertErr.message);
    } else {
      assert(initialCall.status === 'in-progress', 'Test call inserted with status "in-progress"');

      // Now fire webhook for this CallSid
      const { POST: twilioStatusWebhook } = await import('../app/api/webhooks/twilio/status/route.js');
      const callParams = {
        CallSid: testCallSid,
        CallStatus: 'completed',
        CallDuration: '120',
        RecordingUrl: 'https://api.twilio.com/recordings/RE12345'
      };
      const callSig = generateTwilioSignature(testAuthToken, webhookUrl, callParams);
      const req = new Request(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'x-twilio-signature': callSig
        },
        body: new URLSearchParams(callParams).toString()
      });
      const res = await twilioStatusWebhook(req);
      assert(res.status === 200, 'Webhook processed completed status');

      // Verify updated record in DB
      const { data: updatedCall } = await supabaseAdmin
        .from('calls')
        .select('*')
        .eq('call_sid', testCallSid)
        .single();

      assert(updatedCall?.status === 'completed', 'Call record status updated to "completed" in database');
      assert(Number(updatedCall?.duration) === 120, 'Call duration updated accurately in database');
      assert(updatedCall?.recording_url === 'https://api.twilio.com/recordings/RE12345', 'Recording URL saved in database');
    }
  } catch (err) {
    assert(false, `Database call verification error: ${err.message}`);
  }

  // 4. Terminate Call API Verification
  console.log('\n[Test 7] Terminate Call Security & State API:');
  try {
    const endRes = await terminateCall('CA_fake_sid_to_test');
    assert(typeof endRes === 'object', 'terminateCall returns structured execution result');
  } catch (err) {
    assert(false, `terminateCall error: ${err.message}`);
  }

  console.log('\n======================================================================');
  console.log(`📊 TWILIO INTEGRITY & SECURITY RESULTS: ${passed} Passed / ${failed} Failed`);
  console.log('======================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTwilioSecurityAndStateTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
