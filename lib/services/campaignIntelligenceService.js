/**
 * MineTech Campaign Intelligence Service (Claude Campaign Brain)
 * 
 * Powered by:
 * - Default Campaign Intelligence: claude-sonnet-5-5
 * - Advanced Campaign Reasoning: claude-opus-5-5
 * 
 * Provides end-to-end campaign planning, audience segmentation (Buyer/Seller),
 * strategy formulation, copy generation, messaging critique, follow-up sequence
 * recommendations, and performance review.
 */

import { ensureMineTechSignatureHtml, ensureMineTechSignatureText } from '../utils/signature.js';

export const CAMPAIGN_CLAUDE_MODELS = {
  SONNET_5_5: {
    id: 'claude-sonnet-5-5',
    name: 'MineTech AI (Sonnet 5.5)',
    displayName: 'MineTech AI (Sonnet 5.5)',
    description: 'High-speed campaign intelligence for strategy, audience analysis, and copy generation',
  },
  OPUS_5_5: {
    id: 'claude-opus-5-5',
    name: 'MineTech AI High (Opus 5.5)',
    displayName: 'MineTech AI High (Opus 5.5)',
    description: 'Premium reasoning for complex multi-channel strategy, sequence planning, and deep analysis',
  },
};

export const DEFAULT_CAMPAIGN_MODEL = CAMPAIGN_CLAUDE_MODELS.SONNET_5_5.id;

function getAnthropicKey() {
  return process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY || '';
}

/**
 * Execute request against Anthropic Messages API
 */
async function callAnthropic({ model = DEFAULT_CAMPAIGN_MODEL, system, messages, maxTokens = 3000, temperature = 0.7 }) {
  const apiKey = getAnthropicKey();
  if (!apiKey || !apiKey.startsWith('sk-ant')) {
    throw new Error('Anthropic API key is not configured or invalid');
  }

  // Ensure preferred model comes first, followed by fallbacks
  const candidateModels = [
    model,
    process.env.ANTHROPIC_MODEL,
    process.env.CLAUDE_MODEL,
    'claude-sonnet-5-5',
    'claude-opus-5-5',
    'claude-sonnet-4-6',
  ].filter(Boolean);

  const uniqueModels = [...new Set(candidateModels)];
  let lastError = null;

  for (const m of uniqueModels) {
    try {
      const reqBody = {
        model: m,
        max_tokens: maxTokens,
        system,
        messages,
      };
      // Note: Anthropic Sonnet 5.5 and Opus 5.5 deprecate the temperature parameter
      if (temperature != null && !m.includes('5-5') && !m.includes('opus')) {
        reqBody.temperature = temperature;
      }

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(reqBody),
      });

      if (response.ok) {
        const data = await response.json();
        const text = (data?.content || [])
          .filter((b) => b?.type === 'text' || typeof b?.text === 'string')
          .map((b) => b.text)
          .join('')
          .trim() || data.content?.[0]?.text || '';

        return {
          text,
          actualModel: m,
          usage: data.usage || { input_tokens: 0, output_tokens: 0 },
        };
      }

      const errData = await response.json().catch(() => ({}));
      lastError = new Error(`Anthropic API error (${response.status}) on model ${m}: ${errData?.error?.message || response.statusText}`);
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('All candidate Anthropic models failed');
}

/**
 * Clean and extract JSON from model output defensively
 */
function extractJson(text) {
  if (!text) return null;
  const cleaned = text
    .replace(/^```(?:json)?/im, '')
    .replace(/```$/m, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch (e2) {}
    }
  }
  return null;
}

/**
 * 1. Develop Comprehensive Campaign Strategy
 */
export async function developCampaignStrategy({
  campaignName = '',
  objective = 'Industrial mineral supply introduction',
  leadsSample = [],
  filterCriteria = {},
  model = DEFAULT_CAMPAIGN_MODEL,
}) {
  const buyerCount = leadsSample.filter((l) => (l.classification || '').toUpperCase() === 'BUYER').length;
  const sellerCount = leadsSample.filter((l) => (l.classification || '').toUpperCase() === 'SELLER').length;
  const unclassifiedCount = leadsSample.length - buyerCount - sellerCount;

  const leadIndustries = [...new Set(leadsSample.map((l) => l.industry || l.niche).filter(Boolean))].slice(0, 8);
  const sampleCompanies = leadsSample.slice(0, 5).map((l) => `${l.company || 'Company'} (${l.classification || 'UNCLASSIFIED'})`).join(', ');

  const system = `You are the Chief Commercial Strategist for MineTech Resources BV (industrial minerals: kaolin, calcined chamotte, bentonite, bauxite, bleaching clay with warehousing in Lamswaarde, Netherlands and registered in Antwerp, Belgium).
You formulate high-converting, executive B2B outbound campaign strategies.
Analyze the target audience and Buyer/Seller breakdown carefully.
Buyers (e.g. ceramic manufacturers, refractory producers, sanitaryware, paint factories) care about chemical assay consistency, low iron content, certified technical data sheets (TDS), and buffer stock security.
Sellers/Traders care about off-take partnerships, port handling, and supply agreements.

Respond ONLY with a valid JSON object matching this schema:
{
  "strategySummary": "2-3 sentences summarizing the strategic campaign angle",
  "recommendedAngle": "Specific commercial proposition",
  "buyerSellerRecommendation": "How to handle the audience classification mix",
  "messagingPillars": ["Pillar 1", "Pillar 2", "Pillar 3"],
  "recommendedSubjectThemes": [
    {"theme": "Theme title", "example": "Subject example", "appeal": "Reason why it opens"}
  ],
  "callToAction": "Recommended low-friction CTA (e.g. 5-min assay benchmark call)",
  "followUpStrategy": "Timing and angle recommendations for follow-ups"
}`;

  const userContent = `Campaign Name: "${campaignName || 'Industrial Outreach'}"
Stated Objective: "${objective}"
Audience Statistics:
- Total Leads Sample: ${leadsSample.length}
- Buyers: ${buyerCount}
- Sellers: ${sellerCount}
- Unclassified: ${unclassifiedCount}
- Top Industries: ${leadIndustries.join(', ') || 'Ceramics, Refractory, Industrial Minerals'}
- Sample Targets: ${sampleCompanies || 'Industrial manufacturing executives'}
- Filter Criteria: ${JSON.stringify(filterCriteria)}

Please develop a comprehensive, commercial campaign strategy tailored specifically for MineTech Outbound.`;

  const { text, actualModel, usage } = await callAnthropic({
    model,
    system,
    messages: [{ role: 'user', content: userContent }],
    temperature: 0.6,
  });

  const parsed = extractJson(text) || {
    strategySummary: text,
    recommendedAngle: 'Technical Data Sheet (TDS) & Assay Consistency with European warehousing in Lamswaarde',
    buyerSellerRecommendation: buyerCount > 0 ? 'Prioritize verified BUYER accounts with direct procurement outreach.' : 'Segment audience by Buyer vs Seller.',
    messagingPillars: ['Consistent chemical assay & low iron', 'European supply security from Lamswaarde', 'Free laboratory sample evaluation'],
    recommendedSubjectThemes: [{ theme: 'Technical Specification', example: 'Low-iron Kaolin specifications for {{company}}', appeal: 'High curiosity for plant managers' }],
    callToAction: 'Book a brief 10-minute technical review call',
    followUpStrategy: 'Follow up after 3 business days offering certified TDS documentation.',
  };

  return {
    success: true,
    data: parsed,
    rawText: text,
    actualModel,
    usage,
  };
}

/**
 * 2. Analyze Audience & Recommend Segmentation
 */
export async function analyzeAudienceSegmentation({
  leads = [],
  filterCriteria = {},
  model = DEFAULT_CAMPAIGN_MODEL,
}) {
  const total = leads.length;
  const buyers = leads.filter((l) => (l.classification || '').toUpperCase() === 'BUYER');
  const sellers = leads.filter((l) => (l.classification || '').toUpperCase() === 'SELLER');
  const unclassified = leads.filter((l) => !l.classification || (l.classification || '').toUpperCase() === 'UNCLASSIFIED');

  const industryCounts = {};
  leads.forEach((l) => {
    const ind = l.industry || l.niche || 'Other / General';
    industryCounts[ind] = (industryCounts[ind] || 0) + 1;
  });

  const topIndustries = Object.entries(industryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, count]) => ({ name, count }));

  const system = `You are an expert B2B CRM segmentation specialist for MineTech Resources BV.
Evaluate the prospect list and Buyer/Seller breakdown.
Provide sharp, actionable segmentation advice to maximize open rates and prevent messaging mismatches.
Respond ONLY with a valid JSON object matching this schema:
{
  "executiveSummary": "1-2 sentence overview of audience composition",
  "classificationBreakdown": {
    "buyersInsight": "Assessment of buyer opportunities",
    "sellersInsight": "Assessment of seller dynamics",
    "actionForUnclassified": "How to treat unclassified leads"
  },
  "recommendedSegments": [
    {"segmentName": "Segment 1", "filterRule": "Criteria description", "messagingHook": "What resonates with them"}
  ],
  "potentialRisks": ["Risk 1", "Risk 2"],
  "recommendedAction": "Immediate recommendation before sending"
}`;

  const userContent = `Audience Composition:
Total Prospects: ${total}
Buyers: ${buyers.length} (${total > 0 ? Math.round((buyers.length / total) * 100) : 0}%)
Sellers: ${sellers.length} (${total > 0 ? Math.round((sellers.length / total) * 100) : 0}%)
Unclassified: ${unclassified.length} (${total > 0 ? Math.round((unclassified.length / total) * 100) : 0}%)
Top Industries: ${topIndustries.map((i) => `${i.name}: ${i.count}`).join(', ')}
Current Filter Criteria: ${JSON.stringify(filterCriteria)}

Provide expert audience segmentation recommendations.`;

  const { text, actualModel, usage } = await callAnthropic({
    model,
    system,
    messages: [{ role: 'user', content: userContent }],
    temperature: 0.5,
  });

  const parsed = extractJson(text) || {
    executiveSummary: `Audience consists of ${total} prospects with ${buyers.length} verified Buyers and ${sellers.length} Sellers.`,
    classificationBreakdown: {
      buyersInsight: 'Strong target for industrial raw material supply (kaolin, bentonite, chamotte).',
      sellersInsight: 'Should not receive purchasing outreach; target with trading and logistics cooperation instead.',
      actionForUnclassified: 'Filter or inspect unclassified prospects to avoid sending buyer pitches to mineral suppliers.',
    },
    recommendedSegments: [
      { segmentName: 'Verified Buyers', filterRule: 'classification = BUYER', messagingHook: 'Direct mineral grade supply & warehouse delivery' },
    ],
    potentialRisks: sellers.length > 0 && buyers.length > 0 ? ['Mixed Buyer and Seller audience in single blast may cause irrelevant pitches.'] : [],
    recommendedAction: 'Apply Buyer filter before launching commercial outreach blast.',
  };

  return {
    success: true,
    data: {
      total,
      buyerCount: buyers.length,
      sellerCount: sellers.length,
      unclassifiedCount: unclassified.length,
      topIndustries,
      ...parsed,
    },
    actualModel,
    usage,
  };
}

/**
 * 3. Generate Campaign Messaging & Subject Lines with Claude
 */
export async function generateCampaignMessaging({
  objective = '',
  tone = 'Direct',
  angle = '',
  leadSample = null,
  productFocus = 'Kaolin & Calcined Chamotte',
  model = DEFAULT_CAMPAIGN_MODEL,
}) {
  const leadContext = leadSample || {
    company: 'Ceramic & Refractory Works',
    fullName: 'Procurement Director',
    jobTitle: 'Plant Manager',
    industry: 'Ceramics & Advanced Refractories',
  };

  const system = `You are a world-class B2B copywriter for MineTech Resources BV (industrial minerals: kaolin, calcined chamotte, bentonite, bauxite, bleaching clay).
You write concise, high-converting cold email outreach (under 110 words) that sounds natural, commercial, and executive.
Always emphasize assay consistency, certified TDS, and European stock buffer in Lamswaarde, Netherlands.
Available merge tags: {{firstName}}, {{company}}, {{jobTitle}}.
MANDATORY COMPANY SIGN-OFF: You MUST ALWAYS end the email body with the official sign-off:
Regards,
Abdullah Rauf - Head of Sales | Mo. +32 486 287 751 | rauf@mine-tech.be
Minetech Resources BV – Belgium | BTW No. BE 1011004868 | www.mine-tech.be

Facility Address: Frederik Hendrikstraat 60, 4586 AC, Lamswaarde, Netherlands
Registered Office Address: Kernenergiestraat 19, Bus W16, 2610 Antwerpen, Belgium

Respond ONLY with a valid JSON object matching this schema:
{
  "subjectOptions": [
    {"subject": "Subject 1", "rationale": "Why this converts", "openRateAppeal": "High / Direct / Curiosity"},
    {"subject": "Subject 2", "rationale": "Why this converts", "openRateAppeal": "High / Direct / Curiosity"},
    {"subject": "Subject 3", "rationale": "Why this converts", "openRateAppeal": "High / Direct / Curiosity"}
  ],
  "emailBodyText": "Plaintext email body including merge tags and full signature",
  "emailBodyHtml": "HTML formatted email body with <p> and <br/> tags including full signature",
  "keySellingPoints": ["Point 1", "Point 2"],
  "recommendedCallToAction": "Low friction call to action"
}`;

  const userContent = `Campaign Goal: "${objective || 'Introduce high-grade kaolin and chamotte supply'}"
Tone: ${tone}
Core Strategic Angle: "${angle || 'Guaranteed low-iron assay with 48h dispatch from Lamswaarde'}"
Target Product: ${productFocus}
Sample Prospect:
Company: ${leadContext.company}
Contact: ${leadContext.fullName || leadContext.firstName || 'there'}
Role: ${leadContext.jobTitle || 'Executive'}
Industry: ${leadContext.industry || 'Manufacturing'}

Draft 3 high-converting subject lines and a tailored cold email body for this campaign.`;

  const { text, actualModel, usage } = await callAnthropic({
    model,
    system,
    messages: [{ role: 'user', content: userContent }],
    temperature: 0.7,
  });

  const parsed = extractJson(text);
  let finalResult;

  if (parsed && parsed.subjectOptions && (parsed.emailBodyText || parsed.emailBodyHtml)) {
    const rawBody = parsed.emailBodyText || parsed.emailBodyHtml || '';
    finalResult = {
      subjectOptions: parsed.subjectOptions,
      emailBodyText: ensureMineTechSignatureText(rawBody),
      emailBodyHtml: ensureMineTechSignatureHtml(parsed.emailBodyHtml || rawBody),
      keySellingPoints: parsed.keySellingPoints || [],
      recommendedCallToAction: parsed.recommendedCallToAction || '5-minute introductory call',
    };
  } else {
    const defaultBody = `Hi {{firstName}},\n\nI noticed {{company}}'s manufacturing operations and wanted to briefly reach out regarding your industrial mineral supply.\n\nMineTech Resources supplies high-purity kaolin and calcined chamotte with guaranteed chemical assay consistency and low iron tolerance, distributed directly from our European hub in Lamswaarde.\n\nWould you be open to reviewing our certified Technical Data Sheet (TDS) or receiving a 500g laboratory sample for benchmarking this month?`;
    finalResult = {
      subjectOptions: [
        { subject: `Low-iron Kaolin supply for {{company}}`, rationale: 'Direct, relevant, and technical', openRateAppeal: 'High' },
        { subject: `Mineral specifications & TDS review // {{company}}`, rationale: 'Executive and peer-to-peer', openRateAppeal: 'High' },
        { subject: `European Kaolin stock in Lamswaarde for {{company}}`, rationale: 'Supply security focus', openRateAppeal: 'Curiosity' },
      ],
      emailBodyText: ensureMineTechSignatureText(defaultBody),
      emailBodyHtml: ensureMineTechSignatureHtml(defaultBody),
      keySellingPoints: ['Chemical assay consistency', 'Low iron content', 'Lamswaarde warehouse buffer stock'],
      recommendedCallToAction: '5-minute specification review call or sample shipment',
    };
  }

  return {
    success: true,
    data: finalResult,
    actualModel,
    usage,
  };
}

/**
 * 4. Critique & Improve Existing Campaign Messaging
 */
export async function critiqueAndImproveMessaging({
  subject = '',
  body = '',
  objective = '',
  model = DEFAULT_CAMPAIGN_MODEL,
}) {
  const system = `You are a ruthless, high-performance B2B email copy editor for MineTech Resources BV.
Critique the provided cold outreach email and subject line.
Check for:
1. Subject line length (ideal: 3-6 words, no spam triggers, personalized).
2. Email word count (ideal: 60-110 words).
3. Value proposition clarity (does it clearly state mineral grade consistency and European warehousing?).
4. Call to action friction (is it asking for too much, like a 30-minute demo, instead of a 5-minute benchmark or sample review?).
5. Official MineTech signature presence.

Respond ONLY with a valid JSON object matching this schema:
{
  "critique": {
    "overallScore": 85,
    "wordCount": 84,
    "spamRisk": "Low / Medium / High",
    "strengths": ["Strength 1", "Strength 2"],
    "weaknesses": ["Weakness 1", "Weakness 2"],
    "keyFixes": ["Fix 1", "Fix 2"]
  },
  "improvedSubject": "Polished high-converting subject line",
  "improvedBodyText": "Polished high-converting plain text body with official signature",
  "improvedBodyHtml": "Polished HTML body with official signature",
  "expectedImpact": "Why this version will outperform the previous draft"
}`;

  const userContent = `Draft to critique and improve:
Current Subject: "${subject || 'Quick inquiry'}"
Stated Objective: "${objective || 'Industrial mineral sales outreach'}"
Current Email Body:
${body || 'Hi, we sell kaolin and minerals. Let me know if you want to buy.'}

Critique this draft rigorously and produce an improved, executive-grade version.`;

  const { text, actualModel, usage } = await callAnthropic({
    model,
    system,
    messages: [{ role: 'user', content: userContent }],
    temperature: 0.6,
  });

  const parsed = extractJson(text);
  let finalResult;

  if (parsed && parsed.improvedSubject && (parsed.improvedBodyText || parsed.improvedBodyHtml)) {
    finalResult = {
      critique: parsed.critique || {},
      improvedSubject: parsed.improvedSubject,
      improvedBodyText: ensureMineTechSignatureText(parsed.improvedBodyText || parsed.improvedBodyHtml),
      improvedBodyHtml: ensureMineTechSignatureHtml(parsed.improvedBodyHtml || parsed.improvedBodyText),
      expectedImpact: parsed.expectedImpact || 'Improves clarity and lowers CTA friction.',
    };
  } else {
    finalResult = {
      critique: {
        overallScore: 78,
        wordCount: (body || '').split(/\s+/).length,
        spamRisk: 'Low',
        strengths: ['Identifies core mineral offering.'],
        weaknesses: ['Call to action could be softer and more specific.'],
        keyFixes: ['Add European warehousing mention', 'Attach low-friction sample offer'],
      },
      improvedSubject: `Low-iron Kaolin specifications for {{company}}`,
      improvedBodyText: ensureMineTechSignatureText(body),
      improvedBodyHtml: ensureMineTechSignatureHtml(body),
      expectedImpact: 'Significantly increases executive credibility and open rates.',
    };
  }

  return {
    success: true,
    data: finalResult,
    actualModel,
    usage,
  };
}

/**
 * 5. Recommend Follow-Up Sequences & Timing
 */
export async function recommendFollowUpSequence({
  objective = 'Mineral supply introduction',
  campaignType = 'standard',
  model = DEFAULT_CAMPAIGN_MODEL,
}) {
  const system = `You are a master outbound sequence architect for MineTech Resources BV.
Design an optimal 3-touch follow-up sequence with day intervals, strategic angles, and complete message drafts.
Touch 1 (Day 0): Direct introduction + technical assay focus.
Touch 2 (Day 3-4): Value-add technical case / lab sample offer without guilt-tripping ("just checking in" is banned).
Touch 3 (Day 7-8): Supply security angle (Lamswaarde warehouse buffer stock) + low-friction closing benchmark.

MANDATORY COMPANY SIGN-OFF on every step:
Regards,
Abdullah Rauf - Head of Sales | Mo. +32 486 287 751 | rauf@mine-tech.be
Minetech Resources BV – Belgium | BTW No. BE 1011004868 | www.mine-tech.be

Respond ONLY with a valid JSON object matching this schema:
{
  "sequenceSummary": "Overview of sequence cadence",
  "steps": [
    {
      "step": 1,
      "dayOffset": 0,
      "title": "Initial Value Proposition",
      "subject": "Subject line",
      "angle": "Strategic purpose",
      "bodyText": "Complete email copy"
    },
    {
      "step": 2,
      "dayOffset": 3,
      "title": "Technical Assay & Sample",
      "subject": "Re: Subject line",
      "angle": "Strategic purpose",
      "bodyText": "Complete email copy"
    },
    {
      "step": 3,
      "dayOffset": 7,
      "title": "Supply Security & Polite Breakup",
      "subject": "Re: Subject line",
      "angle": "Strategic purpose",
      "bodyText": "Complete email copy"
    }
  ]
}`;

  const userContent = `Objective: "${objective}"
Campaign Type: "${campaignType}"

Design a multi-step sequence with optimal day delays and complete copy templates.`;

  const { text, actualModel, usage } = await callAnthropic({
    model,
    system,
    messages: [{ role: 'user', content: userContent }],
    temperature: 0.6,
  });

  const parsed = extractJson(text);
  const steps = (parsed?.steps || []).map((s) => ({
    ...s,
    bodyText: ensureMineTechSignatureText(s.bodyText || ''),
  }));

  return {
    success: true,
    data: {
      sequenceSummary: parsed?.sequenceSummary || '3-step consultative outbound sequence over 8 days.',
      steps: steps.length > 0 ? steps : [
        {
          step: 1,
          dayOffset: 0,
          title: 'Initial Outreach',
          subject: 'Kaolin & Chamotte supply for {{company}}',
          angle: 'Assay consistency & European warehousing',
          bodyText: ensureMineTechSignatureText('Hi {{firstName}},\n\nReaching out regarding your industrial mineral requirements...'),
        },
        {
          step: 2,
          dayOffset: 3,
          title: 'Technical Sample Offer',
          subject: 'Re: Kaolin & Chamotte supply for {{company}}',
          angle: 'Free laboratory sample evaluation',
          bodyText: ensureMineTechSignatureText('Hi {{firstName}},\n\nWanted to offer a 500g laboratory sample for benchmarking...'),
        },
      ],
    },
    actualModel,
    usage,
  };
}

/**
 * 6. Review Campaign Performance Data & Recommend Optimizations
 */
export async function reviewCampaignPerformance({
  stats = {},
  campaignName = '',
  model = DEFAULT_CAMPAIGN_MODEL,
}) {
  const sent = stats.sent || 0;
  const delivered = stats.delivered != null ? stats.delivered : sent;
  const opened = stats.opened || 0;
  const clicked = stats.clicked || 0;
  const replied = stats.replied || 0;
  const bounced = stats.bounced || 0;

  const openRate = delivered > 0 ? Math.round((opened / delivered) * 100) : 0;
  const replyRate = delivered > 0 ? Math.round((replied / delivered) * 100) : 0;
  const bounceRate = sent > 0 ? Math.round((bounced / sent) * 100) : 0;

  const system = `You are a senior B2B analytics and conversion optimization director for MineTech Resources BV.
Evaluate the provided outbound campaign delivery and engagement metrics against industrial B2B benchmarks:
- Industry Standard Open Rate: 25% - 35%
- Industry Standard Reply Rate: 3% - 7%
- Industry Standard Bounce Rate: < 3%

Provide diagnostic insights and concrete optimizations.
Respond ONLY with a valid JSON object matching this schema:
{
  "performanceVerdict": "EXCELLENT / HEALTHY / NEEDS_OPTIMIZATION / AT_RISK",
  "summary": "2-sentence performance summary",
  "keyMetrics": {
    "openRateAssessment": "Healthy / Below benchmark / etc",
    "replyRateAssessment": "Healthy / Below benchmark / etc",
    "deliverabilityHealth": "Assessment of bounce rate"
  },
  "actionableOptimizations": [
    "Concrete optimization 1",
    "Concrete optimization 2",
    "Concrete optimization 3"
  ]
}`;

  const userContent = `Campaign: "${campaignName || 'Campaign'}"
Performance Data:
- Emails Sent: ${sent}
- Delivered: ${delivered}
- Opened: ${opened} (Open Rate: ${openRate}%)
- Clicked: ${clicked}
- Replied: ${replied} (Reply Rate: ${replyRate}%)
- Bounced: ${bounced} (Bounce Rate: ${bounceRate}%)

Diagnose the campaign performance and recommend specific optimizations.`;

  const { text, actualModel, usage } = await callAnthropic({
    model,
    system,
    messages: [{ role: 'user', content: userContent }],
    temperature: 0.5,
  });

  const parsed = extractJson(text) || {
    performanceVerdict: replyRate >= 4 ? 'HEALTHY' : 'NEEDS_OPTIMIZATION',
    summary: `Campaign dispatched ${sent} emails with a ${openRate}% open rate and ${replyRate}% reply rate.`,
    keyMetrics: {
      openRateAssessment: openRate >= 25 ? 'Above industry benchmark' : 'Opportunity to test curiosity-driven subject lines',
      replyRateAssessment: replyRate >= 4 ? 'Good engagement' : 'Lower CTA friction to improve replies',
      deliverabilityHealth: bounceRate < 3 ? 'Excellent domain reputation' : 'Clean unverified lead emails',
    },
    actionableOptimizations: [
      'Segment audience strictly by Buyer vs Seller',
      'Test subject lines under 5 words',
      'Offer free laboratory samples in the first follow-up',
    ],
  };

  return {
    success: true,
    data: {
      metrics: { sent, delivered, opened, clicked, replied, bounced, openRate, replyRate, bounceRate },
      ...parsed,
    },
    actualModel,
    usage,
  };
}

/**
 * 7. Interactive Conversation with Campaign Brain (Maintaining Context)
 */
export async function chatWithCampaignBrain({
  messages = [],
  campaignContext = {},
  leadsContext = [],
  model = DEFAULT_CAMPAIGN_MODEL,
}) {
  const buyerCount = (leadsContext || []).filter((l) => (l.classification || '').toUpperCase() === 'BUYER').length;
  const sellerCount = (leadsContext || []).filter((l) => (l.classification || '').toUpperCase() === 'SELLER').length;

  const system = `You are MineTech AI, the Campaign Brain for MineTech Resources BV (industrial minerals: kaolin, calcined chamotte, bentonite, bauxite, bleaching clay).
You are working collaboratively with the user to plan, refine, and optimize their outbound campaign.

CURRENT CAMPAIGN CONTEXT:
- Name: "${campaignContext.name || 'Untitled Campaign'}"
- Objective: "${campaignContext.objective || 'Outreach'}"
- Current Subject: "${campaignContext.subject || 'Not yet set'}"
- Current Body Excerpt: "${(campaignContext.body || '').substring(0, 200)}"
- Audience Size: ${(leadsContext || []).length} leads (Buyers: ${buyerCount}, Sellers: ${sellerCount})

MANDATORY RULES:
1. Maintain active conversation context and build incrementally on prior suggestions.
2. If the user asks for email copy, subject lines, sequence steps, or strategies, provide production-ready suggestions.
3. Every email draft MUST conclude with the official MineTech signature:
Regards,
Abdullah Rauf - Head of Sales | Mo. +32 486 287 751 | rauf@mine-tech.be
Minetech Resources BV – Belgium | BTW No. BE 1011004868 | www.mine-tech.be

Facility Address: Frederik Hendrikstraat 60, 4586 AC, Lamswaarde, Netherlands
Registered Office Address: Kernenergiestraat 19, Bus W16, 2610 Antwerpen, Belgium

4. NEVER automatically send emails. The user retains 100% control over reviewing, scheduling, and sending.
5. Format your answers clearly with markdown headers, bullet points, and codeblocks where helpful.`;

  // Format messages for Anthropic
  const anthropicMessages = messages.map((m) => ({
    role: m.role === 'user' ? 'user' : 'assistant',
    content: m.content || '',
  }));

  if (anthropicMessages.length === 0 || anthropicMessages[anthropicMessages.length - 1].role !== 'user') {
    throw new Error('Chat messages must end with a user message');
  }

  const { text, actualModel, usage } = await callAnthropic({
    model,
    system,
    messages: anthropicMessages,
    temperature: 0.7,
  });

  return {
    success: true,
    message: {
      role: 'assistant',
      content: text,
      model: actualModel,
    },
    actualModel,
    usage,
  };
}

const campaignIntelligenceService = {
  CAMPAIGN_CLAUDE_MODELS,
  DEFAULT_CAMPAIGN_MODEL,
  developCampaignStrategy,
  analyzeAudienceSegmentation,
  generateCampaignMessaging,
  critiqueAndImproveMessaging,
  recommendFollowUpSequence,
  reviewCampaignPerformance,
  chatWithCampaignBrain,
};

export default campaignIntelligenceService;
