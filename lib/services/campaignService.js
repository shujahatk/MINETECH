import crypto from 'crypto';
import { supabaseAdmin } from '../supabase.js';
import { runEmailBlastWorker } from '../workers/emailBlastWorker.js';
import { dispatchScheduledTasks } from '../workers/schedulerDispatcher.js';
import {
  isValidEmail,
  interpolateMergeFields,
  dispatchViaResend,
} from './emailService.js';
import { ensureMineTechSignatureHtml, ensureMineTechSignatureText } from '../utils/signature.js';

/**
 * Performs pre-send recipient audit on candidate audience from Supabase
 */
export async function auditCampaignAudience(filterCriteria = {}) {
  try {
    let query = supabaseAdmin.from('leads').select('*');

    if (filterCriteria.leadIds && Array.isArray(filterCriteria.leadIds) && filterCriteria.leadIds.length > 0) {
      query = query.in('id', filterCriteria.leadIds);
    } else {
      if (filterCriteria.status && filterCriteria.status.length > 0) {
        query = query.in('status', filterCriteria.status);
      }

      if (filterCriteria.tags && filterCriteria.tags.length > 0) {
        query = query.contains('tags', filterCriteria.tags);
      }

      if (filterCriteria.classification && filterCriteria.classification !== 'ALL') {
        const cls = filterCriteria.classification;
        if (cls === 'Buyer') {
          query = query.or('custom_fields->>classification.eq.Buyer,and(custom_fields->>classification.is.null,custom_fields->>supplier_type.ilike.%buyer%)');
        } else if (cls === 'Seller') {
          query = query.or('custom_fields->>classification.eq.Seller,and(custom_fields->>classification.is.null,custom_fields->>supplier_type.ilike.%producer%),and(custom_fields->>classification.is.null,custom_fields->>supplier_type.ilike.%supplier%)');
        }
      }
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

      if (!rawEmail || !isValidEmail(rawEmail)) {
        missingEmail++;
        breakdownList.push({ id: lead.id, name: lead.full_name || lead.first_name, reason: 'Invalid or missing email' });
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
 * Normalizes a Supabase campaign row into a unified object supporting both camelCase and snake_case properties
 */
export function normalizeCampaignRecord(campaign) {
  if (!campaign) return null;
  const stats = campaign.stats || {};
  return {
    ...campaign,
    _id: campaign.id,
    id: campaign.id,
    name: campaign.name || 'Untitled Campaign',
    subject: campaign.subject || '',
    bodyHtml: campaign.body_html || '',
    bodyText: campaign.body_plain || '',
    body_html: campaign.body_html || '',
    body_plain: campaign.body_plain || '',
    status: (campaign.status || 'DRAFT').toUpperCase(),
    campaignType: campaign.campaign_type || stats.campaign_type || 'standard',
    campaign_type: campaign.campaign_type || stats.campaign_type || 'standard',
    masterPrompt: campaign.master_prompt || stats.master_prompt || '',
    master_prompt: campaign.master_prompt || stats.master_prompt || '',
    description: campaign.description || stats.description || '',
    sender: stats.sender || { email: process.env.EMAIL_FROM || 'rauf@mine-tech.be', name: process.env.EMAIL_FROM_NAME || 'Rauf', replyTo: process.env.REPLY_TO || 'rauf@mine-tech.be' },
    filterCriteria: stats.filterCriteria || {},
    sendingSettings: stats.sendingSettings || { dailyLimit: 50, delayInterval: 45, scheduleWindow: '08:00 - 18:00 (Prospect Local Time)', warmupEnabled: true },
    tracking: stats.tracking || { trackOpens: true, trackClicks: true, unsubscribeHeader: true },
    compliance: stats.compliance || { includePhysicalAddress: true, includeOneClickOptOut: true, dncSuppressionActive: true },
    stats: {
      total: stats.total || stats.totalRecipients || 0,
      totalRecipients: stats.totalRecipients || stats.total || 0,
      sent: stats.sent || 0,
      delivered: stats.delivered != null ? stats.delivered : (stats.sent || 0),
      opened: stats.opened || 0,
      clicked: stats.clicked || 0,
      replied: stats.replied || 0,
      bounced: stats.bounced || 0,
      failed: stats.failed || 0,
      suppressed: stats.suppressed || 0,
      missingEmail: stats.missingEmail || 0,
      ...stats,
    },
    createdAt: campaign.created_at,
    updatedAt: campaign.updated_at,
    created_at: campaign.created_at,
    updated_at: campaign.updated_at,
  };
}

/**
 * Creates and stages an email blast campaign in Supabase
 */
export async function createCampaign({
  name,
  subject,
  bodyHtml,
  bodyText = '',
  description = '',
  templateId = null,
  inboxId = null,
  filterCriteria = {},
  scheduledAt = null,
  campaignType = 'standard',
  masterPrompt = '',
  sender = null,
  sendingSettings = null,
  tracking = null,
  compliance = null,
  status = null,
  personalizedRecipients = null,
  campaignAttachments = null,
  attachments = null,
}) {
  const isPersonalizedBatch = campaignType === 'personalized_batch' || (Array.isArray(personalizedRecipients) && personalizedRecipients.length > 0);
  const audit = isPersonalizedBatch
    ? { eligible: personalizedRecipients.length, total: personalizedRecipients.length, suppressed: 0, missingEmail: 0, alreadyContacted: 0, eligibleLeadIds: [] }
    : await auditCampaignAudience(filterCriteria);
  const nowIso = new Date().toISOString();

  const initialStatus = status ? status.toUpperCase() : (scheduledAt ? 'SCHEDULED' : 'DRAFT');

  const statsPayload = {
    master_prompt: masterPrompt,
    campaign_type: isPersonalizedBatch ? 'personalized_batch' : campaignType,
    description: description || '',
    totalRecipients: isPersonalizedBatch ? personalizedRecipients.length : audit.eligible,
    total: isPersonalizedBatch ? personalizedRecipients.length : audit.eligible,
    eligible: isPersonalizedBatch ? personalizedRecipients.length : audit.eligible,
    suppressed: audit.suppressed || 0,
    missingEmail: audit.missingEmail || 0,
    alreadyContacted: audit.alreadyContacted || 0,
    sent: 0,
    delivered: 0,
    opened: 0,
    clicked: 0,
    replied: 0,
    bounced: 0,
    failed: 0,
  };

  if (sender) statsPayload.sender = sender;
  if (filterCriteria) statsPayload.filterCriteria = filterCriteria;
  if (sendingSettings) statsPayload.sendingSettings = sendingSettings;
  if (tracking) statsPayload.tracking = tracking;
  if (compliance) statsPayload.compliance = compliance;
  if (campaignAttachments) {
    statsPayload.campaign_attachments = campaignAttachments;
    statsPayload.attachments = campaignAttachments;
  } else if (attachments) {
    statsPayload.campaign_attachments = attachments;
    statsPayload.attachments = attachments;
  }

  const campaignPayload = {
    name: name || `Personalized Batch — ${new Date().toLocaleDateString()}`,
    subject: subject || 'Personalized Outreach Batch',
    body_html: bodyHtml || '<p>Personalized Outreach Batch</p>',
    body_plain: bodyText || (bodyHtml ? bodyHtml.replace(/<[^>]*>?/gm, '') : 'Personalized Outreach Batch'),
    status: initialStatus,
    template_id: templateId || null,
    sending_inbox_id: inboxId || null,
    stats: statsPayload,
    created_at: nowIso,
    updated_at: nowIso,
  };

  // Attempt insert with top-level campaign_type / master_prompt if table supports it,
  // falling back cleanly if those columns are not yet migrated
  let insertPayload = {
    ...campaignPayload,
    campaign_type: isPersonalizedBatch ? 'personalized_batch' : campaignType,
    master_prompt: masterPrompt,
  };

  let { data: campaign, error } = await supabaseAdmin
    .from('email_campaigns')
    .insert(insertPayload)
    .select()
    .single();

  if (error && (error.message?.includes('campaign_type') || error.message?.includes('schema cache'))) {
    const fallback = await supabaseAdmin
      .from('email_campaigns')
      .insert(campaignPayload)
      .select()
      .single();
    campaign = fallback.data;
    error = fallback.error;
  }

  if (error || !campaign) {
    throw new Error(error?.message || 'Failed to create campaign in Supabase');
  }

  // 1. Stage personalized recipients if this is a company-personalized batch
  if (isPersonalizedBatch && Array.isArray(personalizedRecipients) && personalizedRecipients.length > 0) {
    const recipientDocs = personalizedRecipients.map((item) => ({
      campaign_id: campaign.id,
      lead_id: item.leadId || item.lead_id || null,
      email: (item.email || item.contactEmail || item.to || '').toLowerCase().trim(),
      status: 'PENDING',
      scheduled_at: nowIso,
      created_at: nowIso,
      updated_at: nowIso,
      tokens: {
        custom_subject: item.customSubject || item.subject || campaign.subject,
        custom_body_html: item.customBodyHtml || item.bodyHtml || campaign.body_html,
        custom_body_plain: item.customBodyPlain || item.bodyText || campaign.body_plain,
        company_name: item.companyName || item.company || '',
        contact_name: item.contactName || item.name || '',
        attachments: item.attachments || [],
        signature_html: item.signatureHtml || '',
        cc: item.cc || [],
        bcc: item.bcc || [],
        approval_status: item.approvalStatus || 'approved',
        user_approved: item.approvalStatus === 'approved',
        draft_id: item.draftId || null,
      },
    }));

    await supabaseAdmin
      .from('email_recipients')
      .upsert(recipientDocs, { onConflict: 'campaign_id,lead_id', ignoreDuplicates: false });
  } else if (audit.eligibleLeadIds.length > 0) {
    // 2. Pre-stage standard filter-based recipient records
    const { data: leads } = await supabaseAdmin
      .from('leads')
      .select('*')
      .in('id', audit.eligibleLeadIds);

    if (leads && leads.length > 0) {
      const isAiCampaign = campaignType === 'ai_personalized' || Boolean(masterPrompt);
      const initialGenStatus = isAiCampaign ? 'pending' : 'ready';

      const recipientDocs = leads.map((lead) => ({
        campaign_id: campaign.id,
        lead_id: lead.id,
        email: (lead.email || '').toLowerCase().trim(),
        status: 'PENDING',
        scheduled_at: nowIso,
        created_at: nowIso,
        updated_at: nowIso,
        tokens: {
          firstName: lead.first_name || (lead.full_name ? lead.full_name.split(' ')[0] : 'there'),
          lastName: lead.last_name || '',
          company: lead.company || 'your team',
          jobTitle: lead.job_title || 'Executive',
          generation_status: initialGenStatus,
          master_prompt: masterPrompt || '',
        },
      }));

      await supabaseAdmin
        .from('email_recipients')
        .upsert(recipientDocs, { onConflict: 'campaign_id,lead_id', ignoreDuplicates: true });
    }
  }

  return normalizeCampaignRecord(campaign);
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
  const filterCriteria = campaign.stats?.filterCriteria || campaign.filter_criteria || {};
  const audit = await auditCampaignAudience(filterCriteria);

  // Fetch candidate leads
  let leads = [];
  if (audit.eligibleLeadIds.length > 0) {
    const { data: leadData } = await supabaseAdmin
      .from('leads')
      .select('*')
      .in('id', audit.eligibleLeadIds);
    leads = leadData || [];
  }

  // 1. Stage recipient records in Supabase idempotently (only for filterCriteria-based campaigns with no pre-staged recipients)
  const isPersonalizedBatch = campaign.campaign_type === 'personalized_batch' || campaign.stats?.campaign_type === 'personalized_batch';

  const { count: existingRecipientCount } = await supabaseAdmin
    .from('email_recipients')
    .select('*', { count: 'exact', head: true })
    .eq('campaign_id', campaign.id);

  if (!isPersonalizedBatch && (!existingRecipientCount || existingRecipientCount === 0) && leads.length > 0) {
    const campType = campaign.campaign_type || campaign.stats?.campaign_type || 'standard';
    const masterPrompt = campaign.master_prompt || campaign.stats?.master_prompt || '';
    const isAiCampaign = campType === 'ai_personalized' || Boolean(masterPrompt);
    const initialGenStatus = isAiCampaign ? 'pending' : 'ready';

    const recipientDocs = leads.map((lead) => ({
      campaign_id: campaign.id,
      lead_id: lead.id,
      email: lead.email.toLowerCase().trim(),
      status: 'PENDING',
      scheduled_at: nowIso,
      created_at: nowIso,
      updated_at: nowIso,
      tokens: {
        firstName: lead.first_name || (lead.full_name ? lead.full_name.split(' ')[0] : 'there'),
        company: lead.company || 'your team',
        jobTitle: lead.job_title || 'Executive',
        generation_status: initialGenStatus,
        master_prompt: masterPrompt,
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

  // 3. Dispatch Background Scheduler / Blast Worker
  dispatchScheduledTasks({ workerId: `manual-launch-${campaign.id}` }).catch((err) => {
    console.error(`[CampaignWorker] Error running campaign ${campaign.id}:`, err);
  });

  return normalizeCampaignRecord(updatedCampaign);
}

/**
 * Pauses a running campaign
 */
export async function pauseCampaign(campaignId) {
  const { data: campaign, error } = await supabaseAdmin
    .from('email_campaigns')
    .update({
      status: 'PAUSED',
      updated_at: new Date().toISOString(),
    })
    .eq('id', campaignId)
    .select()
    .single();

  if (error || !campaign) throw new Error(error?.message || 'Failed to pause campaign');
  return normalizeCampaignRecord(campaign);
}

/**
 * Resumes a paused campaign
 */
export async function resumeCampaign(campaignId) {
  const { data: campaign, error } = await supabaseAdmin
    .from('email_campaigns')
    .update({
      status: 'RUNNING',
      updated_at: new Date().toISOString(),
    })
    .eq('id', campaignId)
    .select()
    .single();

  if (error || !campaign) throw new Error(error?.message || 'Failed to resume campaign');

  dispatchScheduledTasks({ workerId: `manual-resume-${campaignId}` }).catch((err) => {
    console.error(`[CampaignWorker] Error resuming campaign ${campaignId}:`, err);
  });

  return normalizeCampaignRecord(campaign);
}

/**
 * Cancels a campaign
 */
export async function cancelCampaign(campaignId) {
  const { data: campaign, error } = await supabaseAdmin
    .from('email_campaigns')
    .update({
      status: 'CANCELLED',
      updated_at: new Date().toISOString(),
    })
    .eq('id', campaignId)
    .select()
    .single();

  if (error || !campaign) throw new Error(error?.message || 'Failed to cancel campaign');
  return normalizeCampaignRecord(campaign);
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

  return normalizeCampaignRecord(updatedCampaign);
}

/**
 * Fetches campaigns with search, status filtering, sorting, and pagination
 */
export async function getCampaigns(options = {}) {
  const {
    search = '',
    status = '',
    sort = 'created_at',
    order = 'desc',
    page = 1,
    limit = 50,
  } = options;

  let query = supabaseAdmin
    .from('email_campaigns')
    .select('*', { count: 'exact' })
    .not('status', 'in', '("SETTINGS","AI_CHAT_CONVERSATION")');

  if (status && status !== 'all' && status !== 'ALL') {
    const s = status.trim().toUpperCase();
    if (s === 'RUNNING' || s === 'SENDING') {
      query = query.in('status', ['RUNNING', 'SENDING', 'running', 'sending']);
    } else if (s === 'COMPLETED' || s === 'SENT') {
      query = query.in('status', ['COMPLETED', 'SENT', 'completed', 'sent']);
    } else {
      query = query.ilike('status', s);
    }
  }

  if (search && search.trim()) {
    const s = search.trim();
    query = query.or(`name.ilike.%${s}%,subject.ilike.%${s}%`);
  }

  const ascending = order === 'asc';
  const sortCol = ['created_at', 'updated_at', 'name', 'status'].includes(sort) ? sort : 'created_at';
  query = query.order(sortCol, { ascending });

  if (limit) {
    const from = (Math.max(1, page) - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);
  }

  const { data, count, error } = await query;
  if (error) {
    throw new Error(`Failed to query campaigns from Supabase: ${error.message}`);
  }

  let normalized = (data || []).map(normalizeCampaignRecord);

  // If sorting by performance / sent
  if (sort === 'sent' || sort === 'performance') {
    normalized.sort((a, b) => {
      const aSent = a.stats?.sent || 0;
      const bSent = b.stats?.sent || 0;
      return ascending ? aSent - bSent : bSent - aSent;
    });
  }

  return {
    campaigns: normalized,
    total: count != null ? count : normalized.length,
    page: Math.max(1, page),
    limit,
  };
}

/**
 * Fetches single campaign by ID from Supabase with recent recipient telemetry
 */
export async function getCampaignById(campaignId) {
  const { data: campaign, error: campErr } = await supabaseAdmin
    .from('email_campaigns')
    .select('*')
    .eq('id', campaignId)
    .maybeSingle();

  if (campErr) throw new Error(campErr.message);
  if (!campaign) return null;

  // Fetch recipients for this campaign (up to 1,000 in natural order)
  const { data: recipients } = await supabaseAdmin
    .from('email_recipients')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: true })
    .limit(1000);

  return {
    campaign: normalizeCampaignRecord(campaign),
    recipients: recipients || [],
  };
}

/**
 * Updates campaign details in Supabase (Edit Campaign)
 */
export async function updateCampaign(campaignId, updateData = {}) {
  const { data: existing, error: existErr } = await supabaseAdmin
    .from('email_campaigns')
    .select('*')
    .eq('id', campaignId)
    .maybeSingle();

  if (existErr || !existing) throw new Error('Campaign not found');

  const nowIso = new Date().toISOString();
  const currentStats = existing.stats || {};

  const statsUpdates = { ...currentStats };
  if (updateData.masterPrompt !== undefined) statsUpdates.master_prompt = updateData.masterPrompt;
  if (updateData.master_prompt !== undefined) statsUpdates.master_prompt = updateData.master_prompt;
  if (updateData.campaignType !== undefined) statsUpdates.campaign_type = updateData.campaignType;
  if (updateData.campaign_type !== undefined) statsUpdates.campaign_type = updateData.campaign_type;
  if (updateData.description !== undefined) statsUpdates.description = updateData.description;
  if (updateData.sender) statsUpdates.sender = updateData.sender;
  if (updateData.filterCriteria) statsUpdates.filterCriteria = updateData.filterCriteria;
  if (updateData.sendingSettings) statsUpdates.sendingSettings = updateData.sendingSettings;
  if (updateData.tracking) statsUpdates.tracking = updateData.tracking;
  if (updateData.compliance) statsUpdates.compliance = updateData.compliance;

  const patch = {
    updated_at: nowIso,
    stats: statsUpdates,
  };

  if (updateData.name) patch.name = updateData.name;
  if (updateData.subject) patch.subject = updateData.subject;
  if (updateData.bodyHtml || updateData.body_html) patch.body_html = updateData.bodyHtml || updateData.body_html;
  if (updateData.bodyText || updateData.body_plain) patch.body_plain = updateData.bodyText || updateData.body_plain;
  if (updateData.status) patch.status = updateData.status.toUpperCase();
  if (updateData.templateId !== undefined) patch.template_id = updateData.templateId || null;
  if (updateData.inboxId !== undefined) patch.sending_inbox_id = updateData.inboxId || null;

  // Try updating with top-level campaign_type / master_prompt if available
  let updateResult = await supabaseAdmin
    .from('email_campaigns')
    .update({
      ...patch,
      ...(updateData.campaignType ? { campaign_type: updateData.campaignType } : {}),
      ...(updateData.masterPrompt ? { master_prompt: updateData.masterPrompt } : {}),
    })
    .eq('id', campaignId)
    .select()
    .single();

  if (updateResult.error && (updateResult.error.message?.includes('campaign_type') || updateResult.error.message?.includes('schema cache'))) {
    updateResult = await supabaseAdmin
      .from('email_campaigns')
      .update(patch)
      .eq('id', campaignId)
      .select()
      .single();
  }

  if (updateResult.error) throw new Error(updateResult.error.message);

  // If campaign is in DRAFT status and audience criteria changed, re-audit and re-stage recipients
  if (existing.status === 'DRAFT' && updateData.filterCriteria) {
    const audit = await auditCampaignAudience(updateData.filterCriteria);
    // Remove old un-sent pending recipients
    await supabaseAdmin
      .from('email_recipients')
      .delete()
      .eq('campaign_id', campaignId)
      .eq('status', 'PENDING');

    if (audit.eligibleLeadIds.length > 0) {
      const { data: leads } = await supabaseAdmin
        .from('leads')
        .select('*')
        .in('id', audit.eligibleLeadIds);

      if (leads && leads.length > 0) {
        const campType = statsUpdates.campaign_type || 'standard';
        const masterPrompt = statsUpdates.master_prompt || '';
        const isAiCampaign = campType === 'ai_personalized' || Boolean(masterPrompt);
        const initialGenStatus = isAiCampaign ? 'pending' : 'ready';

        const recipientDocs = leads.map((lead) => ({
          campaign_id: campaignId,
          lead_id: lead.id,
          email: (lead.email || '').toLowerCase().trim(),
          status: 'PENDING',
          scheduled_at: nowIso,
          created_at: nowIso,
          updated_at: nowIso,
          tokens: {
            firstName: lead.first_name || (lead.full_name ? lead.full_name.split(' ')[0] : 'there'),
            lastName: lead.last_name || '',
            company: lead.company || 'your team',
            jobTitle: lead.job_title || 'Executive',
            generation_status: initialGenStatus,
            master_prompt: masterPrompt,
          },
        }));

        await supabaseAdmin
          .from('email_recipients')
          .upsert(recipientDocs, { onConflict: 'campaign_id,lead_id', ignoreDuplicates: true });
      }
    }
  }

  return normalizeCampaignRecord(updateResult.data);
}

/**
 * Calculates dynamic campaign deletion impact:
 * - Total associated leads in this campaign
 * - Exclusive leads (only in this campaign)
 * - Shared leads (associated with other campaigns)
 * - Protected leads (having active conversations or advanced deals)
 * - Eligible leads for deletion
 */
export async function getCampaignDeletionImpact(campaignId) {
  const { data: campaign, error: campErr } = await supabaseAdmin
    .from('email_campaigns')
    .select('id, name')
    .eq('id', campaignId)
    .maybeSingle();

  if (campErr) throw new Error(campErr.message);
  if (!campaign) throw new Error('Campaign not found');

  // 1. Get all recipients for this campaign
  const { data: recipients, error: recErr } = await supabaseAdmin
    .from('email_recipients')
    .select('lead_id')
    .eq('campaign_id', campaignId);

  if (recErr) throw new Error(recErr.message);

  const associatedLeadIds = Array.from(
    new Set((recipients || []).map((r) => r.lead_id).filter(Boolean))
  );

  const totalAssociated = associatedLeadIds.length;

  if (totalAssociated === 0) {
    return {
      campaignId,
      campaignName: campaign.name,
      totalAssociated: 0,
      exclusiveCount: 0,
      sharedCount: 0,
      protectedCount: 0,
      eligibleForDeletionCount: 0,
      eligibleLeadIds: [],
      exclusiveLeadIds: [],
      sharedLeadIds: [],
    };
  }

  // 2. Find shared leads: leads associated with OTHER campaigns in email_recipients
  const { data: otherRecs, error: otherErr } = await supabaseAdmin
    .from('email_recipients')
    .select('lead_id')
    .neq('campaign_id', campaignId)
    .in('lead_id', associatedLeadIds);

  if (otherErr) throw new Error(otherErr.message);

  const sharedLeadIdsSet = new Set((otherRecs || []).map((r) => r.lead_id));
  const sharedCount = sharedLeadIdsSet.size;

  // 3. Candidates for deletion: leads exclusive to this campaign
  const candidateExclusiveLeadIds = associatedLeadIds.filter((id) => !sharedLeadIdsSet.has(id));

  // 4. Check for protected CRM relationships among candidates:
  let protectedLeadIdsSet = new Set();
  if (candidateExclusiveLeadIds.length > 0) {
    const [inboundThreadsRes, inboundMsgsRes, advancedLeadsRes] = await Promise.all([
      // Ongoing active conversations: threads that received inbound replies
      supabaseAdmin
        .from('email_threads')
        .select('lead_id')
        .in('lead_id', candidateExclusiveLeadIds)
        .not('last_inbound_at', 'is', null),
      // Inbound messages indicating active conversations
      supabaseAdmin
        .from('email_messages')
        .select('lead_id')
        .in('lead_id', candidateExclusiveLeadIds)
        .eq('direction', 'inbound'),
      // Advanced deals, negotiation, closed won, or scheduled follow-ups
      supabaseAdmin
        .from('leads')
        .select('id, status, pipeline_stage, custom_fields')
        .in('id', candidateExclusiveLeadIds),
    ]);

    (inboundThreadsRes.data || []).forEach((t) => protectedLeadIdsSet.add(t.lead_id));
    (inboundMsgsRes.data || []).forEach((m) => protectedLeadIdsSet.add(m.lead_id));
    (advancedLeadsRes.data || []).forEach((l) => {
      const isAdvancedStatus = [
        'SAMPLE_SENT',
        'TRIAL_ORDER',
        'APPROVED_SUPPLIER',
        'RECURRING_CUSTOMER',
        'NEGOTIATION',
        'CLOSED_WON',
      ].includes(l.status);
      const isAdvancedStage = ['NEGOTIATION', 'CLOSED_WON', 'QUALIFIED'].includes(l.pipeline_stage);
      const hasFollowUp = Boolean(
        l.custom_fields?.scheduled_follow_up ||
        l.custom_fields?.follow_up_date ||
        l.custom_fields?.scheduledFollowUp
      );
      if (isAdvancedStatus || isAdvancedStage || hasFollowUp) {
        protectedLeadIdsSet.add(l.id);
      }
    });
  }

  const eligibleLeadIds = candidateExclusiveLeadIds.filter((id) => !protectedLeadIdsSet.has(id));
  const protectedCount = protectedLeadIdsSet.size;
  const exclusiveCount = candidateExclusiveLeadIds.length;
  const eligibleForDeletionCount = eligibleLeadIds.length;

  return {
    campaignId,
    campaignName: campaign.name,
    totalAssociated,
    exclusiveCount,
    sharedCount,
    protectedCount,
    eligibleForDeletionCount,
    eligibleLeadIds,
    exclusiveLeadIds: candidateExclusiveLeadIds,
    sharedLeadIds: Array.from(sharedLeadIdsSet),
    protectedLeadIds: Array.from(protectedLeadIdsSet),
  };
}

/**
 * Permanently deletes campaign from Supabase across all campaign states:
 * Supports draft, scheduled, active/running, paused, completed, and already-sent campaigns.
 * Safely cascades to queued and sent recipient dispatch entries for this campaign.
 * Preserves shared leads and protected leads under all conditions.
 *
 * @param {string} campaignId
 * @param {Object} [options]
 * @param {boolean} [options.deleteAssociatedLeads=false]
 */
export async function deleteCampaign(campaignId, { deleteAssociatedLeads = false } = {}) {
  const { data: campaign, error: campErr } = await supabaseAdmin
    .from('email_campaigns')
    .select('*')
    .eq('id', campaignId)
    .maybeSingle();

  if (campErr) throw new Error(campErr.message);
  if (!campaign) throw new Error('Campaign not found');

  // Compute dynamic deletion impact
  const impact = await getCampaignDeletionImpact(campaignId);

  let deletedLeadCount = 0;
  let retainedLeadCount = impact.totalAssociated;

  if (deleteAssociatedLeads && impact.eligibleLeadIds.length > 0) {
    const { deleteLeadsByIds } = await import('./leadService.js');
    const leadDelRes = await deleteLeadsByIds(impact.eligibleLeadIds);
    deletedLeadCount = leadDelRes.affected;
    retainedLeadCount = impact.totalAssociated - deletedLeadCount;
  }

  // 1. Delete associated recipient dispatch and logging entries for this campaign
  const { error: recDelErr } = await supabaseAdmin
    .from('email_recipients')
    .delete()
    .eq('campaign_id', campaignId);

  if (recDelErr) {
    console.warn('[Campaign Deletion] Warning deleting recipients:', recDelErr.message);
  }

  // 2. Delete campaign-lead junction associations if present
  try {
    await supabaseAdmin
      .from('campaign_leads')
      .delete()
      .eq('campaign_id', campaignId);
  } catch (jErr) {
    // Non-blocking if junction table is not enabled in this deployment
  }

  // 3. Delete campaign record from email_campaigns
  const { error: delErr } = await supabaseAdmin
    .from('email_campaigns')
    .delete()
    .eq('id', campaignId);

  if (delErr) throw new Error(delErr.message);

  // Invalidate in-memory analytics cache immediately so dashboard reflects true counts
  try {
    const { invalidateAnalyticsCache } = await import('./analyticsService.js');
    invalidateAnalyticsCache();
  } catch (cErr) {
    // Non-blocking
  }

  let message = '';
  if (!deleteAssociatedLeads) {
    message = `Campaign successfully deleted. All ${impact.totalAssociated} associated leads have been retained in the CRM.`;
  } else {
    message = `Campaign successfully deleted. ${deletedLeadCount} associated leads deleted. ${retainedLeadCount} leads retained in the CRM (${impact.sharedCount} shared, ${impact.protectedCount} protected).`;
  }

  return {
    success: true,
    deletedId: campaignId,
    name: campaign.name,
    totalAssociated: impact.totalAssociated,
    deletedExclusiveCount: deletedLeadCount,
    retainedSharedCount: retainedLeadCount,
    sharedCount: impact.sharedCount,
    protectedCount: impact.protectedCount,
    message,
  };
}

/**
 * Clones an existing campaign as a new Draft
 */
export async function duplicateCampaign(campaignId) {
  const { data: orig, error: origErr } = await supabaseAdmin
    .from('email_campaigns')
    .select('*')
    .eq('id', campaignId)
    .maybeSingle();

  if (origErr || !orig) throw new Error('Source campaign not found');

  const duplicatedName = `${orig.name} (Copy)`;
  const origStats = orig.stats || {};

  return createCampaign({
    name: duplicatedName,
    subject: orig.subject,
    bodyHtml: orig.body_html,
    bodyText: orig.body_plain,
    description: orig.description || origStats.description || '',
    templateId: orig.template_id,
    inboxId: orig.sending_inbox_id,
    filterCriteria: origStats.filterCriteria || {},
    campaignType: orig.campaign_type || origStats.campaign_type || 'standard',
    masterPrompt: orig.master_prompt || origStats.master_prompt || '',
    sender: origStats.sender,
    sendingSettings: origStats.sendingSettings,
    tracking: origStats.tracking,
    compliance: origStats.compliance,
    status: 'DRAFT',
  });
}

/**
 * Archives a campaign
 */
export async function archiveCampaign(campaignId) {
  const { data: campaign, error } = await supabaseAdmin
    .from('email_campaigns')
    .update({
      status: 'ARCHIVED',
      updated_at: new Date().toISOString(),
    })
    .eq('id', campaignId)
    .select()
    .single();

  if (error || !campaign) throw new Error(error?.message || 'Failed to archive campaign');
  return normalizeCampaignRecord(campaign);
}

/**
 * Dispatches a controlled single test email for a campaign
 */
export async function sendCampaignTestEmail({
  campaignId = null,
  testEmail,
  senderEmail = null,
  senderName = null,
  replyToEmail = null,
  customSubject = null,
  customBodyHtml = null,
  customBodyText = null,
}) {
  if (!testEmail || !isValidEmail(testEmail)) {
    throw new Error(`Invalid test recipient email address: "${testEmail}"`);
  }

  let camp = null;
  if (campaignId) {
    const { data } = await supabaseAdmin
      .from('email_campaigns')
      .select('*')
      .eq('id', campaignId)
      .maybeSingle();
    camp = data;
  }

  const subject = customSubject || camp?.subject || 'Test: MineTech Campaign Preview';
  const rawHtml = customBodyHtml || camp?.body_html || '<p>This is a test email preview from MineTech Outbound.</p>';
  const rawText = customBodyText || camp?.body_plain || rawHtml.replace(/<[^>]*>?/gm, '');

  const stats = camp?.stats || {};
  const senderConfig = stats.sender || {};
  const finalSenderEmail = senderEmail || senderConfig.email || process.env.EMAIL_FROM || 'rauf@mine-tech.be';
  const finalSenderName = senderName || senderConfig.name || process.env.EMAIL_FROM_NAME || 'Rauf';
  const finalReplyTo = replyToEmail || senderConfig.replyTo || process.env.REPLY_TO || 'rauf@mine-tech.be';

  // Sample lead data for interpolation
  const sampleLead = {
    firstName: 'Abdullah',
    lastName: 'Rauf',
    fullName: 'Abdullah Rauf',
    company: 'MineTech Resources BV',
    jobTitle: 'Commercial Director',
    website: 'https://www.mine-tech.be',
    industry: 'Industrial Minerals',
  };

  const interpolatedSubject = interpolateMergeFields(subject, sampleLead);
  const interpolatedHtml = interpolateMergeFields(rawHtml, sampleLead);
  const interpolatedText = interpolateMergeFields(rawText, sampleLead);

  const cleanHtml = ensureMineTechSignatureHtml(interpolatedHtml);
  const cleanText = ensureMineTechSignatureText(interpolatedText);

  const domain = finalSenderEmail.split('@')[1] || 'mine-tech.be';
  const messageId = `<test-${crypto.randomUUID()}@${domain}>`;

  const dispatchResult = await dispatchViaResend({
    senderEmail: finalSenderEmail,
    senderName: finalSenderName,
    replyToEmail: finalReplyTo,
    recipientEmail: testEmail.trim().toLowerCase(),
    subject: `[TEST] ${interpolatedSubject}`,
    html: cleanHtml,
    text: cleanText,
    generatedMessageId: messageId,
  });

  // Record audit log
  try {
    await supabaseAdmin.from('audit_logs').insert({
      action: 'CAMPAIGN_TEST_EMAIL_SENT',
      entity_type: 'campaign',
      entity_id: campaignId || 'draft-composer',
      details: {
        recipient: testEmail,
        subject: `[TEST] ${interpolatedSubject}`,
        resend_id: dispatchResult.providerMessageId,
      },
    });
  } catch (e) {}

  return {
    success: true,
    recipient: testEmail,
    subject: `[TEST] ${interpolatedSubject}`,
    providerMessageId: dispatchResult.providerMessageId,
    resendId: dispatchResult.providerMessageId,
    message: `Test email successfully dispatched to ${testEmail}`,
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
  getCampaigns,
  getCampaignById,
  updateCampaign,
  deleteCampaign,
  getCampaignDeletionImpact,
  duplicateCampaign,
  archiveCampaign,
  sendCampaignTestEmail,
  normalizeCampaignRecord,
};

export default campaignService;
