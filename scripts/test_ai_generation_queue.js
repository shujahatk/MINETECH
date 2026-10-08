import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { supabaseAdmin } from '../lib/supabase.js';
import {
  claimNextPendingGeneration,
  markGenerationReady,
  markGenerationFailed,
  releaseGenerationLock,
} from '../lib/queue/claimGenerationRecipient.js';
import { claimNextPendingRecipient } from '../lib/queue/claimRecipient.js';

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

async function runAiGenerationQueueTests() {
  console.log('======================================================================');
  console.log('🤖 TESTING AI GENERATION QUEUE, CONCURRENCY & SEND-BLOCKING');
  console.log('======================================================================\n');

  const testSuffix = Date.now();
  let testCampaignId = null;
  let testLeadId = null;
  let testRecipientId = null;

  try {
    // 1. Setup Test Fixtures
    const { data: lead, error: leadErr } = await supabaseAdmin
      .from('leads')
      .insert({
        email: `ai_test_${testSuffix}@example.com`,
        first_name: 'AiProspect',
        company: 'NeuralCorp',
      })
      .select()
      .single();

    if (leadErr || !lead) throw new Error(`Setup failed creating lead: ${leadErr?.message}`);
    testLeadId = lead.id;

    const { data: campaign, error: campErr } = await supabaseAdmin
      .from('email_campaigns')
      .insert({
        name: `AI Campaign ${testSuffix}`,
        status: 'RUNNING',
        stats: {
          campaign_type: 'ai_personalized',
          master_prompt: 'Pitch AI solutions',
        },
      })
      .select()
      .single();

    if (campErr || !campaign) throw new Error(`Setup failed creating campaign: ${campErr?.message}`);
    testCampaignId = campaign.id;

    const { data: recipient, error: recErr } = await supabaseAdmin
      .from('email_recipients')
      .insert({
        campaign_id: testCampaignId,
        lead_id: testLeadId,
        email: lead.email,
        status: 'PENDING',
        tokens: {
          generation_status: 'pending',
          company: 'NeuralCorp',
        },
      })
      .select()
      .single();

    if (recErr || !recipient) throw new Error(`Setup failed creating recipient: ${recErr?.message}`);
    testRecipientId = recipient.id;

    // 2. Test: Unfinished AI Recipient CANNOT Be Claimed for Email Sending
    console.log('[Test 1] Send-Queue Blocking for Unfinished AI Recipient:');
    const prematureSendClaim = await claimNextPendingRecipient('send-worker-1', 5, testCampaignId);
    assert(prematureSendClaim === null, 'Unfinished AI recipient (generation_status: pending) is strictly blocked from email send queue');

    // 3. Test: Atomic Generation Claim Race (10 Concurrent Workers)
    console.log('\n[Test 2] Atomic AI Generation Claim Race (10 Concurrent Workers):');
    const workerPromises = Array.from({ length: 10 }, (_, i) =>
      claimNextPendingGeneration(`ai-gen-worker-${i + 1}`, 5, testCampaignId)
    );

    const claimResults = await Promise.all(workerPromises);
    const successfulClaims = claimResults.filter(Boolean);

    assert(successfulClaims.length === 1, `Exactly ONE worker successfully claimed the recipient (Got: ${successfulClaims.length})`);
    assert(claimResults.filter((r) => r === null).length === 9, 'All other 9 generation workers safely received null');

    const winningWorker = successfulClaims[0].generation_worker_id || successfulClaims[0].generation_claimed_by;
    assert(Boolean(winningWorker), 'Claimed recipient records generation worker ID');

    // 4. Test: Duplicate Generation Prevention
    console.log('\n[Test 3] Duplicate AI Generation Prevention:');
    const secondAttempt = await claimNextPendingGeneration('late-ai-worker', 5, testCampaignId);
    assert(secondAttempt === null, 'Worker cannot claim recipient currently in processing generation state');

    // 5. Test: Stale Lock Recovery
    console.log('\n[Test 4] Stale Generation Lock Recovery:');
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    await supabaseAdmin
      .from('email_recipients')
      .update({
        tokens: {
          generation_status: 'processing',
          generation_claimed_by: 'abandoned-worker',
          generation_locked_at: tenMinutesAgo,
        },
      })
      .eq('id', testRecipientId);

    const recoveryClaim = await claimNextPendingGeneration('recovery-worker', 5, testCampaignId);
    assert(recoveryClaim !== null, 'Stale generation lock (>5 mins) safely recovered by recovery worker');
    assert(recoveryClaim.generation_worker_id === 'recovery-worker' || recoveryClaim.generationStatus === 'processing', 'Recovery worker recorded as active claim holder');

    // 6. Test: Mark Generation Ready & Verify Unblocked Send Queue
    console.log('\n[Test 5] Mark Generation Ready & Verify Send Queue Unblocking:');
    await markGenerationReady(testRecipientId, 'Tailored Subject for NeuralCorp', '<p>Personalized Body</p>');

    const { data: readyRec } = await supabaseAdmin
      .from('email_recipients')
      .select('*')
      .eq('id', testRecipientId)
      .single();

    const genReady = readyRec.tokens?.generation_status === 'ready' || readyRec.generation_status === 'ready';
    assert(genReady, 'Canonical generation_status updated to "ready"');

    // Now send queue claim SHOULD succeed!
    const validSendClaim = await claimNextPendingRecipient('send-worker-final', 5, testCampaignId);
    assert(validSendClaim !== null, 'Ready recipient successfully claimed by email send worker');
    assert(validSendClaim._id === testRecipientId, 'Claimed send recipient matches target AI recipient');

  } catch (err) {
    console.error('❌ [FATAL TEST ERROR]:', err.message);
    failed++;
  } finally {
    // Cleanup
    if (testRecipientId) await supabaseAdmin.from('email_recipients').delete().eq('id', testRecipientId);
    if (testCampaignId) await supabaseAdmin.from('email_campaigns').delete().eq('id', testCampaignId);
    if (testLeadId) await supabaseAdmin.from('leads').delete().eq('id', testLeadId);
  }

  console.log(`\n======================================================================`);
  console.log(`📊 AI GENERATION QUEUE RESULTS: ${passed} Passed / ${failed} Failed / ${skipped} Skipped`);
  console.log(`======================================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runAiGenerationQueueTests().catch(err => {
  console.error('Fatal runner error:', err);
  process.exit(1);
});
