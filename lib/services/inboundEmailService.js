import { connectToDatabase } from '@/lib/db/mongoose';
import Lead from '@/lib/models/Lead';
import EmailThread from '@/lib/models/EmailThread';
import EmailMessage from '@/lib/models/EmailMessage';
import ActivityLog from '@/lib/models/ActivityLog';

/**
 * Extracts clean email address from string format: "John Doe <john@example.com>" -> "john@example.com"
 */
export function extractEmailAddress(raw) {
  if (!raw) return '';
  const match = raw.match(/<([^>]+)>/);
  if (match) return match[1].toLowerCase().trim();
  return raw.toLowerCase().trim();
}

/**
 * Processes incoming email from Central Mailbox or Webhook
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
  await connectToDatabase();

  const senderEmail = extractEmailAddress(from);
  const recipientEmail = extractEmailAddress(to);

  if (!senderEmail) {
    throw new Error('Sender email address is missing');
  }

  console.log(`[InboundEmail] Received email from ${senderEmail} to ${recipientEmail} | Subject: "${subject}"`);

  // 1. Find matching Lead
  let lead = await Lead.findOne({ email: senderEmail });

  if (!lead) {
    // If not found, create new inbound prospect lead
    const nameParts = (from.replace(/<[^>]+>/, '').trim() || senderEmail.split('@')[0]).split(' ');
    lead = await Lead.create({
      firstName: nameParts[0] || '',
      lastName: nameParts.slice(1).join(' ') || '',
      fullName: nameParts.join(' ').trim() || senderEmail,
      email: senderEmail,
      status: 'ENGAGED',
      source: 'inbound_email',
      hasUnansweredReply: true,
      lastReplySnippet: text.substring(0, 150) || subject,
      lastReplyChannel: 'email',
      lastReplyAt: new Date(),
      lastEngagedAt: new Date(),
    });
    console.log(`[InboundEmail] Created new lead for incoming email: ${lead.email}`);
  } else {
    // Update existing lead engagement state
    lead.hasUnansweredReply = true;
    lead.lastReplySnippet = text.substring(0, 150) || subject;
    lead.lastReplyChannel = 'email';
    lead.lastReplyAt = new Date();
    lead.lastEngagedAt = new Date();

    // Automatically transition to ENGAGED if cold
    if (['NEW', 'CONTACTED', 'FOLLOW_UP', 'NO_RESPONSE', 'new'].includes(lead.status)) {
      lead.status = 'ENGAGED';
    }

    // Automatically halt automated follow-up sequences on reply
    if (lead.emailSequence && lead.emailSequence.status === 'active') {
      lead.emailSequence.status = 'stopped';
      lead.emailSequence.stopReason = 'inbound-reply';
      console.log(`[InboundEmail] Automatically halted active email sequence for ${lead.email}`);
    }

    await lead.save();
  }

  // 2. Thread Matching Logic
  let thread = null;

  // Match via In-Reply-To header
  if (inReplyTo) {
    const parentMsg = await EmailMessage.findOne({ messageId: inReplyTo });
    if (parentMsg && parentMsg.threadId) {
      thread = await EmailThread.findById(parentMsg.threadId);
    }
  }

  // Match via References headers
  if (!thread && references && references.length > 0) {
    const parentMsg = await EmailMessage.findOne({ messageId: { $in: references } });
    if (parentMsg && parentMsg.threadId) {
      thread = await EmailThread.findById(parentMsg.threadId);
    }
  }

  // Fallback match: active thread for lead with clean subject
  if (!thread) {
    const cleanSubject = subject.replace(/^(Re|Fwd|RE|FWD):\s*/i, '').trim();
    thread = await EmailThread.findOne({
      leadId: lead._id,
      status: 'active',
      subject: { $regex: new RegExp(cleanSubject.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
    }).sort({ lastMessageAt: -1 });
  }

  // Fallback: most recent active thread for this lead
  if (!thread) {
    thread = await EmailThread.findOne({
      leadId: lead._id,
      status: 'active',
    }).sort({ lastMessageAt: -1 });
  }

  // If still no thread, create a new thread
  if (!thread) {
    thread = await EmailThread.create({
      leadId: lead._id,
      subject: subject || 'Inbound Conversation',
      participants: [
        { email: senderEmail, name: lead.fullName || lead.firstName },
        { email: recipientEmail, name: 'You' },
      ],
      snippet: (text || subject).substring(0, 150),
      lastMessageAt: new Date(),
      lastMessageDirection: 'inbound',
      unread: true,
      status: 'active',
      messageCount: 1,
    });
  } else {
    thread.lastMessageAt = new Date();
    thread.lastMessageDirection = 'inbound';
    thread.snippet = (text || subject).substring(0, 150);
    thread.unread = true;
    thread.messageCount = (thread.messageCount || 1) + 1;
    await thread.save();
  }

  // 3. Create EmailMessage
  const emailMessage = await EmailMessage.create({
    threadId: thread._id,
    leadId: lead._id,
    direction: 'inbound',
    from: { email: senderEmail, name: lead.fullName || lead.firstName },
    to: [{ email: recipientEmail, name: 'You' }],
    subject,
    bodyText: text,
    bodyHtml: html || `<p>${text}</p>`,
    messageId: messageId || `<inbound-${Date.now()}@inbound.8020>`,
    inReplyTo: inReplyTo || '',
    references: Array.isArray(references) ? references : [references].filter(Boolean),
    providerMessageId: providerMessageId || '',
    status: 'received',
    receivedAt: new Date(),
  });

  // 4. Record Activity Log
  await ActivityLog.create({
    leadId: lead._id,
    action: 'EMAIL_REPLIED',
    channel: 'email',
    direction: 'inbound',
    summary: `Received reply from ${lead.fullName || lead.email}: "${subject}"`,
    details: {
      messageId: emailMessage.messageId,
      threadId: thread._id,
      snippet: text.substring(0, 200),
      senderEmail,
    },
    timestamp: new Date(),
  });

  return {
    success: true,
    leadId: lead._id,
    threadId: thread._id,
    messageId: emailMessage._id,
  };
}

/**
 * Handle delivery events (bounce, open, click, spam report)
 */
export async function processEmailEvent({ event, email, messageId, campaignId }) {
  await connectToDatabase();
  const normalizedEmail = (email || '').toLowerCase().trim();

  const lead = await Lead.findOne({ email: normalizedEmail });
  if (!lead) return { processed: false, reason: 'lead_not_found' };

  if (event === 'bounce' || event === 'dropped') {
    lead.suppression = {
      email: true,
      phone: lead.suppression?.phone || false,
      sms: lead.suppression?.sms || false,
      reason: 'bounced',
      suppressedAt: new Date(),
    };
    lead.status = 'NOT_INTERESTED';
    if (lead.emailSequence) {
      lead.emailSequence.status = 'stopped';
      lead.emailSequence.stopReason = 'bounced';
    }
    await lead.save();

    await ActivityLog.create({
      leadId: lead._id,
      action: 'EMAIL_BOUNCED',
      channel: 'email',
      direction: 'system',
      summary: `Email bounced for ${lead.email}`,
      timestamp: new Date(),
    });
  } else if (event === 'open') {
    lead.lastEngagedAt = new Date();
    await lead.save();

    await ActivityLog.create({
      leadId: lead._id,
      action: 'EMAIL_OPENED',
      channel: 'email',
      direction: 'inbound',
      summary: `Lead opened email`,
      timestamp: new Date(),
    });
  } else if (event === 'click') {
    lead.lastEngagedAt = new Date();
    await lead.save();

    await ActivityLog.create({
      leadId: lead._id,
      action: 'EMAIL_CLICKED',
      channel: 'email',
      direction: 'inbound',
      summary: `Lead clicked link in email`,
      timestamp: new Date(),
    });
  } else if (event === 'spamreport' || event === 'unsubscribe') {
    lead.suppression = {
      email: true,
      phone: lead.suppression?.phone || false,
      sms: lead.suppression?.sms || false,
      reason: 'unsubscribed',
      suppressedAt: new Date(),
    };
    lead.status = 'DO_NOT_CONTACT';
    if (lead.emailSequence) {
      lead.emailSequence.status = 'stopped';
      lead.emailSequence.stopReason = 'unsubscribed';
    }
    await lead.save();

    await ActivityLog.create({
      leadId: lead._id,
      action: 'SUPPRESSION_UPDATED',
      channel: 'email',
      direction: 'inbound',
      summary: `Lead unsubscribed / reported spam`,
      timestamp: new Date(),
    });
  }

  return { processed: true, event };
}
