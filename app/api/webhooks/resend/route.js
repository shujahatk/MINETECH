import { NextResponse } from 'next/server.js';
import crypto from 'crypto';
import { supabaseAdmin } from '../../../../lib/supabase.js';
import { processInboundEmail } from '../../../../lib/services/inboundEmailService.js';

export const dynamic = 'force-dynamic';

/**
 * Verify Svix / Resend HMAC-SHA256 Webhook Signature
 */
function verifyResendSignature(payloadRaw, headers) {
  const secret = process.env.RESEND_WEBHOOK_SECRET || process.env.SVIX_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      return false;
    }
    return true;
  }

  const svixId = headers.get('svix-id') || headers.get('resend-id');
  const svixTimestamp = headers.get('svix-timestamp') || headers.get('resend-timestamp');
  const svixSignature = headers.get('svix-signature') || headers.get('resend-signature');

  if (!svixId || !svixTimestamp || !svixSignature) {
    return false;
  }

  const timestampNum = parseInt(svixTimestamp, 10);
  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - timestampNum) > 300) {
    return false;
  }

  const toSign = `${svixId}.${svixTimestamp}.${payloadRaw}`;
  const secretClean = secret.startsWith('whsec_') ? secret.substring(6) : secret;
  const secretBuffer = Buffer.from(secretClean, 'base64');

  const expectedSignature = crypto
    .createHmac('sha256', secretBuffer.length > 0 ? secretBuffer : secret)
    .update(toSign)
    .digest('base64');

  const signatures = svixSignature.split(' ').map((s) => s.replace(/^v1,/, ''));
  return signatures.some((sig) => {
    try {
      return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSignature));
    } catch {
      return false;
    }
  });
}

/**
 * Atomic helper to increment campaign stats safely in PostgreSQL
 */
async function atomicIncrementCampaignStat(campaignId, fieldName) {
  if (!campaignId) return;
  try {
    const { error } = await supabaseAdmin.rpc('increment_campaign_stat', {
      p_blast_id: campaignId,
      p_field: fieldName,
    });
    if (!error) return;
  } catch (e) {}

  const { data: camp } = await supabaseAdmin
    .from('email_campaigns')
    .select('stats')
    .eq('id', campaignId)
    .maybeSingle();

  const currentStats = camp?.stats || {};
  const updatedValue = (Number(currentStats[fieldName]) || 0) + 1;
  await supabaseAdmin
    .from('email_campaigns')
    .update({
      stats: { ...currentStats, [fieldName]: updatedValue },
      updated_at: new Date().toISOString(),
    })
    .eq('id', campaignId);
}

/**
 * Core business processing for a parsed Resend webhook event
 */
export async function executeWebhookEventProcessing(eventType, data, eventUniqueKey) {
  const nowIso = new Date().toISOString();
  const recipientEmail = (data.to?.[0] || data.email || '').trim().toLowerCase();
  const messageId = data.email_id || data.id || data.message_id;

  // Inbound email received via Resend
  if (eventType.includes('received') || eventType.includes('inbound')) {
    const fromEmail = typeof data.from === 'string' ? data.from : (data.from?.email || data.from?.address || '');
    const toEmail = Array.isArray(data.to) ? data.to.join(', ') : (data.to || recipientEmail || '');
    const subject = data.subject || '(No Subject)';
    const text = data.text || '';
    const html = data.html || '';
    const inReplyTo = data.in_reply_to || data.inReplyTo || data.headers?.['in-reply-to'] || '';
    const references = data.references || data.headers?.['references'] || [];
    const msgId = messageId || data.message_id || data.headers?.['message-id'] || '';

    const inboundResult = await processInboundEmail({
      from: fromEmail,
      to: toEmail,
      subject,
      text,
      html,
      messageId: msgId,
      inReplyTo,
      references,
      headers: data.headers || {},
      providerMessageId: messageId,
    });

    return { processed: true, attributed: true, result: inboundResult };
  }

  // Outbound Delivery / Tracking Events
  let recipient = null;
  let emailMessage = null;

  if (messageId || recipientEmail) {
    let recData = null;

    if (messageId) {
      try {
        const { data: q1 } = await supabaseAdmin
          .from('email_recipients')
          .select('*')
          .filter('tokens->>resend_id', 'eq', messageId);
        if (q1 && q1.length > 0) recData = q1[0];
      } catch (e) {}

      if (!recData) {
        try {
          const { data: q2 } = await supabaseAdmin
            .from('email_recipients')
            .select('*')
            .eq('resend_id', messageId);
          if (q2 && q2.length > 0) recData = q2[0];
        } catch (e) {}
      }
    }

    if (!recData && recipientEmail) {
      try {
        const { data: q3 } = await supabaseAdmin
          .from('email_recipients')
          .select('*')
          .ilike('email', recipientEmail)
          .order('created_at', { ascending: false });

        if (q3 && q3.length > 0) {
          recData = q3.find((r) => r.tokens?.resend_id === messageId || r.resend_id === messageId) || q3[0];
        }
      } catch (e) {}
    }

    recipient = recData;

    if (messageId) {
      try {
        const { data: msgList } = await supabaseAdmin
          .from('email_messages')
          .select('*')
          .eq('resend_id', messageId);

        if (msgList && msgList.length > 0) {
          emailMessage = msgList[0];
        }
      } catch (e) {}
    }
  }

  // If outbound event cannot find local record yet, flag for reconciliation
  const isOutboundEvent =
    eventType.includes('delivered') ||
    eventType.includes('opened') ||
    eventType.includes('clicked') ||
    eventType.includes('bounced');

  if (isOutboundEvent && !recipient && !emailMessage) {
    return {
      processed: false,
      needsReconciliation: true,
      reason: `Message ID ${messageId || 'unknown'} not found locally yet`,
    };
  }

  // Process Events
  if (eventType.includes('delivered') || eventType.includes('email.delivered')) {
    if (recipient && recipient.status !== 'DELIVERED') {
      await supabaseAdmin
        .from('email_recipients')
        .update({ status: 'DELIVERED', updated_at: nowIso })
        .eq('id', recipient.id);

      if (recipient.campaign_id || recipient.blast_id) {
        await atomicIncrementCampaignStat(recipient.campaign_id || recipient.blast_id, 'delivered');
      }
    }
    if (emailMessage) {
      await supabaseAdmin
        .from('email_messages')
        .update({ status: 'delivered' })
        .eq('id', emailMessage.id);
    }
  } else if (eventType.includes('opened') || eventType.includes('email.opened')) {
    if (recipient) {
      const isFirstOpen = !recipient.opened_at;
      await supabaseAdmin
        .from('email_recipients')
        .update({ opened_at: recipient.opened_at || nowIso, updated_at: nowIso })
        .eq('id', recipient.id);

      if (isFirstOpen && (recipient.campaign_id || recipient.blast_id)) {
        await atomicIncrementCampaignStat(recipient.campaign_id || recipient.blast_id, 'opened');
      }
    }
    if (emailMessage) {
      await supabaseAdmin
        .from('email_messages')
        .update({ status: 'opened' })
        .eq('id', emailMessage.id);
    }
  } else if (eventType.includes('clicked') || eventType.includes('email.clicked')) {
    if (recipient) {
      const isFirstClick = !recipient.clicked_at;
      await supabaseAdmin
        .from('email_recipients')
        .update({ clicked_at: recipient.clicked_at || nowIso, updated_at: nowIso })
        .eq('id', recipient.id);

      if (isFirstClick && (recipient.campaign_id || recipient.blast_id)) {
        await atomicIncrementCampaignStat(recipient.campaign_id || recipient.blast_id, 'clicked');
      }
    }
    if (emailMessage) {
      await supabaseAdmin
        .from('email_messages')
        .update({ status: 'clicked' })
        .eq('id', emailMessage.id);
    }
  } else if (eventType.includes('bounced') || eventType.includes('bounce') || eventType.includes('email.bounced')) {
    if (recipient) {
      await supabaseAdmin
        .from('email_recipients')
        .update({ bounced_at: nowIso, status: 'FAILED', error_message: 'Email Bounced', updated_at: nowIso })
        .eq('id', recipient.id);

      if (recipient.campaign_id || recipient.blast_id) {
        await atomicIncrementCampaignStat(recipient.campaign_id || recipient.blast_id, 'bounced');
      }
    }
    if (emailMessage) {
      await supabaseAdmin
        .from('email_messages')
        .update({ status: 'bounced' })
        .eq('id', emailMessage.id);
    }

    if (recipientEmail) {
      await supabaseAdmin
        .from('leads')
        .update({
          is_dnc: true,
          dnc_reason: 'BOUNCED',
          status: 'DO_NOT_CONTACT',
          updated_at: nowIso,
        })
        .ilike('email', recipientEmail);
    }
  } else if (eventType.includes('delayed') || eventType.includes('delivery_delayed')) {
    if (recipient) {
      await supabaseAdmin
        .from('email_recipients')
        .update({ error_message: 'Delivery Delayed (Provider Retry)', updated_at: nowIso })
        .eq('id', recipient.id);
    }
  } else if (eventType.includes('complained') || eventType.includes('unsub')) {
    if (recipientEmail) {
      await supabaseAdmin
        .from('leads')
        .update({
          is_dnc: true,
          dnc_reason: 'UNSUBSCRIBED',
          status: 'DO_NOT_CONTACT',
          updated_at: nowIso,
        })
        .ilike('email', recipientEmail);
    }
  }

  return { processed: true, attributed: Boolean(recipient || emailMessage) };
}

export async function POST(request) {
  try {
    const rawBody = await request.text();
    const headers = request.headers;

    // 1. Cryptographic signature verification
    const isValid = verifyResendSignature(rawBody, headers);
    if (!isValid) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Invalid Resend webhook signature' },
        { status: 401 }
      );
    }

    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch (parseErr) {
      return NextResponse.json({ success: false, error: 'Malformed JSON payload' }, { status: 400 });
    }

    const eventType = (payload.type || payload.event || '').toLowerCase();
    const data = payload.data || payload;
    const svixId = headers.get('svix-id') || headers.get('resend-id');
    const messageId = data.email_id || data.id || data.message_id;
    const nowIso = new Date().toISOString();

    // 2. Deterministic Idempotency Key
    const eventUniqueKey = svixId || `${eventType}_${messageId || 'noid'}_${data.created_at || nowIso}`;

    // 3. Check existing event status in email_webhook_events or audit_logs
    let existingRecord = null;
    try {
      const { data: eventRow } = await supabaseAdmin
        .from('email_webhook_events')
        .select('*')
        .eq('event_id', eventUniqueKey)
        .maybeSingle();
      existingRecord = eventRow;
    } catch (e) {}

    let auditLog = null;
    try {
      const { data: logRow } = await supabaseAdmin
        .from('audit_logs')
        .select('*')
        .eq('action', 'EMAIL_WEBHOOK_EVENT')
        .eq('entity_id', eventUniqueKey)
        .maybeSingle();
      auditLog = logRow;
    } catch (e) {}

    const isProcessed =
      existingRecord?.status === 'processed' ||
      Boolean(existingRecord?.processed_at) ||
      existingRecord?.payload?._status === 'processed' ||
      auditLog?.details?.status === 'processed';

    // If already fully processed, short-circuit idempotently
    if (isProcessed) {
      return NextResponse.json({ success: true, duplicate: true, message: 'Event already processed' });
    }

    // Insert or update event row in email_webhook_events
    try {
      if (!existingRecord) {
        await supabaseAdmin.from('email_webhook_events').insert({
          event_id: eventUniqueKey,
          provider: 'resend',
          event_type: eventType,
          status: 'processing',
          payload: { ...payload, _status: 'processing' },
          retry_count: 0,
          created_at: nowIso,
        });
      } else {
        await supabaseAdmin
          .from('email_webhook_events')
          .update({
            status: 'processing',
            payload: { ...(existingRecord.payload || {}), ...payload, _status: 'processing' },
            retry_count: (existingRecord.retry_count || 0) + 1,
          })
          .eq('event_id', eventUniqueKey);
      }
    } catch (e) {}

    // 4. Execute Business Updates
    try {
      const execResult = await executeWebhookEventProcessing(eventType, data, eventUniqueKey);

      if (execResult.needsReconciliation) {
        try {
          await supabaseAdmin
            .from('email_webhook_events')
            .update({
              status: 'pending_reconciliation',
              payload: { ...payload, _status: 'pending_reconciliation' },
              last_error: execResult.reason,
            })
            .eq('event_id', eventUniqueKey);
        } catch (e) {}

        try {
          if (!auditLog) {
            await supabaseAdmin.from('audit_logs').insert({
              action: 'EMAIL_WEBHOOK_EVENT',
              entity_type: 'WEBHOOK',
              entity_id: eventUniqueKey,
              details: {
                eventType,
                messageId,
                payload,
                status: 'pending_reconciliation',
                last_error: execResult.reason,
              },
              created_at: nowIso,
            });
          } else {
            await supabaseAdmin
              .from('audit_logs')
              .update({
                details: {
                  ...(auditLog.details || {}),
                  eventType,
                  messageId,
                  payload,
                  status: 'pending_reconciliation',
                  last_error: execResult.reason,
                },
              })
              .eq('id', auditLog.id);
          }
        } catch (e) {}

        return NextResponse.json({
          success: true,
          reconciliation_queued: true,
          message: 'Webhook received and queued for reconciliation',
        });
      }

      // Mark successfully processed in database
      try {
        await supabaseAdmin
          .from('email_webhook_events')
          .update({
            status: 'processed',
            processed_at: nowIso,
            payload: { ...payload, _status: 'processed' },
            last_error: null,
          })
          .eq('event_id', eventUniqueKey);
      } catch (e) {}

      // Also record in audit_logs for historical audit
      try {
        if (!auditLog) {
          await supabaseAdmin.from('audit_logs').insert({
            action: 'EMAIL_WEBHOOK_EVENT',
            entity_type: 'WEBHOOK',
            entity_id: eventUniqueKey,
            details: {
              eventType,
              messageId,
              status: 'processed',
              attributed: execResult.attributed,
            },
            created_at: nowIso,
          });
        } else {
          await supabaseAdmin
            .from('audit_logs')
            .update({
              details: {
                ...(auditLog.details || {}),
                eventType,
                messageId,
                status: 'processed',
                attributed: execResult.attributed,
                processed_at: nowIso,
              },
            })
            .eq('id', auditLog.id);
        }
      } catch (e) {}

      return NextResponse.json({
        success: true,
        processed: eventType,
        attributed: execResult.attributed,
      });
    } catch (procErr) {
      console.error('[Resend Webhook Processing Error]:', procErr.message);

      try {
        await supabaseAdmin
          .from('email_webhook_events')
          .update({
            status: 'failed',
            payload: { ...payload, _status: 'failed' },
            last_error: procErr.message,
          })
          .eq('event_id', eventUniqueKey);
      } catch (e) {}

      try {
        if (!auditLog) {
          await supabaseAdmin.from('audit_logs').insert({
            action: 'EMAIL_WEBHOOK_EVENT',
            entity_type: 'WEBHOOK',
            entity_id: eventUniqueKey,
            details: {
              eventType,
              messageId,
              payload,
              status: 'failed',
              last_error: procErr.message,
            },
            created_at: nowIso,
          });
        } else {
          await supabaseAdmin
            .from('audit_logs')
            .update({
              details: {
                ...(auditLog.details || {}),
                status: 'failed',
                last_error: procErr.message,
              },
            })
            .eq('id', auditLog.id);
        }
      } catch (e) {}

      return NextResponse.json(
        { success: false, error: 'Processing error, marked for retry: ' + procErr.message },
        { status: 500 }
      );
    }
  } catch (err) {
    console.error('[Resend Webhook Handler Fatal Error]:', err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/**
 * Reconciliation function to retry pending or failed webhooks
 */
export async function retryUnprocessedWebhooks() {
  let pendingEvents = [];

  // Try from email_webhook_events table
  try {
    const { data } = await supabaseAdmin
      .from('email_webhook_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (data && data.length > 0) {
      pendingEvents = data.filter(
        (ev) =>
          ev.status === 'pending_reconciliation' ||
          ev.status === 'failed' ||
          ev.status === 'received' ||
          ev.payload?._status === 'pending_reconciliation' ||
          (!ev.processed_at && ev.status !== 'processed' && ev.payload?._status !== 'processed')
      );
    }
  } catch (e) {}

  // Also check audit_logs fallback
  try {
    const { data: auditLogs } = await supabaseAdmin
      .from('audit_logs')
      .select('*')
      .eq('action', 'EMAIL_WEBHOOK_EVENT')
      .order('created_at', { ascending: false })
      .limit(100);

    if (auditLogs && auditLogs.length > 0) {
      for (const log of auditLogs) {
        const det = log.details || {};
        if (
          det.status === 'pending_reconciliation' ||
          det.status === 'failed' ||
          det.status === 'received'
        ) {
          const alreadyInList = pendingEvents.some(
            (e) => (e.event_id || e.id) === (log.entity_id || log.id)
          );
          if (!alreadyInList) {
            pendingEvents.push({
              id: log.id,
              event_id: log.entity_id,
              event_type: det.eventType || det.payload?.type,
              payload: det.payload || det,
              source: 'audit_logs',
            });
          }
        }
      }
    }
  } catch (e) {}

  if (!pendingEvents || pendingEvents.length === 0) {
    return { reconciled: 0 };
  }

  let reconciled = 0;
  for (const event of pendingEvents) {
    try {
      const payload = event.payload || {};
      const data = payload.data || payload;
      const res = await executeWebhookEventProcessing(event.event_type || payload.type, data, event.event_id);

      if (res.processed && !res.needsReconciliation) {
        const nowIso = new Date().toISOString();
        try {
          await supabaseAdmin
            .from('email_webhook_events')
            .update({
              status: 'processed',
              processed_at: nowIso,
              payload: { ...payload, _status: 'processed' },
              last_error: null,
            })
            .eq('event_id', event.event_id || event.id);
        } catch (e) {}

        try {
          await supabaseAdmin
            .from('audit_logs')
            .update({
              details: {
                ...(event.payload || {}),
                status: 'processed',
                processed_at: nowIso,
                last_error: null,
              },
            })
            .eq('action', 'EMAIL_WEBHOOK_EVENT')
            .eq('entity_id', event.event_id || event.id);
        } catch (e) {}

        reconciled++;
      }
    } catch (e) {
      try {
        await supabaseAdmin
          .from('email_webhook_events')
          .update({
            retry_count: (event.retry_count || 0) + 1,
            last_error: e.message,
          })
          .eq('event_id', event.event_id || event.id);
      } catch (err) {}
    }
  }

  return { reconciled };
}

