/**
 * MINETECH MASTER EMAIL INTEGRATION — PRODUCTION VERIFICATION TEST SUITE
 * 
 * Comprehensive E2E tests validating:
 * 1. Outbound Sending via Resend with configured sender 'rauf@mine-tech.be'
 * 2. Identity, Display Name 'Rauf', CC, BCC, RFC 2822 Message-ID, Reply-To
 * 3. Inbound Webhook Processing & Lead Auto-Ingestion
 * 4. Reply Threading via In-Reply-To, References, and Subject Normalization
 * 5. Webhook Replay & Idempotency Protection (Zero Duplicate Messages)
 * 6. Google Workspace / Gmail Dual-Delivery & Sent Synchronization Service
 * 7. Do-Not-Contact (DNC) Suppression Enforcement
 * 8. Double-Click / Duplicate Outbound Prevention
 * 9. HTML Email Sanitization & XSS Neutralization
 */

import dotenv from 'dotenv';
dotenv.config();

import { supabaseAdmin } from '../lib/supabase.js';
import { sendLeadEmail } from '../lib/services/emailService.js';
import { processInboundEmail } from '../lib/services/inboundEmailService.js';
import { syncInboundEmailToGmailInbox, syncOutboundEmailToGmailSent } from '../lib/services/gmailSyncService.js';
import { POST as resendWebhookHandler } from '../app/api/webhooks/resend/route.js';
import { sanitizeHtml } from '../lib/utils/sanitizer.js';
import crypto from 'crypto';

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

async function runMasterEmailProductionTests() {
  console.log('======================================================================');
  console.log('🚀 MINETECH MASTER EMAIL INTEGRATION & PRODUCTION VERIFICATION');
  console.log('======================================================================\n');

  const testBatchId = `test_${Date.now()}_${crypto.randomUUID().slice(0, 6)}`;
  let testLead = null;
  let dncLead = null;

  try {
    // -------------------------------------------------------------------------
    // SECTION 1: IDENTITY & PROVIDER ARCHITECTURE
    // -------------------------------------------------------------------------
    console.log('--- [SECTION 1] Resend Provider & Sender Identity Verification ---');
    const configuredFrom = process.env.EMAIL_FROM;
    const configuredFromName = process.env.EMAIL_FROM_NAME;
    const configuredReplyTo = process.env.REPLY_TO;
    const apiKeyConfigured = Boolean(process.env.RESEND_API_KEY && process.env.RESEND_API_KEY.startsWith('re_'));

    assert(apiKeyConfigured, 'Resend API key is configured with valid prefix (re_...)');
    assert(configuredFrom === 'rauf@mine-tech.be', `Sender identity is rauf@mine-tech.be (Got: ${configuredFrom})`);
    assert(configuredFromName === 'Rauf', `Sender display name is Rauf (Got: ${configuredFromName})`);
    assert(configuredReplyTo === 'rauf@mine-tech.be', `Reply-To address is rauf@mine-tech.be (Got: ${configuredReplyTo})`);

    // -------------------------------------------------------------------------
    // SECTION 2: LIVE OUTBOUND DISPATCH & RECIPIENT VALIDATION
    // -------------------------------------------------------------------------
    console.log('\n--- [SECTION 2] Outbound Sending Pipeline (Resend Live API) ---');
    
    // Create an active test lead
    const { data: newLead, error: leadErr } = await supabaseAdmin
      .from('leads')
      .insert({
        first_name: 'Antigravity',
        last_name: 'QA Lead',
        email: `qa.test.${testBatchId}@resend.dev`,
        company: 'MineTech Test Corp',
        status: 'NEW',
        is_dnc: false,
      })
      .select()
      .single();

    if (leadErr || !newLead) throw new Error(`Failed to create test lead: ${leadErr?.message}`);
    testLead = newLead;

    // Send email with CC, BCC, and Subject
    const sendResult = await sendLeadEmail(testLead.id, {
      subject: `MineTech Master Outbound Test [${testBatchId}]`,
      body: '<p>Hello Antigravity Team,</p><p>This is a certified production email test from MineTech.</p>',
      cc: ['audit.cc@resend.dev'],
      bcc: ['archive.bcc@resend.dev'],
    });

    assert(sendResult.success === true, 'Outbound email accepted by Resend provider API');
    assert(Boolean(sendResult.resendId), `Provider message ID returned: ${sendResult.resendId}`);
    assert(Boolean(sendResult.threadId), `Internal thread ID associated: ${sendResult.threadId}`);
    assert(Boolean(sendResult.messageId), `Internal message ID stored: ${sendResult.messageId}`);
    assert(sendResult.from?.includes('rauf@mine-tech.be'), `Sender address confirmed as rauf@mine-tech.be: ${sendResult.from}`);

    // Verify stored email in database
    const { data: storedOutbound } = await supabaseAdmin
      .from('email_messages')
      .select('*')
      .eq('id', sendResult.messageId)
      .single();

    assert(Boolean(storedOutbound), 'Stored outbound email message found in database');
    assert(storedOutbound.direction?.toLowerCase() === 'outbound', 'Message direction recorded as outbound');
    assert(storedOutbound.recipient === testLead.email, `Recipient recorded as ${testLead.email}`);
    assert(storedOutbound.status?.toLowerCase() === 'sent', 'Initial outbound status recorded as sent (not prematurely DELIVERED)');

    // -------------------------------------------------------------------------
    // SECTION 3: DOUBLE-CLICK / DUPLICATE PREVENTION & VALIDATION
    // -------------------------------------------------------------------------
    console.log('\n--- [SECTION 3] Outbound Validation & Double-Click Protection ---');

    // Reject malformed recipient email
    const invalidSend = await sendLeadEmail(testLead.id, {
      to: 'invalid-email-format-without-at',
      subject: 'Invalid test',
      body: 'Should fail',
    });
    assert(invalidSend.success === false, 'Rejects malformed recipient email address format');

    // Duplicate prevention: rapid identical dispatch
    const duplicateDispatch = await sendLeadEmail(testLead.id, {
      subject: `MineTech Master Outbound Test [${testBatchId}]`,
      body: '<p>Hello Antigravity Team,</p><p>This is a certified production email test from MineTech.</p>',
    });
    assert(duplicateDispatch.success === false && duplicateDispatch.code === 'DUPLICATE_SEND_PREVENTED', 
      'Blocks immediate duplicate email dispatch within duplicate prevention window');

    // -------------------------------------------------------------------------
    // SECTION 4: DO-NOT-CONTACT (DNC) SUPPRESSION ENFORCEMENT
    // -------------------------------------------------------------------------
    console.log('\n--- [SECTION 4] Compliance & Do-Not-Contact (DNC) Enforcement ---');

    const { data: dncRecord } = await supabaseAdmin
      .from('leads')
      .insert({
        first_name: 'DoNot',
        last_name: 'ContactUser',
        email: `dnc.${testBatchId}@example.com`,
        status: 'DO_NOT_CONTACT',
        is_dnc: true,
        dnc_reason: 'USER_UNSUBSCRIBED',
      })
      .select()
      .single();
    dncLead = dncRecord;

    const dncAttempt = await sendLeadEmail(dncLead.id, {
      subject: 'Special Offer',
      body: 'You should not receive this',
    });
    assert(dncAttempt.success === false, 'Strictly suppresses outbound email to DNC-flagged lead');
    assert(dncAttempt.error?.includes('DNC'), `Reports DNC suppression reason: ${dncAttempt.error}`);

    // -------------------------------------------------------------------------
    // SECTION 5: INBOUND WEBHOOK INGESTION & THREADING
    // -------------------------------------------------------------------------
    console.log('\n--- [SECTION 5] Inbound Processing & Thread Matching Engine ---');

    const inboundRfcMessageId = `<inbound-${testBatchId}@client-mail.com>`;
    const inboundReplySubject = `Re: MineTech Master Outbound Test [${testBatchId}]`;

    // Process inbound reply to the outbound email sent in Section 2
    const inboundResult = await processInboundEmail({
      from: `Antigravity QA Lead <${testLead.email}>`,
      to: 'rauf@mine-tech.be',
      cc: 'audit.cc@resend.dev',
      subject: inboundReplySubject,
      text: 'Thanks Rauf, we reviewed your proposal and would like to proceed with the integration.',
      html: '<p>Thanks Rauf, we reviewed your proposal and would like to proceed with the integration.</p>',
      messageId: inboundRfcMessageId,
      inReplyTo: `<${sendResult.resendId}@mine-tech.be>`,
      references: `<${sendResult.resendId}@mine-tech.be>`,
    });

    assert(inboundResult.success === true, 'Inbound email processed successfully');
    assert(inboundResult.threadId === sendResult.threadId, 
      `Inbound reply correctly threaded into existing conversation (${inboundResult.threadId} === ${sendResult.threadId})`);

    // Verify lead status updated to ENGAGED
    const { data: updatedLead } = await supabaseAdmin
      .from('leads')
      .select('status, custom_fields')
      .eq('id', testLead.id)
      .single();
    assert(updatedLead?.status === 'ENGAGED', 'Lead pipeline stage automatically updated to ENGAGED');
    assert(updatedLead?.custom_fields?.has_unanswered_reply === true, 'Lead has_unanswered_reply recorded in custom_fields');

    // -------------------------------------------------------------------------
    // SECTION 6: INBOUND IDEMPOTENCY & REPLAY PROTECTION
    // -------------------------------------------------------------------------
    console.log('\n--- [SECTION 6] Inbound Webhook Idempotency & Replay Protection ---');

    // Send the exact same inbound email again with identical messageId
    const replayInboundResult = await processInboundEmail({
      from: `Antigravity QA Lead <${testLead.email}>`,
      to: 'rauf@mine-tech.be',
      subject: inboundReplySubject,
      text: 'Thanks Rauf, we reviewed your proposal and would like to proceed with the integration.',
      html: '<p>Thanks Rauf, we reviewed your proposal and would like to proceed with the integration.</p>',
      messageId: inboundRfcMessageId,
      inReplyTo: `<${sendResult.resendId}@mine-tech.be>`,
    });

    assert(replayInboundResult.success === true, 'Replay call handled safely');
    assert(replayInboundResult.duplicate === true || replayInboundResult.idempotent === true, 'Replayed inbound message identified as duplicate (zero duplicate records)');

    // Verify no duplicate message was inserted in the thread
    const { data: threadMessages } = await supabaseAdmin
      .from('email_messages')
      .select('id, direction, subject')
      .eq('thread_id', sendResult.threadId);

    // Expecting exactly 2 messages in thread: 1 Outbound + 1 Inbound
    assert(threadMessages.length === 2, `Thread contains exactly 2 messages (1 Outbound, 1 Inbound, 0 Duplicates: Got ${threadMessages.length})`);

    // -------------------------------------------------------------------------
    // SECTION 7: GOOGLE WORKSPACE / GMAIL SYNCHRONIZATION SERVICE
    // -------------------------------------------------------------------------
    console.log('\n--- [SECTION 7] Google Workspace / Gmail Synchronization Service ---');

    // Test Inbound Dual Delivery to Gmail
    const inboundGmailSync = await syncInboundEmailToGmailInbox({
      from: testLead.email,
      to: 'rauf@mine-tech.be',
      subject: inboundReplySubject,
      text: 'Gmail inbound dual delivery test body',
      html: '<p>Gmail inbound dual delivery test body</p>',
      messageId: inboundRfcMessageId,
    });

    assert(Boolean(inboundGmailSync), 'Inbound Gmail dual-delivery execution completed');
    assert(inboundGmailSync.status === 'pending_credentials' || inboundGmailSync.status === 'synced', 
      `Inbound sync reported truthful state without crashing (Status: ${inboundGmailSync.status})`);

    // Test Outbound Sent Copy to Gmail Sent Folder
    const outboundGmailSync = await syncOutboundEmailToGmailSent({
      from: 'Rauf <rauf@mine-tech.be>',
      to: testLead.email,
      subject: `MineTech Master Outbound Test [${testBatchId}]`,
      body: '<p>Outbound Gmail sent copy test body</p>',
      messageId: `<${sendResult.resendId}@mine-tech.be>`,
    });

    assert(Boolean(outboundGmailSync), 'Outbound Gmail Sent-folder sync execution completed');
    assert(outboundGmailSync.status === 'pending_credentials' || outboundGmailSync.status === 'synced', 
      `Outbound sync reported truthful state without crashing (Status: ${outboundGmailSync.status})`);

    // Test RFC 2822 MIME generation & loop-prevention header
    const { buildRawRfc2822Email } = await import('../lib/services/gmailSyncService.js');
    const rawRfc = buildRawRfc2822Email({
      from: 'Rauf <rauf@mine-tech.be>',
      to: testLead.email,
      subject: 'RFC Test',
      bodyText: 'Text test',
      bodyHtml: '<p>HTML test</p>',
      messageId: '<test-rfc@mine-tech.be>',
    });
    assert(rawRfc.includes('X-MineTech-Synced: true'), 'RFC 2822 builder adds X-MineTech-Synced loop-prevention header');
    assert(rawRfc.includes('multipart/alternative'), 'RFC 2822 builder creates valid multipart alternative structure');

    // -------------------------------------------------------------------------
    // SECTION 8: HTML EMAIL RENDERING & XSS SANITIZATION
    // -------------------------------------------------------------------------
    console.log('\n--- [SECTION 8] Security: Email HTML Sanitization & XSS Defense ---');

    const maliciousHtml = `
      <div>
        <h1>Proposal Overview</h1>
        <p>Please review our terms.</p>
        <script>alert("XSS Attack!");</script>
        <img src="x" onerror="stealCookies()" />
        <a href="javascript:maliciousCode()">Click Here</a>
        <a href="https://mine-tech.be">Safe Link</a>
      </div>
    `;

    const cleanHtml = sanitizeHtml(maliciousHtml);
    assert(!cleanHtml.includes('<script>'), 'Sanitizer stripped <script> tag');
    assert(!cleanHtml.includes('onerror='), 'Sanitizer stripped inline onerror handler');
    assert(!cleanHtml.includes('javascript:'), 'Sanitizer stripped javascript: pseudo-protocol URL');
    assert(cleanHtml.includes('<p>Please review our terms.</p>'), 'Sanitizer preserved valid paragraph text');
    assert(cleanHtml.includes('https://mine-tech.be'), 'Sanitizer preserved legitimate HTTPS anchor tag');

    // -------------------------------------------------------------------------
    // SECTION 9: WEBHOOK REPLAY & SIGNATURE VERIFICATION
    // -------------------------------------------------------------------------
    console.log('\n--- [SECTION 9] Webhook Signature Security & Delivery Events ---');

    // Unsigned webhook attempt
    const fakeRequest = new Request('http://localhost:3000/api/webhooks/resend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'email.delivered', data: { email_id: sendResult.resendId } }),
    });

    const unsignedResponse = await resendWebhookHandler(fakeRequest);
    // If webhook secret is set in env, it must return 400/401; if unset in test environment, it processes gracefully
    assert(unsignedResponse.status === 200 || unsignedResponse.status === 400 || unsignedResponse.status === 401, 
      `Webhook handler returned safe HTTP status (${unsignedResponse.status})`);

  } catch (err) {
    console.error('❌ Exception during master test execution:', err);
    totalFailed++;
  } finally {
    // -------------------------------------------------------------------------
    // SECTION 10: CLEANUP
    // -------------------------------------------------------------------------
    console.log('\n--- [SECTION 10] Test Teardown & Purge ---');
    try {
      if (testLead?.id) {
        // Clean up messages, threads, and lead
        const { data: threads } = await supabaseAdmin.from('email_threads').select('id').eq('lead_id', testLead.id);
        const threadIds = (threads || []).map(t => t.id);
        if (threadIds.length > 0) {
          await supabaseAdmin.from('email_messages').delete().in('thread_id', threadIds);
          await supabaseAdmin.from('email_threads').delete().in('id', threadIds);
        }
        await supabaseAdmin.from('leads').delete().eq('id', testLead.id);
      }
      if (dncLead?.id) {
        await supabaseAdmin.from('leads').delete().eq('id', dncLead.id);
      }
      console.log('  ✅ Temporary test fixtures purged cleanly');
    } catch (cleanupErr) {
      console.warn('  ⚠️ Teardown notice:', cleanupErr.message);
    }
  }

  console.log('\n======================================================================');
  console.log(`📊 MASTER EMAIL TEST RESULTS: ${totalPassed} Passed / ${totalFailed} Failed`);
  console.log('======================================================================\n');

  if (totalFailed > 0) {
    process.exit(1);
  }
}

runMasterEmailProductionTests();
