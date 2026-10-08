/**
 * Deterministic stop-contact enforcement.
 *
 * When an inbound reply is an unambiguous unsubscribe request, the lead is suppressed
 * immediately - by rules, not by Claude, and without waiting for a human to open the
 * message. The change is strictly protective (it only ever adds suppression) and uses the
 * same fields every other send path already honours (`is_dnc`, `dnc_reason`, status,
 * sequence state), so campaigns, sequences and sendLeadEmail() all stop at once.
 */

import { detectStopSignals } from './safety.js';

async function defaultDb() {
  const mod = await import('../../supabase.js');
  return mod.supabaseAdmin;
}

/**
 * @returns {Promise<{ applied: boolean, reason: string|null }>}
 */
export async function enforceInboundStopSignals({ lead, text = '', subject = '', from = '', messageId = null, db = null, now = new Date() }) {
  if (!lead?.id) return { applied: false, reason: null };

  const signals = detectStopSignals({ text, subject, from });
  if (!signals.unsubscribe) return { applied: false, reason: null };

  const client = db || (await defaultDb());
  const nowIso = now.toISOString();

  // Re-read the row: callers often just updated custom_fields, and we must merge, not clobber.
  const { data: fresh } = await client
    .from('leads')
    .select('is_dnc, dnc_reason, custom_fields')
    .eq('id', lead.id)
    .maybeSingle();
  const current = fresh || lead;

  // Already suppressed for this reason -> nothing to do (idempotent).
  if (current.is_dnc && /unsub/i.test(String(current.dnc_reason || ''))) return { applied: false, reason: 'already_suppressed' };

  const custom = current.custom_fields && typeof current.custom_fields === 'object' ? current.custom_fields : {};

  const sequence = custom.emailSequence || custom.email_sequence;
  const nextCustom = {
    ...custom,
    do_not_contact: true,
    opt_out: true,
    ...(sequence && sequence.status === 'active'
      ? { emailSequence: { ...sequence, status: 'stopped', stopReason: 'Lead unsubscribed (reply)' } }
      : {}),
  };

  const { error } = await client
    .from('leads')
    .update({
      is_dnc: true,
      dnc_reason: 'UNSUBSCRIBED',
      status: 'DO_NOT_CONTACT',
      custom_fields: nextCustom,
      updated_at: nowIso,
    })
    .eq('id', lead.id);

  if (error) throw new Error(`Failed to suppress lead: ${error.message}`);

  await client.from('activity_logs').insert({
    lead_id: lead.id,
    type: 'SUPPRESSION_UPDATED',
    description: 'Lead replied with an unsubscribe / do-not-contact request; suppressed automatically.',
    metadata: { source: 'ai_brain_stop_rules', messageId },
    created_at: nowIso,
  });

  return { applied: true, reason: 'UNSUBSCRIBED' };
}
