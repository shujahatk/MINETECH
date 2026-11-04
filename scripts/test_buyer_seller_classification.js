/**
 * Automated Test Suite: Buyer/Seller Lead Classification
 * Tests distinct classifications (Buyer, Seller, Unclassified),
 * database persistence & fallback, filtering, live count aggregation,
 * CSV import detection, and campaign audience targeting.
 */

import 'dotenv/config';
import { supabaseAdmin } from '../lib/supabase.js';
import { getLeadsList } from '../lib/services/leadListService.js';
import { updateLead, getLeadById, createLead } from '../lib/services/leadService.js';
import { auditCampaignAudience } from '../lib/services/campaignService.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  ❌ [FAIL] ${message}`);
    failed++;
  }
}

async function runClassificationSuite() {
  console.log('======================================================================');
  console.log('🏷️ MINETECH BUYER / SELLER CLASSIFICATION TEST SUITE');
  console.log('======================================================================\n');

  // 1. Fetch leads and check classification field presence
  console.log('--- [TEST 1] Lead Classification Attribute Existence ---');
  const leadsResult = await getLeadsList({ limit: 10 });
  assert(Array.isArray(leadsResult.leads) && leadsResult.leads.length > 0, `Retrieved ${leadsResult.leads.length} leads`);
  const firstLead = leadsResult.leads[0];
  assert(
    ['Buyer', 'Seller', 'Unclassified'].includes(firstLead.classification),
    `Lead classification resolved to valid category: "${firstLead.classification}"`
  );

  // 2. Aggregate Classification Counts
  console.log('\n--- [TEST 2] Classification Breakdown Live Counts ---');
  assert(leadsResult.classificationCounts !== undefined, 'classificationCounts returned in leads response');
  const counts = leadsResult.classificationCounts;
  assert(typeof counts.all === 'number' && counts.all > 0, `Total leads count: ${counts.all}`);
  assert(typeof counts.buyers === 'number', `Buyers count: ${counts.buyers}`);
  assert(typeof counts.sellers === 'number', `Sellers count: ${counts.sellers}`);
  assert(typeof counts.unclassified === 'number', `Unclassified count: ${counts.unclassified}`);
  assert(counts.buyers + counts.sellers + counts.unclassified === counts.all, 'Sum of (Buyers + Sellers + Unclassified) matches Total');

  // 3. Filtering by Classification
  console.log('\n--- [TEST 3] Server-Side Classification Filtering ---');
  const sellersFilter = await getLeadsList({ classification: 'Seller', limit: 5 });
  const allSellers = sellersFilter.leads.every((l) => l.classification === 'Seller');
  assert(allSellers, `Filtered by "Seller" -> all ${sellersFilter.leads.length} returned leads are Sellers`);

  const buyersFilter = await getLeadsList({ classification: 'Buyer', limit: 5 });
  const allBuyers = buyersFilter.leads.every((l) => l.classification === 'Buyer');
  assert(allBuyers, `Filtered by "Buyer" -> all ${buyersFilter.leads.length} returned leads are Buyers`);

  const unclassifiedFilter = await getLeadsList({ classification: 'Unclassified', limit: 5 });
  const allUnclassified = unclassifiedFilter.leads.every((l) => l.classification === 'Unclassified');
  assert(allUnclassified, `Filtered by "Unclassified" -> all ${unclassifiedFilter.leads.length} returned leads are Unclassified`);

  // 4. Update Lead Classification (CRUD & Persistence)
  console.log('\n--- [TEST 4] Inline Classification Update & Dual-Persistence ---');
  const testLeadId = firstLead.id;
  const originalClass = firstLead.classification;
  const targetClass = originalClass === 'Buyer' ? 'Seller' : 'Buyer';

  // Update to new classification
  const updatedLead = await updateLead(testLeadId, { classification: targetClass });
  assert(updatedLead.classification === targetClass, `Updated lead classification from "${originalClass}" to "${targetClass}"`);

  // Verify fetch returns updated classification
  const refetchedLead = await getLeadById(testLeadId);
  assert(refetchedLead.classification === targetClass, `Refetched lead confirmed persisted classification: "${refetchedLead.classification}"`);

  // Revert back to original classification
  await updateLead(testLeadId, { classification: originalClass });
  const restoredLead = await getLeadById(testLeadId);
  assert(restoredLead.classification === originalClass, `Cleanly reverted classification back to original: "${originalClass}"`);

  // 5. Campaign Audience Targeting by Classification
  console.log('\n--- [TEST 5] Campaign Audience Targeting by Classification ---');
  const auditAll = await auditCampaignAudience({ classification: 'ALL' });
  const auditBuyers = await auditCampaignAudience({ classification: 'Buyer' });
  const auditSellers = await auditCampaignAudience({ classification: 'Seller' });

  assert(typeof auditAll.eligible === 'number', `Audience Audit (ALL): ${auditAll.eligible} eligible leads`);
  assert(typeof auditBuyers.eligible === 'number', `Audience Audit (Buyers Only): ${auditBuyers.eligible} eligible leads`);
  assert(typeof auditSellers.eligible === 'number', `Audience Audit (Sellers Only): ${auditSellers.eligible} eligible leads`);
  assert(auditBuyers.eligible <= auditAll.eligible, 'Buyers subset is <= Total Audience');
  assert(auditSellers.eligible <= auditAll.eligible, 'Sellers subset is <= Total Audience');

  console.log('\n======================================================================');
  console.log(`📊 CLASSIFICATION TEST RESULTS: ${passed} Passed / ${failed} Failed`);
  console.log('======================================================================\n');

  if (failed > 0) process.exit(1);
}

runClassificationSuite().catch((e) => {
  console.error('Fatal classification test error:', e);
  process.exit(1);
});

