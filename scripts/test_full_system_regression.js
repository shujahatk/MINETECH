import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const testSuites = [
  { name: 'Password Security & JWT Hardening', script: 'scripts/test_password_security_regression.js' },
  { name: 'Atomic Concurrency & Queue Locking', script: 'scripts/test_concurrency_locking.js' },
  { name: 'Resend Attribution & Webhook Deduplication', script: 'scripts/test_resend_attribution_idempotency.js' },
  { name: 'Twilio Signatures & Status Webhooks', script: 'scripts/test_twilio_signatures_and_states.js' },
  { name: 'Durable Scheduler & Worker Durability', script: 'scripts/test_scheduler_and_durability.js' },
  { name: 'AI Generation Queue & Send-Blocking', script: 'scripts/test_ai_generation_queue.js' },
  { name: 'Resend Transactional Safety & Reconciliation', script: 'scripts/test_webhook_transactional_safety.js' },
  { name: 'Twilio Live Call States & Hangup', script: 'scripts/test_twilio_call_states.js' },
  { name: 'Supabase Migration & Rerun Safety', script: 'scripts/test_migration_rerun_safety.js' },
  { name: 'Exit Code & Failure Discipline', script: 'scripts/test_exit_code_discipline.js' },
];

console.log('======================================================================');
console.log('🚀 RUNNING MINDTECH COMPLETE PRODUCTION REGRESSION TEST SUITE');
console.log('======================================================================\n');

let allPassed = true;
let totalPassed = 0;
let totalFailed = 0;
let totalSkipped = 0;
const resultsLog = [];

for (const suite of testSuites) {
  console.log(`\n▶️ Running: ${suite.name} (${suite.script})...`);
  try {
    const output = execSync(`node ${suite.script}`, {
      cwd: rootDir,
      encoding: 'utf-8',
      stdio: 'pipe',
    });
    console.log(output);

    // Extract numbers if present
    const match = output.match(/(\d+)\s+Passed\s*\/\s*(\d+)\s+Failed(?:\s*\/\s*(\d+)\s+Skipped)?/i);
    if (match) {
      totalPassed += parseInt(match[1], 10);
      totalFailed += parseInt(match[2], 10);
      if (match[3]) totalSkipped += parseInt(match[3], 10);
    }
    resultsLog.push({ name: suite.name, script: suite.script, exitCode: 0, status: 'PASS' });
  } catch (err) {
    console.error(`❌ Suite Failed: ${suite.name}`);
    console.error(err.stdout || '');
    console.error(err.stderr || '');
    allPassed = false;
    totalFailed += 1;
    resultsLog.push({ name: suite.name, script: suite.script, exitCode: err.status || 1, status: 'FAIL' });
  }
}

console.log('\n======================================================================');
console.log('📊 OVERALL TEST EXECUTION SUMMARY');
console.log('======================================================================');
for (const res of resultsLog) {
  const icon = res.status === 'PASS' ? '✅' : '❌';
  console.log(`${icon} [${res.status}] ${res.name} (Exit Code: ${res.exitCode})`);
}
console.log('----------------------------------------------------------------------');
console.log(`Total Assertions Passed:  ${totalPassed}`);
console.log(`Total Assertions Failed:  ${totalFailed}`);
console.log(`Total Assertions Skipped: ${totalSkipped}`);
console.log('======================================================================\n');

if (allPassed && totalFailed === 0) {
  console.log('🏆 ALL SUITES PASSED SUCCESSFULLY (100% PRODUCTION READY)');
  console.log('======================================================================\n');
  process.exit(0);
} else {
  console.error('💥 ONE OR MORE TEST SUITES FAILED');
  console.log('======================================================================\n');
  process.exit(1);
}
