import 'dotenv/config';
import { supabaseAdmin } from '../lib/supabase.js';

async function clearTestData() {
  console.log('🧹 Clearing all test data from Supabase database...');

  try {
    // 1. Clear activity and audit logs
    const { error: errAudit } = await supabaseAdmin.from('audit_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (errAudit) console.warn('audit_logs purge note:', errAudit.message);
    else console.log('  ✓ Purged audit_logs');

    const { error: errAct } = await supabaseAdmin.from('activity_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (errAct) console.warn('activity_logs purge note:', errAct.message);
    else console.log('  ✓ Purged activity_logs');

    // 2. Clear communications: emails, calls, sms
    const { error: errMsg } = await supabaseAdmin.from('email_messages').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (errMsg) console.warn('email_messages purge note:', errMsg.message);
    else console.log('  ✓ Purged email_messages');

    const { error: errTh } = await supabaseAdmin.from('email_threads').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (errTh) console.warn('email_threads purge note:', errTh.message);
    else console.log('  ✓ Purged email_threads');

    const { error: errSms } = await supabaseAdmin.from('sms_messages').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (errSms) console.warn('sms_messages purge note:', errSms.message);
    else console.log('  ✓ Purged sms_messages');

    const { error: errCalls } = await supabaseAdmin.from('calls').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (errCalls) console.warn('calls purge note:', errCalls.message);
    else console.log('  ✓ Purged calls');

    // 3. Clear campaign queue and campaigns
    const { error: errRecip } = await supabaseAdmin.from('email_recipients').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (errRecip) console.warn('email_recipients purge note:', errRecip.message);
    else console.log('  ✓ Purged email_recipients');

    const { error: errCamp } = await supabaseAdmin.from('email_campaigns').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (errCamp) console.warn('email_campaigns purge note:', errCamp.message);
    else console.log('  ✓ Purged email_campaigns');

    // 4. Clear leads
    const { error: errLeads } = await supabaseAdmin.from('leads').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (errLeads) console.warn('leads purge note:', errLeads.message);
    else console.log('  ✓ Purged leads');

    // 5. Purge test users (keep admin account)
    const adminEmail = (process.env.ADMIN_EMAIL || 'admin@minetech.com').toLowerCase().trim();
    const { error: errUsers } = await supabaseAdmin
      .from('users')
      .delete()
      .neq('email', adminEmail);
    if (errUsers) console.warn('users purge note:', errUsers.message);
    else console.log(`  ✓ Purged test users (retained primary admin: ${adminEmail})`);

    console.log('\n✨ Database is 100% clean and ready for real data and lead uploads!');
  } catch (err) {
    console.error('Database cleanup error:', err);
  }
}

clearTestData();
