import sgMail from '@sendgrid/mail';
import { connectToDatabase } from '@/lib/db/mongoose';
import Lead from '@/lib/models/Lead';
import EmailThread from '@/lib/models/EmailThread';
import EmailMessage from '@/lib/models/EmailMessage';
import ActivityLog from '@/lib/models/ActivityLog';
import SendingInbox from '@/lib/models/SendingInbox';
import crypto from 'crypto';

/**
 * Interpolates template strings with lead fields and safe fallback defaults
 */
export function interpolateMergeFields(template, lead) {
  if (!template) return '';
  const firstName = lead.firstName || (lead.fullName ? lead.fullName.split(' ')[0] : '') || 'there';
  const lastName = lead.lastName || (lead.fullName && lead.fullName.split(' ').length > 1 ? lead.fullName.split(' ').slice(1).join(' ') : '') || '';
  const fullName = lead.fullName || `${firstName} ${lastName}`.trim() || 'there';
  const company = lead.company || 'your team';
  const jobTitle = lead.jobTitle || 'Executive';
  const website = lead.website || '';

  return template
    .replace(/\{\{\s*firstName\s*\}\}/gi, firstName)
    .replace(/\{\{\s*lastName\s*\}\}/gi, lastName)
    .replace(/\{\{\s*fullName\s*\}\}/gi, fullName)
    .replace(/\{\{\s*name\s*\}\}/gi, firstName)
    .replace(/\{\{\s*company\s*\}\}/gi, company)
    .replace(/\{\{\s*jobTitle\s*\}\}/gi, jobTitle)
    .replace(/\{\{\s*title\s*\}\}/gi, jobTitle)
    .replace(/\{\{\s*website\s*\}\}/gi, website)
    // Clean up any unhandled merge fields safely
    .replace(/\{\{\s*[\w.-]+\s*\}\}/g, '');
}

/**
 * Send an individual email to a lead with thread tracking and activity logging
 */
export async function sendLeadEmail({
  leadId,
  subject,
  bodyHtml,
  bodyText,
  threadId = null,
  inboxId = null,
  campaignId = null,
  inReplyTo = null,
}) {
  await connectToDatabase();

  const lead = await Lead.findById(leadId);
  if (!lead) {
    throw new Error('Lead not found');
  }

  if (!lead.email) {
    throw new Error('Lead has no valid email address');
  }

  if (lead.suppression?.email) {
    throw new Error('Email channel is suppressed for this lead (DNC / Opt-Out)');
  }

  // Determine sender inbox
  let senderEmail = process.env.EMAIL_FROM || 'outreach@8020aquisition.com';
  let senderName = process.env.EMAIL_FROM_NAME || 'Outbound Sales';
  let replyToEmail = process.env.REPLY_TO || senderEmail;

  if (inboxId) {
    const inbox = await SendingInbox.findById(inboxId);
    if (inbox && inbox.active) {
      senderEmail = inbox.fromEmail;
      senderName = inbox.fromName || senderName;
      replyToEmail = inbox.replyTo || senderEmail;
    }
  }

  // Merge template tags
  const personalizedSubject = interpolateMergeFields(subject, lead);
  const personalizedHtml = interpolateMergeFields(bodyHtml, lead);
  const personalizedText = bodyText ? interpolateMergeFields(bodyText, lead) : personalizedHtml.replace(/<[^>]*>?/gm, '');

  const generatedMessageId = `<${crypto.randomUUID()}@${senderEmail.split('@')[1] || '8020aquisition.com'}>`;

  let providerMessageId = '';
  let sendStatus = 'sent';

  if (process.env.RESEND_API_KEY && process.env.RESEND_API_KEY.startsWith('re_')) {
    try {
      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: senderName ? `${senderName} <${senderEmail}>` : senderEmail,
          to: [lead.email],
          reply_to: replyToEmail,
          subject: personalizedSubject,
          html: personalizedHtml,
          text: personalizedText,
          headers: {
            'Message-ID': generatedMessageId,
            ...(inReplyTo ? { 'In-Reply-To': inReplyTo, References: inReplyTo } : {}),
          },
        }),
      });

      if (!resendRes.ok) {
        const errJson = await resendRes.json().catch(() => ({}));
        throw new Error(errJson.message || `Resend API error (HTTP ${resendRes.status})`);
      }

      const resendData = await resendRes.json();
      providerMessageId = resendData.id || generatedMessageId;
    } catch (sendErr) {
      console.error('[EmailService] Resend error:', sendErr.message);
      throw new Error(`Failed to send email via Resend provider: ${sendErr.message}`);
    }
  } else if (process.env.SENDGRID_API_KEY && process.env.SENDGRID_API_KEY.startsWith('SG.')) {
    try {
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);
      const msg = {
        to: { email: lead.email, name: lead.fullName || lead.firstName },
        from: { email: senderEmail, name: senderName },
        replyTo: { email: replyToEmail, name: senderName },
        subject: personalizedSubject,
        html: personalizedHtml,
        text: personalizedText,
        headers: {
          'Message-ID': generatedMessageId,
          ...(inReplyTo ? { 'In-Reply-To': inReplyTo, References: inReplyTo } : {}),
        },
        customArgs: {
          leadId: lead._id.toString(),
          ...(campaignId ? { campaignId: campaignId.toString() } : {}),
        },
      };

      const [response] = await sgMail.send(msg);
      providerMessageId = response.headers['x-message-id'] || generatedMessageId;
    } catch (sendErr) {
      console.error('[EmailService] SendGrid error:', sendErr.response?.body || sendErr.message);
      throw new Error(`Failed to send email via provider: ${sendErr.message}`);
    }
  } else {
    // Development simulation mode
    providerMessageId = `mock-${Date.now()}-${generatedMessageId}`;
    console.log(`[EmailService] (Dev Mode) Sent mock email to ${lead.email} | Subject: "${personalizedSubject}"`);
  }

  // 1. Find or create EmailThread
  let thread = null;
  if (threadId) {
    thread = await EmailThread.findById(threadId);
  }

  if (!thread) {
    thread = await EmailThread.create({
      leadId: lead._id,
      subject: personalizedSubject,
      participants: [
        { email: senderEmail, name: senderName },
        { email: lead.email, name: lead.fullName || lead.firstName },
      ],
      snippet: personalizedText.substring(0, 150),
      lastMessageAt: new Date(),
      lastMessageDirection: 'outbound',
      unread: false,
      status: 'active',
      campaignId: campaignId || null,
      messageCount: 1,
    });
  } else {
    thread.lastMessageAt = new Date();
    thread.lastMessageDirection = 'outbound';
    thread.snippet = personalizedText.substring(0, 150);
    thread.messageCount = (thread.messageCount || 1) + 1;
    await thread.save();
  }

  // 2. Create EmailMessage
  const emailMessage = await EmailMessage.create({
    threadId: thread._id,
    leadId: lead._id,
    direction: 'outbound',
    from: { email: senderEmail, name: senderName },
    to: [{ email: lead.email, name: lead.fullName || lead.firstName }],
    replyTo: replyToEmail,
    subject: personalizedSubject,
    bodyHtml: personalizedHtml,
    bodyText: personalizedText,
    messageId: generatedMessageId,
    inReplyTo: inReplyTo || '',
    providerMessageId,
    status: sendStatus,
    campaignId: campaignId || null,
    sentAt: new Date(),
  });

  // 3. Update Lead Record
  lead.lastContactedAt = new Date();
  if (lead.status === 'NEW') {
    lead.status = 'CONTACTED';
  }
  await lead.save();

  // 4. Record Activity Log
  await ActivityLog.create({
    leadId: lead._id,
    action: 'EMAIL_SENT',
    channel: 'email',
    direction: 'outbound',
    summary: `Sent email: "${personalizedSubject}"`,
    details: {
      messageId: generatedMessageId,
      threadId: thread._id,
      to: lead.email,
      campaignId: campaignId || null,
    },
    timestamp: new Date(),
  });

  return {
    success: true,
    messageId: emailMessage._id,
    threadId: thread._id,
    providerMessageId,
  };
}
