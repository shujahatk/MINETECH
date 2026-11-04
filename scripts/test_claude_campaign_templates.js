/**
 * MINETECH CLAUDE AI CAMPAIGN TEMPLATES & VALIDATION TEST SUITE
 * 
 * Comprehensive verification of:
 * 1. Initial Outreach Template (A)
 * 2. Follow-Up Email Template (B)
 * 3. Personalized B2B Outreach Template (C)
 * 4. Professional Introduction Template (D)
 * 5. Meeting Request Template (E)
 * 6. Re-Engagement Campaign Template (F)
 * 7. Custom Campaign Instruction Adherence
 * 8. Missing Lead Data Graceful Defaults (Zero undefined/null leaks)
 * 9. Defensive JSON & Markdown Extraction
 * 10. AI Output Validation Guardrails
 */

import dotenv from 'dotenv';
dotenv.config();

import {
  CAMPAIGN_TEMPLATE_TYPES,
  CAMPAIGN_PROMPT_TEMPLATES,
  getCampaignPromptTemplate,
  extractSubjectAndBody,
  validateGeneratedEmail,
  listCampaignPromptTemplates,
} from '../lib/ai/campaignPromptTemplates.js';
import { interpolateMergeFields } from '../lib/services/emailService.js';
import { ensureMineTechSignatureHtml, ensureMineTechSignatureText } from '../lib/utils/signature.js';

let passed = 0;
let failed = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    passed++;
    console.log(`  ✅ [PASS] ${testName}`);
  } else {
    failed++;
    console.error(`  ❌ [FAIL] ${testName}: ${details}`);
  }
}

async function runClaudeTemplatesTestSuite() {
  console.log('======================================================================');
  console.log('🧠 MINETECH CLAUDE AI — CAMPAIGN PROMPT TEMPLATES & VALIDATION SUITE');
  console.log('======================================================================\n');

  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
  assert(Boolean(apiKey && apiKey.startsWith('sk-ant')), '0. Anthropic Claude API Key Configured');

  const candidateModels = [
    process.env.ANTHROPIC_MODEL,
    process.env.CLAUDE_MODEL,
    'claude-haiku-4-5-20251001',
    'claude-sonnet-4-6',
    'claude-3-5-sonnet-20241022',
  ].filter(Boolean);

  // Helper to execute live Claude request
  const callClaude = async (system, userContent) => {
    let lastErr = null;
    for (const model of candidateModels) {
      try {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model,
            max_tokens: 1500,
            system,
            messages: [{ role: 'user', content: userContent }],
          }),
        });
        if (res.ok) {
          const json = await res.json();
          const text = (json.content || []).map((c) => c.text).join('').trim();
          return { text, model, usage: json.usage };
        }
        lastErr = new Error(`HTTP ${res.status}`);
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr || new Error('All Claude models failed');
  };

  // ---------------------------------------------------------------------------
  // SECTION 1: ARCHITECTURAL TEMPLATE REGISTRY
  // ---------------------------------------------------------------------------
  console.log('--- [SECTION 1] Prompt Template Architecture & Metadata ---');
  const templates = listCampaignPromptTemplates();
  assert(templates.length === 6, `1.1 All 6 mandatory B2B campaign templates registered (Got: ${templates.length})`);
  const templateIds = templates.map((t) => t.id);
  assert(templateIds.includes('initial_outreach'), '1.2 Template A: Initial Outreach registered');
  assert(templateIds.includes('follow_up'), '1.3 Template B: Follow-Up registered');
  assert(templateIds.includes('personalized_b2b'), '1.4 Template C: Personalized B2B registered');
  assert(templateIds.includes('professional_intro'), '1.5 Template D: Professional Intro registered');
  assert(templateIds.includes('meeting_request'), '1.6 Template E: Meeting Request registered');
  assert(templateIds.includes('re_engagement'), '1.7 Template F: Re-Engagement registered');

  // ---------------------------------------------------------------------------
  // SECTION 2: LIVE GENERATION FOR ALL 6 TEMPLATES WITH CLAUDE
  // ---------------------------------------------------------------------------
  console.log('\n--- [SECTION 2] Live Generation Across 6 Campaign Templates ---');
  const mockLead = {
    firstName: 'Marcus',
    lastName: 'Vance',
    fullName: 'Marcus Vance',
    company: 'Ceramica Refractories NV',
    jobTitle: 'Head of Raw Material Procurement',
    industry: 'High-Temperature Industrial Ceramics',
  };

  for (const tmpl of templates) {
    try {
      const templateObj = getCampaignPromptTemplate(tmpl.id);
      const userPrompt = templateObj.userPromptTemplate(
        mockLead,
        'Highlight European supply security from Lamswaarde hub and certified low-iron kaolin assays.'
      );

      const response = await callClaude(templateObj.systemInstruction, userPrompt);
      const validated = validateGeneratedEmail(response.text);

      assert(validated.valid, `2. Live ${tmpl.name} generation valid`, validated.error || '');
      assert(Boolean(validated.subject && validated.subject.length > 5), `   ${tmpl.name}: Valid Subject ("${validated.subject}")`);
      assert(Boolean(validated.bodyHtml && validated.bodyHtml.length > 30), `   ${tmpl.name}: Usable Body length (${validated.bodyHtml.length} chars)`);
      assert(validated.bodyHtml.includes('MineTech Outbound') || validated.bodyHtml.includes('MineTech'), `   ${tmpl.name}: Mandatory MineTech signature included`);
      assert(!/undefined|null|\[object Object\]/i.test(validated.bodyHtml), `   ${tmpl.name}: Zero leaked artifacts`);
    } catch (err) {
      assert(false, `2. Live ${tmpl.name} generation`, err.message);
    }
  }

  // ---------------------------------------------------------------------------
  // SECTION 3: CUSTOM USER CAMPAIGN INSTRUCTIONS ADHERENCE
  // ---------------------------------------------------------------------------
  console.log('\n--- [SECTION 3] Adherence to Specific Custom User Campaign Instructions ---');
  try {
    const customInstruction = 'MANDATORY PROMO: Mention free 25kg sample bags of chamotte available for laboratory testing.';
    const tmpl = getCampaignPromptTemplate('personalized_b2b');
    const promptWithCustom = tmpl.userPromptTemplate(mockLead, customInstruction);
    const result = await callClaude(tmpl.systemInstruction, promptWithCustom);
    const validated = validateGeneratedEmail(result.text);

    assert(validated.valid, '3.1 Claude response passes email validation with custom instruction');
    const combined = `${validated.subject} ${validated.bodyHtml}`.toLowerCase();
    assert(combined.includes('sample') || combined.includes('25kg') || combined.includes('chamotte'), '3.2 Claude honored custom instruction content');
  } catch (err) {
    assert(false, '3. Custom instruction test', err.message);
  }

  // ---------------------------------------------------------------------------
  // SECTION 4: MISSING LEAD DATA & PLACEHOLDER RESILIENCE
  // ---------------------------------------------------------------------------
  console.log('\n--- [SECTION 4] Missing Lead Data Graceful Degradation ---');
  const emptyLead = {};
  const interpolated = interpolateMergeFields('Hi {{firstName}}, reviewing {{company}} as {{jobTitle}} at {{website}}.', emptyLead);
  assert(!interpolated.includes('undefined'), '4.1 Missing firstName does not produce "undefined"');
  assert(!interpolated.includes('null'), '4.2 Missing company does not produce "null"');
  assert(interpolated.includes('Hi there'), '4.3 Falls back gracefully to "Hi there"');
  assert(interpolated.includes('your team'), '4.4 Falls back gracefully to "your team"');
  assert(!interpolated.includes('{{'), '4.5 Unmatched merge tags are stripped cleanly');

  // ---------------------------------------------------------------------------
  // SECTION 5: DEFENSIVE EXTRACTION OF MALFORMED / EMBEDDED OUTPUTS
  // ---------------------------------------------------------------------------
  console.log('\n--- [SECTION 5] Defensive JSON, Markdown & Text Extraction ---');

  // Test 5.1: Clean JSON
  const cleanJson = '{"subject": "Hello World", "bodyHtml": "<p>Content</p>"}';
  const ext1 = extractSubjectAndBody(cleanJson);
  assert(ext1?.subject === 'Hello World' && ext1?.bodyHtml === '<p>Content</p>', '5.1 Clean JSON extraction');

  // Test 5.2: Markdown code block wrapped JSON
  const mdJson = '```json\n{"subject": "Wrapped Subject", "bodyHtml": "<p>Wrapped Content</p>"}\n```';
  const ext2 = extractSubjectAndBody(mdJson);
  assert(ext2?.subject === 'Wrapped Subject' && ext2?.bodyHtml === '<p>Wrapped Content</p>', '5.2 Markdown code block JSON extraction');

  // Test 5.3: Text with Subject: line header
  const plainEmail = 'Subject: Low-Iron Kaolin Inquiry\n\nDear Marcus,\n\nWe provide calcined kaolin.\n\nRegards,\nMineTech Outbound';
  const ext3 = extractSubjectAndBody(plainEmail);
  assert(ext3?.subject === 'Low-Iron Kaolin Inquiry', '5.3 Plain text Subject line extraction');
  assert(ext3?.bodyHtml.includes('calcined kaolin'), '5.4 Plain text body conversion to paragraphs');

  // Test 5.4: Leak rejection
  const leakedArtifact = '{"subject": "Hello {{undefined}}", "bodyHtml": "<p>Null data for null</p>"}';
  const valLeak = validateGeneratedEmail(leakedArtifact);
  assert(!valLeak.valid, '5.5 Rejects email containing placeholder leak artifacts');

  console.log('\n======================================================================');
  console.log(`📊 CLAUDE AI TEMPLATES TEST RESULTS: ${passed} Passed / ${failed} Failed`);
  console.log('======================================================================\n');

  if (failed > 0) process.exit(1);
  process.exit(0);
}

runClaudeTemplatesTestSuite().catch((err) => {
  console.error('Fatal Claude test runner error:', err);
  process.exit(1);
});

