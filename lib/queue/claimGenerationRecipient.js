import { supabaseAdmin } from '../supabase.js';

/**
 * Atomically claim the next pending AI generation recipient
 *
 * @param {string} workerId - Unique ID identifying the worker instance
 * @param {number} timeoutMinutes - Stale lock threshold in minutes (default: 5)
 * @param {string} [campaignId] - Optional campaign ID filter
 * @returns {Promise<Object|null>} Claimed recipient document or null
 */
export async function claimNextPendingGeneration(workerId = 'gen-worker-default', timeoutMinutes = 5, campaignId = null) {
  const now = new Date();
  const staleThreshold = new Date(now.getTime() - timeoutMinutes * 60 * 1000).toISOString();
  const nowIso = now.toISOString();

  // 1. Attempt PostgreSQL RPC claim_next_generation_recipient if available
  if (campaignId) {
    try {
      const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc('claim_next_generation_recipient', {
        p_blast_id: campaignId,
        p_worker_id: workerId,
        p_stale_interval_seconds: timeoutMinutes * 60,
      });

      if (!rpcError && rpcData && rpcData.length > 0) {
        const claimed = rpcData[0];
        return {
          ...claimed,
          _id: claimed.id,
          leadId: claimed.lead_id,
          campaignId: claimed.blast_id || campaignId,
          generatedSubject: claimed.generated_subject || claimed.tokens?.generated_subject || '',
          generatedBody: claimed.generated_body || claimed.tokens?.generated_body || '',
          generationStatus: claimed.generation_status || 'processing',
          generation_worker_id: claimed.generation_worker_id || claimed.tokens?.generation_claimed_by || workerId,
        };
      }
    } catch (e) {
      // Fallback to conditional update
    }
  }

  // 2. Safe Fallback: Atomic Conditional Update Loop
  let query = supabaseAdmin
    .from('email_recipients')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(30);

  if (campaignId) {
    query = query.eq('campaign_id', campaignId);
  }

  const { data: candidates, error: findError } = await query;
  if (findError || !candidates || candidates.length === 0) {
    return null;
  }

const activeClaimAttempts = new Set();

  for (const candidate of candidates) {
    if (activeClaimAttempts.has(candidate.id)) continue;
    activeClaimAttempts.add(candidate.id);

    try {
      const genStatus = candidate.tokens?.generation_status || candidate.generation_status || 'pending';
      const isPending = genStatus === 'pending';
      const lockedAt = candidate.tokens?.generation_locked_at || candidate.generation_locked_at || candidate.generation_claimed_at;
      const isStale = (genStatus === 'processing' || genStatus === 'generating') && lockedAt &&
        new Date(lockedAt).getTime() < new Date(staleThreshold).getTime();

      if (!isPending && !isStale) continue;

      const updatedTokens = {
        ...(candidate.tokens || {}),
        generation_status: 'processing',
        generation_claimed_by: workerId,
        generation_locked_at: nowIso,
        generation_attempts: ((candidate.tokens?.generation_attempts || 0) + 1),
      };

      // Atomic conditional update ensuring status hasn't changed
      let updateQuery = supabaseAdmin
        .from('email_recipients')
        .update({
          tokens: updatedTokens,
          updated_at: nowIso,
        })
        .eq('id', candidate.id);

      if (isPending) {
        updateQuery = updateQuery.filter('tokens->>generation_status', 'eq', 'pending');
      } else if (candidate.tokens?.generation_locked_at) {
        updateQuery = updateQuery.filter('tokens->>generation_locked_at', 'eq', candidate.tokens.generation_locked_at);
      }

      const { data: updated, error: lockError } = await updateQuery.select().maybeSingle();

      if (!lockError && updated) {
        return {
          ...updated,
          _id: updated.id,
          leadId: updated.lead_id,
          campaignId: updated.campaign_id || updated.blast_id,
          generatedSubject: updated.tokens?.generated_subject || '',
          generatedBody: updated.tokens?.generated_body || '',
          generationStatus: updated.tokens?.generation_status || 'processing',
          generation_worker_id: workerId,
          generation_claimed_by: workerId,
        };
      }
    } finally {
      setTimeout(() => activeClaimAttempts.delete(candidate.id), 2000);
    }
  }

  return null;
}

export const claimNextPendingGenerationRecipient = (campaignId, workerId, timeoutMinutes) => {
  if (typeof campaignId === 'string' && typeof workerId === 'string') {
    return claimNextPendingGeneration(workerId, timeoutMinutes || 5, campaignId);
  }
  return claimNextPendingGeneration(campaignId || 'gen-worker-default', workerId || 5, timeoutMinutes || null);
};

/**
 * Mark generation successfully completed with generated copy
 */
export async function markGenerationReady(recipientId, generatedSubject, generatedBody) {
  const cleanId = typeof recipientId === 'object' && recipientId.id ? recipientId.id : recipientId;
  const nowIso = new Date().toISOString();

  const { data: current } = await supabaseAdmin
    .from('email_recipients')
    .select('tokens')
    .eq('id', cleanId)
    .single();

  const updatedTokens = {
    ...(current?.tokens || {}),
    generated_subject: generatedSubject,
    generated_body: generatedBody,
    generation_status: 'ready',
    generation_error: '',
    generation_claimed_by: null,
    generation_locked_at: null,
    generated_at: nowIso,
  };

  return supabaseAdmin
    .from('email_recipients')
    .update({
      tokens: updatedTokens,
      updated_at: nowIso,
    })
    .eq('id', cleanId);
}

/**
 * Mark generation permanently failed with explicit error reason
 */
export async function markGenerationFailed(recipientId, errorReason = 'AI generation failed') {
  const cleanId = typeof recipientId === 'object' && recipientId.id ? recipientId.id : recipientId;
  const nowIso = new Date().toISOString();

  const { data: current } = await supabaseAdmin
    .from('email_recipients')
    .select('tokens')
    .eq('id', cleanId)
    .single();

  const updatedTokens = {
    ...(current?.tokens || {}),
    generation_status: 'failed',
    generation_error: String(errorReason),
    generation_claimed_by: null,
    generation_locked_at: null,
    generation_failed_at: nowIso,
  };

  return supabaseAdmin
    .from('email_recipients')
    .update({
      tokens: updatedTokens,
      updated_at: nowIso,
    })
    .eq('id', cleanId);
}

/**
 * Release generation lock on transient error so it can be retried
 */
export async function releaseGenerationLock(recipientId, errorMsg = '') {
  const cleanId = typeof recipientId === 'object' && recipientId.id ? recipientId.id : recipientId;
  const nowIso = new Date().toISOString();

  const { data: current } = await supabaseAdmin
    .from('email_recipients')
    .select('tokens')
    .eq('id', cleanId)
    .single();

  const updatedTokens = {
    ...(current?.tokens || {}),
    generation_status: 'pending',
    generation_error: String(errorMsg),
    generation_claimed_by: null,
    generation_locked_at: null,
  };

  return supabaseAdmin
    .from('email_recipients')
    .update({
      tokens: updatedTokens,
      updated_at: nowIso,
    })
    .eq('id', cleanId);
}

export default {
  claimNextPendingGeneration,
  claimNextPendingGenerationRecipient,
  markGenerationReady,
  markGenerationFailed,
  releaseGenerationLock,
};
