/**
 * MINETECH — SUPABASE POSTGRESQL ATOMIC RECIPIENT CLAIMING & CONCURRENCY TEST
 */

import dotenv from 'dotenv';
dotenv.config();

import { supabaseAdmin } from '../lib/supabase.js';
import {
  claimNextPendingRecipient,
  releaseRecipientLock,
  markRecipientSent,
  markRecipientPermanentFailure,
} from '../lib/queue/claimRecipient.js';
import crypto from 'crypto';

async function runConcurrencyTests() {
  console.log('======================================================================');
  console.log('⚡ TESTING SUPABASE ATOMIC RECIPIENT CLAIMING & CONCURRENCY SAFETY');
  console.log('======================================================================\n');

  let passed = 0;
  let failed = 0;

  const assert = (condition, name) => {
    if (condition) {
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${name}`);
      failed++;
    }
  };

  const testId = `conc_${Date.now()}_${crypto.randomUUID().slice(0, 6)}`;
  const nowIso = new Date().toISOString();

  // Setup: Create Lead & Running Campaign
  const { data: lead, error: leadErr } = await supabaseAdmin
    .from('leads')
    .insert({
      email: `${testId}@example.com`,
      first_name: 'RaceCondition',
      last_name: 'Lead',
      status: 'NEW',
    })
    .select()
    .single();

  if (leadErr || !lead) {
    console.error('Lead setup error:', leadErr);
    process.exit(1);
  }

  const { data: campaign, error: campErr } = await supabaseAdmin
    .from('email_campaigns')
    .insert({
      name: `Concurrency Campaign ${testId}`,
      subject: 'Concurrency Test',
      body_html: '<p>Testing concurrency</p>',
      status: 'RUNNING',
    })
    .select()
    .single();

  if (campErr || !campaign) {
    console.error('Campaign setup error:', campErr);
    process.exit(1);
  }

  try {
    // -------------------------------------------------------------
    // TEST 1: Single Recipient High-Concurrency Claim (10 Workers)
    // -------------------------------------------------------------
    const { data: recipient1, error: rec1Err } = await supabaseAdmin
      .from('email_recipients')
      .insert({
        campaign_id: campaign.id,
        lead_id: lead.id,
        email: lead.email,
        status: 'PENDING',
        scheduled_at: nowIso,
        tokens: { generation_status: 'ready' },
      })
      .select()
      .single();

    if (rec1Err || !recipient1) {
      console.error('Recipient 1 setup error:', rec1Err);
      process.exit(1);
    }

    console.log('[Action] Firing 10 simultaneous workers to claim recipient 1...');
    const NUM_WORKERS = 10;
    const workers = Array.from({ length: NUM_WORKERS }, (_, i) => `worker-single-${i + 1}`);

    const claimPromises = workers.map((wId) => claimNextPendingRecipient(wId, 5, campaign.id));
    const claimResults = await Promise.all(claimPromises);

    const successfulClaims = claimResults.filter((r) => r !== null && r !== undefined);
    const nullClaims = claimResults.filter((r) => r === null);

    assert(successfulClaims.length === 1, `Exactly 1 worker acquired the recipient lock (Got: ${successfulClaims.length})`);
    assert(nullClaims.length === NUM_WORKERS - 1, `All other ${NUM_WORKERS - 1} workers safely returned null (Got: ${nullClaims.length})`);

    const winningWorkerId = successfulClaims[0]?.claimed_by;
    const { data: dbRecipient1 } = await supabaseAdmin
      .from('email_recipients')
      .select('*')
      .eq('id', recipient1.id)
      .single();

    assert(dbRecipient1.status === 'PROCESSING', 'Recipient state in database is PROCESSING');
    assert(dbRecipient1.claimed_by === winningWorkerId, `Database claimed_by strictly matches winner (${winningWorkerId})`);

    // -------------------------------------------------------------
    // TEST 2: Stale Lock Recovery
    // -------------------------------------------------------------
    console.log('\n[Action] Simulating worker crash / stale lock expiration (10 minutes ago)...');
    const staleTime = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { error: staleUpdateErr } = await supabaseAdmin
      .from('email_recipients')
      .update({
        status: 'PROCESSING',
        locked_at: staleTime,
      })
      .eq('id', recipient1.id);

    if (staleUpdateErr) {
      console.error('Failed to set stale lock:', staleUpdateErr);
    }

    const recoveryWorkerId = 'worker-recovery-hero';
    const recoveredRecipient = await claimNextPendingRecipient(recoveryWorkerId, 5, campaign.id);

    assert(recoveredRecipient !== null, 'Stale locked recipient successfully recovered by new worker');
    assert(recoveredRecipient?.claimed_by === recoveryWorkerId, 'Recovered recipient claimed_by updated to recovery worker');

    // Mark sent
    await markRecipientSent(recipient1.id, 'resend_msg_test_001');
    const { data: sentRec } = await supabaseAdmin
      .from('email_recipients')
      .select('*')
      .eq('id', recipient1.id)
      .single();
    const hasResendId = sentRec.resend_id === 'resend_msg_test_001' || sentRec.tokens?.resend_id === 'resend_msg_test_001';
    assert(sentRec.status === 'SENT' && hasResendId, 'markRecipientSent stores SENT status and provider message ID');

    // -------------------------------------------------------------
    // TEST 3: Multi-Recipient Batch Concurrency (5 Recipients, 10 Workers)
    // -------------------------------------------------------------
    console.log('\n[Action] Staging 5 pending recipients and firing 10 concurrent workers...');
    const multiLeads = [];
    for (let i = 1; i <= 5; i++) {
      const { data: ml } = await supabaseAdmin
        .from('leads')
        .insert({
          email: `batch_${i}_${testId}@example.com`,
          first_name: `BatchLead${i}`,
          status: 'NEW',
        })
        .select()
        .single();
      multiLeads.push(ml);
    }

    const multiRecipients = [];
    for (const ml of multiLeads) {
      const { data: mr } = await supabaseAdmin
        .from('email_recipients')
        .insert({
          campaign_id: campaign.id,
          lead_id: ml.id,
          email: ml.email,
          status: 'PENDING',
          scheduled_at: nowIso,
          tokens: { generation_status: 'ready' },
        })
        .select()
        .single();
      multiRecipients.push(mr);
    }

    const batchWorkers = Array.from({ length: 10 }, (_, i) => `worker-batch-${i + 1}`);
    const batchClaimPromises = batchWorkers.map((wId) => claimNextPendingRecipient(wId, 5, campaign.id));
    const batchResults = await Promise.all(batchClaimPromises);

    const successfulBatchClaims = batchResults.filter((r) => r !== null && r !== undefined);
    const claimedRecipientIds = successfulBatchClaims.map((r) => r.id);
    const uniqueClaimedIds = new Set(claimedRecipientIds);

    assert(successfulBatchClaims.length === 5, `Exactly 5 recipients claimed across 10 workers (Got: ${successfulBatchClaims.length})`);
    assert(uniqueClaimedIds.size === 5, `Every claimed recipient is unique (Zero duplicate claims: ${uniqueClaimedIds.size}/5)`);

  } finally {
    // Clean up
    await supabaseAdmin.from('email_campaigns').delete().eq('id', campaign.id);
    await supabaseAdmin.from('leads').delete().ilike('email', `%${testId}%`);
  }

  console.log('\n======================================================================');
  console.log(`📊 CONCURRENCY RESULTS: ${passed} Passed / ${failed} Failed`);
  console.log('======================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runConcurrencyTests().catch((err) => {
  console.error('Concurrency test error:', err);
  process.exit(1);
});
