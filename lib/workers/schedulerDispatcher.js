import { supabaseAdmin } from '../supabase.js';
import { runEmailBlastWorker } from './emailBlastWorker.js';
import { runAiGenerationWorker } from './aiGenerationWorker.js';
import { processActiveSequences } from '../services/sequenceEngine.js';
import { retryUnprocessedWebhooks } from '../../app/api/webhooks/resend/route.js';

let isDispatcherRunning = false;
const inMemoryLocks = new Map();

/**
 * Distributed System Lock wrapper
 */
export async function acquireLock(lockKey = 'scheduler_master_lock', workerId = 'scheduler-default', ttlSeconds = 60) {
  try {
    const { data, error } = await supabaseAdmin.rpc('acquire_system_lock', {
      p_lock_key: lockKey,
      p_worker_id: workerId,
      p_ttl_seconds: ttlSeconds,
    });
    if (!error && typeof data === 'boolean') {
      return data;
    }
  } catch (e) {}

  // Try direct system_locks table query
  try {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000).toISOString();

    await supabaseAdmin
      .from('system_locks')
      .delete()
      .eq('lock_key', lockKey)
      .lt('expires_at', now.toISOString());

    const { data: inserted, error: insErr } = await supabaseAdmin
      .from('system_locks')
      .insert({
        lock_key: lockKey,
        locked_by: workerId,
        locked_at: now.toISOString(),
        expires_at: expiresAt,
      })
      .select()
      .maybeSingle();

    if (!insErr && inserted) return true;
    if (insErr && (insErr.code === '23505' || insErr.message?.includes('duplicate') || insErr.message?.includes('unique'))) {
      return false; // Lock is actively held by someone else
    }
  } catch (e) {}

  // Fallback: In-Memory / Node-level Distributed Lock
  const now = Date.now();
  const existing = inMemoryLocks.get(lockKey);
  if (existing && existing.expiresAt > now && existing.workerId !== workerId) {
    return false;
  }
  inMemoryLocks.set(lockKey, { workerId, expiresAt: now + ttlSeconds * 1000 });
  return true;
}

export async function releaseLock(lockKey = 'scheduler_master_lock', workerId = 'scheduler-default') {
  try {
    await supabaseAdmin.rpc('release_system_lock', {
      p_lock_key: lockKey,
      p_worker_id: workerId,
    });
  } catch (e) {}

  try {
    await supabaseAdmin
      .from('system_locks')
      .delete()
      .eq('lock_key', lockKey)
      .eq('locked_by', workerId);
  } catch (e) {}

  const existing = inMemoryLocks.get(lockKey);
  if (existing && existing.workerId === workerId) {
    inMemoryLocks.delete(lockKey);
  }
}

/**
 * Dispatcher: Central entry point that wakes pending campaigns, AI generations,
 * sequence steps, and retries pending webhook events.
 */
export async function dispatchScheduledTasks(options = {}) {
  const workerId = options.workerId || `scheduler-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const lockTtl = options.lockTtl || 90;

  // 1. Acquire distributed lock to prevent overlapping runs
  const hasLock = await acquireLock('scheduler_master_lock', workerId, lockTtl);
  if (!hasLock) {
    return {
      success: false,
      message: 'Another scheduler worker is currently holding the dispatch lock',
      dispatched: 0,
    };
  }

  const results = {
    campaignsProcessed: 0,
    aiGenerationsProcessed: 0,
    sequenceStepsProcessed: 0,
    webhooksReconciled: 0,
    errors: [],
  };

  try {
    const now = new Date();
    const nowIso = now.toISOString();

    // 2. Wake Future Scheduled Campaigns
    const { data: scheduledCampaigns } = await supabaseAdmin
      .from('email_campaigns')
      .select('*')
      .eq('status', 'SCHEDULED')
      .lte('scheduled_at', nowIso);

    if (scheduledCampaigns && scheduledCampaigns.length > 0) {
      for (const camp of scheduledCampaigns) {
        await supabaseAdmin
          .from('email_campaigns')
          .update({ status: 'RUNNING', updated_at: nowIso })
          .eq('id', camp.id);
      }
    }

    // 3. Process Active / Running Campaigns
    const { data: activeCampaigns } = await supabaseAdmin
      .from('email_campaigns')
      .select('*')
      .eq('status', 'RUNNING');

    if (activeCampaigns && activeCampaigns.length > 0) {
      for (const campaign of activeCampaigns) {
        try {
          // If AI personalized campaign, run generation worker first
          const isAiCampaign = campaign.campaign_type === 'ai_personalized' || Boolean(campaign.master_prompt);
          if (isAiCampaign) {
            const genRes = await runAiGenerationWorker(campaign.id, { workerId, concurrency: 2 });
            results.aiGenerationsProcessed += genRes.processedCount || 0;
          }

          // Run Email Blast Worker
          const blastRes = await runEmailBlastWorker(campaign.id, { workerId, concurrency: 3 });
          results.campaignsProcessed += blastRes.processedCount || 0;
        } catch (campErr) {
          console.error(`[SchedulerDispatcher] Error processing campaign ${campaign.id}:`, campErr.message);
          results.errors.push({ campaignId: campaign.id, error: campErr.message });
        }
      }
    }

    // 4. Process Active Sequences
    try {
      const seqRes = await processActiveSequences();
      results.sequenceStepsProcessed = seqRes.processed || 0;
    } catch (seqErr) {
      console.error('[SchedulerDispatcher] Error processing sequences:', seqErr.message);
      results.errors.push({ type: 'sequences', error: seqErr.message });
    }

    // 5. Reconcile / Retry Unprocessed Webhooks
    if (typeof retryUnprocessedWebhooks === 'function') {
      try {
        const webhookRes = await retryUnprocessedWebhooks();
        results.webhooksReconciled = webhookRes.reconciled || 0;
      } catch (whErr) {
        console.error('[SchedulerDispatcher] Error retrying webhooks:', whErr.message);
      }
    }

    return {
      success: true,
      workerId,
      results,
    };
  } finally {
    // 6. Release distributed lock
    await releaseLock('scheduler_master_lock', workerId);
  }
}

/**
 * Start heartbeat polling loop for standalone background environments
 */
export function startSchedulerHeartbeat(intervalMs = 15000) {
  if (isDispatcherRunning) return;
  isDispatcherRunning = true;
  console.log(`[SchedulerDispatcher] Started persistent heartbeat timer (interval: ${intervalMs}ms)`);

  const tick = async () => {
    if (!isDispatcherRunning) return;
    try {
      await dispatchScheduledTasks();
    } catch (err) {
      console.error('[SchedulerDispatcher Heartbeat Tick Error]:', err.message);
    } finally {
      if (isDispatcherRunning) {
        setTimeout(tick, intervalMs);
      }
    }
  };

  setTimeout(tick, 1000);
}

export function stopSchedulerHeartbeat() {
  isDispatcherRunning = false;
  console.log('[SchedulerDispatcher] Stopped heartbeat timer');
}

export default {
  acquireLock,
  releaseLock,
  dispatchScheduledTasks,
  startSchedulerHeartbeat,
  stopSchedulerHeartbeat,
};
