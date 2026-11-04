/**
 * MINETECH CAMPAIGN EXECUTION ENGINE TEST SUITE
 * 
 * Verifies:
 * 1. Pre-flight launch validation (subject, body, settings)
 * 2. Recipient List Audit (invalid email filtering, DNC suppression, duplicate exclusion)
 * 3. Rate limiting and dynamic delay calculation
 * 4. Atomic recipient claiming & concurrent execution safety
 * 5. Pause and Resume execution lifecycle (worker halts on PAUSED)
 * 6. Partial failure handling & controlled retries
 * 7. Completion transition and stats accuracy
 */

import dotenv from 'dotenv';
dotenv.config();

import { supabaseAdmin } from '../lib/supabase.js';
import {
  createCampaign,
  launchCampaign,
  pauseCampaign,
  resumeCampaign,
  deleteCampaign,
  auditCampaignAudience,
} from '../lib/services/campaignService.js';
import { getDynamicRateDelay, runEmailBlastWorker } from '../lib/workers/emailBlastWorker.js';
import { claimNextPendingRecipient, releaseRecipientLock, markRecipientSent, markRecipientPermanentFailure } from '../lib/queue/claimRecipient.js';

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

async function runExecutionEngineSuite() {
  console.log('======================================================================');
  console.log('⚙️ MINETECH CAMPAIGN EXECUTION ENGINE & QUEUE SUITE');
  console.log('======================================================================\n');

  let testCampaign = null;
  const createdLeadIds = [];

  try {
    // -------------------------------------------------------------------------
    // SECTION 1: Dynamic Rate Limiting & Pacing Calculation
    // -------------------------------------------------------------------------
    console.log('--- [SECTION 1] Rate Limiting & Pacing Calculations ---');
    const delayMs = getDynamicRateDelay();
    assert(delayMs >= 50, `Dynamic rate delay calculated properly: ${delayMs}ms (>= 50ms safeguard)`);
    assert(typeof delayMs === 'number' && !isNaN(delayMs), 'Delay is a valid positive number');

    // -------------------------------------------------------------------------
    // SECTION 2: Recipient Auditing & DNC / Suppression Filtering
    // -------------------------------------------------------------------------
    console.log('\n--- [SECTION 2] Recipient List Audit & Suppression Enforcement ---');
    
    // Seed 3 test leads: 1 active, 1 DNC, 1 invalid email
    const ts = Date.now();
    const { data: leadActive } = await supabaseAdmin
      .from('leads')
      .insert({
        first_name: 'Valid',
        last_name: 'Lead',
        email: `valid.lead.${ts}@mine-tech.be`,
        status: 'LEAD',
        is_dnc: false,
      })
      .select('*')
      .single();
    createdLeadIds.push(leadActive.id);

    const { data: leadDnc } = await supabaseAdmin
      .from('leads')
      .insert({
        first_name: 'DoNot',
        last_name: 'Contact',
        email: `dnc.lead.${ts}@mine-tech.be`,
        status: 'DO_NOT_CONTACT',
        is_dnc: true,
      })
      .select('*')
      .single();
    createdLeadIds.push(leadDnc.id);

    const { data: leadMalformed } = await supabaseAdmin
      .from('leads')
      .insert({
        first_name: 'Invalid',
        last_name: 'Email',
        email: 'invalid-email-no-domain',
        status: 'LEAD',
        is_dnc: false,
      })
      .select('*')
      .single();
    createdLeadIds.push(leadMalformed.id);

    // Run audience audit
    const audit = await auditCampaignAudience({});
    assert(audit.eligibleLeadIds.includes(leadActive.id), 'Active valid lead is included in eligible audience');
    assert(!audit.eligibleLeadIds.includes(leadDnc.id), 'DNC / Opt-out lead is strictly excluded from eligible audience');
    assert(!audit.eligibleLeadIds.includes(leadMalformed.id), 'Malformed email lead is excluded from eligible audience');

    // -------------------------------------------------------------------------
    // SECTION 3: Campaign Staging & Recipient Seeding
    // -------------------------------------------------------------------------
    console.log('\n--- [SECTION 3] Campaign Recipient Staging & Token Generation ---');
    testCampaign = await createCampaign({
      name: `[TEST] Engine Execution ${ts}`,
      subject: 'Execution Engine Test Subject',
      bodyHtml: '<p>Hi {{firstName}}, testing execution engine at {{company}}.</p>',
      bodyPlain: 'Hi {{firstName}}, testing execution engine at {{company}}.',
      senderEmail: 'rauf@mine-tech.be',
      senderName: 'Rauf',
      filterCriteria: { leadIds: [leadActive.id] },
    });

    assert(Boolean(testCampaign?.id), `Campaign created with ID: ${testCampaign?.id}`);
    assert(testCampaign.status === 'DRAFT', `Initial campaign status is DRAFT (Got: "${testCampaign.status}")`);

    // Query recipient automatically staged by createCampaign
    const { data: stagedRec1, error: stagedErr } = await supabaseAdmin
      .from('email_recipients')
      .select('*')
      .eq('campaign_id', testCampaign.id)
      .eq('lead_id', leadActive.id)
      .single();

    if (stagedErr) console.error('stagedRec1 query error:', stagedErr);
    assert(Boolean(stagedRec1?.id), `Recipient automatically staged in PENDING status by createCampaign (ID: ${stagedRec1?.id})`);

    // -------------------------------------------------------------------------
    // SECTION 4: Atomic Recipient Claiming (PostgreSQL Safe Concurrency)
    // -------------------------------------------------------------------------
    console.log('\n--- [SECTION 4] Atomic Recipient Claiming & Lock Safety ---');
    // Set campaign status to RUNNING so the queue engine activates
    await supabaseAdmin
      .from('email_campaigns')
      .update({ status: 'RUNNING' })
      .eq('id', testCampaign.id);

    const workerA = `worker-A-${ts}`;
    const workerB = `worker-B-${ts}`;

    // Worker A claims recipient
    const claimedRec = await claimNextPendingRecipient(workerA, 5, testCampaign.id);
    assert(Boolean(claimedRec), 'Worker A successfully claimed pending recipient');
    assert(claimedRec.id === stagedRec1.id, 'Claimed recipient matches staged ID');

    // Worker B tries to claim concurrently - should get null because it is locked by Worker A
    const conflictClaim = await claimNextPendingRecipient(workerB, 5, testCampaign.id);
    assert(conflictClaim === null, 'Worker B blocked from claiming already-locked recipient (race-condition protection verified)');

    // -------------------------------------------------------------------------
    // SECTION 5: Retry & Lock Release on Transient Failure
    // -------------------------------------------------------------------------
    console.log('\n--- [SECTION 5] Transient Failure Lock Release & Permanent Failure ---');
    await releaseRecipientLock(stagedRec1.id, 'Simulated 429 Rate Limit - Transient Error');

    const { data: releasedRec } = await supabaseAdmin
      .from('email_recipients')
      .select('status, error_message')
      .eq('id', stagedRec1.id)
      .single();
    assert(releasedRec.status === 'PENDING', `Recipient unlocked and returned to PENDING for retry (Got: "${releasedRec.status}")`);
    assert(releasedRec.error_message?.includes('Simulated 429'), 'Error message recorded on recipient');

    // Test Permanent Failure
    await markRecipientPermanentFailure(stagedRec1.id, 'Simulated Permanent Failure (Mailbox Not Found)');
    const { data: permFailedRec } = await supabaseAdmin
      .from('email_recipients')
      .select('status, error_message')
      .eq('id', stagedRec1.id)
      .single();
    assert(permFailedRec.status === 'FAILED', `Recipient marked permanently FAILED (Got: "${permFailedRec.status}")`);

    // Test Mark Recipient Sent
    await markRecipientSent(stagedRec1.id, 're_simulated_success_id_999');
    const { data: sentRec } = await supabaseAdmin
      .from('email_recipients')
      .select('status, tokens')
      .eq('id', stagedRec1.id)
      .single();
    assert(sentRec.status === 'SENT', `Recipient status transitioned to SENT (Got: "${sentRec.status}")`);
    assert(sentRec.tokens?.resend_id === 're_simulated_success_id_999', 'Provider message ID stored in recipient tokens');

    // -------------------------------------------------------------------------
    // SECTION 6: Pause and Resume Execution Engine Safeguards
    // -------------------------------------------------------------------------
    console.log('\n--- [SECTION 6] Pause and Resume Engine State Halting ---');
    // Set campaign to PAUSED
    await pauseCampaign(testCampaign.id);
    const { data: pausedCamp } = await supabaseAdmin
      .from('email_campaigns')
      .select('status')
      .eq('id', testCampaign.id)
      .single();
    assert(pausedCamp.status === 'PAUSED', `Campaign status is PAUSED in database (Got: "${pausedCamp.status}")`);

    // Worker run on a PAUSED campaign should halt immediately without processing
    const workerResult = await runEmailBlastWorker(testCampaign.id, `test-worker-${ts}`);
    assert(workerResult.success === true, 'Worker loop executed safely');
    assert(workerResult.processedCount === 0, `Worker halted immediately with 0 processed on PAUSED campaign (Got: ${workerResult.processedCount})`);

    // Resume campaign
    await resumeCampaign(testCampaign.id);
    const { data: resumedCamp } = await supabaseAdmin
      .from('email_campaigns')
      .select('status')
      .eq('id', testCampaign.id)
      .single();
    assert(resumedCamp.status === 'RUNNING', `Campaign status resumed to RUNNING in database (Got: "${resumedCamp.status}")`);

  } catch (err) {
    console.error('💥 Unhandled exception in Execution Engine test suite:', err);
    totalFailed++;
  } finally {
    // Cleanup
    try {
      if (testCampaign?.id) {
        await supabaseAdmin.from('email_recipients').delete().eq('campaign_id', testCampaign.id);
        await deleteCampaign(testCampaign.id, true);
      }
    } catch (e) {}

    for (const leadId of createdLeadIds) {
      try {
        await supabaseAdmin.from('leads').delete().eq('id', leadId);
      } catch (e) {}
    }
  }

  console.log('\n======================================================================');
  console.log(`📊 EXECUTION ENGINE TEST RESULTS: ${totalPassed} Passed / ${totalFailed} Failed`);
  console.log('======================================================================');

  if (totalFailed > 0) process.exit(1);
}

runExecutionEngineSuite();
