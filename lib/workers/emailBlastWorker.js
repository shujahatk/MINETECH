import { supabaseAdmin } from '../supabase.js';
import { sendLeadEmail, EMAIL_CONFIG, isTransientError } from '../services/emailService.js';
import {
  claimNextPendingRecipient,
  releaseRecipientLock,
  markRecipientSent,
  markRecipientPermanentFailure,
} from '../queue/claimRecipient.js';

export function getDynamicRateDelay() {
  const ratePerMin = EMAIL_CONFIG.RATE_LIMIT_PER_MINUTE || 60;
  return Math.max(50, Math.floor(60000 / ratePerMin));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Robust database-backed worker processing campaign recipients using Supabase atomic claiming
 *
 * @param {string} [campaignId] - Target campaign ID or global queue processor
 * @param {string} [workerId] - Identifier for this worker process
 */
export async function runEmailBlastWorker(campaignId = null, workerId = `worker-${Date.now()}`) {
  console.log(`[EmailBlastWorker] Starting blast worker ${workerId} for campaign: ${campaignId || 'ALL'}`);

  let isRunning = true;
  let processedCount = 0;

  // Pre-fetch campaign details if campaignId is provided
  let activeCampaign = null;
  if (campaignId) {
    const { data: campData } = await supabaseAdmin
      .from('email_campaigns')
      .select('*')
      .eq('id', campaignId)
      .maybeSingle();
    activeCampaign = campData;
  }

  while (isRunning) {
    try {
      // 1. Check if campaign was paused, cancelled, or completed
      if (campaignId) {
        const { data: currentCamp } = await supabaseAdmin
          .from('email_campaigns')
          .select('status')
          .eq('id', campaignId)
          .maybeSingle();

        const currentStatus = (currentCamp?.status || 'RUNNING').toUpperCase();
        if (currentStatus === 'PAUSED' || currentStatus === 'CANCELLED' || currentStatus === 'DRAFT' || currentStatus === 'COMPLETED') {
          console.log(`[EmailBlastWorker] Campaign is in state "${currentStatus}". Halting worker loop.`);
          break;
        }
      }

      // 2. Atomically claim next recipient (PostgreSQL safe single-worker lock)
      const recipient = await claimNextPendingRecipient(workerId, 5, campaignId);

      if (!recipient) {
        // No pending recipients left in queue for this worker
        break;
      }

      const recipientId = recipient.id || recipient._id;
      const leadId = recipient.lead_id || recipient.leadId;
      const targetEmail = (recipient.email || '').trim().toLowerCase();

      // 3. Fetch Lead from Supabase to check DNC / suppression
      let isSuppressed = false;
      let targetLead = null;

      if (leadId) {
        const { data: leadRecord } = await supabaseAdmin
          .from('leads')
          .select('*')
          .eq('id', leadId)
          .maybeSingle();

        targetLead = leadRecord;
        if (targetLead && (targetLead.is_dnc || targetLead.status === 'DO_NOT_CONTACT' || targetLead.status === 'DNC')) {
          isSuppressed = true;
        }
      }

      if (isSuppressed) {
        console.log(`[EmailBlastWorker] Recipient ${targetEmail} is on DNC/suppression list. Marking permanent failure.`);
        await markRecipientPermanentFailure(recipientId, 'Suppressed by DNC / Opt-out policy');
        continue;
      }

      // 4. Determine Subject and Body
      const emailSubject =
        recipient.generatedSubject ||
        recipient.tokens?.generated_subject ||
        activeCampaign?.subject ||
        'Outbound Update';

      const rawBody =
        recipient.generatedBody ||
        recipient.tokens?.generated_body ||
        activeCampaign?.body_html ||
        activeCampaign?.bodyHtml ||
        '<p>We are pleased to assist you with our outbound solutions.</p>';

      const emailHtml = rawBody.startsWith('<') ? rawBody : `<p>${rawBody.replace(/\n/g, '<br/>')}</p>`;
      const emailText = rawBody.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

      // 5. Attempt Email Dispatch
      try {
        let providerMessageId = null;

        if (leadId && targetLead) {
          const sendRes = await sendLeadEmail({
            leadId,
            subject: emailSubject,
            bodyHtml: emailHtml,
            bodyText: emailText,
            campaignId: recipient.campaign_id || recipient.campaignId || campaignId,
          });
          providerMessageId = sendRes?.providerMessageId || null;
        }

        // 6. Mark Recipient as Sent with Resend Message ID
        await markRecipientSent(recipientId, providerMessageId);
        processedCount++;

        // 7. Update Campaign Sent Stats in Supabase
        const targetCampId = recipient.campaign_id || recipient.campaignId || campaignId;
        if (targetCampId) {
          const { data: campDoc } = await supabaseAdmin
            .from('email_campaigns')
            .select('stats')
            .eq('id', targetCampId)
            .maybeSingle();

          const currentStats = campDoc?.stats || { sent: 0, delivered: 0, opened: 0, clicked: 0, replied: 0, bounced: 0, failed: 0 };
          const updatedStats = {
            ...currentStats,
            sent: (currentStats.sent || 0) + 1,
          };

          await supabaseAdmin
            .from('email_campaigns')
            .update({
              stats: updatedStats,
              updated_at: new Date().toISOString(),
            })
            .eq('id', targetCampId);
        }
      } catch (sendErr) {
        console.error(`[EmailBlastWorker] Dispatch failed for ${targetEmail}:`, sendErr.message);
        if (isTransientError(sendErr)) {
          await releaseRecipientLock(recipientId, sendErr.message);
        } else {
          await markRecipientPermanentFailure(recipientId, sendErr.message);
        }
      }

      await sleep(getDynamicRateDelay());
    } catch (loopErr) {
      console.error('[EmailBlastWorker] Error in worker iteration:', loopErr);
      await sleep(1000);
      break;
    }
  }

  // If campaignId was specified, check if all recipients are done, then mark COMPLETED
  if (campaignId) {
    const { count: pendingCount } = await supabaseAdmin
      .from('email_recipients')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaignId)
      .in('status', ['PENDING', 'pending', 'PROCESSING', 'processing']);

    if (pendingCount === 0) {
      await supabaseAdmin
        .from('email_campaigns')
        .update({
          status: 'COMPLETED',
          updated_at: new Date().toISOString(),
        })
        .eq('id', campaignId);
    }
  }

  console.log(`[EmailBlastWorker] Worker ${workerId} finished. Processed ${processedCount} blast emails.`);
  return { success: true, processedCount };
}

/**
 * Scan database for any RUNNING campaigns with pending recipients and resume processing
 */
export async function recoverAndProcessRunningCampaigns() {
  try {
    const { data: runningCampaigns } = await supabaseAdmin
      .from('email_campaigns')
      .select('id')
      .eq('status', 'RUNNING');

    if (runningCampaigns && runningCampaigns.length > 0) {
      console.log(`[EmailBlastWorker] Recovering ${runningCampaigns.length} running campaigns...`);
      for (const camp of runningCampaigns) {
        try {
          await runEmailBlastWorker(camp.id);
        } catch (err) {
          console.error(`[EmailBlastWorker] Recovery error for campaign ${camp.id}:`, err);
        }
      }
    }
  } catch (err) {
    console.error('[EmailBlastWorker] Recovery scan error:', err);
  }
}

export default { runEmailBlastWorker, recoverAndProcessRunningCampaigns };
