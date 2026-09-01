import { connectToDatabase } from '@/lib/db/mongoose';
import Lead from '@/lib/models/Lead';
import EmailCampaign from '@/lib/models/EmailCampaign';
import EmailRecipient from '@/lib/models/EmailRecipient';
import { runEmailBlastWorker } from '@/lib/workers/emailBlastWorker';
import {
  checkListmonkHealth,
  getOrCreateList,
  syncSubscribersToListmonk,
  createListmonkCampaign,
  updateListmonkCampaignStatus,
} from '@/lib/services/listmonkService';

/**
 * Builds MongoDB filter query from campaign criteria
 */
export function buildAudienceQuery(filterCriteria = {}) {
  const query = {};

  if (filterCriteria.status && filterCriteria.status.length > 0) {
    query.status = { $in: filterCriteria.status };
  }

  if (filterCriteria.tags && filterCriteria.tags.length > 0) {
    query.tags = { $in: filterCriteria.tags };
  }

  if (filterCriteria.source) {
    query.source = filterCriteria.source;
  }

  if (filterCriteria.onlyUncontacted) {
    query.lastContactedAt = { $exists: false };
  }

  return query;
}

/**
 * Performs pre-send recipient audit on candidate audience
 */
export async function auditCampaignAudience(filterCriteria = {}) {
  const baseQuery = buildAudienceQuery(filterCriteria);
  let candidateLeads = [];
  try {
    await connectToDatabase();
    candidateLeads = await Lead.find(baseQuery).lean();
  } catch (err) {
    return {
      totalCandidates: 0,
      eligible: 0,
      suppressed: 0,
      missingEmail: 0,
      alreadyContacted: 0,
      duplicates: 0,
      eligibleLeadIds: [],
      sampleExcluded: [],
    };
  }

  let eligible = 0;
  let suppressed = 0;
  let missingEmail = 0;
  let alreadyContacted = 0;
  const seenEmails = new Set();
  let duplicates = 0;

  const eligibleLeadIds = [];
  const breakdownList = [];

  for (const lead of candidateLeads) {
    const rawEmail = (lead.email || '').trim().toLowerCase();

    if (!rawEmail) {
      missingEmail++;
      breakdownList.push({ id: lead._id, name: lead.fullName || lead.firstName, reason: 'Missing email' });
      continue;
    }

    if (seenEmails.has(rawEmail)) {
      duplicates++;
      breakdownList.push({ id: lead._id, email: rawEmail, name: lead.fullName || lead.firstName, reason: 'Duplicate email' });
      continue;
    }
    seenEmails.add(rawEmail);

    if (lead.suppression?.email || lead.status === 'DO_NOT_CONTACT') {
      suppressed++;
      breakdownList.push({ id: lead._id, email: rawEmail, name: lead.fullName || lead.firstName, reason: 'Email suppressed (DNC/Opt-Out)' });
      continue;
    }

    if (filterCriteria.onlyUncontacted && lead.lastContactedAt) {
      alreadyContacted++;
      breakdownList.push({ id: lead._id, email: rawEmail, name: lead.fullName || lead.firstName, reason: 'Already contacted' });
      continue;
    }

    eligible++;
    eligibleLeadIds.push(lead._id);
  }

  return {
    totalCandidates: candidateLeads.length,
    eligible,
    suppressed,
    missingEmail,
    alreadyContacted,
    duplicates,
    eligibleLeadIds,
    sampleExcluded: breakdownList.slice(0, 20),
  };
}

/**
 * Creates and stages an email blast campaign
 */
export async function createCampaign({
  name,
  subject,
  bodyHtml,
  bodyText = '',
  templateId = null,
  inboxId = null,
  filterCriteria = {},
  scheduledAt = null,
}) {
  await connectToDatabase();

  const audit = await auditCampaignAudience(filterCriteria);

  const campaign = await EmailCampaign.create({
    name,
    subject,
    bodyHtml,
    bodyText,
    templateId,
    inboxId,
    status: scheduledAt ? 'scheduled' : 'draft',
    filterCriteria,
    scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
    stats: {
      totalRecipients: audit.eligible,
      eligible: audit.eligible,
      suppressed: audit.suppressed,
      missingEmail: audit.missingEmail,
      alreadyContacted: audit.alreadyContacted,
      sent: 0,
      delivered: 0,
      opened: 0,
      clicked: 0,
      replied: 0,
      bounced: 0,
      failed: 0,
    },
  });

  return campaign;
}

/**
 * Launches an Email Blast (synchronizes with Listmonk if available, stages recipients idempotently)
 */
export async function launchCampaign(campaignId) {
  await connectToDatabase();

  const campaign = await EmailCampaign.findById(campaignId);
  if (!campaign) throw new Error('Campaign not found');

  if (['running', 'completed'].includes(campaign.status)) {
    throw new Error(`Campaign is already in status: ${campaign.status}`);
  }

  const audit = await auditCampaignAudience(campaign.filterCriteria);
  const leads = await Lead.find({ _id: { $in: audit.eligibleLeadIds } });

  // 1. Check Listmonk connectivity
  const lmHealth = await checkListmonkHealth();

  if (lmHealth.connected) {
    try {
      // Create / get Listmonk list
      const listId = await getOrCreateList(`8020 - ${campaign.name}`);
      campaign.listmonkListId = listId;

      // Sync leads as subscribers
      await syncSubscribersToListmonk(leads, listId);

      // Idempotently create or retrieve Listmonk campaign
      if (!campaign.listmonkCampaignId) {
        const lmCampaign = await createListmonkCampaign({
          name: campaign.name,
          subject: campaign.subject,
          bodyHtml: campaign.bodyHtml,
          listIds: [listId],
          sendAt: campaign.scheduledAt,
        });

        if (lmCampaign.success) {
          campaign.listmonkCampaignId = lmCampaign.campaignId;
          campaign.listmonkStatus = 'running';
          await updateListmonkCampaignStatus(lmCampaign.campaignId, 'running');
        }
      } else {
        await updateListmonkCampaignStatus(campaign.listmonkCampaignId, 'running');
      }

      campaign.engine = 'listmonk';
    } catch (lmErr) {
      console.warn('[CampaignService] Listmonk launch failed, using internal worker fallback:', lmErr.message);
      campaign.engine = 'direct';
    }
  } else {
    campaign.engine = 'direct';
  }

  // 2. Stage recipient documents idempotently in MongoDB
  const recipientDocs = [];
  for (const lead of leads) {
    recipientDocs.push({
      campaignId: campaign._id,
      leadId: lead._id,
      email: lead.email.toLowerCase().trim(),
      status: 'pending',
    });
  }

  if (recipientDocs.length > 0) {
    const bulkOps = recipientDocs.map((rec) => ({
      updateOne: {
        filter: { campaignId: rec.campaignId, leadId: rec.leadId },
        update: { $setOnInsert: rec },
        upsert: true,
      },
    }));
    await EmailRecipient.bulkWrite(bulkOps);
  }

  campaign.status = 'running';
  campaign.startedAt = campaign.startedAt || new Date();
  campaign.stats.totalRecipients = audit.eligible;
  campaign.stats.eligible = audit.eligible;
  campaign.stats.suppressed = audit.suppressed;
  campaign.stats.missingEmail = audit.missingEmail;
  campaign.stats.alreadyContacted = audit.alreadyContacted;
  await campaign.save();

  // Run internal worker for local dispatch / tracking
  runEmailBlastWorker(campaign._id).catch((err) => {
    console.error(`[CampaignWorker] Error running campaign ${campaign._id}:`, err);
  });

  return campaign;
}

/**
 * Pauses a running campaign
 */
export async function pauseCampaign(campaignId) {
  await connectToDatabase();
  const campaign = await EmailCampaign.findById(campaignId);
  if (!campaign) throw new Error('Campaign not found');

  campaign.status = 'paused';
  if (campaign.listmonkCampaignId) {
    await updateListmonkCampaignStatus(campaign.listmonkCampaignId, 'paused');
  }
  await campaign.save();
  return campaign;
}

/**
 * Resumes a paused campaign
 */
export async function resumeCampaign(campaignId) {
  await connectToDatabase();
  const campaign = await EmailCampaign.findById(campaignId);
  if (!campaign) throw new Error('Campaign not found');

  campaign.status = 'running';
  if (campaign.listmonkCampaignId) {
    await updateListmonkCampaignStatus(campaign.listmonkCampaignId, 'running');
  }
  await campaign.save();

  runEmailBlastWorker(campaign._id).catch((err) => {
    console.error(`[CampaignWorker] Error resuming campaign ${campaign._id}:`, err);
  });

  return campaign;
}

/**
 * Cancels a campaign
 */
export async function cancelCampaign(campaignId) {
  await connectToDatabase();
  const campaign = await EmailCampaign.findById(campaignId);
  if (!campaign) throw new Error('Campaign not found');

  campaign.status = 'cancelled';
  if (campaign.listmonkCampaignId) {
    await updateListmonkCampaignStatus(campaign.listmonkCampaignId, 'cancelled');
  }
  await campaign.save();
  return campaign;
}

/**
 * Retries failed recipients for a campaign
 */
export async function retryFailedCampaignRecipients(campaignId) {
  await connectToDatabase();
  const campaign = await EmailCampaign.findById(campaignId);
  if (!campaign) throw new Error('Campaign not found');

  await EmailRecipient.updateMany(
    { campaignId: campaign._id, status: 'failed' },
    { status: 'pending', error: '' }
  );

  campaign.status = 'running';
  await campaign.save();

  runEmailBlastWorker(campaign._id).catch((err) => {
    console.error(`[CampaignWorker] Error retrying campaign ${campaign._id}:`, err);
  });

  return campaign;
}
