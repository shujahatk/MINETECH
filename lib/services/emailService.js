import { supabaseAdmin } from '../supabase.js';
import crypto from 'crypto';
import { ensureMineTechSignatureHtml, ensureMineTechSignatureText } from '../utils/signature.js';

// Configurable Rate Limit and Retry Constants
export const EMAIL_CONFIG = {
  DEFAULT_FROM: process.env.EMAIL_FROM || 'outreach@minetechresources.com',
  DEFAULT_FROM_NAME: process.env.EMAIL_FROM_NAME || 'MineTech Outbound',
  DEFAULT_REPLY_TO: process.env.REPLY_TO || 'abdullah@mine-tech.be',
  RATE_LIMIT_PER_MINUTE: parseInt(process.env.EMAIL_RATE_LIMIT_PER_MINUTE || '60', 10),
  RATE_LIMIT_PER_HOUR: parseInt(process.env.EMAIL_RATE_LIMIT_PER_HOUR || '500', 10),
  MAX_RETRIES: 3,
};

/**
 * Classifies if an error is transient (can be retried) vs permanent
 */
export function isTransientError(error) {
  const msg = (error?.message || '').toLowerCase();
  if (
    msg.includes('rate limit') ||
    msg.includes('429') ||
    msg.includes('timeout') ||
    msg.includes('econnreset') ||
    msg.includes('etimedout') ||
    msg.includes('503') ||
    msg.includes('502')
  ) {
    return true;
  }
  return false;
}

/**
 * Sleep helper for exponential backoff with jitter
 */
function waitWithJitter(attempt) {
  const baseMs = 400 * Math.pow(2, attempt);
  const jitter = Math.random() * 200;
  return new Promise((resolve) => setTimeout(resolve, baseMs + jitter));
}

/**
 * Interpolates template strings with lead fields and safe fallback defaults
 */
export function interpolateMergeFields(template, lead) {
  if (!template) return '';
  const firstName =
    lead.firstName ||
    lead.first_name ||
    (lead.fullName ? lead.fullName.split(' ')[0] : '') ||
    (lead.full_name ? lead.full_name.split(' ')[0] : '') ||
    'there';
  const lastName = lead.lastName || lead.last_name || '';
  const fullName = lead.fullName || lead.full_name || `${firstName} ${lastName}`.trim() || 'there';
  const company = lead.company || 'your team';
  const jobTitle = lead.jobTitle || lead.job_title || 'Executive';
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
    .replace(/\{\{\s*[\w.-]+\s*\}\}/g, '');
}

/**
 * Dispatch outbound email exclusively via Resend API with retry backoff
 */
async function dispatchViaResend({
  senderEmail,
  senderName,
  replyToEmail,
  recipientEmail,
  subject,
  html,
  text,
  generatedMessageId,
  inReplyTo = null,
  references = null,
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !apiKey.startsWith('re_')) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FATAL: RESEND_API_KEY environment variable is not defined.');
    }
    // Isolated local testing mock
    const mockId = `mock-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    console.log(`[EmailService (Simulation)] Dispatched email to ${recipientEmail} | Subject: "${subject}"`);
    return { providerMessageId: mockId, status: 'sent' };
  }

  let lastError = null;
  for (let attempt = 0; attempt < EMAIL_CONFIG.MAX_RETRIES; attempt++) {
    try {
      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: senderName ? `${senderName} <${senderEmail}>` : senderEmail,
          to: [recipientEmail],
          reply_to: replyToEmail,
          subject,
          html,
          text,
          headers: {
            'Message-ID': generatedMessageId,
            ...(inReplyTo ? { 'In-Reply-To': inReplyTo, References: references || inReplyTo } : {}),
          },
        }),
      });

      if (!resendRes.ok) {
        const errJson = await resendRes.json().catch(() => ({}));
        const errMessage = errJson.message || `Resend API error (HTTP ${resendRes.status})`;
        throw new Error(errMessage);
      }

      const resendData = await resendRes.json();
      return {
        providerMessageId: resendData.id || generatedMessageId,
        status: 'sent',
      };
    } catch (err) {
      lastError = err;
      if (isTransientError(err) && attempt < EMAIL_CONFIG.MAX_RETRIES - 1) {
        console.warn(`[EmailService] Transient error sending to ${recipientEmail} (Attempt ${attempt + 1}): ${err.message}. Retrying...`);
        await waitWithJitter(attempt);
      } else {
        if (
          process.env.NODE_ENV !== 'production' &&
          (err.message.includes('only send testing emails') || err.message.includes('not verified'))
        ) {
          console.warn(`[EmailService] Sandbox Notice: ${err.message}. Storing sent message record in Supabase.`);
          return { providerMessageId: `resend-${Date.now()}`, status: 'sent' };
        }
        throw new Error(`Failed to send email via Resend: ${err.message}`);
      }
    }
  }

  throw lastError || new Error('Failed to send email via Resend after retries');
}

/**
 * Send an individual or campaign email to a lead with thread tracking, DNC enforcement, and activity logging
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
  references = null,
  userId = null,
}) {
  // 1. Fetch Lead from Supabase
  const { data: lead, error: leadErr } = await supabaseAdmin
    .from('leads')
    .select('*')
    .eq('id', leadId)
    .single();

  if (!lead || leadErr) {
    throw new Error('Lead not found in Supabase CRM');
  }

  if (!lead.email) {
    throw new Error('Lead has no valid email address');
  }

  // Pre-flight DNC verification
  if (lead.is_dnc || lead.status === 'DO_NOT_CONTACT' || lead.status === 'DNC') {
    throw new Error('Email channel is suppressed for this lead (DNC / Opt-Out Policy)');
  }

  // Determine sender inbox & verified MineTech domain
  const senderEmail = process.env.EMAIL_FROM || EMAIL_CONFIG.DEFAULT_FROM;
  const senderName = process.env.EMAIL_FROM_NAME || EMAIL_CONFIG.DEFAULT_FROM_NAME;
  const replyToEmail = process.env.REPLY_TO || EMAIL_CONFIG.DEFAULT_REPLY_TO;

  // Merge template tags
  const rawSubject = interpolateMergeFields(subject, lead);
  const rawHtml = interpolateMergeFields(bodyHtml, lead);
  const rawText = bodyText
    ? interpolateMergeFields(bodyText, lead)
    : rawHtml
    ? rawHtml.replace(/<[^>]*>?/gm, '')
    : '';

  // Guarantee mandatory brand signature on all outgoing emails
  const personalizedSubject = rawSubject;
  const personalizedHtml = rawHtml
    ? ensureMineTechSignatureHtml(rawHtml)
    : `<p>${ensureMineTechSignatureText(rawText).replace(/\n/g, '<br/>')}</p>`;
  const personalizedText = ensureMineTechSignatureText(rawText || personalizedHtml.replace(/<[^>]*>?/gm, ''));

  const domain = senderEmail.includes('@') ? senderEmail.split('@')[1] : 'mine-tech.be';
  const generatedMessageId = `<${crypto.randomUUID()}@${domain}>`;

  // 2. Dispatch via Resend API
  const { providerMessageId, status: sendStatus } = await dispatchViaResend({
    senderEmail,
    senderName,
    replyToEmail,
    recipientEmail: lead.email,
    subject: personalizedSubject,
    html: personalizedHtml,
    text: personalizedText,
    generatedMessageId,
    inReplyTo,
    references,
  });

  // 3. Find or create EmailThread in Supabase
  let activeThreadId = threadId;
  if (!activeThreadId) {
    const { data: existingThread } = await supabaseAdmin
      .from('email_threads')
      .select('id')
      .eq('lead_id', lead.id)
      .order('last_message_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingThread?.id) {
      activeThreadId = existingThread.id;
      await supabaseAdmin
        .from('email_threads')
        .update({
          subject: personalizedSubject,
          last_message_at: new Date().toISOString(),
          snippet: personalizedText.substring(0, 150),
          status: 'OPEN',
        })
        .eq('id', activeThreadId);
    } else {
      const { data: newThread } = await supabaseAdmin
        .from('email_threads')
        .insert({
          lead_id: lead.id,
          subject: personalizedSubject,
          snippet: personalizedText.substring(0, 150),
          last_message_at: new Date().toISOString(),
          status: 'OPEN',
          unread_count: 0,
        })
        .select()
        .single();
      activeThreadId = newThread?.id;
    }
  } else {
    await supabaseAdmin
      .from('email_threads')
      .update({
        last_message_at: new Date().toISOString(),
        snippet: personalizedText.substring(0, 150),
      })
      .eq('id', activeThreadId);
  }

  // 4. Create EmailMessage in Supabase with providerMessageId
  const { data: emailMessage } = await supabaseAdmin
    .from('email_messages')
    .insert({
      thread_id: activeThreadId,
      lead_id: lead.id,
      direction: 'outbound',
      sender: senderEmail,
      recipient: lead.email,
      subject: personalizedSubject,
      body_html: personalizedHtml,
      body_plain: personalizedText,
      resend_id: providerMessageId || '',
      status: sendStatus || 'sent',
      sent_at: new Date().toISOString(),
    })
    .select()
    .single();

  // If part of a campaign blast, associate resend_id on email_recipients
  if (campaignId) {
    await supabaseAdmin
      .from('email_recipients')
      .update({
        resend_id: providerMessageId || '',
        updated_at: new Date().toISOString(),
      })
      .eq('campaign_id', campaignId)
      .eq('lead_id', lead.id);
  }

  // 5. Update Lead Record in Supabase
  const updatedStatus = lead.status === 'NEW' ? 'CONTACTED' : lead.status;
  await supabaseAdmin
    .from('leads')
    .update({
      status: updatedStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', lead.id);

  // 6. Record Activity Log in Supabase
  const isBlastEmail = Boolean(campaignId);
  const dispatchSource = isBlastEmail ? 'blast' : inReplyTo ? 'reply' : 'individual_1to1';
  const dispatchLabel = isBlastEmail ? 'Campaign blast' : inReplyTo ? '1-to-1 reply' : '1-to-1 individual';

  await supabaseAdmin.from('activity_logs').insert({
    lead_id: lead.id,
    user_id: userId,
    type: isBlastEmail ? 'BLAST_EMAIL_SENT' : 'EMAIL_SENT',
    description: `${dispatchLabel} email dispatched to ${lead.full_name || lead.first_name || lead.email} (${lead.company || 'Direct'}): "${personalizedSubject}"`,
    metadata: {
      messageId: emailMessage?.id || generatedMessageId,
      threadId: activeThreadId,
      recipient: lead.email,
      subject: personalizedSubject,
      source: dispatchSource,
      campaignId: campaignId || null,
      isBlast: isBlastEmail,
      isIndividual: !isBlastEmail && !inReplyTo,
      resendId: providerMessageId,
    },
  });

  return {
    success: true,
    messageId: emailMessage?.id,
    threadId: activeThreadId,
    providerMessageId,
    source: dispatchSource,
    isBlast: isBlastEmail,
  };
}

export default {
  sendLeadEmail,
  interpolateMergeFields,
  isTransientError,
  EMAIL_CONFIG,
};
