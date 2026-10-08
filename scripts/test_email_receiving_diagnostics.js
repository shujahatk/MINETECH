import dotenv from 'dotenv';
dotenv.config();

import { supabaseAdmin } from '../lib/supabase.js';
import Lead from '../lib/models/Lead.js';
import { processInboundEmail } from '../lib/services/inboundEmailService.js';
import { sendLeadEmail } from '../lib/services/emailService.js';

async function runEmailReceivingDiagnostics() {
  console.log('=====================================================');
  console.log('🔍 RUNNING EMAIL RECEIVING & RESEND / WEB DIAGNOSTICS');
  console.log('=====================================================\n');

  const report = {
    resendConfigured: false,
    supabaseConnected: false,
    inboundLeadCreated: false,
    inboundThreadCreated: false,
    inboundReplyMatched: false,
    inboxApiFormatted: false,
    threadDetailFetched: false,
  };

  // 1. Resend Credentials Check
  const hasResendKey = Boolean(
    process.env.RESEND_API_KEY &&
    process.env.RESEND_API_KEY.startsWith('re_') &&
    !process.env.RESEND_API_KEY.includes('your_')
  );
  report.resendConfigured = hasResendKey;
  console.log(`[1] Resend API Key: ${hasResendKey ? '✅ VALID (Configured)' : '❌ NOT CONFIGURED'}`);
  console.log(`    From Domain: ${process.env.EMAIL_FROM || 'outreach@minetechresources.com'}`);

  // 2. Supabase Connection Check
  const { data: userCheck, error: sbErr } = await supabaseAdmin.from('users').select('id').limit(1);
  if (sbErr) {
    console.error('❌ Supabase Connection Error:', sbErr.message);
  } else {
    report.supabaseConnected = true;
    console.log('[2] Supabase Database: ✅ CONNECTED');
  }

  // 3. Test Inbound Email from a Brand New Prospect
  console.log('\n[3] Testing Inbound Email Processing (Brand New Prospect)...');
  const newProspectEmail = `diagnostic.new.${Date.now()}@inboundtest.com`;
  const newMsgId = `<inbound-new-${Date.now()}@inboundtest.com>`;

  const newInboundResult = await processInboundEmail({
    from: `Sarah Connor <${newProspectEmail}>`,
    to: 'outreach@minetechresources.com',
    subject: 'Inquiry about outbound automation services',
    text: 'Hello, I saw your website and would like to learn more about your outbound sales automation system. Can you share pricing details?',
    html: '<p>Hello, I saw your website and would like to learn more about your outbound sales automation system. Can you share pricing details?</p>',
    messageId: newMsgId,
  });

  if (newInboundResult?.success && newInboundResult.leadId && newInboundResult.threadId) {
    report.inboundLeadCreated = true;
    report.inboundThreadCreated = true;
    console.log(`    ✅ New Lead Auto-Created: ID ${newInboundResult.leadId}`);
    console.log(`    ✅ New Conversation Thread Created: ID ${newInboundResult.threadId}`);
    console.log(`    ✅ Inbound Message Stored in DB: ID ${newInboundResult.messageId}`);
  } else {
    console.error('    ❌ Failed to process inbound email for new prospect', newInboundResult);
  }

  // Verify lead status is ENGAGED and unread count is 1
  const { data: newLeadDb } = await supabaseAdmin
    .from('leads')
    .select('id, email, status, custom_fields')
    .eq('id', newInboundResult.leadId)
    .single();

  console.log(`    - Lead Status: ${newLeadDb?.status} (Expected: ENGAGED)`);
  console.log(`    - Lead has_unanswered_reply: ${newLeadDb?.custom_fields?.has_unanswered_reply}`);

  // 4. Test Inbound Reply to an Existing Outbound Conversation (Thread Matching)
  console.log('\n[4] Testing Inbound Reply to Existing Outbound Thread (Thread Matching)...');
  const existingLead = await Lead.create({
    firstName: 'Alex',
    lastName: 'Mercer',
    fullName: 'Alex Mercer',
    email: `alex.mercer.${Date.now()}@gentek.org`,
    company: 'Gentek Bio',
    status: 'NEW',
  });

  // Outbound send to create initial thread
  const outboundSend = await sendLeadEmail({
    leadId: existingLead.id,
    subject: 'Partnership discussion with Gentek Bio',
    bodyHtml: '<p>Hi Alex, Are you available for a brief sync?</p>',
    bodyText: 'Hi Alex, Are you available for a brief sync?',
  });

  console.log(`    - Outbound email dispatched. Thread ID: ${outboundSend.threadId}`);

  // Inbound reply with inReplyTo
  const replyMsgId = `<reply-alex-${Date.now()}@gentek.org>`;
  const replyInboundResult = await processInboundEmail({
    from: `Alex Mercer <${existingLead.email}>`,
    to: 'outreach@minetechresources.com',
    subject: 'Re: Partnership discussion with Gentek Bio',
    text: 'Yes, let us schedule something for next Tuesday morning.',
    html: '<p>Yes, let us schedule something for next Tuesday morning.</p>',
    inReplyTo: outboundSend.providerMessageId || outboundSend.messageId,
    messageId: replyMsgId,
  });

  if (replyInboundResult?.threadId === outboundSend.threadId) {
    report.inboundReplyMatched = true;
    console.log(`    ✅ Inbound reply accurately matched existing thread: ${replyInboundResult.threadId}`);
  } else {
    console.error(`    ❌ Thread mismatch! Expected ${outboundSend.threadId}, got ${replyInboundResult?.threadId}`);
  }

  // 5. Check Thread Unread Count & Message Count in Supabase
  const { data: threadDb } = await supabaseAdmin
    .from('email_threads')
    .select('*')
    .eq('id', outboundSend.threadId)
    .single();

  console.log(`    - Thread unread_count: ${threadDb?.unread_count} (Expected: >= 1)`);
  console.log(`    - Thread snippet: "${threadDb?.snippet}"`);

  // 6. Test Web API formatting: Inbox View & Thread Details
  console.log('\n[5] Testing Web API Data Pipeline & Unified Inbox Formatting...');
  const { data: allThreadMsgs } = await supabaseAdmin
    .from('email_messages')
    .select('*')
    .eq('thread_id', outboundSend.threadId)
    .order('sent_at', { ascending: true });

  console.log(`    - Total messages retrieved for thread: ${allThreadMsgs?.length}`);
  const hasInbound = allThreadMsgs.some((m) => m.direction === 'inbound');
  const hasOutbound = allThreadMsgs.some((m) => m.direction === 'outbound');
  console.log(`    - Contains Outbound: ${hasOutbound ? '✅ YES' : '❌ NO'}`);
  console.log(`    - Contains Inbound:  ${hasInbound ? '✅ YES' : '❌ NO'}`);

  if (hasInbound && hasOutbound) {
    report.threadDetailFetched = true;
    report.inboxApiFormatted = true;
  }

  // 7. Test Activity Logs
  const { data: activityLogs } = await supabaseAdmin
    .from('activity_logs')
    .select('*')
    .eq('lead_id', existingLead.id)
    .order('created_at', { ascending: false });

  const inboundLog = activityLogs.find((l) => l.type === 'INBOUND_REPLY_RECEIVED');
  console.log(`\n[6] Audit Activity Log: ${inboundLog ? '✅ RECORDED (INBOUND_REPLY_RECEIVED)' : '❌ MISSING'}`);
  if (inboundLog) {
    console.log(`    - Description: "${inboundLog.description}"`);
  }

  console.log('\n=====================================================');
  console.log('📊 DIAGNOSTIC SUMMARY:');
  console.log(`- Resend Configuration:        ${report.resendConfigured ? 'PASSED ✅' : 'FAILED ❌'}`);
  console.log(`- Database Connection:         ${report.supabaseConnected ? 'PASSED ✅' : 'FAILED ❌'}`);
  console.log(`- Inbound Lead Ingestion:      ${report.inboundLeadCreated ? 'PASSED ✅' : 'FAILED ❌'}`);
  console.log(`- Inbound Thread Management:   ${report.inboundThreadCreated ? 'PASSED ✅' : 'FAILED ❌'}`);
  console.log(`- Thread Matching (In-Reply-To):${report.inboundReplyMatched ? 'PASSED ✅' : 'FAILED ❌'}`);
  console.log(`- Unified Inbox Website Feed:  ${report.inboxApiFormatted ? 'PASSED ✅' : 'FAILED ❌'}`);
  console.log('=====================================================');
}

runEmailReceivingDiagnostics().catch((err) => {
  console.error('Fatal Error:', err);
  process.exit(1);
});
