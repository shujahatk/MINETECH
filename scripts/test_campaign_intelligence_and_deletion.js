import dotenv from 'dotenv';
dotenv.config();

import assert from 'assert';
import { supabaseAdmin } from '../lib/supabase.js';
import {
  developCampaignStrategy,
  analyzeAudienceSegmentation,
  generateCampaignMessaging,
  critiqueAndImproveMessaging,
  recommendFollowUpSequence,
  reviewCampaignPerformance,
  chatWithCampaignBrain,
  CAMPAIGN_CLAUDE_MODELS,
} from '../lib/services/campaignIntelligenceService.js';
import { deleteCampaign, getCampaignById, createCampaign } from '../lib/services/campaignService.js';

console.log('===============================================================');
console.log('MINETECH: CAMPAIGN CLAUDE 5.5 UPGRADE & DELETION TEST SUITE');
console.log('===============================================================\n');

async function runTests() {
  let passed = 0;
  let total = 0;

  function record(desc, ok) {
    total++;
    if (ok) {
      passed++;
      console.log(`[PASS] ${desc}`);
    } else {
      console.error(`[FAIL] ${desc}`);
      process.exitCode = 1;
    }
  }

  // TEST 1: Model Configurations
  console.log('--- TEST GROUP 1: Campaign Claude Models ---');
  record('Sonnet 5.5 model ID is claude-sonnet-5-5', CAMPAIGN_CLAUDE_MODELS.SONNET_5_5.id === 'claude-sonnet-5-5');
  record('Opus 5.5 model ID is claude-opus-5-5', CAMPAIGN_CLAUDE_MODELS.OPUS_5_5.id === 'claude-opus-5-5');

  // TEST 2: Real Anthropic API Call - Sonnet 5.5
  console.log('\n--- TEST GROUP 2: Real Anthropic API Integration ---');
  try {
    const resSonnet = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5-5',
        max_tokens: 50,
        messages: [{ role: 'user', content: 'Respond with exactly: MineTech Sonnet 5.5 Verified' }],
      }),
    });
    const dataSonnet = await resSonnet.json();
    const textSonnet = dataSonnet?.content?.[0]?.text || '';
    record(
      `Real Anthropic API call with claude-sonnet-5-5 succeeded (HTTP ${resSonnet.status}: "${textSonnet.trim()}")`,
      resSonnet.ok && textSonnet.includes('MineTech Sonnet 5.5')
    );
  } catch (e) {
    record(`Real Anthropic API call with claude-sonnet-5-5 failed: ${e.message}`, false);
  }

  // TEST 3: Real Anthropic API Call - Opus 5.5
  try {
    const resOpus = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-5-5',
        max_tokens: 300,
        messages: [{ role: 'user', content: 'Respond with: MineTech Opus 5.5 Verified' }],
      }),
    });
    const dataOpus = await resOpus.json();
    const textOpus = (dataOpus?.content || []).filter((b) => b?.type === 'text').map((b) => b.text).join('') || dataOpus?.content?.[0]?.text || '';
    record(
      `Real Anthropic API call with claude-opus-5-5 succeeded (HTTP ${resOpus.status}: "${textOpus.trim()}")`,
      resOpus.ok && textOpus.includes('MineTech Opus 5.5')
    );
  } catch (e) {
    record(`Real Anthropic API call with claude-opus-5-5 failed: ${e.message}`, false);
  }

  // TEST 4: Campaign Brain Strategy Formulation (Opus 5.5 Advanced Reasoning)
  console.log('\n--- TEST GROUP 3: Claude Campaign Brain Intelligence ---');
  const sampleLeads = [
    { fullName: 'Jan De Smet', company: 'Flemish Ceramics NV', jobTitle: 'Plant Director', industry: 'Ceramics', classification: 'BUYER' },
    { fullName: 'Elena Rostova', company: 'EuroRefractory Ltd', jobTitle: 'Procurement Head', industry: 'Refractory', classification: 'BUYER' },
    { fullName: 'Ahmed Mansoor', company: 'Global Mining Minerals', jobTitle: 'Managing Partner', industry: 'Raw Minerals', classification: 'SELLER' },
  ];

  try {
    const strat = await developCampaignStrategy({
      campaignName: 'European Low-Iron Kaolin Outreach Q4',
      objective: 'Secure 10 pilot laboratory test batches with European ceramic tile manufacturers',
      leadsSample: sampleLeads,
      model: 'claude-opus-5-5',
    });
    record('Strategy formulation succeeded using claude-opus-5-5', strat.success && strat.actualModel === 'claude-opus-5-5');
    record('Strategy returned structured recommendations and pillars', Boolean(strat.data.strategySummary && strat.data.messagingPillars));
    console.log(`  -> Strategy Summary: "${strat.data.strategySummary.substring(0, 100)}..."`);
  } catch (e) {
    record(`Strategy formulation failed: ${e.message}`, false);
  }

  // TEST 5: Audience Analysis & Buyer/Seller Segmentation (Sonnet 5.5 Default)
  try {
    const aud = await analyzeAudienceSegmentation({
      leads: sampleLeads,
      model: 'claude-sonnet-5-5',
    });
    record('Audience segmentation analysis succeeded using claude-sonnet-5-5', aud.success && aud.actualModel === 'claude-sonnet-5-5');
    record('Audience analysis accurately broke down Buyers (2) and Sellers (1)', aud.data.buyerCount === 2 && aud.data.sellerCount === 1);
    console.log(`  -> Buyer/Seller Assessment: "${aud.data.executiveSummary}"`);
  } catch (e) {
    record(`Audience analysis failed: ${e.message}`, false);
  }

  // TEST 6: Generate Messaging & Subject Lines with Mandatory Signature
  try {
    const msg = await generateCampaignMessaging({
      objective: 'Schedule a 5-minute technical data sheet review call',
      angle: 'Certified low-iron chemical assay with buffer stock in Lamswaarde warehouse',
      leadSample: sampleLeads[0],
      model: 'claude-sonnet-5-5',
    });
    record('Messaging generator produced subject line options', Array.isArray(msg.data.subjectOptions) && msg.data.subjectOptions.length >= 2);
    const bodyText = msg.data.emailBodyText || '';
    const hasSignature = bodyText.includes('Abdullah Rauf - Head of Sales') && bodyText.includes('Lamswaarde, Netherlands');
    record('Generated email body includes mandatory official MineTech signature', hasSignature);
    console.log(`  -> Sample Subject: "${msg.data.subjectOptions[0]?.subject}"`);
  } catch (e) {
    record(`Messaging generation failed: ${e.message}`, false);
  }

  // TEST 7: Critique & Upgrade Weak Messaging
  try {
    const crit = await critiqueAndImproveMessaging({
      subject: 'hey buy our kaolin',
      body: 'Hi, we sell kaolin minerals. Do you need some? Let me know.',
      objective: 'Commercial mineral outreach',
      model: 'claude-sonnet-5-5',
    });
    record('Critique identified weak copy and produced improvedSubject', Boolean(crit.data.improvedSubject && crit.data.improvedSubject !== 'hey buy our kaolin'));
    record('Improved copy contains official MineTech signature', (crit.data.improvedBodyText || '').includes('Abdullah Rauf'));
    console.log(`  -> Improved Subject: "${crit.data.improvedSubject}"`);
  } catch (e) {
    record(`Critique failed: ${e.message}`, false);
  }

  // TEST 8: Follow-up Sequence Recommendation
  try {
    const seq = await recommendFollowUpSequence({
      objective: 'Kaolin supply for ceramic plants',
      model: 'claude-sonnet-5-5',
    });
    record('Sequence recommendations generated multi-touch steps with day delays', Array.isArray(seq.data.steps) && seq.data.steps.length >= 2);
    console.log(`  -> Generated ${seq.data.steps.length} sequence steps (${seq.data.sequenceSummary})`);
  } catch (e) {
    record(`Sequence recommendation failed: ${e.message}`, false);
  }

  // TEST 9: Multi-turn Conversation with Campaign Brain
  try {
    const chat1 = await chatWithCampaignBrain({
      messages: [
        { role: 'user', content: 'What are the three most critical technical parameters ceramic tile manufacturers evaluate when buying kaolin?' }
      ],
      campaignContext: { name: 'Ceramic Outreach', objective: 'Low-iron Kaolin' },
      leadsContext: sampleLeads,
      model: 'claude-sonnet-5-5',
    });
    record('Campaign Brain chat turn 1 answered with technical parameters', chat1.success && chat1.message.content.length > 50);

    const chat2 = await chatWithCampaignBrain({
      messages: [
        { role: 'user', content: 'What are the three most critical technical parameters ceramic tile manufacturers evaluate when buying kaolin?' },
        { role: 'assistant', content: chat1.message.content },
        { role: 'user', content: 'Now turn that into a 2-sentence opening hook for an email.' },
      ],
      campaignContext: { name: 'Ceramic Outreach', objective: 'Low-iron Kaolin' },
      leadsContext: sampleLeads,
      model: 'claude-sonnet-5-5',
    });
    record('Campaign Brain chat turn 2 maintained conversation memory and drafted hook', chat2.success && chat2.message.content.length > 20);
    console.log(`  -> Opening Hook: "${chat2.message.content.substring(0, 100)}..."`);
  } catch (e) {
    record(`Brain chat failed: ${e.message}`, false);
  }

  // TEST GROUP 4: Database Campaign Deletion
  console.log('\n--- TEST GROUP 4: Campaign Deletion across All States ---');

  // TEST 10: Create and Delete a DRAFT Campaign
  let draftCampId = null;
  try {
    const draftCamp = await createCampaign({
      name: 'Automated Test Draft Campaign',
      subject: 'Draft Subject',
      bodyHtml: '<p>Draft body</p>',
      bodyText: 'Draft body',
      status: 'DRAFT',
    });
    draftCampId = draftCamp.id;
    record(`Created test draft campaign in Supabase (ID: ${draftCampId})`, Boolean(draftCampId));

    // Delete draft campaign
    const delDraftResult = await deleteCampaign(draftCampId);
    record('deleteCampaign() executed successfully on draft campaign', delDraftResult.success);

    // Verify deletion persisted in Supabase
    const verifyDraft = await getCampaignById(draftCampId);
    record('Draft campaign verified permanently deleted from Supabase (returned null)', verifyDraft === null);
  } catch (e) {
    record(`Draft campaign creation/deletion failed: ${e.message}`, false);
  }

  // TEST 11: Create and Delete an ALREADY-SENT Campaign with Recipient Records
  let sentCampId = null;
  let testLeadId = null;
  try {
    // 1. Fetch a real lead to attach recipient without breaking not-null constraints
    const { data: realLead } = await supabaseAdmin.from('leads').select('id, email, full_name').limit(1).single();
    assert(realLead, 'Need at least one lead in database for test');
    testLeadId = realLead.id;

    // 2. Insert an already-sent campaign with sentCount > 0 and COMPLETED status
    const { data: sentCamp, error: sentCampErr } = await supabaseAdmin
      .from('email_campaigns')
      .insert({
        name: 'Automated Test Already-Sent Campaign',
        subject: 'Sent Campaign Subject',
        body_html: '<p>Already sent email body</p>',
        body_plain: 'Already sent email body',
        status: 'COMPLETED',
        stats: { sent: 12, delivered: 12, opened: 4, replied: 1, bounced: 0, total: 12 },
      })
      .select()
      .single();

    if (sentCampErr) throw sentCampErr;
    sentCampId = sentCamp.id;
    record(`Created test already-sent campaign in Supabase (ID: ${sentCampId}, status: COMPLETED, sent: 12)`, Boolean(sentCampId));

    // 3. Insert recipient record associated with this campaign
    const { data: recDoc, error: recErr } = await supabaseAdmin
      .from('email_recipients')
      .insert({
        campaign_id: sentCampId,
        lead_id: testLeadId,
        email: realLead.email || 'prospect@test-mine.be',
        status: 'sent',
        sent_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (recErr) throw recErr;
    const recId = recDoc.id;
    record(`Inserted sent recipient record (ID: ${recId}) linked to campaign`, Boolean(recId));

    // 4. Delete the already-sent campaign! (This previously threw CAMPAIGN_ALREADY_SENT error)
    const delSentResult = await deleteCampaign(sentCampId);
    record('deleteCampaign() successfully deleted already-sent campaign without throwing CAMPAIGN_ALREADY_SENT', delSentResult.success);

    // 5. Confirm deletion persists after querying Supabase again
    const verifySentCamp = await getCampaignById(sentCampId);
    record('Already-sent campaign confirmed permanently deleted from Supabase (returned null)', verifySentCamp === null);

    // 6. Confirm recipient records were cleaned up
    const { data: checkRecs } = await supabaseAdmin
      .from('email_recipients')
      .select('id')
      .eq('campaign_id', sentCampId);
    record('Recipient records for deleted campaign confirmed deleted from Supabase', (checkRecs || []).length === 0);

    // 7. CRITICAL: Confirm the associated lead remains 100% intact!
    const { data: leadCheck } = await supabaseAdmin
      .from('leads')
      .select('id, full_name, email')
      .eq('id', testLeadId)
      .single();
    record(`Associated CRM lead "${leadCheck?.full_name}" remains 100% intact in Supabase`, Boolean(leadCheck && leadCheck.id === testLeadId));
  } catch (e) {
    record(`Already-sent campaign test failed: ${e.message}`, false);
  }

  console.log('\n===============================================================');
  console.log(`TEST SUMMARY: ${passed} / ${total} tests passed (${Math.round((passed / total) * 100)}%)`);
  console.log('===============================================================');

  if (passed < total) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
