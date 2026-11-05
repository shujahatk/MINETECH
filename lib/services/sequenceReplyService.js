/**
 * MineTech Follow-up Sequence & Inbound Reply Service
 * 
 * Manages:
 * - Multi-touch prewritten follow-up sequences with configurable day delays
 * - Sequence conditions: stop-on-reply, stop-on-unsubscribe, stop-on-bounce
 * - Claude-assisted inbound reply categorization (Interested, Pricing, Tech Specs, Samples, Meeting, Not Interested, Unsubscribe, OOO)
 * - CRM relationship status progression based on commercial interactions
 */

import { supabaseAdmin } from '../supabase.js';

const ANTHROPIC_ENDPOINT = 'https://api.anthropic.com/v1/messages';

function getAnthropicKey() {
  return process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY || '';
}

export const REPLY_CATEGORIES = {
  INTERESTED: 'interested',
  REQUESTING_PRICING: 'requesting_pricing',
  REQUESTING_SPECS: 'requesting_technical_specifications',
  REQUESTING_SAMPLES: 'requesting_samples',
  REQUESTING_MEETING: 'requesting_meeting',
  NOT_INTERESTED: 'not_interested',
  UNSUBSCRIBE: 'unsubscribe_request',
  OUT_OF_OFFICE: 'out_of_office',
  DELIVERY_FAILURE: 'delivery_failure',
  OTHER: 'other'
};

/**
 * Heuristic fallback classifier for email replies
 */
export function heuristicCategorizeReply(replyText = '') {
  const lower = (replyText || '').toLowerCase();

  if (lower.includes('unsubscribe') || lower.includes('remove me') || lower.includes('stop emailing') || lower.includes('opt out')) {
    return { category: REPLY_CATEGORIES.UNSUBSCRIBE, confidence: 'high', reason: 'Explicit unsubscribe or opt-out keyword detected' };
  }
  if (lower.includes('out of office') || lower.includes('out of the office') || lower.includes('automatic reply') || lower.includes('autoreply') || lower.includes('on leave') || lower.includes('away from my desk') || lower.includes('annual leave') || lower.includes('vacation')) {
    return { category: REPLY_CATEGORIES.OUT_OF_OFFICE, confidence: 'high', reason: 'Standard automated out-of-office autoreply' };
  }
  if (lower.includes('delivery failure') || lower.includes('mail delivery subsystem') || lower.includes('undeliverable') || lower.includes('address not found')) {
    return { category: REPLY_CATEGORIES.DELIVERY_FAILURE, confidence: 'high', reason: 'Mail delivery failure notice' };
  }
  if (lower.includes('not interested') || lower.includes('not looking') || lower.includes('no need') || lower.includes('no thank')) {
    return { category: REPLY_CATEGORIES.NOT_INTERESTED, confidence: 'high', reason: 'Prospect declined commercial offer' };
  }
  if (lower.includes('sample') || lower.includes('send 1kg') || lower.includes('lab test') || lower.includes('trial quantity')) {
    return { category: REPLY_CATEGORIES.REQUESTING_SAMPLES, confidence: 'high', reason: 'Prospect requested material sample for evaluation' };
  }
  if (lower.includes('spec sheet') || lower.includes('technical data') || lower.includes('coa') || lower.includes('certificate of analysis') || lower.includes('mesh size') || lower.includes('bleaching power')) {
    return { category: REPLY_CATEGORIES.REQUESTING_SPECS, confidence: 'high', reason: 'Prospect requested technical specifications or TDS/COA' };
  }
  if (lower.includes('price') || lower.includes('quote') || lower.includes('quotation') || lower.includes('cif') || lower.includes('fob') || lower.includes('pricing') || lower.includes('cost per ton')) {
    return { category: REPLY_CATEGORIES.REQUESTING_PRICING, confidence: 'high', reason: 'Prospect requested pricing, quotation, or commercial terms' };
  }
  if (lower.includes('call') || lower.includes('meeting') || lower.includes('schedule') || lower.includes('teams') || lower.includes('zoom') || lower.includes('calendar')) {
    return { category: REPLY_CATEGORIES.REQUESTING_MEETING, confidence: 'high', reason: 'Prospect suggested a phone or video call' };
  }
  if (lower.includes('yes') || lower.includes('interested') || lower.includes('more information') || lower.includes('details')) {
    return { category: REPLY_CATEGORIES.INTERESTED, confidence: 'medium', reason: 'Positive commercial inquiry' };
  }

  return { category: REPLY_CATEGORIES.OTHER, confidence: 'low', reason: 'General reply requiring manual review' };
}

/**
 * Categorize reply using Claude AI
 */
export async function categorizeInboundReplyWithClaude({
  subject = '',
  body = '',
  model = 'claude-sonnet-5-5'
}) {
  const apiKey = getAnthropicKey();
  if (!apiKey || !apiKey.startsWith('sk-ant')) {
    return heuristicCategorizeReply(`${subject} ${body}`);
  }

  const systemPrompt = `You are the Commercial Response Triage Specialist for MineTech Resources (Belgium & Netherlands), an industrial minerals trading company.

Analyze the inbound email response from a B2B recipient and classify it into EXACTLY ONE of the following categories:
- "interested"
- "requesting_pricing"
- "requesting_technical_specifications"
- "requesting_samples"
- "requesting_meeting"
- "not_interested"
- "unsubscribe_request"
- "out_of_office"
- "delivery_failure"
- "other"

OUTPUT FORMAT: Strict JSON object ONLY.
{
  "category": string,
  "confidence": "high" | "medium" | "low",
  "sentiment": "positive" | "negative" | "neutral",
  "recommended_crm_status": "ENGAGED" | "QUALIFIED" | "DO_NOT_CONTACT" | "NURTURE",
  "reason": string
}`;

  try {
    const candidateModels = [model, 'claude-sonnet-5-5', 'claude-opus-5-5'];
    const chosenModel = candidateModels.find(Boolean) || 'claude-sonnet-5-5';

    const reqBody = {
      model: chosenModel,
      max_tokens: 800,
      system: systemPrompt,
      messages: [{ role: 'user', content: `Inbound Subject: "${subject}"\nInbound Message:\n${body}` }]
    };

    const res = await fetch(ANTHROPIC_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(reqBody)
    });

    if (res.ok) {
      const data = await res.json();
      const text = (data.content || [])
        .filter((b) => b?.type === 'text' || typeof b?.text === 'string')
        .map((b) => b.text)
        .join('')
        .trim();

      const cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*$/gi, '').trim();
      return JSON.parse(cleaned);
    }
  } catch (err) {
    console.warn('[SequenceReplyService] Claude triage fallback:', err.message);
  }

  return heuristicCategorizeReply(`${subject} ${body}`);
}

/**
 * Handle inbound reply event: categorize, stop sequences, and update CRM status
 */
export async function processInboundReply({
  email,
  leadId,
  campaignId = null,
  subject = '',
  body = ''
}) {
  const triage = await categorizeInboundReplyWithClaude({ subject, body });

  // 1. If unsubscribe, immediately suppress lead
  if (triage.category === REPLY_CATEGORIES.UNSUBSCRIBE) {
    await supabaseAdmin
      .from('leads')
      .update({
        is_dnc: true,
        dnc_reason: 'Unsubscribe request received via email',
        status: 'DO_NOT_CONTACT',
        updated_at: new Date().toISOString()
      })
      .or(`email.eq.${email.toLowerCase().trim()},id.eq.${leadId || '00000000-0000-0000-0000-000000000000'}`);
  } else if (['interested', 'requesting_pricing', 'requesting_technical_specifications', 'requesting_samples', 'requesting_meeting'].includes(triage.category)) {
    // 2. Positive engagement
    await supabaseAdmin
      .from('leads')
      .update({
        status: 'ENGAGED',
        pipeline_stage: 'QUALIFIED',
        updated_at: new Date().toISOString()
      })
      .or(`email.eq.${email.toLowerCase().trim()},id.eq.${leadId || '00000000-0000-0000-0000-000000000000'}`);
  }

  // 3. Mark campaign recipient status as REPLIED to cancel any future follow-ups in that campaign
  if (campaignId || leadId) {
    let q = supabaseAdmin.from('email_recipients').update({
      status: 'REPLIED',
      replied_at: new Date().toISOString()
    });

    if (campaignId) q = q.eq('campaign_id', campaignId);
    if (leadId) q = q.eq('lead_id', leadId);
    else q = q.eq('email', email.toLowerCase().trim());

    await q;
  }

  return triage;
}

/**
 * Automatically assemble an ordered sequence from uploaded prewritten templates
 */
export function buildSequenceFromTemplates(templates = [], { sequenceName = 'Mineral Outreach Sequence', defaultDelays = [0, 4, 5, 7] } = {}) {
  // Sort templates by sequence stage
  const stageWeights = {
    initial_outreach: 1,
    first_follow_up: 2,
    second_follow_up: 3,
    final_follow_up: 4,
    general: 5
  };

  const sorted = [...templates].sort((a, b) => {
    const wa = stageWeights[a.sequence_stage] || 99;
    const wb = stageWeights[b.sequence_stage] || 99;
    return wa - wb;
  });

  const steps = sorted.map((tpl, idx) => ({
    stepNumber: idx + 1,
    templateId: tpl.id,
    templateName: tpl.name,
    subject: tpl.subject,
    sequenceStage: tpl.sequence_stage || (idx === 0 ? 'initial_outreach' : `follow_up_${idx}`),
    delayDays: defaultDelays[idx] !== undefined ? defaultDelays[idx] : 5,
    stopConditions: ['on_reply', 'on_unsubscribe', 'on_bounce']
  }));

  return {
    name: sequenceName,
    steps,
    totalSteps: steps.length,
    estimatedTotalDays: steps.reduce((sum, s) => sum + s.delayDays, 0)
  };
}
