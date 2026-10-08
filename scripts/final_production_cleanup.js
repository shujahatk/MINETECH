import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '../lib/supabase.js';

async function performFinalCleanup() {
  console.log('🚀 [FINAL PRODUCTION CLEANUP] Starting execution...\n');

  // Step 1: Pre-cleanup count check
  const { count: preSeqCount } = await supabaseAdmin.from('email_sequences').select('*', { count: 'exact', head: true });
  const { count: preTplCount } = await supabaseAdmin.from('email_templates').select('*', { count: 'exact', head: true });

  console.log(`📊 [BEFORE CLEANUP]`);
  console.log(` - email_sequences: ${preSeqCount}`);
  console.log(` - email_templates: ${preTplCount}\n`);

  // Step 2: Delete email_sequences (child reference to templates in steps jsonb)
  console.log('🗑️ [ACTION] Deleting all records from email_sequences...');
  const { error: seqError } = await supabaseAdmin
    .from('email_sequences')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');

  if (seqError) {
    console.error('❌ Failed to delete email_sequences:', seqError.message);
  } else {
    console.log(`✅ [DELETED] All ${preSeqCount} records from email_sequences.`);
  }

  // Step 3: Delete email_templates
  console.log('🗑️ [ACTION] Deleting all records from email_templates...');
  const { error: tplError } = await supabaseAdmin
    .from('email_templates')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');

  if (tplError) {
    console.error('❌ Failed to delete email_templates:', tplError.message);
  } else {
    console.log(`✅ [DELETED] All ${preTplCount} records from email_templates.\n`);
  }

  // Step 4: Post-cleanup verification of all 13 tables
  console.log('📊 [AFTER CLEANUP - EXACT TABLE COUNTS]');
  const allTables = [
    'users',
    'leads',
    'calls',
    'sms_messages',
    'sending_inboxes',
    'email_templates',
    'email_sequences',
    'email_campaigns',
    'email_recipients',
    'email_threads',
    'email_messages',
    'activity_logs',
    'audit_logs'
  ];

  const postCounts = {};
  for (const table of allTables) {
    const { count, error } = await supabaseAdmin.from(table).select('*', { count: 'exact', head: true });
    if (error) {
      postCounts[table] = `ERROR: ${error.message}`;
    } else {
      postCounts[table] = count;
    }
    console.log(` - ${table.padEnd(20)}: ${postCounts[table]} records`);
  }

  // Step 5: Verify Admin User integrity
  console.log('\n🔐 [ADMIN INTEGRITY VERIFICATION]');
  const { data: adminUsers, error: userError } = await supabaseAdmin
    .from('users')
    .select('id, email, role, approved, password')
    .eq('email', 'admin@8020aquisition.com');

  if (userError || !adminUsers || adminUsers.length === 0) {
    console.error('❌ Admin user verification failed:', userError?.message);
  } else {
    const admin = adminUsers[0];
    const passwordValid = await bcrypt.compare('AdminPassword2026!', admin.password);
    console.log(`✅ Admin account found: ${admin.email} (Role: ${admin.role}, Approved: ${admin.approved})`);
    console.log(`✅ Password verification: ${passwordValid ? 'VALID' : 'INVALID'}`);
  }

  // Step 6: Verify Analytics Dynamic Calculation
  console.log('\n📈 [ANALYTICS VERIFICATION]');
  const { getDashboardData } = await import('../lib/services/analyticsService.js');
  const dashboardData = await getDashboardData();
  console.log('Dashboard KPI Response:', JSON.stringify(dashboardData, null, 2));

  console.log('\n✨ [FINAL CLEANUP EXECUTION COMPLETED]');
}

performFinalCleanup().catch(console.error);
