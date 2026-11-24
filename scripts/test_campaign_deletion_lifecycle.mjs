import assert from 'node:assert/strict';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });
import { supabaseAdmin } from '../lib/supabase.js';
import {
  getCampaignDeletionImpact,
  deleteCampaign
} from '../lib/services/campaignService.js';
import { getDashboardData } from '../lib/services/analyticsService.js';

let passed = 0;
function test(name, ok, msg) {
  if (ok) {
    passed++;
    console.log(`  [PASS] ${name}`);
  } else {
    console.error(`  [FAIL] ${name} - ${msg}`);
    process.exitCode = 1;
  }
}

async function run() {
  console.log('\n--- CAMPAIGN DELETION LIFECYCLE VERIFICATION SUITE ---\n');

  // ==========================================
  // SCENARIO 1: Option 1 — Delete Campaign Only
  // ==========================================
  console.log('Testing Scenario 1: Option 1 (Delete Campaign Only)...');

  // 1. Create a test campaign
  const { data: camp1, error: c1Err } = await supabaseAdmin
    .from('email_campaigns')
    .insert({
      name: 'Test Deletion Camp 1 - Retain Leads',
      status: 'DRAFT',
      subject: 'Test Subject 1',
    })
    .select()
    .single();
  assert.ok(!c1Err, 'camp1 creation failed: ' + c1Err?.message);

  // 2. Create 2 test leads
  const ts = Date.now();
  const { data: lead1, error: l1Err } = await supabaseAdmin
    .from('leads')
    .insert({
      company: 'Test Co 1',
      email: `test_c1_l1_${ts}@example.com`,
      status: 'NEW',
    })
    .select()
    .single();
  assert.ok(!l1Err, 'lead1 creation failed');

  const { data: lead2, error: l2Err } = await supabaseAdmin
    .from('leads')
    .insert({
      company: 'Test Co 2',
      email: `test_c1_l2_${ts}@example.com`,
      status: 'NEW',
    })
    .select()
    .single();
  assert.ok(!l2Err, 'lead2 creation failed');

  // 3. Associate leads with campaign in email_recipients
  await supabaseAdmin.from('email_recipients').insert([
    { campaign_id: camp1.id, lead_id: lead1.id, email: lead1.email, status: 'QUEUED' },
    { campaign_id: camp1.id, lead_id: lead2.id, email: lead2.email, status: 'QUEUED' },
  ]);

  // 4. Verify impact calculation
  const impact1 = await getCampaignDeletionImpact(camp1.id);
  test('Impact 1 associated leads count', impact1.totalAssociated === 2, `got ${impact1.totalAssociated}`);
  test('Impact 1 exclusive leads count', impact1.exclusiveCount === 2, `got ${impact1.exclusiveCount}`);
  test('Impact 1 shared count is 0', impact1.sharedCount === 0, `got ${impact1.sharedCount}`);

  // 5. Delete with Option 1: deleteAssociatedLeads = false
  const res1 = await deleteCampaign(camp1.id, { deleteAssociatedLeads: false });
  test('Option 1 deleteCampaign returned success', res1.success === true);
  test('Option 1 deletedExclusiveCount is 0', res1.deletedExclusiveCount === 0);
  test('Option 1 retainedSharedCount equals totalAssociated (2)', res1.retainedSharedCount === 2);

  // 6. Verify leads still exist in leads table
  const { data: checkLeads1 } = await supabaseAdmin
    .from('leads')
    .select('id')
    .in('id', [lead1.id, lead2.id]);
  test('Option 1 leaves all leads intact in database', checkLeads1?.length === 2, `expected 2, got ${checkLeads1?.length}`);

  // 7. Verify campaign row deleted
  const { data: checkCamp1 } = await supabaseAdmin
    .from('email_campaigns')
    .select('id')
    .eq('id', camp1.id)
    .maybeSingle();
  test('Campaign row is deleted', checkCamp1 === null);

  // Clean up the 2 test leads from Scenario 1
  const { deleteLeadsByIds } = await import('../lib/services/leadService.js');
  await deleteLeadsByIds([lead1.id, lead2.id]);


  // ==========================================
  // SCENARIO 2: Option 2 — Delete Campaign & Exclusive Leads (With Shared and Protected Leads)
  // ==========================================
  console.log('\nTesting Scenario 2: Option 2 (Shared Lead Protection & Advanced Stage Protection)...');

  // Create Campaign B (to be deleted) and Campaign C (remains active)
  const { data: campB } = await supabaseAdmin
    .from('email_campaigns')
    .insert({ name: 'Test Campaign B (Target)', status: 'DRAFT', subject: 'Target' })
    .select()
    .single();

  const { data: campC } = await supabaseAdmin
    .from('email_campaigns')
    .insert({ name: 'Test Campaign C (Other Active)', status: 'DRAFT', subject: 'Other' })
    .select()
    .single();

  // Create 3 leads:
  // - leadExclusive: associated only with campB
  // - leadShared: associated with BOTH campB and campC
  // - leadProtected: associated only with campB but has advanced status SAMPLE_SENT
  const { data: leadExclusive } = await supabaseAdmin
    .from('leads')
    .insert({ company: 'Exclusive Co', email: `excl_${ts}@example.com`, status: 'NEW' })
    .select().single();

  const { data: leadShared } = await supabaseAdmin
    .from('leads')
    .insert({ company: 'Shared Co', email: `shared_${ts}@example.com`, status: 'NEW' })
    .select().single();

  const { data: leadProtected } = await supabaseAdmin
    .from('leads')
    .insert({ company: 'Protected Co', email: `prot_${ts}@example.com`, status: 'SAMPLE_SENT' })
    .select().single();

  // Wire associations:
  await supabaseAdmin.from('email_recipients').insert([
    { campaign_id: campB.id, lead_id: leadExclusive.id, email: leadExclusive.email, status: 'QUEUED' },
    { campaign_id: campB.id, lead_id: leadShared.id, email: leadShared.email, status: 'QUEUED' },
    { campaign_id: campB.id, lead_id: leadProtected.id, email: leadProtected.email, status: 'QUEUED' },
    // campC also has leadShared
    { campaign_id: campC.id, lead_id: leadShared.id, email: leadShared.email, status: 'QUEUED' },
  ]);

  // Check impact of campB
  const impactB = await getCampaignDeletionImpact(campB.id);
  test('Impact B total associated is 3', impactB.totalAssociated === 3, `got ${impactB.totalAssociated}`);
  test('Impact B shared count is 1', impactB.sharedCount === 1, `got ${impactB.sharedCount}`);
  test('Impact B protected count is 1', impactB.protectedCount === 1, `got ${impactB.protectedCount}`);
  test('Impact B eligible for deletion count is 1', impactB.eligibleForDeletionCount === 1, `got ${impactB.eligibleForDeletionCount}`);
  test('Eligible lead is exactly leadExclusive', impactB.eligibleLeadIds[0] === leadExclusive.id);

  // Execute deleteCampaign with Option 2 (deleteAssociatedLeads = true)
  const resB = await deleteCampaign(campB.id, { deleteAssociatedLeads: true });
  test('Option 2 deleteCampaign success', resB.success === true);
  test('Option 2 deletedExclusiveCount is 1', resB.deletedExclusiveCount === 1, `got ${resB.deletedExclusiveCount}`);
  test('Option 2 retained count is 2 (1 shared + 1 protected)', resB.retainedSharedCount === 2, `got ${resB.retainedSharedCount}`);

  // Verify DB states:
  // 1. leadExclusive is DELETED
  const { data: checkExcl } = await supabaseAdmin.from('leads').select('id').eq('id', leadExclusive.id).maybeSingle();
  test('Exclusive unprotected lead was permanently deleted from DB', checkExcl === null);

  // 2. leadShared STILL EXISTS in leads and in campC recipients
  const { data: checkShared } = await supabaseAdmin.from('leads').select('id').eq('id', leadShared.id).maybeSingle();
  test('Shared lead was kept in DB', checkShared !== null);

  const { data: checkSharedRec } = await supabaseAdmin.from('email_recipients').select('id').eq('campaign_id', campC.id).eq('lead_id', leadShared.id);
  test('Shared lead association with other active campaign remains intact', checkSharedRec?.length === 1);

  // 3. leadProtected STILL EXISTS in leads
  const { data: checkProt } = await supabaseAdmin.from('leads').select('id').eq('id', leadProtected.id).maybeSingle();
  test('Protected lead was kept in DB', checkProt !== null);

  // Clean up campC and remaining test leads
  await deleteCampaign(campC.id, { deleteAssociatedLeads: false });
  await deleteLeadsByIds([leadShared.id, leadProtected.id]);

  // ==========================================
  // SCENARIO 3: Dashboard Synchronization & Accuracy
  // ==========================================
  console.log('\nTesting Scenario 3: Dashboard Synchronization...');
  const dash = await getDashboardData();
  const { count: actualLeadCount } = await supabaseAdmin.from('leads').select('*', { count: 'exact', head: true });
  test('Dashboard totalLeads matches actual database lead count exactly', dash.today?.totalLeads === actualLeadCount, `dash=${dash.today?.totalLeads}, actual=${actualLeadCount}`);

  console.log(`\nAll ${passed} tests passed successfully!`);
}

run().catch((err) => {
  console.error('Test execution error:', err);
  process.exitCode = 1;
});
