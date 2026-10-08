import 'dotenv/config';
import { supabaseAdmin } from '../lib/supabase.js';

async function purgeTestData() {
  console.log('🧹 [PURGE] Starting database cleanup of test leads & operational history...\n');

  const tablesToClear = [
    { name: 'email_recipients', desc: 'Campaign recipients dispatch queue' },
    { name: 'email_campaigns', desc: 'Outbound campaigns' },
    { name: 'email_messages', desc: 'Outbound & inbound email messages' },
    { name: 'email_threads', desc: 'Unified inbox threads' },
    { name: 'calls', desc: 'Twilio call records' },
    { name: 'sms_messages', desc: 'SMS messages' },
    { name: 'activity_logs', desc: 'Lead activity timeline logs' },
    { name: 'audit_logs', desc: 'Security audit logs' },
    { name: 'leads', desc: 'CRM Leads' },
  ];

  for (const { name, desc } of tablesToClear) {
    try {
      // Fetch count before deletion
      const { count: beforeCount } = await supabaseAdmin.from(name).select('*', { count: 'exact', head: true });
      
      // Delete all records using neq on id (matching all UUIDs)
      const { error } = await supabaseAdmin.from(name).delete().neq('id', '00000000-0000-0000-0000-000000000000');
      
      if (error) {
        console.error(`❌ [PURGE ERROR] ${name} (${desc}):`, error.message);
      } else {
        console.log(`✅ [CLEARED] ${name} (${desc}): Removed ${beforeCount || 0} records.`);
      }
    } catch (err) {
      console.error(`⚠️ [EXCEPTION] Failed on table ${name}:`, err.message);
    }
  }

  console.log('\n📊 [VERIFYING POST-PURGE COUNTS]');
  const allTables = [
    'leads',
    'calls',
    'sms_messages',
    'email_campaigns',
    'email_recipients',
    'email_threads',
    'email_messages',
    'activity_logs',
    'audit_logs',
    'users',
    'sending_inboxes',
    'email_templates',
    'email_sequences'
  ];

  for (const table of allTables) {
    const { count } = await supabaseAdmin.from(table).select('*', { count: 'exact', head: true });
    console.log(` - ${table.padEnd(20)}: ${count} records`);
  }

  console.log('\n✨ [PURGE COMPLETE] System is fresh and ready for live production deployment.');
}

purgeTestData();
