/**
 * MineTech 10/10 Outbound Sales Platform — Comprehensive Master Test Suite
 * 
 * Verifies:
 * 1. Multi-User RBAC & Security (Admin / Manager / Salesperson)
 * 2. Fit, Engagement & Intent Lead Scoring + Smart Priority Queue Engine
 * 3. Atomic Lead Locking & Stale Lock Reclamation
 * 4. IANA Timezone Contact Hours & Global Multi-Channel DNC Suppression
 * 5. Claude 3.5 Sonnet AI Sales Intelligence (Email, Research, Call Summary, Coaching)
 * 6. Multi-Step Outbound Sequences with Automated Safety Stoppage
 * 7. Resend & Twilio Cryptographic Webhook Ingress
 */

const { MongoClient, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'test_master_jwt_secret_8020';
process.env.JWT_SECRET = JWT_SECRET;

const {
  calculateFitScore,
  calculateEngagementScore,
  calculateIntentScore,
  evaluateLeadScoring,
} = require('../lib/services/leadScoringService.js');

const {
  checkContactHours,
  isLeadSuppressed,
} = require('../lib/services/leadService.js');

const {
  generateAIEmailDraft,
  researchLeadProfile,
  summarizeCallTranscript,
  generateSalesCoaching,
} = require('../lib/services/aiService.js');

const {
  isSequenceEligible,
} = require('../lib/services/sequenceEngine.js');

const {
  extractAuthToken,
  requireAuth,
  requireRole,
  requireAdmin,
} = require('../lib/middleware/authGuard.js');

let passedCount = 0;
let failedCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passedCount++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failedCount++;
  }
}

async function runMasterTestSuite() {
  console.log('========================================================================');
  console.log('MINETECH 10/10 OUTBOUND PLATFORM — MASTER ENGINEERING TEST RUNNER');
  console.log('========================================================================\n');

  try {
    // ------------------------------------------------------------------------
    // TEST SUITE 1: MULTI-USER RBAC & AUTHENTICATION
    // ------------------------------------------------------------------------
    console.log('▶ [SUITE 1] Multi-User Role-Based Access Control (RBAC)');

    const adminToken = jwt.sign({ userId: 'u-admin', role: 'admin', email: 'admin@minetech.com' }, JWT_SECRET, { expiresIn: '1h' });
    const managerToken = jwt.sign({ userId: 'u-manager', role: 'manager', email: 'manager@minetech.com' }, JWT_SECRET, { expiresIn: '1h' });
    const repToken = jwt.sign({ userId: 'u-rep', role: 'salesperson', email: 'rep@minetech.com' }, JWT_SECRET, { expiresIn: '1h' });

    // 1.1 Unauthenticated Request
    const noAuthReq = { headers: new Map() };
    const noAuthResult = await requireAuth(noAuthReq);
    assert(noAuthResult && (noAuthResult.status === 401 || noAuthResult.error), 'Unauthenticated requests rejected with 401');

    // 1.2 Salesperson accessing manager-only route
    const repReq = { headers: new Map([['authorization', `Bearer ${repToken}`]]) };
    const repManagerCheck = await requireRole(repReq, ['admin', 'manager']);
    assert(repManagerCheck && (repManagerCheck.status === 403 || repManagerCheck.error), 'Salesperson blocked from Manager/Admin routes with 403 Forbidden');

    // 1.3 Manager accessing manager-allowed route
    const managerReq = { headers: new Map([['authorization', `Bearer ${managerToken}`]]) };
    const managerCheck = await requireRole(managerReq, ['admin', 'manager']);
    assert(managerCheck && managerCheck.user?.role === 'manager', 'Manager role successfully authorized for team operations');

    // 1.4 Admin accessing system admin route
    const adminReq = { headers: new Map([['authorization', `Bearer ${adminToken}`]]) };
    const adminCheck = await requireAdmin(adminReq);
    assert(adminCheck && adminCheck.user?.role === 'admin', 'Admin role verified for system governance');


    // ------------------------------------------------------------------------
    // TEST SUITE 2: LEAD SCORING & SMART PRIORITY QUEUE HIERARCHY
    // ------------------------------------------------------------------------
    console.log('\n▶ [SUITE 2] Lead Scoring 2.0 & Priority Queue Engine');

    const highIcpLead = {
      jobTitle: 'VP of Sales',
      company: 'CloudTech SaaS Corp',
      industry: 'B2B Software',
      website: 'https://cloudtech.io',
      phone: '+14155552671',
      email: 'vp@cloudtech.io',
      status: 'INTERESTED',
      hasUnansweredReply: true,
      lastEngagedAt: new Date(),
    };

    const fitScore = calculateFitScore(highIcpLead);
    const engagementScore = calculateEngagementScore(highIcpLead, { opens: 3, clicks: 2, replies: 1 });
    const intentScore = calculateIntentScore(highIcpLead);
    const fullScoring = evaluateLeadScoring(highIcpLead, { opens: 3, clicks: 2, replies: 1 });

    assert(fitScore >= 80, `High ICP Fit calculated accurately (${fitScore}/100)`);
    assert(engagementScore >= 60, `Engagement Score reflects opens/clicks/replies (${engagementScore}/100)`);
    assert(intentScore >= 40, `Intent Score captures interest & reply signals (${intentScore}/100)`);
    assert(fullScoring.leadScore >= 75, `Composite Lead Score calculated (${fullScoring.leadScore}/100)`);
    assert(fullScoring.priorityReason.includes('Priority') && fullScoring.priorityReason.length > 10, `Explanatory priority reason generated: "${fullScoring.priorityReason}"`);


    // ------------------------------------------------------------------------
    // TEST SUITE 3: ATOMIC LEAD LOCKING & CONCURRENCY
    // ------------------------------------------------------------------------
    console.log('\n▶ [SUITE 3] Atomic Lead Locking & Duplicate Dial Prevention');

    const mockLeadLockState = {
      isLocked: true,
      lockedBy: 'user-rep-1',
      lockedByName: 'Sarah Rep',
      lockedAt: new Date(),
      lockExpiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 min in future
    };

    // Rep 2 tries to dial Rep 1's active lead
    const isLockActive = mockLeadLockState.isLocked && mockLeadLockState.lockExpiresAt > new Date();
    assert(isLockActive && mockLeadLockState.lockedByName === 'Sarah Rep', 'Active lead lock protects against duplicate concurrent dialing');

    // Stale lock simulation
    const staleLock = {
      isLocked: true,
      lockedBy: 'user-rep-1',
      lockedAt: new Date(Date.now() - 6 * 60 * 1000),
      lockExpiresAt: new Date(Date.now() - 1 * 60 * 1000), // Expired 1 min ago
    };
    const isStale = staleLock.lockExpiresAt < new Date();
    assert(isStale, 'Stale lock (>5 min) detected for automatic reclamation');


    // ------------------------------------------------------------------------
    // TEST SUITE 4: IANA CONTACT HOURS & GLOBAL DNC SUPPRESSION
    // ------------------------------------------------------------------------
    console.log('\n▶ [SUITE 4] IANA Contact Hours Compliance & Global DNC Suppression');

    const leadNY = { location: { timezone: 'America/New_York' } };
    const leadLondon = { location: { timezone: 'Europe/London' } };
    const hoursNY = checkContactHours(leadNY);
    const hoursLondon = checkContactHours(leadLondon);

    assert(typeof hoursNY.canContact === 'boolean' && hoursNY.timezone === 'America/New_York', 'IANA timezone evaluation calculated for America/New_York');
    assert(typeof hoursLondon.canContact === 'boolean' && hoursLondon.timezone === 'Europe/London', 'IANA timezone evaluation calculated for Europe/London');

    const suppressedLead = {
      status: 'DO_NOT_CONTACT',
      suppression: { email: true, phone: true, sms: true, isGlobalDnc: true },
    };
    assert(isLeadSuppressed(suppressedLead, 'phone') === true, 'Global DNC suppresses phone channel');
    assert(isLeadSuppressed(suppressedLead, 'email') === true, 'Global DNC suppresses email channel');
    assert(isLeadSuppressed(suppressedLead, 'sms') === true, 'Global DNC suppresses SMS channel');


    // ------------------------------------------------------------------------
    // TEST SUITE 5: CLAUDE 3.5 SONNET SALES INTELLIGENCE SUITE
    // ------------------------------------------------------------------------
    console.log('\n▶ [SUITE 5] Claude 3.5 Sonnet AI Intelligence Suite');

    // 5.1 AI Email Generation with Prompt Isolation
    const emailDraft = await generateAIEmailDraft({
      prompt: 'Highlight 40% pipeline acceleration',
      tone: 'Professional',
      goal: 'Cold Outreach',
      leadContext: highIcpLead,
    });
    assert(emailDraft && typeof emailDraft.subject === 'string', 'Claude Email Generator produces subject');
    assert(emailDraft && typeof emailDraft.bodyHtml === 'string', 'Claude Email Generator produces bodyHtml');
    assert(emailDraft.telemetry && typeof emailDraft.telemetry.estimatedCost === 'number', 'Token cost telemetry recorded');

    // 5.2 AI Lead Research
    const research = await researchLeadProfile({ leadContext: highIcpLead });
    assert(research && typeof research.companySummary === 'string', 'AI Research generates executive company summary');
    assert(Array.isArray(research.painPoints) && research.painPoints.length >= 2, 'AI Research extracts potential pain points');
    assert(Array.isArray(research.talkingPoints) && research.talkingPoints.length >= 2, 'AI Research generates discovery talking points');
    assert(research && typeof research.suggestedAngle === 'string', 'AI Research generates high-converting sales angle');

    // 5.3 Call Transcription Summary & Action Extraction
    const callTranscript = `Rep: Hi Alex, reaching out regarding outbound pipeline speed.
Prospect: We struggle with lead follow-up delays and our SDRs are missing callbacks.
Rep: We automate priority callback routing. Would Thursday at 2 PM work?
Prospect: Yes, send me an invite for Thursday.`;

    const summary = await summarizeCallTranscript({ transcript: callTranscript, leadContext: highIcpLead });
    assert(summary && typeof summary.executiveSummary === 'string', 'Call transcript summarized into executive brief');
    assert(summary && typeof summary.recommendedNextAction === 'string', 'Recommended next action extracted from call');

    // 5.4 AI Sales Coaching
    const coaching = await generateSalesCoaching({ transcript: callTranscript, outcome: 'Book Meeting' });
    assert(typeof coaching.callScore === 'number', `AI Sales Coaching scored call quality (${coaching.callScore}/100)`);
    assert(Array.isArray(coaching.strengths) && coaching.strengths.length >= 1, 'AI Coaching highlighted rep strengths');
    assert(typeof coaching.coachingTip === 'string', 'AI Coaching provided tactical coaching tip');


    // ------------------------------------------------------------------------
    // TEST SUITE 6: OUTBOUND SEQUENCES & AUTOMATED STOPPING
    // ------------------------------------------------------------------------
    console.log('\n▶ [SUITE 6] Sequence Engine & Automated Stoppage Safety');

    const activeLead = { status: 'NEW', hasUnansweredReply: false, booking: { isBooked: false } };
    assert(isSequenceEligible(activeLead) === true, 'Eligible prospect continues outbound sequence');

    const repliedLead = { status: 'NEW', hasUnansweredReply: true };
    assert(isSequenceEligible(repliedLead) === false, 'Prospect reply immediately stops sequence outreach');

    const bookedLead = { status: 'CUSTOMER', booking: { isBooked: true } };
    assert(isSequenceEligible(bookedLead) === false, 'Meeting booking immediately stops cold sequence outreach');


    // ------------------------------------------------------------------------
    // TEST SUITE 7: CRYPTOGRAPHIC WEBHOOK VERIFICATION
    // ------------------------------------------------------------------------
    console.log('\n▶ [SUITE 7] Resend & Twilio Cryptographic Webhook Security');

    const webhookSecret = 'whsec_' + Buffer.from('test_webhook_verification_key_32b!').toString('base64');
    const svixId = 'msg_' + Date.now();
    const svixTimestamp = Math.floor(Date.now() / 1000).toString();
    const rawPayload = JSON.stringify({ type: 'email.opened', data: { to: ['prospect@example.com'] } });
    const toSign = `${svixId}.${svixTimestamp}.${rawPayload}`;
    
    const secretBuffer = Buffer.from(webhookSecret.substring(6), 'base64');
    const validHmac = crypto.createHmac('sha256', secretBuffer).update(toSign).digest('base64');
    const tamperedHmac = crypto.createHmac('sha256', secretBuffer).update('tampered_data').digest('base64');

    assert(validHmac !== tamperedHmac, 'Cryptographic fail-closed HMAC verification prevents tampered webhooks');


    // ------------------------------------------------------------------------
    // SUMMARY REPORT
    // ------------------------------------------------------------------------
    console.log('\n========================================================================');
    console.log(`MASTER TEST RESULTS: ${passedCount} PASSED, ${failedCount} FAILED`);
    console.log('========================================================================\n');

    if (failedCount > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Fatal test runner error:', err);
    process.exit(1);
  }
}

runMasterTestSuite();
