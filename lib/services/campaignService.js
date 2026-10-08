import { supabaseAdmin } from '../supabase.js';
import { runEmailBlastWorker } from '../workers/emailBlastWorker.js';
import { dispatchScheduledTasks } from '../workers/schedulerDispatcher.js';
import {
  checkListmonkHealth,
  getOrCreateList,
  syncSubscribersToListmonk,
  createListmonkCampaign,
  updateListmonkCampaignStatus,
} from './listmonkService.js';

/**
 * Performs pre-send recipient audit on candidate audience from Supabase
 */
export async function auditCampaignAudience(filterCriteria = {}) {
  try {
    let query = supabaseAdmin.from('leads').select('*');

    if (filterCriteria.status && filterCriteria.status.length > 0) {
      query = query.in('status', filterCriteria.status);
    }

    if (filterCriteria.tags && filterCriteria.tags.length > 0) {
      query = query.contains('tags', filterCriteria.tags);
    }

    const { data: candidateLeads, error } = await query;
    if (error || !candidateLeads) {
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
        breakdownList.push({ id: lead.id, name: lead.full_name || lead.first_name, reason: 'Missing email' });
        continue;
      }

      if (seenEmails.has(rawEmail)) {
        duplicates++;
        breakdownList.push({ id: lead.id, email: rawEmail, name: lead.full_name || lead.first_name, reason: 'Duplicate email' });
        continue;
      }
      seenEmails.add(rawEmail);

      if (lead.is_dnc || lead.suppression?.email || lead.status === 'DO_NOT_CONTACT' || lead.status === 'DNC') {
        suppressed++;
        breakdownList.push({ id: lead.id, email: rawEmail, name: lead.full_name || lead.first_name, reason: 'Email suppressed (DNC/Opt-Out)' });
        continue;
      }

      if (filterCriteria.onlyUncontacted && (lead.status === 'CONTACTED' || lead.status === 'ENGAGED')) {
        alreadyContacted++;
        breakdownList.push({ id: lead.id, email: rawEmail, name: lead.full_name || lead.first_name, reason: 'Already contacted' });
        continue;
      }

      eligible++;
      eligibleLeadIds.push(lead.id);
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
  } catch (err) {
    console.error('[auditCampaignAudience Error]:', err);
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
}

/**
 * Creates and stages an email blast campaign in Supabase
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
  campaignType = 'standard',
  masterPrompt = '',
}) {
  const audit = await auditCampaignAudience(filterCriteria);
  const nowIso = new Date().toISOString();

  const campaignPayload = {
    name,
    subject,
    body_html: bodyHtml,
    body_plain: bodyText || bodyHtml.replace(/<[^>]*>?/gm, ''),
    status: scheduledAt ? 'SCHEDULED' : 'DRAFT',
    template_id: templateId || null,
    sending_inbox_id: inboxId || null,
    stats: {
      master_prompt: masterPrompt,
      campaign_type: campaignType,
      totalRecipients: audit.eligible,
      total: audit.eligible,
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
    created_at: nowIso,
    updated_at: nowIso,
  };

  const { data: campaign, error } = await supabaseAdmin
    .from('email_campaigns')
    .insert(campaignPayload)
    .select()
    .single();

  if (error || !campaign) {
    throw new Error(error?.message || 'Failed to create campaign in Supabase');
  }

  return {
    ...campaign,
    _id: campaign.id,
    filterCriteria,
  };
}

/**
 * Launches an Email Blast (stages recipients idempotently and triggers emailBlastWorker)
 */
export async function launchCampaign(campaignId) {
  const { data: campaign, error: campErr } = await supabaseAdmin
    .from('email_campaigns')
    .select('*')
    .eq('id', campaignId)
    .single();

  if (campErr || !campaign) throw new Error('Campaign not found');

  const nowIso = new Date().toISOString();
  const audit = await auditCampaignAudience(campaign.filter_criteria || {});

  // Fetch candidate leads
  let leads = [];
  if (audit.eligibleLeadIds.length > 0) {
    const { data: leadData } = await supabaseAdmin
      .from('leads')
      .select('*')
      .in('id', audit.eligibleLeadIds);
    leads = leadData || [];
  }

  // 1. Stage recipient records in Supabase
  if (leads.length > 0) {
    const isAiCampaign = campaign.campaign_type === 'ai_personalized' || Boolean(campaign.master_prompt);
    const initialGenStatus = isAiCampaign ? 'pending' : 'ready';

    const recipientDocs = leads.map((lead) => ({
      campaign_id: campaign.id,
      lead_id: lead.id,
      email: lead.email.toLowerCase().trim(),
      status: 'PENDING',
      generation_status: initialGenStatus,
      scheduled_at: nowIso,
      created_at: nowIso,
      updated_at: nowIso,
      tokens: {
        firstName: lead.first_name || (lead.full_name ? lead.full_name.split(' ')[0] : 'there'),
        company: lead.company || 'your team',
        jobTitle: lead.job_title || 'Executive',
        generation_status: initialGenStatus,
        master_prompt: campaign.master_prompt || '',
      },
    }));

    await supabaseAdmin
      .from('email_recipients')
      .upsert(recipientDocs, { onConflict: 'campaign_id,lead_id', ignoreDuplicates: true });
  }

  // 2. Update campaign status to RUNNING
  const { data: updatedCampaign } = await supabaseAdmin
    .from('email_campaigns')
    .update({
      status: 'RUNNING',
      updated_at: nowIso,
    })
    .eq('id', campaign.id)
    .select()
    .single();

  // 3. Dispatch Persistent Scheduler Task
  dispatchScheduledTasks({ workerId: `manual-launch-${campaign.id}` }).catch((err) => {
    console.error(`[CampaignWorker] Error running campaign ${campaign.id}:`, err);
  });

  return {
    ...updatedCampaign,
    _id: updatedCampaign.id,
  };
}

/**
 * Pauses a running campaign
 */
export async function pauseCampaign(campaignId) {
  const { data: campaign } = await supabaseAdmin
    .from('email_campaigns')
    .update({
      status: 'PAUSED',
      updated_at: new Date().toISOString(),
    })
    .eq('id', campaignId)
    .select()
    .single();

  return campaign;
}

/**
 * Resumes a paused campaign
 */
export async function resumeCampaign(campaignId) {
  const { data: campaign } = await supabaseAdmin
    .from('email_campaigns')
    .update({
      status: 'RUNNING',
      updated_at: new Date().toISOString(),
    })
    .eq('id', campaignId)
    .select()
    .single();

  dispatchScheduledTasks({ workerId: `manual-resume-${campaignId}` }).catch((err) => {
    console.error(`[CampaignWorker] Error resuming campaign ${campaignId}:`, err);
  });

  return campaign;
}

/**
 * Cancels a campaign
 */
export async function cancelCampaign(campaignId) {
  const { data: campaign } = await supabaseAdmin
    .from('email_campaigns')
    .update({
      status: 'CANCELLED',
      updated_at: new Date().toISOString(),
    })
    .eq('id', campaignId)
    .select()
    .single();
  return campaign;
}

/**
 * Retries failed recipients for a campaign by resetting their status to PENDING
 * and triggering the background worker
 */
export async function retryFailedCampaignRecipients(campaignId) {
  const { data: campaign, error: campErr } = await supabaseAdmin
    .from('email_campaigns')
    .select('*')
    .eq('id', campaignId)
    .single();

  if (campErr || !campaign) throw new Error('Campaign not found');

  const nowIso = new Date().toISOString();

  // Reset failed recipients to PENDING
  await supabaseAdmin
    .from('email_recipients')
    .update({
      status: 'PENDING',
      error_message: null,
      claimed_by: null,
      locked_at: null,
      claimed_at: null,
      updated_at: nowIso,
    })
    .eq('campaign_id', campaignId)
    .eq('status', 'FAILED');

  // Update campaign status to RUNNING
  const { data: updatedCampaign } = await supabaseAdmin
    .from('email_campaigns')
    .update({
      status: 'RUNNING',
      updated_at: nowIso,
    })
    .eq('id', campaignId)
    .select()
    .single();

  dispatchScheduledTasks({ workerId: `manual-retry-${campaignId}` }).catch((err) => {
    console.error(`[CampaignWorker] Error retrying campaign ${campaignId}:`, err);
  });

  return {
    ...updatedCampaign,
    _id: updatedCampaign.id,
  };
}

const campaignService = {
  auditCampaignAudience,
  createCampaign,
  launchCampaign,
  pauseCampaign,
  resumeCampaign,
  cancelCampaign,
  retryFailedCampaignRecipients,
};

export default campaignService;
