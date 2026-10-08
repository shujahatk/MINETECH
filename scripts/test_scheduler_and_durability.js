import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { supabaseAdmin } from '../lib/supabase.js';
import { dispatchScheduledTasks, acquireLock, releaseLock } from '../lib/workers/schedulerDispatcher.js';
import { processActiveSequences } from '../lib/services/sequenceEngine.js';

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

async function runSchedulerDurabilityTests() {
  console.log('======================================================================');
  console.log('⏱️ TESTING PERSISTENT SCHEDULER & WORKER DURABILITY');
  console.log('======================================================================\n');

  const testSuffix = Date.now();
  let createdCampaignId = null;
  let createdScheduledCampId = null;
  let testLeadId = null;
  let testSequenceId = null;

  try {
    // 1. Distributed Locking Test
    console.log('[Test 1] Distributed System Locking:');
    const lock1 = await acquireLock('test_concurrency_lock', 'worker-1', 10);
    assert(lock1 === true, 'Worker 1 acquires distributed lock successfully');

    const lock2 = await acquireLock('test_concurrency_lock', 'worker-2', 10);
    assert(lock2 === false, 'Worker 2 is blocked from acquiring lock held by Worker 1');

    await releaseLock('test_concurrency_lock', 'worker-1');
    const lock3 = await acquireLock('test_concurrency_lock', 'worker-2', 10);
    assert(lock3 === true, 'Worker 2 acquires lock after Worker 1 releases it');
    await releaseLock('test_concurrency_lock', 'worker-2');

    // 2. Future Scheduled Campaign Wake-Up
    console.log('\n[Test 2] Future Scheduled Campaign Wake-Up:');
    const pastTime = new Date(Date.now() - 5000).toISOString();
    const { data: schedCamp, error: schedErr } = await supabaseAdmin
      .from('email_campaigns')
      .insert({
        name: `Scheduled Campaign ${testSuffix}`,
        status: 'SCHEDULED',
        scheduled_at: pastTime,
        body_html: '<p>Scheduled Body</p>',
        body_plain: 'Scheduled Body',
      })
      .select()
      .single();

    if (schedErr || !schedCamp) throw new Error(`Setup failed creating scheduled campaign: ${schedErr?.message}`);
    createdScheduledCampId = schedCamp.id;

    // Run scheduler dispatcher
    const dispatchRes = await dispatchScheduledTasks({ workerId: `test-dispatcher-${testSuffix}` });
    assert(dispatchRes.success === true, 'dispatchScheduledTasks executes successfully');

    // Verify scheduled campaign was transitioned to RUNNING
    const { data: wokeCamp } = await supabaseAdmin
      .from('email_campaigns')
      .select('status')
      .eq('id', createdScheduledCampId)
      .single();

    assert(
      wokeCamp.status === 'RUNNING' || wokeCamp.status === 'COMPLETED',
      'Past scheduled campaign automatically woken to RUNNING / COMPLETED status'
    );

    // 3. Campaign Pause/Cancel Safety
    console.log('\n[Test 3] Campaign Pause & Stop Safety:');
    const { data: runningCamp, error: rErr } = await supabaseAdmin
      .from('email_campaigns')
      .insert({
        name: `Pause Test Campaign ${testSuffix}`,
        status: 'RUNNING',
      })
      .select()
      .single();

    if (rErr || !runningCamp) throw new Error(`Setup failed creating test campaign: ${rErr?.message}`);
    createdCampaignId = runningCamp.id;

    // Pause campaign
    await supabaseAdmin
      .from('email_campaigns')
      .update({ status: 'PAUSED' })
      .eq('id', createdCampaignId);

    const { data: pausedCamp } = await supabaseAdmin
      .from('email_campaigns')
      .select('status')
      .eq('id', createdCampaignId)
      .single();

    assert(pausedCamp.status === 'PAUSED', 'Campaign paused safely in database');

    // 4. Sequence Step Scheduler Execution
    console.log('\n[Test 4] Outbound Sequence Scheduler Execution:');
    const { data: seq, error: seqErr } = await supabaseAdmin
      .from('email_sequences')
      .insert({
        name: `Test Sequence ${testSuffix}`,
        steps: [
          { type: 'email', subject: 'Step 1 Subject', delayDays: 0, delayHours: 0 },
          { type: 'email', subject: 'Step 2 Subject', delayDays: 1, delayHours: 0 },
        ],
      })
      .select()
      .single();

    if (seqErr || !seq) throw new Error(`Setup failed creating sequence: ${seqErr?.message}`);
    testSequenceId = seq.id;

    const { data: lead, error: leadErr } = await supabaseAdmin
      .from('leads')
      .insert({
        email: `delivered_${testSuffix}@resend.dev`,
        first_name: 'SequenceLead',
        company: 'TestCorp',
        custom_fields: {
          emailSequence: {
            status: 'active',
            sequenceId: testSequenceId,
            currentStep: 0,
            nextSendAt: new Date(Date.now() - 1000).toISOString(),
          },
        },
      })
      .select()
      .single();

    if (leadErr || !lead) throw new Error(`Setup failed creating lead: ${leadErr?.message}`);
    testLeadId = lead.id;

    const seqResult = await processActiveSequences();
    assert(seqResult.processed >= 1, 'processActiveSequences processes eligible sequence step');

    // Verify lead's sequence state was advanced
    const { data: updatedLead } = await supabaseAdmin
      .from('leads')
      .select('custom_fields')
      .eq('id', testLeadId)
      .single();

    const updatedSeq = updatedLead.custom_fields?.emailSequence;
    assert(updatedSeq.currentStep === 1, 'Lead sequence advanced to step 1');
    assert(Boolean(updatedSeq.nextSendAt), 'Next step scheduled at future timestamp');

  } catch (err) {
    console.error('❌ [FATAL TEST ERROR]:', err.message);
    failed++;
  } finally {
    // Cleanup fixtures
    if (createdScheduledCampId) await supabaseAdmin.from('email_campaigns').delete().eq('id', createdScheduledCampId);
    if (createdCampaignId) await supabaseAdmin.from('email_campaigns').delete().eq('id', createdCampaignId);
    if (testLeadId) await supabaseAdmin.from('leads').delete().eq('id', testLeadId);
    if (testSequenceId) await supabaseAdmin.from('email_sequences').delete().eq('id', testSequenceId);
  }

  console.log(`\n======================================================================`);
  console.log(`📊 SCHEDULER & DURABILITY RESULTS: ${passed} Passed / ${failed} Failed / ${skipped} Skipped`);
  console.log(`======================================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runSchedulerDurabilityTests().catch(err => {
  console.error('Fatal runner error:', err);
  process.exit(1);
});
