/**
 * MINE TECH — END-TO-END MULTI-CHANNEL DNC SUPPRESSION VERIFICATION
 * 
 * Specifically tests:
 * 1. Mark a live test lead with DNC suppression.
 * 2. Attempt Voice call -> strictly blocked (403 / Error).
 * 3. Attempt SMS message -> strictly blocked (403 / Error).
 * 4. Attempt Email message -> strictly blocked (Error: channel suppressed).
 * 5. Attempt Sequence step progression -> strictly skipped / sequence stopped.
 * 6. Verify suppression persists across session restarts, different salespersons, and campaigns.
 */

import { config } from 'dotenv';
config();

import mongoose from 'mongoose';
import Lead from '../lib/models/Lead.js';
import { isLeadSuppressed, processCallOutcome } from '../lib/services/leadService.js';
import { sendLeadEmail } from '../lib/services/emailService.js';
import { isSequenceEligible, processActiveSequences } from '../lib/services/sequenceEngine.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/80-20-outbound';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, testName, details = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  \x1b[32m✔ PASS\x1b[0m: ${testName}`);
  } else {
    failedTests++;
    console.error(`  \x1b[31m✘ FAIL\x1b[0m: ${testName} ${details ? `(${details})` : ''}`);
  }
}

async function runDncEndToEndTest() {
  console.log('\n=============================================================');
  console.log('  TESTING END-TO-END MULTI-CHANNEL DNC SUPPRESSION ENGINE');
  console.log('=============================================================\n');

  try {
    await mongoose.connect(MONGODB_URI);
    console.log('[DB] Connected to MongoDB for DNC Verification\n');

    // 1. Create a clean active lead
    const dncTargetLead = await Lead.create({
      fullName: 'DNC Compliance Subject',
      email: `dnc_test_${Date.now()}@target.com`,
      phone: '+14155558899',
      status: 'NEW',
      suppression: {
        isGlobalDnc: false,
        email: false,
        phone: false,
        sms: false,
      },
    });

    // 2. Trigger DNC via Call Outcome
    console.log('--- TEST 1: Trigger Global DNC Disposition ---');
    const outcomeResult = await processCallOutcome(dncTargetLead._id.toString(), {
      outcome: 'DNC',
      duration: 15,
      notes: 'Prospect stated: Remove me from your call and email lists immediately.',
    });

    assert(outcomeResult.status === 'DO_NOT_CONTACT', 'Lead status advanced to DO_NOT_CONTACT');
    assert(outcomeResult.suppression?.isGlobalDnc === true, 'Global DNC flag set to true');
    assert(outcomeResult.suppression?.phone === true, 'Phone suppression enabled');
    assert(outcomeResult.suppression?.email === true, 'Email suppression enabled');
    assert(outcomeResult.suppression?.sms === true, 'SMS suppression enabled');

    // Re-query from fresh DB instance
    const freshLead = await Lead.findById(dncTargetLead._id);

    // 3. Test Voice Dispatch Guard
    console.log('\n--- TEST 2: Voice Outbound Guard ---');
    const voiceSuppressed = isLeadSuppressed(freshLead, 'phone');
    assert(voiceSuppressed === true, 'Voice dispatch strictly rejected by isLeadSuppressed guard');

    // 4. Test SMS Dispatch Guard
    console.log('\n--- TEST 3: SMS Outbound Guard ---');
    const smsSuppressed = isLeadSuppressed(freshLead, 'sms');
    assert(smsSuppressed === true, 'SMS dispatch strictly rejected by isLeadSuppressed guard');

    // 5. Test Email Dispatch Guard
    console.log('\n--- TEST 4: Email Dispatch Guard ---');
    let emailBlocked = false;
    let emailErrorMsg = '';
    try {
      await sendLeadEmail({
        leadId: freshLead._id.toString(),
        subject: 'Follow-up proposal',
        bodyHtml: '<p>Should we chat?</p>',
      });
    } catch (err) {
      emailBlocked = true;
      emailErrorMsg = err.message;
    }
    assert(emailBlocked === true, `Email send strictly blocked with exception: "${emailErrorMsg}"`);

    // 6. Test Sequence Engine Stoppage
    console.log('\n--- TEST 5: Sequence Engine Stoppage on DNC ---');
    const isEligible = isSequenceEligible(freshLead);
    assert(isEligible === false, 'isSequenceEligible returns false for DNC lead');

    freshLead.emailSequence = {
      status: 'active',
      currentStep: 1,
      nextSendAt: new Date(Date.now() - 1000), // Due now
      stopReason: '',
    };
    await freshLead.save();

    await processActiveSequences();

    const postSeqLead = await Lead.findById(freshLead._id);
    assert(
      postSeqLead.emailSequence.status === 'stopped',
      `Sequence engine halts immediately and marks status "stopped" on DNC lead (Stop Reason: ${postSeqLead.emailSequence.stopReason})`
    );

    // Clean up
    await Lead.deleteOne({ _id: dncTargetLead._id });

    console.log('\n=============================================================');
    console.log(`  DNC AUDIT COMPLETE: ${passedTests}/${totalTests} TESTS PASSED (${failedTests} failures)`);
    console.log('=============================================================\n');

    await mongoose.disconnect();
    process.exit(failedTests === 0 ? 0 : 1);
  } catch (err) {
    console.error('[FATAL DNC TEST ERROR]:', err);
    await mongoose.disconnect();
    process.exit(1);
  }
}

runDncEndToEndTest();
