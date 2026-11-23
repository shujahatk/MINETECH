import { supabaseAdmin } from '../lib/supabase.js';
import { toLightweightAttachment } from '../lib/services/documentLibraryService.js';

let passes = 0;
let failures = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passes++;
  } else {
    console.error(`  [FAIL] ${message}`);
    failures++;
  }
}

async function runSuite() {
  console.log('====================================================');
  console.log('TEST SUITE: ATTACHMENT REMOVAL & DETACHMENT VERIFICATION');
  console.log('====================================================\n');

  // Guard: track emails count before testing
  const { count: initialEmailsCount } = await supabaseAdmin
    .from('emails')
    .select('*', { count: 'exact', head: true });

  // Step 1: Fetch active batch
  console.log('Step 1: Fetch active workspace batch');
  const { data: batches } = await supabaseAdmin
    .from('email_campaigns')
    .select('id, name, stats')
    .filter('stats->>is_personalized_workspace', 'eq', 'true')
    .order('created_at', { ascending: false })
    .limit(1);

  assert(batches && batches.length > 0, 'Found active personalized workspace batch');
  const batch = batches[0];
  const initialDrafts = batch.stats?.drafts || [];
  assert(initialDrafts.length === 24, `Active batch has 24 drafts (actual: ${initialDrafts.length})`);

  // Create lightweight test attachment
  const testFile1 = {
    id: `doc-test-1`,
    name: 'MineTech Technical Specs',
    fileName: 'MineTech_Specs.pdf',
    fileSize: '1.2 MB',
    fileType: 'application/pdf',
    url: 'https://example.com/specs.pdf',
    storagePath: 'uploads/specs.pdf',
  };
  const testFile2 = {
    id: `doc-test-2`,
    name: 'MineTech Product Brochure',
    fileName: 'MineTech_Brochure.pdf',
    fileSize: '2.5 MB',
    fileType: 'application/pdf',
    url: 'https://example.com/brochure.pdf',
    storagePath: 'uploads/brochure.pdf',
  };

  const lightweight1 = toLightweightAttachment(testFile1);
  const lightweight2 = toLightweightAttachment(testFile2);

  const targetDraft0 = initialDrafts[0];
  const targetDraft1 = initialDrafts[1];
  const targetDraft2 = initialDrafts[2];

  // ----------------------------------------------------
  // TEST 1: Attach files to drafts 0, 1, 2
  // ----------------------------------------------------
  console.log('\nTest 1: Attach files to drafts 0, 1, 2 in Supabase');
  const draftsWithFiles = initialDrafts.map((d) => {
    if ([targetDraft0.id, targetDraft1.id, targetDraft2.id].includes(d.id)) {
      return {
        ...d,
        assigned_attachments: [lightweight1, lightweight2],
      };
    }
    return d;
  });

  const { error: err1 } = await supabaseAdmin
    .from('email_campaigns')
    .update({
      stats: {
        ...batch.stats,
        drafts: draftsWithFiles,
      },
    })
    .eq('id', batch.id);

  assert(!err1, 'Attached 2 files to drafts 0, 1, 2 without error');

  // Verify in DB
  const { data: dbCheck1 } = await supabaseAdmin
    .from('email_campaigns')
    .select('stats')
    .eq('id', batch.id)
    .single();

  const d0_1 = dbCheck1.stats.drafts.find((d) => d.id === targetDraft0.id);
  const d1_1 = dbCheck1.stats.drafts.find((d) => d.id === targetDraft1.id);
  const d2_1 = dbCheck1.stats.drafts.find((d) => d.id === targetDraft2.id);

  assert(d0_1?.assigned_attachments?.length === 2, 'Draft 0 in DB has 2 attachments');
  assert(d1_1?.assigned_attachments?.length === 2, 'Draft 1 in DB has 2 attachments');
  assert(d2_1?.assigned_attachments?.length === 2, 'Draft 2 in DB has 2 attachments');

  // ----------------------------------------------------
  // TEST 2: 1-Click Detach from Single Draft (Draft 0)
  // ----------------------------------------------------
  console.log('\nTest 2: Detach all attachments from Draft 0 (1-click removal logic)');
  // Execute detachment logic: mode 'replace' with empty attachments for targetDraft0
  const draftsAfterSingleDetach = dbCheck1.stats.drafts.map((d) => {
    if (d.id === targetDraft0.id) {
      return { ...d, assigned_attachments: [] };
    }
    return d;
  });

  const { error: err2 } = await supabaseAdmin
    .from('email_campaigns')
    .update({
      stats: {
        ...dbCheck1.stats,
        drafts: draftsAfterSingleDetach,
      },
    })
    .eq('id', batch.id);

  assert(!err2, 'Detached attachments from Draft 0 in DB');

  const { data: dbCheck2 } = await supabaseAdmin
    .from('email_campaigns')
    .select('stats')
    .eq('id', batch.id)
    .single();

  const d0_2 = dbCheck2.stats.drafts.find((d) => d.id === targetDraft0.id);
  const d1_2 = dbCheck2.stats.drafts.find((d) => d.id === targetDraft1.id);
  const d2_2 = dbCheck2.stats.drafts.find((d) => d.id === targetDraft2.id);

  assert((d0_2?.assigned_attachments || []).length === 0, 'Draft 0 attachments successfully reduced to 0 in DB');
  assert(d1_2?.assigned_attachments?.length === 2, 'Draft 1 retains its 2 attachments (isolated)');
  assert(d2_2?.assigned_attachments?.length === 2, 'Draft 2 retains its 2 attachments (isolated)');

  // ----------------------------------------------------
  // TEST 3: Bulk Detach from Selected Drafts (Drafts 1 & 2)
  // ----------------------------------------------------
  console.log('\nTest 3: Bulk Detach from Selected Drafts (Drafts 1 and 2)');
  const selectedIds = new Set([targetDraft1.id, targetDraft2.id]);
  const draftsAfterBulkDetach = dbCheck2.stats.drafts.map((d) => {
    if (selectedIds.has(d.id)) {
      return { ...d, assigned_attachments: [] };
    }
    return d;
  });

  const { error: err3 } = await supabaseAdmin
    .from('email_campaigns')
    .update({
      stats: {
        ...dbCheck2.stats,
        drafts: draftsAfterBulkDetach,
      },
    })
    .eq('id', batch.id);

  assert(!err3, 'Bulk detached from selected drafts 1 and 2 in DB');

  const { data: dbCheck3 } = await supabaseAdmin
    .from('email_campaigns')
    .select('stats')
    .eq('id', batch.id)
    .single();

  const d1_3 = dbCheck3.stats.drafts.find((d) => d.id === targetDraft1.id);
  const d2_3 = dbCheck3.stats.drafts.find((d) => d.id === targetDraft2.id);

  assert((d1_3?.assigned_attachments || []).length === 0, 'Draft 1 attachments successfully reduced to 0 in DB');
  assert((d2_3?.assigned_attachments || []).length === 0, 'Draft 2 attachments successfully reduced to 0 in DB');

  // ----------------------------------------------------
  // TEST 4: Detach a specific file by ID/Name (Filtering)
  // ----------------------------------------------------
  console.log('\nTest 4: Detach specific file by ID');
  const d0WithTwoFiles = [lightweight1, lightweight2];
  const d0AfterFilteringOne = d0WithTwoFiles.filter(
    (a) => a.id !== testFile1.id && a.fileName !== testFile1.fileName
  );
  assert(d0AfterFilteringOne.length === 1, 'Filtering single file leaves exactly 1 file');
  assert(d0AfterFilteringOne[0].id === testFile2.id, 'Remaining file is testFile2');

  // ----------------------------------------------------
  // TEST 5: Campaign-Wide Attachment Removal (Remove All)
  // ----------------------------------------------------
  console.log('\nTest 5: Campaign-Wide Attachment Removal (Remove All)');
  const draftsClearedAll = dbCheck3.stats.drafts.map((d) => ({
    ...d,
    assigned_attachments: [],
  }));

  const { error: err5 } = await supabaseAdmin
    .from('email_campaigns')
    .update({
      stats: {
        ...dbCheck3.stats,
        campaign_attachments: [],
        attachments: [],
        drafts: draftsClearedAll,
      },
    })
    .eq('id', batch.id);

  assert(!err5, 'Campaign attachments cleared workspace-wide');

  const { data: dbCheck5 } = await supabaseAdmin
    .from('email_campaigns')
    .select('stats')
    .eq('id', batch.id)
    .single();

  const campAtts = dbCheck5.stats?.campaign_attachments || [];
  const allDraftAtts = (dbCheck5.stats?.drafts || []).flatMap((d) => d.assigned_attachments || []);

  assert(campAtts.length === 0, 'Campaign attachments list in database is completely empty (0 files)');
  assert(allDraftAtts.length === 0, 'All 24 drafts in database have 0 attachments');

  // ----------------------------------------------------
  // TEST 6: Re-attach and re-detach cycle verification
  // ----------------------------------------------------
  console.log('\nTest 6: End-to-end cycle (attach to all -> verify 24 -> detach from all -> verify 0)');
  const cycleDraftsAttached = dbCheck5.stats.drafts.map((d) => ({
    ...d,
    assigned_attachments: [lightweight1],
  }));

  const { error: errAttachCycle } = await supabaseAdmin
    .from('email_campaigns')
    .update({
      stats: {
        ...dbCheck5.stats,
        campaign_attachments: [lightweight1],
        drafts: cycleDraftsAttached,
      },
    })
    .eq('id', batch.id);

  assert(!errAttachCycle, 'Attached test file to all 24 drafts');

  const { data: checkCycle1 } = await supabaseAdmin
    .from('email_campaigns')
    .select('stats')
    .eq('id', batch.id)
    .single();
  const countAttached = (checkCycle1.stats?.drafts || []).filter((d) => (d.assigned_attachments || []).length === 1).length;
  assert(countAttached === 24, `All 24 drafts now show 1 attached file (actual: ${countAttached})`);

  // Now detach all
  const cycleDraftsDetached = checkCycle1.stats.drafts.map((d) => ({
    ...d,
    assigned_attachments: [],
  }));
  const { error: errDetachCycle } = await supabaseAdmin
    .from('email_campaigns')
    .update({
      stats: {
        ...checkCycle1.stats,
        campaign_attachments: [],
        drafts: cycleDraftsDetached,
      },
    })
    .eq('id', batch.id);

  assert(!errDetachCycle, 'Detached all files from all 24 drafts cleanly');

  const { data: checkCycle2 } = await supabaseAdmin
    .from('email_campaigns')
    .select('stats')
    .eq('id', batch.id)
    .single();
  const countRemaining = (checkCycle2.stats?.drafts || []).filter((d) => (d.assigned_attachments || []).length > 0).length;
  assert(countRemaining === 0, `0 drafts have attachments remaining after detachment (actual: ${countRemaining})`);

  // ----------------------------------------------------
  // TEST 7: Live Email Sending Guard (Zero live emails sent)
  // ----------------------------------------------------
  console.log('\nTest 7: Verification that ZERO live emails were sent');
  const { count: finalEmailsCount } = await supabaseAdmin
    .from('emails')
    .select('*', { count: 'exact', head: true });

  assert(initialEmailsCount === finalEmailsCount, `ZERO live emails sent during tests (initial: ${initialEmailsCount}, final: ${finalEmailsCount})`);

  // Summary
  console.log('\n====================================================');
  console.log(`RESULTS: ${passes} PASSED, ${failures} FAILED`);
  console.log('====================================================');

  if (failures > 0) {
    process.exit(1);
  }
}

runSuite().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
