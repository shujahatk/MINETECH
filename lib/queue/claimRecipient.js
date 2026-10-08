import { supabaseAdmin } from '../supabase.js';

/**
 * Atomically claim the next pending or stale-processing recipient from Supabase PostgreSQL.
 * Strict requirement: AI-generated campaign recipients must NEVER enter the send queue until generation_status is 'ready'.
 * Only ONE worker can claim any given recipient at a time.
 *
 * @param {string} arg1 - Worker ID or Campaign ID
 * @param {number|string} arg2 - Timeout in minutes or Worker ID
 * @param {string|number|null} arg3 - Campaign ID or Timeout in minutes
 * @returns {Promise<Object|null>} Claimed recipient document or null
 */
export async function claimNextPendingRecipient(arg1 = 'worker-default', arg2 = 5, arg3 = null) {
  let workerId = 'worker-default';
  let timeoutMinutes = 5;
  let campaignId = null;

  if (typeof arg2 === 'string') {
    // Called as (campaignId, workerId, timeoutMinutes)
    campaignId = arg1;
    workerId = arg2;
    timeoutMinutes = typeof arg3 === 'number' ? arg3 : 5;
  } else {
    // Called as (workerId, timeoutMinutes, campaignId)
    workerId = typeof arg1 === 'string' ? arg1 : 'worker-default';
    timeoutMinutes = typeof arg2 === 'number' ? arg2 : 5;
    campaignId = arg3;
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const staleThreshold = new Date(now.getTime() - timeoutMinutes * 60 * 1000).toISOString();

  // 1. Primary Strategy: Try PostgreSQL RPC function with FOR UPDATE SKIP LOCKED
  try {
    const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc('claim_next_email_recipient', {
      p_blast_id: campaignId || null,
      p_worker_id: workerId,
      p_stale_interval_seconds: timeoutMinutes * 60,
    });

    if (!rpcError && rpcData) {
      const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
      if (row && row.id) {
        return formatClaimedRecipient(row);
      }
    }
  } catch (rpcErr) {
    // Fall back to conditional atomic update loop below
  }

  // 2. Fallback Strategy: Safe Conditional Atomic Claiming Loop
  let query = supabaseAdmin
    .from('email_recipients')
    .select('*')
    .in('status', ['PENDING', 'pending', 'PROCESSING', 'processing'])
    .order('created_at', { ascending: true })
    .limit(30);

  if (campaignId) {
    query = query.eq('campaign_id', campaignId);
  }

  const { data: candidates, error: findError } = await query;
  if (findError || !candidates || candidates.length === 0) {
    return null;
  }

  for (const candidate of candidates) {
    const status = (candidate.status || '').toUpperCase();
    const isPending = status === 'PENDING';
    const lockTime = candidate.locked_at || candidate.claimed_at;
    const isStale =
      status === 'PROCESSING' &&
      lockTime &&
      new Date(lockTime).getTime() < new Date(staleThreshold).getTime();

    if (!isPending && !isStale) continue;

    // Verify scheduled time (must not be in future)
    if (candidate.scheduled_at && new Date(candidate.scheduled_at).getTime() > Date.now() + 2000) {
      continue;
    }

    // Strict AI Generation Status Blocking:
    // If generation is in progress/pending/failed, block from send queue
    const genStatus = candidate.tokens?.generation_status || candidate.generation_status || 'ready';
    if (genStatus !== 'ready') {
      continue;
    }

    // Verify campaign status is RUNNING if candidate has campaign_id
    const targetCampaignId = candidate.campaign_id || candidate.blast_id;
    if (targetCampaignId) {
      const { data: camp } = await supabaseAdmin
        .from('email_campaigns')
        .select('status, stats')
        .eq('id', targetCampaignId)
        .maybeSingle();

      if (camp) {
        if ((camp.status || '').toUpperCase() !== 'RUNNING') {
          continue;
        }
        // If campaign is AI-driven and generation not ready -> skip
        const isAiCampaign = Boolean(camp.stats?.master_prompt || candidate.tokens?.master_prompt);
        if (isAiCampaign && genStatus !== 'ready') {
          continue;
        }
      }
    }

    // Attempt conditional atomic claim:
    let claimQuery = supabaseAdmin
      .from('email_recipients')
      .update({
        status: 'PROCESSING',
        claimed_by: workerId,
        locked_at: nowIso,
        updated_at: nowIso,
      })
      .eq('id', candidate.id);

    if (isPending) {
      claimQuery = claimQuery.in('status', ['PENDING', 'pending']);
    } else {
      const previousLock = candidate.locked_at;
      if (previousLock) {
        claimQuery = claimQuery.eq('locked_at', previousLock);
      }
    }

    const { data: claimed, error: lockError } = await claimQuery.select().maybeSingle();

    if (!lockError && claimed) {
      // Won the atomic race for this recipient
      return formatClaimedRecipient(claimed);
    }
  }

  return null;
}

function formatClaimedRecipient(row) {
  return {
    ...row,
    _id: row.id,
    leadId: row.lead_id,
    campaignId: row.campaign_id || row.blast_id,
    blast_id: row.blast_id || row.campaign_id,
    resendId: row.resend_id || row.tokens?.resend_id || '',
    generatedSubject: row.generated_subject || row.custom_subject || row.tokens?.generated_subject || '',
    generatedBody: row.generated_body || row.custom_body || row.tokens?.generated_body || '',
    generationStatus: row.tokens?.generation_status || row.generation_status || 'ready',
  };
}

/**
 * Release lock on transient failure so job can be safely retried
 */
export async function releaseRecipientLock(recipientId, errorMsg = '') {
  const cleanId = typeof recipientId === 'object' && recipientId.id ? recipientId.id : recipientId;
  return supabaseAdmin
    .from('email_recipients')
    .update({
      status: 'PENDING',
      claimed_by: null,
      locked_at: null,
      error_message: String(errorMsg || ''),
      updated_at: new Date().toISOString(),
    })
    .eq('id', cleanId);
}

/**
 * Mark recipient as successfully sent with provider message ID
 */
export async function markRecipientSent(recipientId, providerMessageId = null) {
  const cleanId = typeof recipientId === 'object' && recipientId.id ? recipientId.id : recipientId;
  const nowIso = new Date().toISOString();

  // Fetch current tokens to preserve existing metadata
  const { data: currentRec } = await supabaseAdmin
    .from('email_recipients')
    .select('tokens')
    .eq('id', cleanId)
    .maybeSingle();

  const updatedTokens = {
    ...(currentRec?.tokens || {}),
  };
  if (providerMessageId) {
    updatedTokens.resend_id = String(providerMessageId);
  }

  const updatePayload = {
    status: 'SENT',
    sent_at: nowIso,
    claimed_by: null,
    locked_at: null,
    tokens: updatedTokens,
    updated_at: nowIso,
  };

  return supabaseAdmin
    .from('email_recipients')
    .update(updatePayload)
    .eq('id', cleanId);
}

/**
 * Mark recipient as permanently failed
 */
export async function markRecipientFailed(recipientId, errorReason = 'Failed to send') {
  const cleanId = typeof recipientId === 'object' && recipientId.id ? recipientId.id : recipientId;
  const nowIso = new Date().toISOString();

  return supabaseAdmin
    .from('email_recipients')
    .update({
      status: 'FAILED',
      error_message: String(errorReason),
      claimed_by: null,
      locked_at: null,
      updated_at: nowIso,
    })
    .eq('id', cleanId);
}

export const markRecipientPermanentFailure = markRecipientFailed;

export default {
  claimNextPendingRecipient,
  releaseRecipientLock,
  markRecipientSent,
  markRecipientFailed,
  markRecipientPermanentFailure,
};
