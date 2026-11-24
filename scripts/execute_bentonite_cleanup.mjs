import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });
import { supabaseAdmin } from '../lib/supabase.js';
import { deleteLeadsByIds } from '../lib/services/leadService.js';
import { getDashboardData } from '../lib/services/analyticsService.js';

async function main() {
  console.log('--- STARTING BENTONITE SUPPLIERS CLEANUP ---');
  
  // 1. Fetch exact 42 leads from Nov 3 batch
  const { data: leads, error: fetchErr } = await supabaseAdmin
    .from('leads')
    .select('id, company, full_name, email, tags, created_at, status')
    .filter('created_at', 'gte', '2026-11-03T00:00:00')
    .filter('created_at', 'lte', '2026-11-03T23:59:59');

  if (fetchErr) throw fetchErr;
  console.log(`Identified ${leads.length} leads for deletion.`);

  const idsToDelete = leads.map(l => l.id);

  // 2. Perform deletion
  const delResult = await deleteLeadsByIds(idsToDelete);
  console.log('Deletion result:', delResult);

  // 3. Verify total remaining leads in database
  const { count: remainingCount, error: countErr } = await supabaseAdmin
    .from('leads')
    .select('*', { count: 'exact', head: true });
  console.log(`Remaining leads in database: ${remainingCount}`);

  // 4. Verify dashboard stats
  const dashboard = await getDashboardData();
  console.log('Dashboard Data today:', dashboard.today);

  // Log activity log for audit trail
  await supabaseAdmin.from('activity_logs').insert({
    type: 'CAMPAIGN_LEADS_CLEANUP',
    description: `Deleted ${delResult.affected} remaining associated leads from deleted campaign "Bentonite Suppliers" (d1868381-c259-4dee-9e66-f882f3f9c9df).`,
    metadata: {
      campaignId: 'd1868381-c259-4dee-9e66-f882f3f9c9df',
      deletedLeadCount: delResult.affected,
      deletedLeadIds: delResult.deleted,
      remainingTotalLeads: remainingCount
    }
  });

  console.log('Cleanup completed successfully and logged.');
}

main().catch(console.error);
