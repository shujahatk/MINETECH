import { supabaseAdmin } from '../supabase.js';

/**
 * MineTech AI-Powered Lead Scoring Engine (Claude 3.5 Sonnet Integration)
 * Computes Fit Score (ICP Match), Intent Score (Signals), Engagement Score (Response Index),
 * and human-readable Priority Justifications in real-time.
 */

/**
 * High-accuracy deterministic heuristic scoring fallback
 */
export function calculateFitScore(lead = {}) {
  let score = 35;
  const title = (lead.jobTitle || lead.job_title || lead.position || '').toLowerCase();
  const industry = (lead.industry || lead.niche || lead.company || '').toLowerCase();
  const phone = (lead.phone || '').trim();
  const email = (lead.email || '').trim();

  // 1. Decision Maker Authority
  if (title.includes('ceo') || title.includes('founder') || title.includes('owner') || title.includes('president') || title.includes('co-founder')) {
    score += 40;
  } else if (title.includes('vp') || title.includes('vice president') || title.includes('chief') || title.includes('cro') || title.includes('cmo') || title.includes('cto') || title.includes('head')) {
    score += 35;
  } else if (title.includes('director') || title.includes('partner') || title.includes('principal')) {
    score += 25;
  } else if (title.includes('manager') || title.includes('lead') || title.includes('executive')) {
    score += 15;
  }

  // 2. High-Value ICP Target Industry
  if (
    industry.includes('tech') ||
    industry.includes('software') ||
    industry.includes('saas') ||
    industry.includes('biotech') ||
    industry.includes('bio') ||
    industry.includes('health') ||
    industry.includes('fintech') ||
    industry.includes('finance') ||
    industry.includes('ai') ||
    industry.includes('consulting') ||
    industry.includes('enterprise')
  ) {
    score += 20;
  } else if (industry.length > 2) {
    score += 10;
  }

  // 3. Contactability
  if (email && email.includes('@')) score += 5;
  if (phone && phone.length >= 7) score += 5;

  return Math.min(100, Math.max(20, score));
}

export function calculateIntentScore(lead = {}) {
  let score = 40;
  const title = (lead.jobTitle || lead.job_title || '').toLowerCase();
  const status = (lead.status || '').toUpperCase();
  const notes = (lead.notes || '').toLowerCase();

  if (title.includes('growth') || title.includes('revenue') || title.includes('sales') || title.includes('acquisition') || title.includes('marketing')) {
    score += 30;
  } else if (title.includes('research') || title.includes('product') || title.includes('operations')) {
    score += 20;
  }

  if (status === 'INTERESTED' || status === 'QUALIFIED' || status === 'ENGAGED') {
    score += 25;
  }

  if (notes.includes('expansion') || notes.includes('hiring') || notes.includes('funding') || notes.includes('pipeline') || notes.includes('outbound')) {
    score += 25;
  }

  return Math.min(100, Math.max(15, score));
}

export function calculateEngagementScore(lead = {}, activityStats = {}) {
  let score = 25; // Baseline for uncontacted leads
  const status = (lead.status || '').toUpperCase();
  const opens = activityStats.opens || 0;
  const clicks = activityStats.clicks || 0;
  const replies = activityStats.replies || (lead.hasUnansweredReply ? 1 : 0);

  if (status === 'CONTACTED') score += 20;
  if (status === 'ENGAGED' || status === 'INTERESTED') score += 40;

  score += Math.min(25, opens * 10);
  score += Math.min(25, clicks * 15);
  score += Math.min(40, replies * 35);

  return Math.min(100, Math.max(10, score));
}

export function evaluateLeadScoring(lead = {}, activityStats = {}) {
  const fitScore = calculateFitScore(lead);
  const intentScore = calculateIntentScore(lead);
  const engagementScore = calculateEngagementScore(lead, activityStats);

  // Weighted Composite Score: 45% ICP Fit, 35% Intent Signals, 20% Engagement
  const compositeScore = Math.min(
    100,
    Math.max(15, Math.round(fitScore * 0.45 + intentScore * 0.35 + engagementScore * 0.20))
  );

  let priority = 'WARM';
  if (compositeScore >= 80) priority = 'HOT';
  else if (compositeScore < 50) priority = 'COLD';

  const reason = `${lead.jobTitle || lead.job_title || 'Executive'} @ ${lead.company || 'Target Company'} (${lead.industry || 'B2B Industry'})`;

  return {
    fitScore,
    intentScore,
    engagementScore,
    leadScore: compositeScore,
    compositeScore,
    priority,
    reason,
  };
}

/**
 * Score a batch of leads in real-time using Claude 3.5 Sonnet
 */
export async function scoreBatchWithClaude(leads = []) {
  if (!leads || leads.length === 0) return [];

  // If Anthropic API key is not configured, fallback gracefully to heuristic scoring
  if (!process.env.ANTHROPIC_API_KEY || !process.env.ANTHROPIC_API_KEY.startsWith('sk-ant')) {
    return leads.map((l) => {
      const scored = evaluateLeadScoring(l);
      return {
        ...l,
        scoring: {
          fitScore: scored.fitScore,
          intentScore: scored.intentScore,
          engagementScore: scored.engagementScore,
          compositeScore: scored.compositeScore,
          reason: scored.reason,
        },
        score: scored.compositeScore,
      };
    });
  }

  try {
    const candidateModels = [
      'claude-sonnet-4-5-20250929',
      'claude-haiku-4-5-20251001',
      'claude-3-5-sonnet-20241022',
    ];

    const promptPayload = leads.map((l, idx) => ({
      index: idx,
      name: l.fullName || `${l.firstName || ''} ${l.lastName || ''}`.trim() || l.first_name,
      jobTitle: l.jobTitle || l.job_title || '',
      company: l.company || '',
      industry: l.industry || l.niche || '',
      email: l.email || '',
      phone: l.phone || '',
    }));

    const systemPrompt = `You are the MINETECH Outbound AI Scoring Engine.
Evaluate each B2B prospect in the provided array and return a JSON array containing exact scoring objects:
- fitScore (integer 10-100): How closely they match a high-ticket B2B decision-maker profile (C-Suite, VP, Director in Tech/SaaS/Biotech/Fintech/Agency = 85-98).
- intentScore (integer 10-100): Buying velocity & market timing signals (Growth, Revenue, Sales, Operations leaders = 80-95).
- engagementScore (integer 10-100): Contactability & response probability (70-85 baseline for verified email+phone).
- compositeScore (integer 10-100): Weighted formula round(fitScore * 0.45 + intentScore * 0.35 + engagementScore * 0.20).
- reason (string): Concise 1-sentence explanation of why this prospect is high or low priority.

RESPOND ONLY WITH A VALID JSON ARRAY OF OBJECTS in the format:
[
  { "index": 0, "fitScore": 92, "intentScore": 85, "engagementScore": 78, "compositeScore": 87, "reason": "C-Level decision maker at high-growth enterprise" }
]`;

    let claudeResponseText = '';
    for (const model of candidateModels) {
      try {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model,
            max_tokens: 1500,
            system: systemPrompt,
            messages: [
              {
                role: 'user',
                content: `Score these prospects:\n${JSON.stringify(promptPayload, null, 2)}`,
              },
            ],
          }),
        });

        if (res.ok) {
          const json = await res.json();
          claudeResponseText = json.content?.[0]?.text || '';
          break;
        }
      } catch (err) {
        console.warn(`[AI Scoring] Model ${model} failed, trying next...`);
      }
    }

    if (claudeResponseText) {
      const cleanJson = claudeResponseText.replace(/^```(?:json)?/im, '').replace(/```$/m, '').trim();
      const parsedScores = JSON.parse(cleanJson);

      if (Array.isArray(parsedScores) && parsedScores.length > 0) {
        return leads.map((l, idx) => {
          const aiScore = parsedScores.find((s) => s.index === idx) || parsedScores[idx];
          if (aiScore) {
            const fitScore = Number(aiScore.fitScore) || 75;
            const intentScore = Number(aiScore.intentScore) || 75;
            const engagementScore = Number(aiScore.engagementScore) || 70;
            const compositeScore = Number(aiScore.compositeScore) || Math.round(fitScore * 0.45 + intentScore * 0.35 + engagementScore * 0.20);
            return {
              ...l,
              scoring: {
                fitScore,
                intentScore,
                engagementScore,
                compositeScore,
                reason: aiScore.reason || 'AI Scored Prospect',
              },
              score: compositeScore,
            };
          }
          const scored = evaluateLeadScoring(l);
          return {
            ...l,
            scoring: {
              fitScore: scored.fitScore,
              intentScore: scored.intentScore,
              engagementScore: scored.engagementScore,
              compositeScore: scored.compositeScore,
              reason: scored.reason,
            },
            score: scored.compositeScore,
          };
        });
      }
    }
  } catch (err) {
    console.warn('[AI Scoring] Claude batch scoring error, falling back to heuristic engine:', err.message);
  }

  // Fallback to heuristic
  return leads.map((l) => {
    const scored = evaluateLeadScoring(l);
    return {
      ...l,
      scoring: {
        fitScore: scored.fitScore,
        intentScore: scored.intentScore,
        engagementScore: scored.engagementScore,
        compositeScore: scored.compositeScore,
        reason: scored.reason,
      },
      score: scored.compositeScore,
    };
  });
}

export default {
  calculateFitScore,
  calculateIntentScore,
  calculateEngagementScore,
  evaluateLeadScoring,
  scoreBatchWithClaude,
};
