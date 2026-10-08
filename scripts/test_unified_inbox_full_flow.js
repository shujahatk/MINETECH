import dotenv from 'dotenv';
dotenv.config();

import { supabaseAdmin } from '../lib/supabase.js';
import Lead from '../lib/models/Lead.js';
import { sendLeadEmail } from '../lib/services/emailService.js';
import { processInboundEmail } from '../lib/services/inboundEmailService.js';

async function runInboxVerification() {
  console.log('--- Starting Unified Inbox End-to-End Verification ---');

  // 1. Create a test lead
  const testEmail = `prospect.test.${Date.now()}@example.com`;
  const lead = await Lead.create({
    firstName: 'Marcus',
    lastName: 'Vance',
    fullName: 'Marcus Vance',
    email: testEmail,
    company: 'Vance Dynamics',
    jobTitle: 'Chief Revenue Officer',
    status: 'NEW',
  });

  console.log(`\n[Step 1]: Created test lead: ${lead.fullName} (${lead.email}), ID: ${lead.id}`);

  // 2. Dispatch an Outbound Email via sendLeadEmail
  console.log('\n[Step 2]: Dispatching Outbound Email via sendLeadEmail...');
  const sendRes = await sendLeadEmail({
    leadId: lead.id,
    subject: 'Outbound pipeline scaling for Vance Dynamics',
    bodyHtml: '<p>Hi Marcus,</p><p>We help high-growth teams accelerate their outbound conversion by 40%.</p><p>Would you be open for a 10-minute discovery call this Thursday?</p>',
    bodyText: 'Hi Marcus, We help high-growth teams accelerate their outbound conversion by 40%. Would you be open for a 10-minute discovery call this Thursday?',
  });

  console.log('Outbound email dispatched. Result:', sendRes.success ? 'SUCCESS' : 'FAILED');

  // 3. Verify that an EmailThread and EmailMessage were created in Supabase
  console.log('\n[Step 3]: Querying Supabase for email_threads and email_messages...');
  const { data: threadData } = await supabaseAdmin
    .from('email_threads')
    .select('*')
    .eq('lead_id', lead.id)
    .maybeSingle();

  if (!threadData) {
    throw new Error('Failed to find created email_thread in Supabase');
  }
  console.log(`Found email_thread: ID ${threadData.id} | Subject: "${threadData.subject}" | Snippet: "${threadData.snippet}"`);

  const { data: messagesData } = await supabaseAdmin
    .from('email_messages')
    .select('*')
    .eq('thread_id', threadData.id);

  console.log(`Found ${messagesData?.length || 0} message(s) in thread.`);
  if (!messagesData || messagesData.length === 0) {
    throw new Error('No email_messages found for the thread');
  }

  const outboundMsg = messagesData[0];
  console.log(`Outbound Message ID: ${outboundMsg.id} | Direction: ${outboundMsg.direction} | Sender: ${outboundMsg.sender}`);

  // 4. Simulate Inbound Reply from the Prospect
  console.log('\n[Step 4]: Simulating Inbound Reply from Prospect...');
  const inboundRes = await processInboundEmail({
    from: `${lead.fullName} <${lead.email}>`,
    to: 'outreach@minetechresources.com',
    subject: `Re: ${threadData.subject}`,
    text: 'Hi, Thanks for reaching out. Yes, I would be interested in seeing a quick walkthrough. What times work for you on Thursday afternoon?',
    html: '<p>Hi,</p><p>Thanks for reaching out. Yes, I would be interested in seeing a quick walkthrough. What times work for you on Thursday afternoon?</p>',
    inReplyTo: outboundMsg.resend_id || outboundMsg.id,
    messageId: `<reply-${Date.now()}@vancedynamics.com>`,
  });

  console.log('Inbound reply processed successfully.');

  // 5. Verify thread is updated with inbound reply and marked unread
  const { data: updatedThread } = await supabaseAdmin
    .from('email_threads')
    .select('*')
    .eq('id', threadData.id)
    .single();

  console.log(`\n[Step 5]: Thread after inbound reply:`);
  console.log(`- Unread Count: ${updatedThread.unread_count}`);
  console.log(`- Last Message At: ${updatedThread.last_message_at}`);
  console.log(`- Snippet: "${updatedThread.snippet}"`);

  const { data: allMessages } = await supabaseAdmin
    .from('email_messages')
    .select('*')
    .eq('thread_id', threadData.id)
    .order('sent_at', { ascending: true });

  console.log(`Total messages in thread stream: ${allMessages.length}`);
  allMessages.forEach((m, idx) => {
    console.log(`  [Message ${idx + 1}] (${m.direction.toUpperCase()}): "${m.body_plain?.substring(0, 60)}..."`);
  });

  if (allMessages.length < 2) {
    throw new Error('Expected at least 2 messages in thread stream (outbound + inbound reply)');
  }

  // 6. Test Sending Follow-up Reply from the Unified Inbox
  console.log('\n[Step 6]: Sending Unified Inbox follow-up reply...');
  const replyRes = await sendLeadEmail({
    leadId: lead.id,
    subject: `Re: ${threadData.subject}`,
    bodyHtml: '<p>Great! How does 2:00 PM EST this Thursday sound for a quick 10-minute Google Meet?</p>',
    bodyText: 'Great! How does 2:00 PM EST this Thursday sound for a quick 10-minute Google Meet?',
    threadId: threadData.id,
  });

  console.log('Follow-up reply sent successfully:', replyRes.success);

  const { data: finalMessages } = await supabaseAdmin
    .from('email_messages')
    .select('*')
    .eq('thread_id', threadData.id)
    .order('sent_at', { ascending: true });

  console.log(`\nFinal conversation message count: ${finalMessages.length}`);
  const lastMsg = finalMessages[finalMessages.length - 1];
  console.log(`Last message body plain:\n${lastMsg.body_plain}`);

  if (!lastMsg.body_plain.includes('MineTech Outbound')) {
    throw new Error('Signature "MineTech Outbound" missing from sent message');
  }

  console.log('\n✅ ALL UNIFIED INBOX FULL-FLOW TESTS PASSED SUCCESSFULLY!');
}

runInboxVerification().catch((err) => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
