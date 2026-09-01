import { connectToDatabase } from '@/lib/db/mongoose';
import EmailCampaign from '@/lib/models/EmailCampaign';
import EmailRecipient from '@/lib/models/EmailRecipient';
import Lead from '@/lib/models/Lead';
import { sendLeadEmail } from '@/lib/services/emailService';

const BATCH_SIZE = 10;
const DELAY_MS_BETWEEN_EMAILS = 250; // Smooth rate limit delay

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Idempotent background worker processing campaign recipients
 */
export async function runEmailBlastWorker(campaignId) {
  await connectToDatabase();

  console.log(`[CampaignWorker] Starting blast worker for campaign: ${campaignId}`);

  // Fetch campaign
  const campaign = await EmailCampaign.findById(campaignId);
  if (!campaign || campaign.status !== 'running') {
    console.log(`[CampaignWorker] Campaign ${campaignId} is not in running state. Aborting worker.`);
    return;
  }

  let hasMore = true;

  while (hasMore) {
    // Check if campaign was paused or cancelled by user in the meantime
    const currentCampaign = await EmailCampaign.findById(campaignId);
    if (!currentCampaign || currentCampaign.status !== 'running') {
      console.log(`[CampaignWorker] Campaign state changed to "${currentCampaign?.status}". Stopping worker loop.`);
      return;
    }

    // Fetch batch of pending or retried recipients
    const batch = await EmailRecipient.find({
      campaignId: campaign._id,
      status: { $in: ['pending', 'queued'] },
    })
      .limit(BATCH_SIZE)
      .lean();

    if (batch.length === 0) {
      hasMore = false;
      break;
    }

    for (const recipient of batch) {
      // Re-verify campaign is still running
      const liveCheck = await EmailCampaign.findById(campaignId).select('status');
      if (liveCheck.status !== 'running') {
        console.log(`[CampaignWorker] Campaign interrupted. Exiting.`);
        return;
      }

      // 1. Idempotently acquire lock on recipient
      const lockedRecipient = await EmailRecipient.findOneAndUpdate(
        { _id: recipient._id, status: recipient.status },
        { status: 'sending' },
        { new: true }
      );

      if (!lockedRecipient) {
        // Another worker loop already picked it up
        continue;
      }

      try {
        // 2. Perform Send
        const result = await sendLeadEmail({
          leadId: recipient.leadId,
          subject: campaign.subject,
          bodyHtml: campaign.bodyHtml,
          bodyText: campaign.bodyText,
          inboxId: campaign.inboxId,
          campaignId: campaign._id,
        });

        // 3. Mark sent
        await EmailRecipient.findByIdAndUpdate(recipient._id, {
          status: 'sent',
          providerMessageId: result.providerMessageId,
          sentAt: new Date(),
          error: '',
        });

        // 4. Update campaign stats
        await EmailCampaign.findByIdAndUpdate(campaign._id, {
          $inc: { 'stats.sent': 1 },
          lastWorkerRunAt: new Date(),
        });
      } catch (err) {
        console.error(`[CampaignWorker] Error sending to lead ${recipient.leadId}:`, err.message);

        await EmailRecipient.findByIdAndUpdate(recipient._id, {
          status: 'failed',
          error: err.message || 'Send failure',
          $inc: { retryCount: 1 },
        });

        await EmailCampaign.findByIdAndUpdate(campaign._id, {
          $inc: { 'stats.failed': 1 },
          lastWorkerRunAt: new Date(),
        });
      }

      // Small throttling delay to preserve sender reputation
      await sleep(DELAY_MS_BETWEEN_EMAILS);
    }
  }

  // Check if any recipients remain
  const remainingCount = await EmailRecipient.countDocuments({
    campaignId: campaign._id,
    status: { $in: ['pending', 'queued', 'sending'] },
  });

  if (remainingCount === 0) {
    await EmailCampaign.findByIdAndUpdate(campaign._id, {
      status: 'completed',
      completedAt: new Date(),
    });
    console.log(`[CampaignWorker] Campaign ${campaign._id} finished all recipients. Marked COMPLETED.`);
  }
}
