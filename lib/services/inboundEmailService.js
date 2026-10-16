import { supabaseAdmin } from '../supabase.js';
import crypto from 'crypto';
import { enforceInboundStopSignals } from '../ai/brain/stopContact.js';
import { syncInboundEmailToGmailInbox } from './gmailSyncService.js';

/**
 * Extracts clean email address from string format: "John Doe <john@example.com>" -> "john@example.com"
 */
export function extractEmailAddress(raw) {
  if (!raw) return '';
  const match = String(raw).match(/<([^>]+)>/);
  if (match) return match[1].toLowerCase().trim();
  return String(raw).toLowerCase().trim();
}

/**
 * Normalizes subject line by stripping common reply/forward prefixes
 */
export function normalizeSubject(subj) {
  if (!subj) return '';
  return subj
    .replace(/^(\s*(re|fwd|fw|re\[\d+\]|fwd\[\d+\])\s*:\s*)+/i, '')
    .trim();
}

/**
 * Processes incoming email from Resend Inbound Webhook or Central Mailbox
 */
export async function processInboundEmail({
  from,
  to,
  cc = [],
  bcc = [],
  subject = '(No Subject)',
  text = '',
  html = '',
  messageId = '',
  inReplyTo = '',
  references = [],
  attachments = [],
  headers = {},
  providerMessageId = '',
}) {
  const senderEmail = extractEmailAddress(from);
  const recipientEmail = extractEmailAddress(to) || process.env.EMAIL_FROM || 'rauf@mine-tech.be';

  if (!senderEmail) {
    throw new Error('Sender email address is missing');
  }

  // Idempotency check: prevent duplicate processing of the same incoming message ID
  const incomingId = messageId || providerMessageId;
  if (incomingId) {
    try {
      const { data: existingMsg } = await supabaseAdmin
        .from('email_messages')
        .select('id, thread_id, lead_id')
        .eq('resend_id', incomingId)
        .maybeSingle();

      if (existingMsg?.id) {
        console.log(`[InboundEmail] Idempotency: Duplicate inbound webhook for ID ${incomingId}. Skipping duplicate record.`);
        return {
          success: true,
          duplicate: true,
          leadId: existingMsg.lead_id,
          threadId: existingMsg.thread_id,
          messageId: existingMsg.id,
        };
      }
    } catch (e) {}
  }

  console.log(`[InboundEmail] Received email from ${senderEmail} to ${recipientEmail} | Subject: "${subject}"`);

  // 1. Find matching Lead in Supabase CRM
  let lead = null;
  const { data: existingLeads } = await supabaseAdmin
    .from('leads')
    .select('*')
    .ilike('email', senderEmail)
    .limit(1);

  if (existingLeads && existingLeads.length > 0) {
    lead = existingLeads[0];
  }

  const nowIso = new Date().toISOString();

  if (!lead) {
    // If not found, automatically register new inbound prospect lead
    const rawFromName = from.replace(/<[^>]+>/, '').trim();
    const nameParts = (rawFromName || senderEmail.split('@')[0]).split(' ');
    const firstName = nameParts[0] || 'Inbound';
    const lastName = nameParts.slice(1).join(' ') || 'Prospect';
    const fullName = nameParts.join(' ').trim() || senderEmail;

    const customFields = {
      has_unanswered_reply: true,
      last_reply_snippet: (text || subject).substring(0, 150),
      last_reply_channel: 'email',
      last_reply_at: nowIso,
      last_engaged_at: nowIso,
      source: 'inbound_email',
    };

    const { data: newLead, error: createLeadErr } = await supabaseAdmin
      .from('leads')
      .insert({
        first_name: firstName,
        last_name: lastName,
        full_name: fullName,
        email: senderEmail,
        status: 'ENGAGED',
        custom_fields: customFields,
        created_at: nowIso,
        updated_at: nowIso,
      })
      .select('*')
      .single();

    if (createLeadErr) {
      console.error('[InboundEmail] Error creating lead for inbound email:', createLeadErr);
      throw new Error(`Failed to create lead: ${createLeadErr.message}`);
    }
    lead = newLead;
    console.log(`[InboundEmail] Created new lead for incoming email: ${lead.email}`);
  } else {
    // Update existing lead engagement state
    const existingCustom = (typeof lead.custom_fields === 'object' && lead.custom_fields) ? lead.custom_fields : {};
    const updatedCustom = {
      ...existingCustom,
      has_unanswered_reply: true,
      last_reply_snippet: (text || subject).substring(0, 150),
      last_reply_channel: 'email',
      last_reply_at: nowIso,
      last_engaged_at: nowIso,
    };

    const updatePayload = {
      custom_fields: updatedCustom,
      updated_at: nowIso,
    };

    // Transition cold leads to ENGAGED
    const coldStatuses = ['NEW', 'CONTACTED', 'FOLLOW_UP', 'NO_RESPONSE', 'new', 'contacted', 'follow_up'];
    if (coldStatuses.includes(lead.status)) {
      updatePayload.status = 'ENGAGED';
    }

    await supabaseAdmin
      .from('leads')
      .update(updatePayload)
      .eq('id', lead.id);
  }

  // 2. Thread Matching Logic using Standard Headers
  let matchedThreadId = null;

  // A. Match via In-Reply-To header
  if (inReplyTo) {
    // Check resend_id first
    try {
      const { data: parentByResendId } = await supabaseAdmin
        .from('email_messages')
        .select('thread_id')
        .eq('resend_id', inReplyTo)
        .limit(1);

      if (parentByResendId && parentByResendId.length > 0 && parentByResendId[0].thread_id) {
        matchedThreadId = parentByResendId[0].thread_id;
      }
    } catch (e) {}

    // Safe check on message_id if not matched yet
    if (!matchedThreadId) {
      try {
        const { data: parentByMsgId } = await supabaseAdmin
          .from('email_messages')
          .select('thread_id')
          .eq('message_id', inReplyTo)
          .limit(1);

        if (parentByMsgId && parentByMsgId.length > 0 && parentByMsgId[0].thread_id) {
          matchedThreadId = parentByMsgId[0].thread_id;
        }
      } catch (e) {}
    }
  }

  // B. Match via References headers
  if (!matchedThreadId && references && (Array.isArray(references) ? references.length > 0 : Boolean(references))) {
    const refArray = Array.isArray(references) ? references : String(references).split(/\s+/).filter(Boolean);
    try {
      const { data: refMsgs } = await supabaseAdmin
        .from('email_messages')
        .select('thread_id')
        .in('resend_id', refArray)
        .limit(1);

      if (refMsgs && refMsgs.length > 0 && refMsgs[0].thread_id) {
        matchedThreadId = refMsgs[0].thread_id;
      }
    } catch (e) {}

    if (!matchedThreadId) {
      try {
        const { data: refMsgs2 } = await supabaseAdmin
          .from('email_messages')
          .select('thread_id')
          .in('message_id', refArray)
          .limit(1);

        if (refMsgs2 && refMsgs2.length > 0 && refMsgs2[0].thread_id) {
          matchedThreadId = refMsgs2[0].thread_id;
        }
      } catch (e) {}
    }
  }

  // C. Fallback: match by normalized subject within this lead's threads
  if (!matchedThreadId && lead.id) {
    const cleanSubject = normalizeSubject(subject);
    if (cleanSubject && cleanSubject !== '(no subject)') {
      try {
        const { data: threadBySubj } = await supabaseAdmin
          .from('email_threads')
          .select('id')
          .eq('lead_id', lead.id)
          .ilike('subject', `%${cleanSubject}%`)
          .order('last_message_at', { ascending: false })
          .limit(1);

        if (threadBySubj && threadBySubj.length > 0) {
          matchedThreadId = threadBySubj[0].id;
        }
      } catch (e) {}
    }
  }

  // D. Fallback: most recent active thread for this lead
  if (!matchedThreadId && lead.id) {
    try {
      const { data: recentThreads } = await supabaseAdmin
        .from('email_threads')
        .select('id')
        .eq('lead_id', lead.id)
        .order('last_message_at', { ascending: false })
        .limit(1);

      if (recentThreads && recentThreads.length > 0) {
        matchedThreadId = recentThreads[0].id;
      }
    } catch (e) {}
  }

  let finalThread = null;

  if (!matchedThreadId) {
    // Create new conversation thread
    const { data: newThread, error: threadErr } = await supabaseAdmin
      .from('email_threads')
      .insert({
        lead_id: lead.id,
        subject: subject || 'Inbound Conversation',
        snippet: (text || subject).substring(0, 150),
        last_message_at: nowIso,
        status: 'OPEN',
        unread_count: 1,
        created_at: nowIso,
        updated_at: nowIso,
      })
      .select('*')
      .single();

    if (threadErr) {
      console.error('[InboundEmail] Error creating thread:', threadErr);
      throw new Error(`Failed to create thread: ${threadErr.message}`);
    }
    finalThread = newThread;
  } else {
    // Fetch and update existing conversation thread
    const { data: threadData } = await supabaseAdmin
      .from('email_threads')
      .select('*')
      .eq('id', matchedThreadId)
      .single();

    finalThread = threadData;

    await supabaseAdmin
      .from('email_threads')
      .update({
        last_message_at: nowIso,
        snippet: (text || subject).substring(0, 150),
        status: 'OPEN',
        unread_count: (finalThread?.unread_count || 0) + 1,
        updated_at: nowIso,
      })
      .eq('id', matchedThreadId);
  }

  // 3. Create EmailMessage in Supabase
  const domain = recipientEmail.includes('@') ? recipientEmail.split('@')[1] : 'mine-tech.be';
  const finalMsgId = messageId || providerMessageId || `<inbound-${Date.now()}-${crypto.randomUUID().slice(0, 8)}@${domain}>`;

  const msgPayload = {
    thread_id: finalThread.id,
    lead_id: lead.id,
    direction: 'inbound',
    sender: senderEmail,
    recipient: recipientEmail,
    subject: subject,
    body_plain: text,
    body_html: html || `<p>${text}</p>`,
    resend_id: finalMsgId,
    message_id: finalMsgId,
    in_reply_to: inReplyTo || null,
    status: 'received',
    sent_at: nowIso,
    created_at: nowIso,
  };

  if (cc && cc.length > 0) msgPayload.cc = Array.isArray(cc) ? cc : [cc];
  if (bcc && bcc.length > 0) msgPayload.bcc = Array.isArray(bcc) ? bcc : [bcc];
  if (references) msgPayload.references = Array.isArray(references) ? references : [references];
  if (attachments && attachments.length > 0) msgPayload.attachments = attachments;

  let newEmailMsg = null;
  try {
    const { data: createdMsg, error: msgErr } = await supabaseAdmin
      .from('email_messages')
      .insert(msgPayload)
      .select('*')
      .single();

    if (msgErr) {
      // Fallback for unmigrated schema: insert with core columns only
      console.warn('[InboundEmail] Inserting message with fallback core columns:', msgErr.message);
      const fallbackPayload = {
        thread_id: finalThread.id,
        lead_id: lead.id,
        direction: 'inbound',
        sender: senderEmail,
        recipient: recipientEmail,
        subject: subject,
        body_plain: text,
        body_html: html || `<p>${text}</p>`,
        resend_id: finalMsgId,
        status: 'received',
        sent_at: nowIso,
        created_at: nowIso,
      };
      const { data: fbMsg } = await supabaseAdmin
        .from('email_messages')
        .insert(fallbackPayload)
        .select('*')
        .single();
      newEmailMsg = fbMsg;
    } else {
      newEmailMsg = createdMsg;
    }
  } catch (e) {
    console.error('[InboundEmail] Fatal error saving email_message:', e);
  }

  // 4. Record Activity Log in Supabase
  try {
    await supabaseAdmin
      .from('activity_logs')
      .insert({
        lead_id: lead.id,
        type: 'INBOUND_REPLY_RECEIVED',
        description: `Inbound reply received from ${lead.full_name || lead.email}: "${subject}"`,
        metadata: {
          messageId: newEmailMsg?.id || finalMsgId,
          threadId: finalThread.id,
          snippet: text.substring(0, 200),
          senderEmail,
          recipientEmail,
        },
        created_at: nowIso,
      });
  } catch (actErr) {
    console.warn('[InboundEmail] Activity log error:', actErr.message);
  }

  // 5. Dual Delivery: Synchronize Inbound Message to Google Workspace / Gmail
  let gmailSyncResult = null;
  try {
    gmailSyncResult = await syncInboundEmailToGmailInbox({
      messageId: finalMsgId,
      sender: from,
      recipient: recipientEmail,
      subject,
      bodyHtml: html || `<p>${text}</p>`,
      bodyText: text,
      inReplyTo,
      references,
      receivedAt: nowIso,
      dbMessageId: newEmailMsg?.id,
    });
  } catch (gmailErr) {
    console.warn('[InboundEmail] Inbound Gmail Inbox sync warning:', gmailErr.message);
  }

  // 6. Deterministic stop-contact rules: unambiguous unsubscribe suppresses the lead immediately
  try {
    await enforceInboundStopSignals({
      lead,
      text,
      subject,
      from: senderEmail,
      messageId: newEmailMsg?.id || null,
    });
  } catch (stopErr) {
    console.error('[InboundEmail] Stop-signal enforcement failed:', stopErr.message);
  }

  return {
    success: true,
    leadId: lead.id,
    threadId: finalThread.id,
    messageId: newEmailMsg?.id || null,
    gmailSync: gmailSyncResult,
  };
}

/**
 * Handle delivery events (bounce, open, click, spam report) with Supabase persistence
 */
export async function processEmailEvent({ event, email, messageId, campaignId }) {
  const normalizedEmail = (email || '').toLowerCase().trim();
  if (!normalizedEmail) return { processed: false, reason: 'missing_email' };

  const { data: leads } = await supabaseAdmin
    .from('leads')
    .select('*')
    .ilike('email', normalizedEmail)
    .limit(1);

  if (!leads || leads.length === 0) {
    return { processed: false, reason: 'lead_not_found' };
  }

  const lead = leads[0];
  const nowIso = new Date().toISOString();

  if (event === 'bounce' || event === 'dropped') {
    await supabaseAdmin
      .from('leads')
      .update({
        is_dnc: true,
        dnc_reason: 'bounced',
        status: 'NOT_INTERESTED',
        updated_at: nowIso,
      })
      .eq('id', lead.id);

    await supabaseAdmin
      .from('activity_logs')
      .insert({
        lead_id: lead.id,
        type: 'EMAIL_BOUNCED',
        description: `Email bounced for ${lead.email}`,
        created_at: nowIso,
      });
  } else if (event === 'open') {
    await supabaseAdmin
      .from('leads')
      .update({
        updated_at: nowIso,
      })
      .eq('id', lead.id);

    await supabaseAdmin
      .from('activity_logs')
      .insert({
        lead_id: lead.id,
        type: 'EMAIL_OPENED',
        description: `Lead opened email`,
        created_at: nowIso,
      });
  } else if (event === 'click') {
    await supabaseAdmin
      .from('leads')
      .update({
        updated_at: nowIso,
      })
      .eq('id', lead.id);

    await supabaseAdmin
      .from('activity_logs')
      .insert({
        lead_id: lead.id,
        type: 'EMAIL_CLICKED',
        description: `Lead clicked link in email`,
        created_at: nowIso,
      });
  } else if (event === 'spamreport' || event === 'unsubscribe') {
    await supabaseAdmin
      .from('leads')
      .update({
        is_dnc: true,
        dnc_reason: 'unsubscribed',
        status: 'DO_NOT_CONTACT',
        updated_at: nowIso,
      })
      .eq('id', lead.id);

    await supabaseAdmin
      .from('activity_logs')
      .insert({
        lead_id: lead.id,
        type: 'SUPPRESSION_UPDATED',
        description: `Lead unsubscribed / reported spam`,
        created_at: nowIso,
      });
  }

  return { processed: true, event };
}

export default {
  extractEmailAddress,
  normalizeSubject,
  processInboundEmail,
  processEmailEvent,
};
