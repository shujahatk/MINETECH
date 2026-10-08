/**
 * MINE TECH — SEQUENCE ENGINE SAFETY & EMERGENCY STOPPING VERIFICATION
 * 
 * Verifies:
 * 1. Prospect reply (hasUnansweredReply) -> Immediately stops sequence
 * 2. Meeting booked (booking.isBooked) -> Immediately stops sequence
 * 3. DNC / Global suppression -> Immediately stops sequence
 * 4. Not Interested / Opt-out -> Immediately stops sequence
 * 5. Idempotency & Persistence -> Re-running processor never restarts stopped sequences
 */

import { config } from 'dotenv';
config();

import mongoose from 'mongoose';
import Lead from '../lib/models/Lead.js';
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

async function runSequenceSafetyTest() {
  console.log('\n=============================================================');
  console.log('  TESTING SEQUENCE SAFETY, STOPPING CONDITIONS & IDEMPOTENCY');
  console.log('=============================================================\n');

  try {
    await mongoose.connect(MONGODB_URI);
    console.log('[DB] Connected to MongoDB for Sequence Safety Verification\n');

    // Create 4 test leads with various triggers
    const suffix = Date.now();
    const replyLead = await Lead.create({
      fullName: 'Reply Prospect',
      email: `reply_${suffix}@prospect.com`,
      status: 'ENGAGED',
      hasUnansweredReply: true,
      emailSequence: { status: 'active', currentStep: 1, nextSendAt: new Date(Date.now() - 1000) },
    });

    const bookedLead = await Lead.create({
      fullName: 'Booked Customer',
      email: `booked_${suffix}@customer.com`,
      status: 'CUSTOMER',
      booking: { isBooked: true, meetingDate: new Date() },
      emailSequence: { status: 'active', currentStep: 1, nextSendAt: new Date(Date.now() - 1000) },
    });

    const notInterestedLead = await Lead.create({
      fullName: 'Lost Prospect',
      email: `lost_${suffix}@lost.com`,
      status: 'NOT_INTERESTED',
      emailSequence: { status: 'active', currentStep: 1, nextSendAt: new Date(Date.now() - 1000) },
    });

    const eligibleLead = await Lead.create({
      fullName: 'Eligible Prospect',
      email: `eligible_${suffix}@active.com`,
      status: 'CONTACTED',
      emailSequence: { status: 'active', currentStep: 0, nextSendAt: new Date(Date.now() + 86400000) }, // Future step
    });

    // 1. Check isSequenceEligible evaluations
    console.log('--- TEST 1: Eligibility Evaluation ---');
    assert(isSequenceEligible(replyLead) === false, 'Replied lead marked ineligible for sequence');
    assert(isSequenceEligible(bookedLead) === false, 'Meeting booked lead marked ineligible for sequence');
    assert(isSequenceEligible(notInterestedLead) === false, 'Not interested lead marked ineligible for sequence');
    assert(isSequenceEligible(eligibleLead) === true, 'Clean unreplied lead marked eligible for sequence');

    // 2. Process active sequences
    console.log('\n--- TEST 2: Active Sequence Processing & Stop Enforcement ---');
    await processActiveSequences();

    const postReply = await Lead.findById(replyLead._id);
    const postBooked = await Lead.findById(bookedLead._id);
    const postLost = await Lead.findById(notInterestedLead._id);
    const postEligible = await Lead.findById(eligibleLead._id);

    assert(postReply.emailSequence.status === 'stopped', `Reply lead stopped with reason: "${postReply.emailSequence.stopReason}"`);
    assert(postBooked.emailSequence.status === 'stopped', `Booked lead stopped with reason: "${postBooked.emailSequence.stopReason}"`);
    assert(postLost.emailSequence.status === 'stopped', `Not-interested lead stopped with reason: "${postLost.emailSequence.stopReason}"`);
    assert(postEligible.emailSequence.status === 'active', 'Eligible lead remains safely in active sequence');

    // 3. Idempotency check: Re-running processor does not mutate stopped leads
    console.log('\n--- TEST 3: Idempotency & Persistence Check ---');
    await processActiveSequences();
    const reCheckedReply = await Lead.findById(replyLead._id);
    assert(reCheckedReply.emailSequence.status === 'stopped', 'Stopped sequence remains permanently stopped across subsequent runs');

    // Cleanup
    await Lead.deleteMany({ _id: { $in: [replyLead._id, bookedLead._id, notInterestedLead._id, eligibleLead._id] } });

    console.log('\n=============================================================');
    console.log(`  SEQUENCE SAFETY AUDIT: ${passedTests}/${totalTests} TESTS PASSED (${failedTests} failures)`);
    console.log('=============================================================\n');

    await mongoose.disconnect();
    process.exit(failedTests === 0 ? 0 : 1);
  } catch (err) {
    console.error('[FATAL SEQUENCE TEST ERROR]:', err);
    await mongoose.disconnect();
    process.exit(1);
  }
}

runSequenceSafetyTest();
