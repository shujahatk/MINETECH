import { supabaseAdmin } from '../supabase.js';
import crypto from 'crypto';
import { ensureMineTechSignatureHtml, ensureMineTechSignatureText } from '../utils/signature.js';
import { syncOutboundEmailToGmailSent } from './gmailSyncService.js';

// Centralized Server-Side Outbound Email Configuration
export function getEmailConfig() {
  const from = (process.env.EMAIL_FROM || process.env.RESEND_FROM_EMAIL || process.env.DEFAULT_FROM_EMAIL || 'rauf@mine-tech.be').trim();
  const fromName = (process.env.EMAIL_FROM_NAME || 'Rauf').trim();
  const replyTo = (process.env.REPLY_TO || from).trim();
  const apiKey = (process.env.RESEND_API_KEY || '').trim();
  const webhookSecret = (process.env.RESEND_WEBHOOK_SECRET || process.env.SVIX_SECRET || '').trim();

  return {
    from,
    fromName,
    replyTo,
    apiKey,
    webhookSecret,
    rateLimitPerMinute: parseInt(process.env.EMAIL_RATE_LIMIT_PER_MINUTE || '60', 10),
    rateLimitPerHour: parseInt(process.env.EMAIL_RATE_LIMIT_PER_HOUR || '500', 10),
    maxRetries: 3,
  };
}

export const EMAIL_CONFIG = {
  get DEFAULT_FROM() { return getEmailConfig().from; },
  get DEFAULT_FROM_NAME() { return getEmailConfig().fromName; },
  get DEFAULT_REPLY_TO() { return getEmailConfig().replyTo; },
  get RATE_LIMIT_PER_MINUTE() { return getEmailConfig().rateLimitPerMinute; },
  get RATE_LIMIT_PER_HOUR() { return getEmailConfig().rateLimitPerHour; },
  MAX_RETRIES: 3,
};

/**
 * Basic Email validation helper
 */
export function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email.trim());
}

/**
 * Validates server-side sender and reply-to configuration
 */
export function validateSenderConfig({ senderEmail, replyToEmail } = {}) {
  const from = (senderEmail || getEmailConfig().from || '').trim();
  const reply = (replyToEmail || getEmailConfig().replyTo || from).trim();

  if (!from || !isValidEmail(from)) {
    return {
      valid: false,
      error: `Invalid or missing sender email address: "${from}". Expected a valid email address such as rauf@mine-tech.be (configured via EMAIL_FROM).`,
      code: 'INVALID_SENDER_EMAIL',
    };
  }

  const domain = from.split('@')[1]?.toLowerCase();
  if (domain === 'minetech.be') {
    return {
      valid: false,
      error: `Configured sender domain 'minetech.be' is not verified in Resend. The verified domain in Resend is 'mine-tech.be' (with a hyphen). Update EMAIL_FROM to rauf@mine-tech.be in Vercel.`,
      code: 'UNAUTHORIZED_SENDER_DOMAIN',
    };
  }

  if (reply && !isValidEmail(reply)) {
    return {
      valid: false,
      error: `Invalid reply-to email address: "${reply}". Check REPLY_TO environment variable.`,
      code: 'INVALID_REPLY_TO',
    };
  }

  return {
    valid: true,
    domain: domain || 'mine-tech.be',
    senderEmail: from,
    replyToEmail: reply,
  };
}

/**
 * Classifies if an error is transient (can be retried) vs permanent
 */
export function isTransientError(error) {
  const msg = (error?.message || '').toLowerCase();
  return (
    msg.includes('rate limit') ||
    msg.includes('429') ||
    msg.includes('timeout') ||
    msg.includes('econnreset') ||
    msg.includes('etimedout') ||
    msg.includes('503') ||
    msg.includes('502')
  );
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
 * Dispatch outbound email via Resend API with retry backoff
 */
async function dispatchViaResend({
  senderEmail,
  senderName,
  replyToEmail,
  recipientEmail,
  cc = [],
  bcc = [],
  subject,
  html,
  text,
  attachments = [],
  generatedMessageId,
  inReplyTo = null,
  references = null,
}) {
  const config = getEmailConfig();
  const apiKey = config.apiKey;
  if (!apiKey || !apiKey.startsWith('re_')) {
    if (process.env.NODE_ENV === 'production') {
      const err = new Error('FATAL: RESEND_API_KEY environment variable is not defined or invalid (must start with "re_"). Configure RESEND_API_KEY in Vercel project settings and redeploy.');
      err.code = 'MISSING_API_KEY';
      throw err;
    }
    // Isolated local simulation mock only when running in non-production AND explicitly without key
    const mockId = `mock-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    console.log(`[EmailService (Simulation)] Dispatched email to ${recipientEmail} | Subject: "${subject}"`);
    return { providerMessageId: mockId, status: 'sent', accepted: true };
  }

  const headersPayload = {
    'Message-ID': generatedMessageId,
    'X-MineTech-Sender': senderEmail,
  };

  if (inReplyTo) {
    headersPayload['In-Reply-To'] = Array.isArray(inReplyTo) ? inReplyTo[0] : String(inReplyTo);
  }

  const formattedReferences = references
    ? (Array.isArray(references) ? references.filter(Boolean).map(String).join(' ') : String(references))
    : (inReplyTo ? (Array.isArray(inReplyTo) ? inReplyTo[0] : String(inReplyTo)) : null);

  if (formattedReferences) {
    headersPayload['References'] = formattedReferences;
  }

  const payload = {
    from: senderName ? `${senderName} <${senderEmail}>` : senderEmail,
    to: [recipientEmail],
    reply_to: replyToEmail || senderEmail,
    subject,
    html,
    text,
    headers: headersPayload,
  };

  if (cc && cc.length > 0) payload.cc = Array.isArray(cc) ? cc : [cc];
  if (bcc && bcc.length > 0) payload.bcc = Array.isArray(bcc) ? bcc : [bcc];
  if (attachments && attachments.length > 0) payload.attachments = attachments;

  let lastError = null;
  for (let attempt = 0; attempt < EMAIL_CONFIG.MAX_RETRIES; attempt++) {
    try {
      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!resendRes.ok) {
        const errJson = await resendRes.json().catch(() => ({}));
        let errMessage = errJson.message || `Resend API error (HTTP ${resendRes.status})`;
        let errCode = 'RESEND_API_ERROR';

        if (resendRes.status === 403) {
          errCode = 'UNAUTHORIZED_SENDER_DOMAIN';
          errMessage = `Resend 403 Forbidden: ${errMessage}. Verify that the domain '${senderEmail.split('@')[1]}' is registered, verified, and sending is enabled in your Resend account.`;
        } else if (resendRes.status === 401) {
          errCode = 'INVALID_API_KEY';
          errMessage = 'Resend 401 Unauthorized: Invalid API key. Verify RESEND_API_KEY in Vercel environment variables.';
        } else if (resendRes.status === 422) {
          errCode = 'VALIDATION_ERROR';
          errMessage = `Resend 422 Invalid Input: ${errMessage === 'expected ""' ? 'Header format mismatch (expected string)' : errMessage}`;
        }

        const error = new Error(errMessage);
        error.code = errCode;
        error.statusCode = resendRes.status;
        throw error;
      }

      const resendData = await resendRes.json();
      return {
        providerMessageId: resendData.id || generatedMessageId,
        status: 'sent',
        accepted: true,
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
          return { providerMessageId: `resend-${Date.now()}`, status: 'sent', accepted: true };
        }
        throw err;
      }
    }
  }

  throw lastError || new Error('Failed to send email via Resend after retries');
}

/**
 * Send an individual or campaign email to a lead with thread tracking, DNC enforcement, and Gmail sync
 */
export async function sendLeadEmail(firstArg, secondArg = {}) {
  const opts = (typeof firstArg === 'object' && firstArg !== null && !Array.isArray(firstArg))
    ? firstArg
    : { leadId: firstArg, ...secondArg };

  const {
    leadId,
    subject,
    cc = [],
    bcc = [],
    replyTo = null,
    attachments = [],
    threadId = null,
    inboxId = null,
    campaignId = null,
    inReplyTo = null,
    references = null,
    userId = null,
  } = opts;

  const bodyHtml = opts.bodyHtml || opts.body || '';
  const bodyText = opts.bodyText || opts.text || (typeof bodyHtml === 'string' ? bodyHtml.replace(/<[^>]*>/g, '') : '');

  try {
    // 1. Fetch Lead from Supabase
    const { data: lead, error: leadErr } = await supabaseAdmin
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .single();

    if (!lead || leadErr) {
      return { success: false, error: 'Lead not found in Supabase CRM', code: 'LEAD_NOT_FOUND' };
    }

    const targetEmail = opts.to || lead.email;
    if (!targetEmail || !isValidEmail(targetEmail)) {
      return { success: false, error: `Invalid recipient email address: "${targetEmail || ''}"`, code: 'INVALID_RECIPIENT' };
    }

    // Pre-flight DNC verification
    if (lead.is_dnc || lead.status === 'DO_NOT_CONTACT' || lead.status === 'DNC') {
      return { success: false, error: 'Email channel is suppressed for this lead (DNC / Opt-Out Policy)', code: 'DNC_SUPPRESSED' };
    }

    // Anti-duplicate protection: prevent repeated double-click dispatch within 8 seconds
    const duplicateKey = `${lead.id}:${subject}:${targetEmail}`;
    const nowMs = Date.now();
    if (global._recentOutboundCache && global._recentOutboundCache.has(duplicateKey)) {
      const prevMs = global._recentOutboundCache.get(duplicateKey);
      if (nowMs - prevMs < 8000) {
        return {
          success: false,
          error: 'Duplicate outbound email send prevented. Please wait before re-sending.',
          code: 'DUPLICATE_SEND_PREVENTED',
        };
      }
    }
    if (!global._recentOutboundCache) {
      global._recentOutboundCache = new Map();
    }
    global._recentOutboundCache.set(duplicateKey, nowMs);
    // Auto-clean old entries from cache
    if (global._recentOutboundCache.size > 500) {
      for (const [k, v] of global._recentOutboundCache.entries()) {
        if (nowMs - v > 60000) global._recentOutboundCache.delete(k);
      }
    }

    // Determine sender inbox & verified MineTech domain
    const senderEmail = (opts.from || opts.senderEmail || process.env.EMAIL_FROM || EMAIL_CONFIG.DEFAULT_FROM).trim();
    const senderName = (opts.fromName || opts.senderName || process.env.EMAIL_FROM_NAME || EMAIL_CONFIG.DEFAULT_FROM_NAME).trim();
    const replyToEmail = (replyTo || opts.replyTo || process.env.REPLY_TO || EMAIL_CONFIG.DEFAULT_REPLY_TO).trim();

    // Pre-flight Sender & Domain Configuration Validation
    const senderValidation = validateSenderConfig({ senderEmail, replyToEmail });
    if (!senderValidation.valid) {
      return {
        success: false,
        error: senderValidation.error,
        code: senderValidation.code,
      };
    }

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
      recipientEmail: targetEmail,
      cc,
      bcc,
      subject: personalizedSubject,
      html: personalizedHtml,
      text: personalizedText,
      attachments,
      generatedMessageId,
      inReplyTo,
      references,
    });

  const nowIso = new Date().toISOString();

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
          last_message_at: nowIso,
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
          last_message_at: nowIso,
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
        last_message_at: nowIso,
        snippet: personalizedText.substring(0, 150),
      })
      .eq('id', activeThreadId);
  }

  // 4. Create EmailMessage in Supabase with providerMessageId and headers
  const insertPayload = {
    thread_id: activeThreadId,
    lead_id: lead.id,
    direction: 'outbound',
    sender: senderName ? `${senderName} <${senderEmail}>` : senderEmail,
    recipient: lead.email,
    subject: personalizedSubject,
    body_html: personalizedHtml,
    body_plain: personalizedText,
    resend_id: providerMessageId || '',
    message_id: generatedMessageId,
    in_reply_to: inReplyTo || null,
    status: sendStatus || 'sent',
    sent_at: nowIso,
  };

  if (cc && cc.length > 0) insertPayload.cc = Array.isArray(cc) ? cc : [cc];
  if (bcc && bcc.length > 0) insertPayload.bcc = Array.isArray(bcc) ? bcc : [bcc];
  if (references) insertPayload.references = Array.isArray(references) ? references : [references];
  if (attachments && attachments.length > 0) insertPayload.attachments = attachments;

  let emailMessage = null;
  try {
    const { data: createdMsg, error: insertErr } = await supabaseAdmin
      .from('email_messages')
      .insert(insertPayload)
      .select()
      .single();

    if (insertErr) {
      // Fallback for unmigrated schema: retry with basic columns only
      console.warn('[EmailService] Inserting message with fallback columns:', insertErr.message);
      const fallbackPayload = {
        thread_id: activeThreadId,
        lead_id: lead.id,
        direction: 'outbound',
        sender: senderEmail,
        recipient: lead.email,
        subject: personalizedSubject,
        body_html: personalizedHtml,
        body_plain: personalizedText,
        resend_id: providerMessageId || generatedMessageId,
        status: sendStatus || 'sent',
        sent_at: nowIso,
      };
      const { data: fbMsg } = await supabaseAdmin
        .from('email_messages')
        .insert(fallbackPayload)
        .select()
        .single();
      emailMessage = fbMsg;
    } else {
      emailMessage = createdMsg;
    }
  } catch (dbErr) {
    console.error('[EmailService] Error persisting email_message to Supabase:', dbErr.message);
  }

  // If part of a campaign blast, associate resend_id on email_recipients
  if (campaignId) {
    try {
      await supabaseAdmin
        .from('email_recipients')
        .update({
          resend_id: providerMessageId || '',
          updated_at: nowIso,
        })
        .eq('campaign_id', campaignId)
        .eq('lead_id', lead.id);
    } catch (e) {}
  }

  // 5. Update Lead Record in Supabase
  const updatedStatus = lead.status === 'NEW' ? 'CONTACTED' : lead.status;
  await supabaseAdmin
    .from('leads')
    .update({
      status: updatedStatus,
      updated_at: nowIso,
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
      rfcMessageId: generatedMessageId,
    },
  });

  // 7. Synchronize outbound sent copy into Gmail's Sent folder
  let gmailSyncResult = null;
  try {
    gmailSyncResult = await syncOutboundEmailToGmailSent({
      messageId: generatedMessageId,
      sender: senderName ? `${senderName} <${senderEmail}>` : senderEmail,
      recipient: lead.email,
      subject: personalizedSubject,
      bodyHtml: personalizedHtml,
      bodyText: personalizedText,
      inReplyTo,
      references,
      dbMessageId: emailMessage?.id,
    });
  } catch (gmailErr) {
    console.warn('[EmailService] Gmail Sent folder sync warning:', gmailErr.message);
  }

  return {
    success: true,
    messageId: emailMessage?.id,
    threadId: activeThreadId,
    providerMessageId,
    resendId: providerMessageId,
    rfcMessageId: generatedMessageId,
    from: senderName ? `${senderName} <${senderEmail}>` : senderEmail,
    source: dispatchSource,
    isBlast: isBlastEmail,
    gmailSync: gmailSyncResult,
  };
} catch (err) {
  console.error('[EmailService] sendLeadEmail failed:', err.message);
  return {
    success: false,
    error: err.message,
    code: err.code || 'SEND_ERROR',
  };
}
}

export default {
  sendLeadEmail,
  interpolateMergeFields,
  isTransientError,
  isValidEmail,
  validateSenderConfig,
  getEmailConfig,
  EMAIL_CONFIG,
};
