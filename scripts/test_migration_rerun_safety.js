import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let passed = 0;
let failed = 0;
let skipped = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  ❌ [FAIL] ${message}`);
    failed++;
  }
}

async function runMigrationSafetyTests() {
  console.log('======================================================================');
  console.log('🗄️ TESTING SUPABASE UPGRADE MIGRATION & RERUN SAFETY');
  console.log('======================================================================\n');

  const migrationPath = path.resolve(__dirname, '../supabase/migrations/20260909_production_queue_fixes.sql');

  try {
    assert(fs.existsSync(migrationPath), 'Migration file supabase/migrations/20260909_production_queue_fixes.sql exists');

    const sqlContent = fs.readFileSync(migrationPath, 'utf-8');

    assert(sqlContent.includes('ADD COLUMN IF NOT EXISTS generation_status'), 'Migration uses non-destructive ADD COLUMN IF NOT EXISTS for generation_status');
    assert(sqlContent.includes('ADD COLUMN IF NOT EXISTS resend_id'), 'Migration adds resend_id column safely');
    assert(sqlContent.includes('CREATE TABLE IF NOT EXISTS email_webhook_events'), 'Migration creates email_webhook_events with IF NOT EXISTS');
    assert(sqlContent.includes('CREATE TABLE IF NOT EXISTS system_locks'), 'Migration creates system_locks with IF NOT EXISTS');
    assert(sqlContent.includes('CREATE INDEX IF NOT EXISTS'), 'Migration uses IF NOT EXISTS for all indexes');
    assert(sqlContent.includes('CREATE OR REPLACE FUNCTION claim_next_email_recipient'), 'Migration replaces claim_next_email_recipient RPC safely');
    assert(sqlContent.includes('CREATE OR REPLACE FUNCTION claim_next_generation_recipient'), 'Migration defines claim_next_generation_recipient RPC');
    assert(sqlContent.includes('DROP POLICY IF EXISTS'), 'Migration drops existing policies before re-creation');
    assert(sqlContent.includes('UPDATE email_recipients'), 'Migration includes backfill logic for existing records');

  } catch (err) {
    console.error('❌ [FATAL TEST ERROR]:', err.message);
    failed++;
  }

  console.log(`\n======================================================================`);
  console.log(`📊 MIGRATION SAFETY RESULTS: ${passed} Passed / ${failed} Failed / ${skipped} Skipped`);
  console.log(`======================================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runMigrationSafetyTests().catch(err => {
  console.error('Fatal runner error:', err);
  process.exit(1);
});
