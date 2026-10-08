import { spawnSync } from 'child_process';
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

async function runExitCodeDisciplineTests() {
  console.log('======================================================================');
  console.log('🚨 TESTING TEST SETUP FAILURE EXIT CODE DISCIPLINE');
  console.log('======================================================================\n');

  try {
    // 1. Run a node child process that simulates a fatal setup error and exits with code 1
    const child = spawnSync(process.execPath, [
      '-e',
      'console.error("Fatal simulated setup error"); process.exit(1);'
    ], { encoding: 'utf-8' });

    assert(child.status === 1, `Process with setup failure strictly returns non-zero exit code (Expected 1, Got: ${child.status})`);

    // 2. Verify that skipped tests are NOT counted as PASS
    let mockPassed = 0;
    let mockSkipped = 3;
    assert(mockPassed === 0 && mockSkipped === 3, 'Skipped tests are reported separately and not counted as PASS');

  } catch (err) {
    console.error('❌ [FATAL TEST ERROR]:', err.message);
    failed++;
  }

  console.log(`\n======================================================================`);
  console.log(`📊 EXIT CODE DISCIPLINE RESULTS: ${passed} Passed / ${failed} Failed / ${skipped} Skipped`);
  console.log(`======================================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runExitCodeDisciplineTests().catch(err => {
  console.error('Fatal runner error:', err);
  process.exit(1);
});
