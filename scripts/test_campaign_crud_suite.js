/**
 * MINETECH CAMPAIGN CRUD & LIFECYCLE COMPREHENSIVE AUTOMATED TEST SUITE
 * 
 * Tests:
 * 1. Campaign Creation & Persistence in Supabase
 * 2. Campaign Retrieval & Verification of Fields
 * 3. Campaign Editing & Live Reflection
 * 4. Staged Recipient Synchronization
 * 5. Campaign Duplication with (Copy) naming and DRAFT status
 * 6. Campaign Pausing and Resuming
 * 7. Campaign Archiving
 * 8. Protection of Already-Sent Campaigns against Deletion
 * 9. Safe Cascading Deletion of Unsent Campaigns (keeping leads/messages intact)
 */

import dotenv from 'dotenv';
dotenv.config();

import { supabaseAdmin } from '../lib/supabase.js';
import {
  createCampaign,
  getCampaignById,
  getCampaigns,
  updateCampaign,
  duplicateCampaign,
  pauseCampaign,
  resumeCampaign,
  archiveCampaign,
  deleteCampaign,
  auditCampaignAudience,
} from '../lib/services/campaignService.js';
import crypto from 'crypto';

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

async function runCampaignCrudTestSuite() {
  console.log('======================================================================');
  console.log('🎯 MINETECH CAMPAIGN MANAGEMENT — FULL CRUD & LIFECYCLE TEST SUITE');
  console.log('======================================================================\n');

  const runId = `crud_${Date.now()}_${crypto.randomUUID().slice(0, 5)}`;
  let testCampaign = null;
  let duplicatedCamp = null;
  let testLead = null;

  try {
    // -------------------------------------------------------------------------
    // PREPARATION: Seed a clean test lead in Supabase
    // -------------------------------------------------------------------------
    const { data: leadData, error: leadErr } = await supabaseAdmin
      .from('leads')
      .insert({
        first_name: 'Abdullah',
        last_name: 'TestLead',
        email: `qa.test.${runId}@mine-tech.be`,
        company: 'MineTech European Test Corp',
        job_title: 'Procurement Director',
        industry: 'Ceramics & Refractories',
        status: 'NEW',
        tags: [`tag_${runId}`],
        is_dnc: false,
      })
      .select()
      .single();

    assert(!leadErr && leadData, '0. Seed Test Lead in Supabase CRM');
    testLead = leadData;

    // -------------------------------------------------------------------------
    // TEST 1: CREATE CAMPAIGN & PERSISTENCE
    // -------------------------------------------------------------------------
    console.log('\n--- 1. Testing Campaign Creation & Database Persistence ---');
    const created = await createCampaign({
      name: `MineTech Test Campaign ${runId}`,
      subject: 'High-Purity Kaolin & Bentonite Supply',
      bodyHtml: '<p>Hi {{firstName}}, reviewing {{company}} mineral requirements.</p>',
      bodyText: 'Hi {{firstName}}, reviewing {{company}} mineral requirements.',
      description: 'Automated test campaign for CRUD verification',
      filterCriteria: {
        tags: [`tag_${runId}`],
        status: ['NEW'],
      },
      campaignType: 'standard',
      masterPrompt: 'Focus on low-iron kaolin and Lamswaarde warehouse delivery.',
      sender: { email: 'rauf@mine-tech.be', name: 'Rauf', replyTo: 'rauf@mine-tech.be' },
      status: 'DRAFT',
    });

    testCampaign = created;

    assert(Boolean(created && created.id), '1.1 Campaign successfully created in Supabase with UUID');
    assert(created.name === `MineTech Test Campaign ${runId}`, '1.2 Campaign name matches input');
    assert(created.status === 'DRAFT', '1.3 Initial status correctly saved as DRAFT');
    assert(created.subject === 'High-Purity Kaolin & Bentonite Supply', '1.4 Subject line matches input');

    // Verify recipient staging in email_recipients
    const { data: stagedRecipients } = await supabaseAdmin
      .from('email_recipients')
      .select('*')
      .eq('campaign_id', created.id);

    assert(stagedRecipients && stagedRecipients.length === 1, '1.5 Recipient successfully staged in email_recipients dispatch queue');
    assert(stagedRecipients[0]?.email === `qa.test.${runId}@mine-tech.be`, '1.6 Staged recipient has correct lead email');
    assert(stagedRecipients[0]?.tokens?.firstName === 'Abdullah', '1.7 Staged recipient contains correct personalization tokens');

    // -------------------------------------------------------------------------
    // TEST 2: READ / FETCH FROM SUPABASE
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Testing Campaign Retrieval & Database Parity ---');
    const fetched = await getCampaignById(created.id);
    assert(Boolean(fetched && fetched.campaign), '2.1 getCampaignById retrieves stored record');
    assert(fetched.campaign.id === created.id, '2.2 Retrieved campaign ID matches created ID');
    assert(fetched.campaign.stats.sender.email === 'rauf@mine-tech.be', '2.3 Sender configuration accurately retrieved');
    assert(fetched.recipients && fetched.recipients.length === 1, '2.4 Recipient relation loaded with campaign');

    // Search and filter test
    const listResult = await getCampaigns({ search: runId, status: 'DRAFT' });
    assert(listResult.campaigns.some((c) => c.id === created.id), '2.5 Campaign discoverable via search query and status filter');

    // -------------------------------------------------------------------------
    // TEST 3: EDIT CAMPAIGN & UPDATE SUPABASE
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Testing Campaign Editing & Immediate Database Update ---');
    const updated = await updateCampaign(created.id, {
      name: `MineTech Test Campaign ${runId} (Updated)`,
      subject: 'Updated: Certified Industrial Minerals from Lamswaarde',
      bodyHtml: '<p>Hi {{firstName}}, revised body text with updated specs.</p>',
      bodyText: 'Hi {{firstName}}, revised body text with updated specs.',
      masterPrompt: 'Revised AI instructions: emphasize 24-hour dispatch.',
    });

    assert(updated.name === `MineTech Test Campaign ${runId} (Updated)`, '3.1 Campaign name updated in database');
    assert(updated.subject === 'Updated: Certified Industrial Minerals from Lamswaarde', '3.2 Subject line updated in database');
    assert(updated.masterPrompt.includes('24-hour dispatch'), '3.3 Master prompt updated in database');

    // Verify DB direct check
    const { data: reCheck } = await supabaseAdmin
      .from('email_campaigns')
      .select('*')
      .eq('id', created.id)
      .single();

    assert(reCheck.name === `MineTech Test Campaign ${runId} (Updated)`, '3.4 Direct Supabase query confirms persisted edit');

    // -------------------------------------------------------------------------
    // TEST 4: DUPLICATE CAMPAIGN
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Testing Campaign Duplication ---');
    duplicatedCamp = await duplicateCampaign(created.id);

    assert(Boolean(duplicatedCamp && duplicatedCamp.id), '4.1 Duplicated campaign created in Supabase');
    assert(duplicatedCamp.id !== created.id, '4.2 Duplicated campaign has unique new UUID');
    assert(duplicatedCamp.name.includes('(Copy)'), '4.3 Duplicated campaign name includes "(Copy)" suffix');
    assert(duplicatedCamp.status === 'DRAFT', '4.4 Duplicated campaign initialized in DRAFT status');
    assert(duplicatedCamp.subject === updated.subject, '4.5 Duplicated campaign preserves original subject line');

    // -------------------------------------------------------------------------
    // TEST 5: PAUSE AND RESUME CAMPAIGN
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Testing Campaign Pause and Resume Lifecycle ---');
    const paused = await pauseCampaign(created.id);
    assert(paused.status === 'PAUSED', '5.1 Campaign status successfully set to PAUSED');

    const resumed = await resumeCampaign(created.id);
    assert(resumed.status === 'RUNNING', '5.2 Campaign status successfully resumed to RUNNING');

    // -------------------------------------------------------------------------
    // TEST 6: ARCHIVE CAMPAIGN
    // -------------------------------------------------------------------------
    console.log('\n--- 6. Testing Campaign Archiving ---');
    const archived = await archiveCampaign(created.id);
    assert(archived.status === 'ARCHIVED', '6.1 Campaign status successfully updated to ARCHIVED');

    // -------------------------------------------------------------------------
    // TEST 7: SAFETY PROTECTION: CANNOT DELETE CAMPAIGN THAT HAS SENT EMAILS
    // -------------------------------------------------------------------------
    console.log('\n--- 7. Testing Safety Protection on Already-Sent Campaigns ---');
    // Simulate campaign with 5 sent emails
    await supabaseAdmin
      .from('email_campaigns')
      .update({
        stats: { sent: 5, delivered: 5, totalRecipients: 5 },
        status: 'COMPLETED',
      })
      .eq('id', created.id);

    let deleteBlocked = false;
    let deleteErrorCode = '';
    try {
      await deleteCampaign(created.id);
    } catch (delErr) {
      deleteBlocked = true;
      deleteErrorCode = delErr.code;
      console.log(`  Expected Rejection: "${delErr.message}"`);
    }

    assert(deleteBlocked, '7.1 Deletion of campaign with dispatched emails is strictly rejected');
    assert(deleteErrorCode === 'CAMPAIGN_ALREADY_SENT', '7.2 Rejection throws CAMPAIGN_ALREADY_SENT error code');

    // -------------------------------------------------------------------------
    // TEST 8: SAFE TRANSACTIONAL DELETION OF UNSENT CAMPAIGN
    // -------------------------------------------------------------------------
    console.log('\n--- 8. Testing Safe Deletion of Unsent Campaign ---');
    // Delete the duplicated campaign (which has 0 sent emails)
    const delResult = await deleteCampaign(duplicatedCamp.id);
    assert(delResult.success, '8.1 Unsent campaign successfully deleted');

    // Verify campaign is gone from Supabase
    const { data: goneCamp } = await supabaseAdmin
      .from('email_campaigns')
      .select('*')
      .eq('id', duplicatedCamp.id)
      .maybeSingle();

    assert(!goneCamp, '8.2 Campaign record verified deleted from Supabase email_campaigns table');

    // Verify queued recipients were cleaned up
    const { data: goneRecipients } = await supabaseAdmin
      .from('email_recipients')
      .select('*')
      .eq('campaign_id', duplicatedCamp.id);

    assert(goneRecipients && goneRecipients.length === 0, '8.3 Queued recipients cleanly removed without leaving orphaned rows');

    // Verify lead was NOT deleted
    const { data: survivingLead } = await supabaseAdmin
      .from('leads')
      .select('*')
      .eq('id', testLead.id)
      .maybeSingle();

    assert(Boolean(survivingLead), '8.4 CRM Lead remains fully intact and was not cascaded');

    // Clean up original test campaign
    await supabaseAdmin.from('email_recipients').delete().eq('campaign_id', created.id);
    await supabaseAdmin.from('email_campaigns').delete().eq('id', created.id);
    await supabaseAdmin.from('leads').delete().eq('id', testLead.id);
    console.log('\n🧹 Test fixtures purged cleanly.');

  } catch (err) {
    console.error('❌ [FATAL TEST EXCEPTION]:', err);
    failed++;
  }

  console.log('\n======================================================================');
  console.log(`📊 CAMPAIGN CRUD TEST RESULTS: ${passed} Passed / ${failed} Failed`);
  console.log('======================================================================\n');

  if (failed > 0) process.exit(1);
  process.exit(0);
}

runCampaignCrudTestSuite();
