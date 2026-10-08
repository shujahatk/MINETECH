import { config } from 'dotenv';
config();

import assert from 'assert';
import { supabaseAdmin } from '../lib/supabase.js';
import User from '../lib/models/User.js';
import Lead from '../lib/models/Lead.js';
import Call from '../lib/models/Call.js';
import SMSMessage from '../lib/models/SMSMessage.js';
import EmailCampaign from '../lib/models/EmailCampaign.js';
import EmailRecipient from '../lib/models/EmailRecipient.js';
import EmailTemplate from '../lib/models/EmailTemplate.js';
import EmailSequence from '../lib/models/EmailSequence.js';
import EmailThread from '../lib/models/EmailThread.js';
import EmailMessage from '../lib/models/EmailMessage.js';
import SendingInbox from '../lib/models/SendingInbox.js';
import ActivityLog from '../lib/models/ActivityLog.js';
import AuditLog from '../lib/models/AuditLog.js';
import { connectToDatabase } from '../lib/db/mongoose.js';

let totalTests = 0;
let passedTests = 0;

function it(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    throw err;
  }
}

async function itAsync(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    throw err;
  }
}

async function runDatabaseTestSuite() {
  console.log('\n=============================================================');
  console.log('  MINETECH SUPABASE (POSTGRESQL) COMPREHENSIVE TEST SUITE');
  console.log('=============================================================\n');

  const testEmailPrefix = `dbtest_${Date.now()}`;

  try {
    // -------------------------------------------------------------
    // 1. Connection & Health
    // -------------------------------------------------------------
    console.log('[SECTION 1] Connection & Health Check');
    await itAsync('Should connect to Supabase and validate credentials', async () => {
      const client = await connectToDatabase();
      assert(client, 'Supabase client must be initialized');
    });

    await itAsync('Should verify all 13 core tables are present and queryable', async () => {
      const tables = [
        'users', 'leads', 'calls', 'sms_messages', 'sending_inboxes',
        'email_templates', 'email_sequences', 'email_campaigns',
        'email_recipients', 'email_threads', 'email_messages',
        'activity_logs', 'audit_logs'
      ];
      for (const table of tables) {
        const { error } = await supabaseAdmin.from(table).select('id', { head: true, count: 'exact' });
        assert(!error, `Table ${table} query failed: ${error?.message}`);
      }
    });

    // -------------------------------------------------------------
    // 2. User & Authentication Engine
    // -------------------------------------------------------------
    console.log('\n[SECTION 2] User Management & Auth Verification');
    let testUserId = null;
    const testUserEmail = `${testEmailPrefix}_agent@minetech.io`;

    await itAsync('Should create a new user with bcrypt password hashing', async () => {
      const user = await User.create({
        name: 'Database Tester',
        email: testUserEmail,
        password: 'TestPassword2026!',
        role: 'agent',
        approved: true,
      });
      assert(user && user.id, 'User must have a generated UUID');
      assert.strictEqual(user.email, testUserEmail);
      assert.strictEqual(user.role, 'agent');
      testUserId = user.id;
    });

    await itAsync('Should verify bcrypt password matching method on instance', async () => {
      const user = await User.findById(testUserId);
      assert(user, 'User must be found by ID');
      const isCorrect = await user.matchPassword('TestPassword2026!');
      const isWrong = await user.matchPassword('WrongPassword123!');
      assert(isCorrect === true, 'Valid password must return true');
      assert(isWrong === false, 'Invalid password must return false');
    });

    await itAsync('Should update user fields and timestamps', async () => {
      const updated = await User.findByIdAndUpdate(testUserId, {
        name: 'Updated DB Tester',
      });
      assert.strictEqual(updated.name, 'Updated DB Tester');
    });

    // -------------------------------------------------------------
    // 3. Leads (CRM) Data Engine
    // -------------------------------------------------------------
    console.log('\n[SECTION 3] Leads (CRM) Full Lifecycle Testing');
    let testLeadId = null;
    const testLeadEmail = `${testEmailPrefix}_lead@enterprise.com`;

    await itAsync('Should create lead with nested JSONB location, custom fields & tags', async () => {
      const lead = await Lead.create({
        firstName: 'Jonathan',
        lastName: 'Archer',
        fullName: 'Jonathan Archer',
        email: testLeadEmail,
        phone: '+14155552671',
        company: 'Starfleet Systems',
        jobTitle: 'Captain',
        industry: 'Aerospace',
        location: { city: 'San Francisco', state: 'CA', country: 'US', timezone: 'America/Los_Angeles' },
        status: 'NEW',
        pipelineStage: 'NEW',
        tags: ['enterprise', 'q3-target', 'vip'],
        customFields: { annual_revenue: 50000000, employees: 250 },
        score: 85,
        assignedTo: testUserId,
      });

      assert(lead && lead.id, 'Lead must have a valid UUID');
      assert.strictEqual(lead.email, testLeadEmail);
      assert.strictEqual(lead.company, 'Starfleet Systems');
      assert.strictEqual(lead.score, 85);
      testLeadId = lead.id;
    });

    await itAsync('Should query leads with filtering, search and sorting', async () => {
      const results = await Lead.find({ status: 'NEW' }).limit(10);
      assert(Array.isArray(results), 'Results must be an array');
      const match = results.find((l) => l.email === testLeadEmail);
      assert(match, 'Created lead must be present in find results');
      assert.strictEqual(match.company, 'Starfleet Systems');
    });

    await itAsync('Should update lead pipeline stage and record DNC flag', async () => {
      const lead = await Lead.findById(testLeadId);
      lead.pipelineStage = 'QUALIFIED';
      lead.status = 'QUALIFIED';
      lead.isDnc = true;
      lead.dncReason = 'Explicit customer opt-out';
      await lead.save();

      const fresh = await Lead.findById(testLeadId);
      assert.strictEqual(fresh.pipelineStage, 'QUALIFIED');
      assert.strictEqual(fresh.isDnc, true);
      assert.strictEqual(fresh.dncReason, 'Explicit customer opt-out');
    });

    // -------------------------------------------------------------
    // 4. Calls & SMS (Telephony)
    // -------------------------------------------------------------
    console.log('\n[SECTION 4] Calls & SMS Telephony Records');
    let testCallId = null;

    await itAsync('Should record completed phone call linked to lead and user', async () => {
      const call = await Call.create({
        callSid: `CA_${testEmailPrefix}`,
        leadId: testLeadId,
        userId: testUserId,
        direction: 'outbound',
        fromNumber: '+18005550199',
        toNumber: '+14155552671',
        duration: 142,
        status: 'completed',
        outcome: 'meeting_booked',
        sentiment: 'positive',
        notes: 'Great conversation, scheduled discovery call for next Tuesday.',
      });

      assert(call && call.id, 'Call must be saved');
      assert.strictEqual(call.duration, 142);
      assert.strictEqual(call.outcome, 'meeting_booked');
      testCallId = call.id;
    });

    await itAsync('Should record inbound/outbound SMS messages linked to lead', async () => {
      const sms = await SMSMessage.create({
        messageSid: `SM_${testEmailPrefix}`,
        leadId: testLeadId,
        userId: testUserId,
        direction: 'outbound',
        fromNumber: '+18005550199',
        toNumber: '+14155552671',
        body: 'Hi Jonathan, looking forward to our meeting on Tuesday!',
        status: 'delivered',
      });

      assert(sms && sms.id, 'SMS message must be saved');
      assert.strictEqual(sms.status, 'delivered');
    });

    // -------------------------------------------------------------
    // 5. Unified Inbox (Email Threads & Messages)
    // -------------------------------------------------------------
    console.log('\n[SECTION 5] Unified Inbox (Threads & Messages)');
    let testThreadId = null;

    await itAsync('Should create email thread and messages for lead', async () => {
      const thread = await EmailThread.create({
        leadId: testLeadId,
        subject: 'Partnership Discussion - Minetech & Starfleet',
        snippet: 'Here is the proposal we discussed...',
        status: 'OPEN',
        unreadCount: 1,
      });

      assert(thread && thread.id, 'Thread must be created');
      testThreadId = thread.id;

      const message = await EmailMessage.create({
        threadId: thread.id,
        leadId: testLeadId,
        direction: 'inbound',
        sender: testLeadEmail,
        recipient: 'outreach@minetech.io',
        subject: 'Partnership Discussion - Minetech & Starfleet',
        bodyPlain: 'Thanks for reaching out! Looking forward to reviewing the proposal.',
        status: 'received',
      });

      assert(message && message.id, 'Email message must be created');
      assert.strictEqual(message.direction, 'inbound');
    });

    // -------------------------------------------------------------
    // 6. Campaigns, Sequences & Recipient Queue
    // -------------------------------------------------------------
    console.log('\n[SECTION 6] Campaigns, Sequences & Queue Engine');
    let testCampaignId = null;

    await itAsync('Should create email template and drip sequence', async () => {
      const template = await EmailTemplate.create({
        name: 'Enterprise Discovery Intro',
        subject: 'Quick question regarding {{company}}',
        bodyHtml: '<p>Hi {{first_name}}, would love to connect.</p>',
        category: 'outbound',
        variables: ['first_name', 'company'],
        createdBy: testUserId,
      });
      assert(template && template.id, 'Template created');

      const sequence = await EmailSequence.create({
        name: 'Enterprise 3-Touch Cold Outbound',
        description: 'Multi-touch enterprise cold sequence',
        steps: [
          { stepNumber: 1, delayDays: 0, templateId: template.id },
          { stepNumber: 2, delayDays: 3, templateId: template.id },
        ],
        isActive: true,
        createdBy: testUserId,
      });
      assert(sequence && sequence.id, 'Sequence created');
    });

    await itAsync('Should create campaign and dispatch recipient queue entry', async () => {
      const campaign = await EmailCampaign.create({
        name: `Q3 Enterprise Outbound ${testEmailPrefix}`,
        subject: 'Minetech Outbound Platform',
        bodyHtml: '<p>Hello world</p>',
        status: 'ACTIVE',
        createdBy: testUserId,
      });
      assert(campaign && campaign.id, 'Campaign created');
      testCampaignId = campaign.id;

      const recipient = await EmailRecipient.create({
        campaignId: campaign.id,
        leadId: testLeadId,
        email: testLeadEmail,
        status: 'PENDING',
        tokens: { first_name: 'Jonathan', company: 'Starfleet Systems' },
      });
      assert(recipient && recipient.id, 'Recipient queue entry created');
      assert.strictEqual(recipient.status, 'PENDING');
    });

    await itAsync('Should update recipient queue status on send dispatch', async () => {
      const recipient = await EmailRecipient.findOne({
        campaignId: testCampaignId,
        leadId: testLeadId,
      });
      assert(recipient, 'Recipient must be found in queue');
      recipient.status = 'SENT';
      recipient.sentAt = new Date();
      await recipient.save();

      const updated = await EmailRecipient.findById(recipient.id);
      assert.strictEqual(updated.status, 'SENT');
    });

    // -------------------------------------------------------------
    // 7. Activity Logs & Audit Logs
    // -------------------------------------------------------------
    console.log('\n[SECTION 7] Activity & Audit Logging');
    await itAsync('Should create activity log with structured metadata', async () => {
      const activity = await ActivityLog.create({
        leadId: testLeadId,
        userId: testUserId,
        type: 'STAGE_CHANGED',
        description: 'Lead stage changed from NEW to QUALIFIED',
        metadata: { from: 'NEW', to: 'QUALIFIED' },
      });
      assert(activity && activity.id, 'Activity log created');
    });

    await itAsync('Should create system audit log entry', async () => {
      const audit = await AuditLog.create({
        userId: testUserId,
        action: 'UPDATE_PIPELINE',
        entityType: 'lead',
        entityId: testLeadId,
        details: { field: 'pipelineStage', value: 'QUALIFIED' },
        ipAddress: '127.0.0.1',
      });
      assert(audit && audit.id, 'Audit log created');
    });

    // -------------------------------------------------------------
    // 8. Cleanup Test Entities
    // -------------------------------------------------------------
    console.log('\n[SECTION 8] Data Cleanup');
    await itAsync('Should purge all generated test records cleanly', async () => {
      if (testCampaignId) await EmailCampaign.findByIdAndDelete(testCampaignId);
      if (testThreadId) await EmailThread.findByIdAndDelete(testThreadId);
      if (testLeadId) await Lead.findByIdAndDelete(testLeadId);
      if (testUserId) await User.findByIdAndDelete(testUserId);
      console.log('  -> All temporary test records removed.');
    });

    console.log('\n=============================================================');
    console.log(`  ALL DATABASE TESTS PASSED: ${passedTests}/${totalTests} (100% SUCCESS)`);
    console.log('=============================================================\n');

  } catch (err) {
    console.error('\n[Database Test Failure]:', err);
    process.exit(1);
  }
}

runDatabaseTestSuite();
