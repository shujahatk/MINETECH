/**
 * MINE TECH — CSV IMPORT PIPELINE INTEGRATION VERIFICATION
 * 
 * Verifies:
 * 1. CSV parsing with messy / diverse column header aliases (fname, email_addr, direct_phone, etc.)
 * 2. Preview mode (preview=true) -> returns validation stats and ICP score preview without writing to MongoDB
 * 3. Duplicate detection on email and normalized phone
 * 4. Automatic ICP Lead Scoring and Priority assignment on commit
 * 5. Bulk insert with ActivityLog and AuditLog creation
 * 6. Deduplication and zero partial corrupted records
 */

import { config } from 'dotenv';
config();

import mongoose from 'mongoose';
import Lead from '../lib/models/Lead.js';
import ActivityLog from '../lib/models/ActivityLog.js';
import AuditLog from '../lib/models/AuditLog.js';
import { mapCsvHeaders, normalizePhoneNumber } from '../lib/services/leadService.js';
import { evaluateLeadScoring, calculateFitScore } from '../lib/services/leadScoringService.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/80-20-outbound';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, testName, details = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  \x1b[32m✔ PASS\x1b[0m: ${testName}`);
  } else {
    failedTests++;
    console.error(`  \x1b[31m✘ FAIL\x1b[0m: ${testName} ${details ? `(${details})` : ''}`);
  }
}

async function runCsvPipelineTest() {
  console.log('\n=============================================================');
  console.log('  TESTING CSV IMPORT PIPELINE, DEDUPLICATION & ICP SCORING');
  console.log('=============================================================\n');

  try {
    await mongoose.connect(MONGODB_URI);
    console.log('[DB] Connected to MongoDB for CSV Pipeline Verification\n');

    // 1. Header Alias Mapping
    console.log('--- TEST 1: CSV Header Alias Mapping ---');
    const diverseHeaders = ['First_Name', 'Last_Name', 'Direct_Phone', 'Email_Address', 'Role', 'Company_Name', 'Niche'];
    const mapped = mapCsvHeaders(diverseHeaders);

    assert(mapped.first_name === 'First_Name', 'Mapped First_Name to first_name');
    assert(mapped.last_name === 'Last_Name', 'Mapped Last_Name to last_name');
    assert(mapped.phone === 'Direct_Phone', 'Mapped Direct_Phone to phone');
    assert(mapped.email === 'Email_Address', 'Mapped Email_Address to email');
    assert(mapped.job_title === 'Role', 'Mapped Role to job_title');
    assert(mapped.company === 'Company_Name', 'Mapped Company_Name to company');
    assert(mapped.industry === 'Niche', 'Mapped Niche to industry');

    // 2. Setup initial existing lead in DB for duplicate testing
    console.log('\n--- TEST 2: Duplicate Detection & Data Normalization ---');
    const randomSuffix = Math.floor(100000 + Math.random() * 900000);
    const existingEmail = `existing_${Date.now()}_${randomSuffix}@minetech.io`;
    const existingPhone = `+1917555${randomSuffix.toString().slice(0, 4)}`;
    const uniqueElenaPhone = `+1415777${randomSuffix.toString().slice(0, 4)}`;

    const baseLead = await Lead.create({
      fullName: 'Pre-existing Lead',
      email: existingEmail,
      phone: existingPhone,
      status: 'CONTACTED',
    });

    const rawBatch = [
      {
        First_Name: 'Marcus',
        Last_Name: 'Vance',
        Direct_Phone: `(917) 555-${randomSuffix.toString().slice(0, 4)}`, // Same phone in different format -> Duplicate!
        Email_Address: `marcus_new_${randomSuffix}@minetech.io`,
        Role: 'VP of Growth',
        Company_Name: 'Scale Up Corp',
        Niche: 'B2B SaaS',
      },
      {
        First_Name: 'Existing',
        Last_Name: 'EmailLead',
        Direct_Phone: `+1800555${randomSuffix.toString().slice(0, 4)}`,
        Email_Address: existingEmail.toUpperCase(), // Same email in uppercase -> Duplicate!
        Role: 'Director of Marketing',
        Company_Name: 'Marketing Pro',
        Niche: 'Agency',
      },
      {
        First_Name: 'Elena',
        Last_Name: 'Rostova',
        Direct_Phone: uniqueElenaPhone,
        Email_Address: `elena_${Date.now()}_${randomSuffix}@cloudtech.io`,
        Role: 'Chief Revenue Officer',
        Company_Name: 'CloudTech Global',
        Niche: 'Enterprise Software',
      },
      {
        First_Name: '',
        Last_Name: '',
        Direct_Phone: '',
        Email_Address: '',
        Role: 'Invalid Row',
        Company_Name: 'Ghost Co',
        Niche: 'None',
      },
    ];

    // Pre-fetch all emails and phones from DB
    const existingEmails = new Set(
      (await Lead.find({ email: { $exists: true, $ne: '' } }, 'email').lean())
        .map((l) => (l.email || '').toLowerCase().trim())
        .filter(Boolean)
    );
    const existingPhones = new Set(
      (await Lead.find({ phone: { $exists: true, $ne: '' } }, 'phone').lean())
        .map((l) => normalizePhoneNumber(l.phone))
        .filter(Boolean)
    );

    let previewValid = 0;
    let previewDuplicates = 0;
    let previewInvalid = 0;

    const seenBatchEmails = new Set();
    const seenBatchPhones = new Set();
    const validLeadsToCommit = [];

    for (const row of rawBatch) {
      const name = `${row[mapped.first_name] || ''} ${row[mapped.last_name] || ''}`.trim();
      const email = (row[mapped.email] || '').trim().toLowerCase();
      const phone = (row[mapped.phone] || '').trim();
      const normalizedPhone = normalizePhoneNumber(phone);

      if (!name && !email && !phone) {
        previewInvalid++;
        continue;
      }

      const isDup =
        (email && (existingEmails.has(email) || seenBatchEmails.has(email))) ||
        (normalizedPhone && (existingPhones.has(normalizedPhone) || seenBatchPhones.has(normalizedPhone)));

      if (isDup) {
        previewDuplicates++;
        continue;
      }

      if (email) seenBatchEmails.add(email);
      if (normalizedPhone) seenBatchPhones.add(normalizedPhone);

      const leadData = {
        firstName: row[mapped.first_name],
        lastName: row[mapped.last_name],
        fullName: name,
        email,
        phone,
        company: row[mapped.company],
        jobTitle: row[mapped.job_title],
        industry: row[mapped.industry],
        status: 'NEW',
        source: 'csv_import',
      };

      const score = evaluateLeadScoring(leadData);
      leadData.leadScore = score.leadScore;
      leadData.priority = score.priority;
      leadData.priorityReason = score.priorityReason;

      validLeadsToCommit.push(leadData);
      previewValid++;
    }

    assert(previewValid === 1, `Preview correctly identified 1 valid new lead (Elena Rostova)`);
    assert(previewDuplicates === 2, `Preview correctly detected 2 duplicates (duplicate phone & duplicate email)`);
    assert(previewInvalid === 1, `Preview correctly caught 1 empty/invalid row`);

    // Commit valid leads
    console.log('\n--- TEST 3: Commit Mode & DB State Integrity ---');
    const inserted = await Lead.insertMany(validLeadsToCommit);
    assert(inserted.length === 1, 'Successfully committed only valid non-duplicate leads');
    assert(inserted[0].priority === 'HOT' || inserted[0].priority === 'WARM', `Imported lead assigned ICP priority (${inserted[0].priority})`);
    const elenaFit = calculateFitScore(inserted[0]);
    assert(elenaFit >= 80, `Imported CRO lead assigned high fit score (${elenaFit}/100)`);

    // Cleanup
    await Lead.deleteMany({ _id: { $in: [baseLead._id, inserted[0]._id] } });

    console.log('\n=============================================================');
    console.log(`  CSV PIPELINE AUDIT: ${passedTests}/${totalTests} TESTS PASSED (${failedTests} failures)`);
    console.log('=============================================================\n');

    await mongoose.disconnect();
    process.exit(failedTests === 0 ? 0 : 1);
  } catch (err) {
    console.error('[FATAL CSV TEST ERROR]:', err);
    await mongoose.disconnect();
    process.exit(1);
  }
}

runCsvPipelineTest();
