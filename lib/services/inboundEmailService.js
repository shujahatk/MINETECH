import { supabaseAdmin } from '../supabase.js';
import crypto from 'crypto';
import { enforceInboundStopSignals } from '../ai/brain/stopContact.js';

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
 * Processes incoming email from Central Mailbox or Resend Inbound Webhook
 */
export async function processInboundEmail({
  from,
  to,
  subject = '(No Subject)',
  text = '',
  html = '',
  messageId = '',
  inReplyTo = '',
  references = [],
  headers = {},
  providerMessageId = '',
}) {
  const senderEmail = extractEmailAddress(from);
  const recipientEmail = extractEmailAddress(to);

  if (!senderEmail) {
    throw new Error('Sender email address is missing');
  }

  // Idempotency check: prevent duplicate processing of the same webhook payload
  const incomingId = messageId || providerMessageId;
  if (incomingId) {
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
  }

  console.log(`[InboundEmail] Received email from ${senderEmail} to ${recipientEmail} | Subject: "${subject}"`);

  // 1. Find matching Lead in Supabase
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
    // If not found, create new inbound prospect lead
    const nameParts = (from.replace(/<[^>]+>/, '').trim() || senderEmail.split('@')[0]).split(' ');
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

  // 2. Thread Matching Logic
  let matchedThreadId = null;

  // A. Match via In-Reply-To header against email_messages
  if (inReplyTo) {
    const { data: parentMsgs } = await supabaseAdmin
      .from('email_messages')
      .select('thread_id')
      .eq('message_id', inReplyTo)
      .limit(1);

    if (parentMsgs && parentMsgs.length > 0 && parentMsgs[0].thread_id) {
      matchedThreadId = parentMsgs[0].thread_id;
    }
  }

  // B. Match via References headers
  if (!matchedThreadId && references && references.length > 0) {
    const refArray = Array.isArray(references) ? references : [references];
    const { data: refMsgs } = await supabaseAdmin
      .from('email_messages')
      .select('thread_id')
      .in('message_id', refArray)
      .limit(1);

    if (refMsgs && refMsgs.length > 0 && refMsgs[0].thread_id) {
      matchedThreadId = refMsgs[0].thread_id;
    }
  }

  // C. Fallback: match by clean subject for this lead
  if (!matchedThreadId && lead.id) {
    const cleanSubject = subject.replace(/^(Re|Fwd|RE|FWD):\s*/i, '').trim();
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
  }

  // D. Fallback: most recent active thread for this lead
  if (!matchedThreadId && lead.id) {
    const { data: recentThreads } = await supabaseAdmin
      .from('email_threads')
      .select('id')
      .eq('lead_id', lead.id)
      .order('last_message_at', { ascending: false })
      .limit(1);

    if (recentThreads && recentThreads.length > 0) {
      matchedThreadId = recentThreads[0].id;
    }
  }

  let finalThread = null;

  if (!matchedThreadId) {
    // Create new thread
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
    // Fetch and update existing thread
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
  const finalMsgId = messageId || providerMessageId || `<inbound-${Date.now()}-${crypto.randomUUID().slice(0, 8)}@minetechresources.com>`;

  const { data: newEmailMsg, error: msgErr } = await supabaseAdmin
    .from('email_messages')
    .insert({
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
    })
    .select('*')
    .single();

  if (msgErr) {
    console.error('[InboundEmail] Error creating email_message:', msgErr);
  }

  // 4. Record Activity Log in Supabase
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
      },
      created_at: nowIso,
    });

  // 5. Deterministic stop-contact rules (no AI): an unambiguous unsubscribe reply suppresses the lead
  //    immediately so campaigns, sequences and sendLeadEmail() all stop. Protective only; never throws.
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
