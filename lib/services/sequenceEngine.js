import { supabaseAdmin } from '../supabase.js';
import { sendLeadEmail } from './emailService.js';
import { isLeadSuppressed } from './leadService.js';

/**
 * Evaluates whether a lead is eligible to continue in an outbound sequence
 */
export function isSequenceEligible(lead = {}) {
  if (!lead) return false;
  if (isLeadSuppressed(lead, 'all')) return false;

  const customFields = lead.custom_fields || {};
  if (lead.hasUnansweredReply || customFields.has_unanswered_reply) return false;
  if (lead.booking?.isBooked || lead.status === 'meeting-booked' || lead.status === 'CUSTOMER') return false;
  if (lead.status === 'DO_NOT_CONTACT' || lead.status === 'DNC' || lead.status === 'NOT_INTERESTED') return false;
  return true;
}

/**
 * Process next step for leads enrolled in sequences via Supabase PostgreSQL
 */
export async function processActiveSequences() {
  const now = new Date();
  const nowIso = now.toISOString();

  // 1. Query candidate leads with custom_fields containing emailSequence
  const { data: leads, error: leadsErr } = await supabaseAdmin
    .from('leads')
    .select('*')
    .not('is_dnc', 'eq', true)
    .neq('status', 'DO_NOT_CONTACT');

  if (leadsErr || !leads) {
    console.error('[SequenceEngine] Failed to query leads:', leadsErr?.message);
    return { processed: 0, stopped: 0 };
  }

  let processed = 0;
  let stopped = 0;

  for (const lead of leads) {
    const customFields = lead.custom_fields || {};
    const emailSeq = customFields.emailSequence || customFields.email_sequence;

    if (!emailSeq || emailSeq.status !== 'active') {
      continue;
    }

    if (emailSeq.nextSendAt && new Date(emailSeq.nextSendAt).getTime() > now.getTime()) {
      continue;
    }

    // Safety check
    if (!isSequenceEligible(lead)) {
      emailSeq.status = 'stopped';
      emailSeq.stopReason = lead.booking?.isBooked
        ? 'Meeting Booked'
        : (customFields.has_unanswered_reply ? 'Prospect Replied' : 'Lead Suppressed / Opted Out');

      await supabaseAdmin
        .from('leads')
        .update({
          custom_fields: { ...customFields, emailSequence: emailSeq },
          updated_at: nowIso,
        })
        .eq('id', lead.id);

      stopped++;
      continue;
    }

    const seqId = emailSeq.sequenceId || emailSeq.sequence_id;
    if (!seqId) {
      emailSeq.status = 'completed';
      await supabaseAdmin
        .from('leads')
        .update({
          custom_fields: { ...customFields, emailSequence: emailSeq },
          updated_at: nowIso,
        })
        .eq('id', lead.id);
      continue;
    }

    // Fetch sequence from Supabase
    const { data: sequence } = await supabaseAdmin
      .from('email_sequences')
      .select('*')
      .eq('id', seqId)
      .maybeSingle();

    if (!sequence || !sequence.steps || sequence.steps.length === 0) {
      emailSeq.status = 'completed';
      await supabaseAdmin
        .from('leads')
        .update({
          custom_fields: { ...customFields, emailSequence: emailSeq },
          updated_at: nowIso,
        })
        .eq('id', lead.id);
      continue;
    }

    const currentStepIndex = emailSeq.currentStep || 0;
    const step = sequence.steps[currentStepIndex];

    if (!step) {
      emailSeq.status = 'completed';
      await supabaseAdmin
        .from('leads')
        .update({
          custom_fields: { ...customFields, emailSequence: emailSeq },
          updated_at: nowIso,
        })
        .eq('id', lead.id);
      continue;
    }

    // Execute Step
    try {
      if (step.type === 'email' || !step.type) {
        await sendLeadEmail({
          leadId: lead.id,
          subject: step.subject || 'Outbound Update',
          bodyHtml: step.bodyHtml || step.body_html || '<p>Hello {{firstName}},</p>',
          bodyText: step.bodyText || step.body_plain || '',
        });
      }

      const nextIndex = currentStepIndex + 1;
      if (nextIndex < sequence.steps.length) {
        const nextStep = sequence.steps[nextIndex];
        const delayHours = (nextStep.delayDays || 1) * 24 + (nextStep.delayHours || 0);
        emailSeq.currentStep = nextIndex;
        emailSeq.nextSendAt = new Date(now.getTime() + delayHours * 60 * 60 * 1000).toISOString();
        emailSeq.lastSentAt = nowIso;
        emailSeq.emailsSent = (emailSeq.emailsSent || 0) + 1;
      } else {
        emailSeq.status = 'completed';
        emailSeq.nextSendAt = null;
      }

      await supabaseAdmin
        .from('leads')
        .update({
          custom_fields: { ...customFields, emailSequence: emailSeq },
          updated_at: nowIso,
        })
        .eq('id', lead.id);

      processed++;
    } catch (err) {
      console.error(`[SequenceEngine] Failed step execution for lead ${lead.id}:`, err.message);
    }
  }

  return { processed, stopped };
}

export default {
  isSequenceEligible,
  processActiveSequences,
};
