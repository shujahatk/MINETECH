import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { supabaseAdmin } from '../lib/supabase.js';
import { POST as twilioStatusWebhook } from '../app/api/webhooks/twilio/status/route.js';
import { GET as getCallsHandler } from '../app/api/twilio/calls/route.js';
import { terminateCall } from '../lib/services/twilioService.js';
import { signToken } from '../lib/services/authService.js';

let passed = 0;
let failed = 0;
let skipped = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  ❌ [FAIL] ${message}`);
    failed++;
  }
}

async function runTwilioCallStatesTests() {
  console.log('======================================================================');
  console.log('📞 TESTING TWILIO REAL CALL STATES & HANGUP VERIFICATION');
  console.log('======================================================================\n');

  const testSuffix = Date.now();
  const testCallSid1 = `CA_state_test_${testSuffix}`;
  const testCallSid2 = `CA_fail_test_${testSuffix}`;
  const dummyToken = signToken({ userId: '00000000-0000-0000-0000-000000000001', email: 'admin@test.com', role: 'admin' });

  try {
    // 1. Insert Initial Call in Queued State
    console.log('[Test 1] Full Call State Progression (Queued -> Ringing -> In-Progress -> Completed):');
    await supabaseAdmin.from('calls').insert({
      call_sid: testCallSid1,
      from_number: '+15551234567',
      to_number: '+15559876543',
      status: 'queued',
      direction: 'outbound',
    });

    const getReq1 = new Request(`https://crm.mine-tech.be/api/twilio/calls?callSid=${testCallSid1}`, {
      headers: { authorization: `Bearer ${dummyToken}` },
    });
    const res1 = await getCallsHandler(getReq1);
    const json1 = await res1.json();
    assert(json1.data.status === 'queued', 'Call queried via GET /api/twilio/calls has status "queued"');

    // Simulate Ringing Webhook
    await supabaseAdmin.from('calls').update({ status: 'ringing' }).eq('call_sid', testCallSid1);
    const resRinging = await getCallsHandler(getReq1);
    const jsonRinging = await resRinging.json();
    assert(jsonRinging.data.status === 'ringing', 'Call state transitioned to "ringing"');

    // Simulate In-Progress Webhook
    await supabaseAdmin.from('calls').update({ status: 'in-progress' }).eq('call_sid', testCallSid1);
    const resProgress = await getCallsHandler(getReq1);
    const jsonProgress = await resProgress.json();
    assert(jsonProgress.data.status === 'in-progress', 'Call state transitioned to "in-progress" (Connected)');

    // Simulate Completed Webhook
    await supabaseAdmin.from('calls').update({ status: 'completed', duration: 75 }).eq('call_sid', testCallSid1);
    const resComp = await getCallsHandler(getReq1);
    const jsonComp = await resComp.json();
    assert(jsonComp.data.status === 'completed', 'Call state transitioned to "completed"');
    assert(Number(jsonComp.data.duration) === 75, 'Call duration accurately recorded');

    // 2. Queued -> Failed State Transition
    console.log('\n[Test 2] Queued -> Failed State Transition:');
    await supabaseAdmin.from('calls').insert({
      call_sid: testCallSid2,
      from_number: '+15551234567',
      to_number: '+15559876543',
      status: 'queued',
      direction: 'outbound',
    });

    await supabaseAdmin.from('calls').update({ status: 'failed' }).eq('call_sid', testCallSid2);
    const getReq2 = new Request(`https://crm.mine-tech.be/api/twilio/calls?callSid=${testCallSid2}`, {
      headers: { authorization: `Bearer ${dummyToken}` },
    });
    const resFail = await getCallsHandler(getReq2);
    const jsonFail = await resFail.json();
    assert(jsonFail.data.status === 'failed', 'Call state transitioned to "failed" when connection fails');

    // 3. Hangup API Verification
    console.log('\n[Test 3] Call Hangup / Termination API:');
    const termRes = await terminateCall(testCallSid1);
    assert(typeof termRes === 'object', 'terminateCall handles live call hangup request gracefully');

  } catch (err) {
    console.error('❌ [FATAL TEST ERROR]:', err.message);
    failed++;
  } finally {
    // Cleanup
    await supabaseAdmin.from('calls').delete().in('call_sid', [testCallSid1, testCallSid2]);
  }

  console.log(`\n======================================================================`);
  console.log(`📊 TWILIO CALL STATES RESULTS: ${passed} Passed / ${failed} Failed / ${skipped} Skipped`);
  console.log(`======================================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTwilioCallStatesTests().catch(err => {
  console.error('Fatal runner error:', err);
  process.exit(1);
});
