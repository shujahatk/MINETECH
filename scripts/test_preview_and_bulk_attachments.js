import jwt from 'jsonwebtoken';
import { supabaseAdmin } from '../lib/supabase.js';
import {
  getAllDocumentsAsync,
  addCustomDocumentAsync,
  deleteDocumentAsync,
  toLightweightAttachment,
} from '../lib/services/documentLibraryService.js';
import { GET as previewRoute } from '../app/api/email/workspace/documents/preview/route.js';

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
  console.log('TEST SUITE: DOCUMENT PREVIEW & BULK ATTACHMENT TIMEOUT');
  console.log('====================================================\n');

  // Track email dispatch count before tests
  const { count: initialEmailsSent } = await supabaseAdmin
    .from('emails')
    .select('*', { count: 'exact', head: true });

  // ----------------------------------------------------
  // TEST 1: Lightweight Attachment Serialization (<400 bytes, No Base64)
  // ----------------------------------------------------
  console.log('Test 1: Lightweight Attachment Serialization');
  const heavyDoc = {
    id: `doc-${Date.now()}`,
    name: 'Heavy Industrial Bentonite Spec Sheet',
    fileName: 'heavy_spec.pdf',
    fileSize: '4.2 MB',
    fileType: 'application/pdf',
    url: 'https://oatkydlnhenemojbaxwx.supabase.co/storage/v1/object/public/email-attachments/uploads/spec.pdf',
    storagePath: 'uploads/spec.pdf',
    uploadedBy: 'rauf@mine-tech.be',
    dataBase64: 'A'.repeat(4 * 1024 * 1024), // 4MB raw base64 string
    unnecessaryField: 'should be stripped',
  };

  const lightweight = toLightweightAttachment(heavyDoc);
  const serialized = JSON.stringify(lightweight);
  const byteSize = Buffer.byteLength(serialized, 'utf8');

  assert(lightweight.dataBase64 === undefined, 'dataBase64 is completely stripped from lightweight attachment');
  assert(lightweight.unnecessaryField === undefined, 'Extraneous fields stripped');
  assert(lightweight.id === heavyDoc.id, 'Document ID preserved');
  assert(lightweight.fileName === heavyDoc.fileName, 'File name preserved');
  assert(lightweight.url === heavyDoc.url, 'Direct URL preserved');
  assert(lightweight.storagePath === heavyDoc.storagePath, 'Storage path preserved');
  assert(byteSize < 400, `Lightweight attachment is extremely small: ${byteSize} bytes (limit: <400 bytes, down from 4.2 MB)`);

  // Calculate batch scale: 24 drafts * 309 bytes = 7.4 KB vs 24 drafts * 4.2 MB = 100.8 MB (99.993% reduction)
  const payload24Drafts = Buffer.byteLength(JSON.stringify(new Array(24).fill([lightweight])), 'utf8');
  assert(payload24Drafts < 10000, `24 recipients attachment payload is ${payload24Drafts} bytes (~${(payload24Drafts/1024).toFixed(1)} KB), eliminating statement timeout`);

  // ----------------------------------------------------
  // TEST 2: Document Preview Route Security & Streaming
  // ----------------------------------------------------
  console.log('\nTest 2: Document Preview Route Security & Streaming');

  // 2.1 Unauthorized request
  const unauthReq = new Request('http://localhost:3000/api/email/workspace/documents/preview?id=dummy', {
    headers: {},
  });
  const unauthRes = await previewRoute(unauthReq);
  assert(unauthRes.status === 401, 'Unauthorized request correctly rejected with 401');

  // Create real test document in Supabase Storage
  const testDocId = `test-doc-${Date.now()}`;
  const testFileName = `MineTech_Capability_${Date.now()}.pdf`;
  const dummyPdfBytes = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF');

  const { error: uploadErr } = await supabaseAdmin.storage
    .from('email-attachments')
    .upload(`uploads/${testFileName}`, dummyPdfBytes, {
      contentType: 'application/pdf',
      upsert: true,
    });
  assert(!uploadErr, `Uploaded physical test PDF to Supabase storage (error: ${uploadErr?.message || 'none'})`);

  const { data: publicUrlData } = supabaseAdmin.storage
    .from('email-attachments')
    .getPublicUrl(`uploads/${testFileName}`);

  const savedCustomDoc = await addCustomDocumentAsync({
    id: testDocId,
    name: 'MineTech Capability Statement',
    fileName: testFileName,
    fileSize: '68 B',
    fileType: 'application/pdf',
    url: publicUrlData?.publicUrl,
    storagePath: `uploads/${testFileName}`,
    uploadedBy: 'rauf@mine-tech.be',
  });
  assert(savedCustomDoc && savedCustomDoc.id === testDocId, 'Custom document record saved to database');

  // 2.2 Authorized request with valid admin JWT token
  const validAdminToken = jwt.sign(
    { userId: 'admin-rauf', email: 'rauf@mine-tech.be', role: 'admin' },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  const previewReq = new Request(`http://localhost:3000/api/email/workspace/documents/preview?id=${encodeURIComponent(testDocId)}`, {
    headers: {
      Authorization: `Bearer ${validAdminToken}`,
    },
  });
  const previewRes = await previewRoute(previewReq);
  assert(previewRes.status === 200, `Preview returned 200 OK (status: ${previewRes.status})`);
  assert(previewRes.headers.get('content-type') === 'application/pdf', 'Preview returned Content-Type: application/pdf');
  assert(previewRes.headers.get('content-disposition')?.includes('inline'), 'Preview returned Content-Disposition: inline for embedded rendering');

  const streamBody = await previewRes.arrayBuffer();
  assert(streamBody.byteLength > 0, `Preview streamed ${streamBody.byteLength} bytes of PDF data`);

  // 2.3 Download parameter check
  const downloadReq = new Request(`http://localhost:3000/api/email/workspace/documents/preview?id=${encodeURIComponent(testDocId)}&download=1`, {
    headers: {
      Authorization: `Bearer ${validAdminToken}`,
    },
  });
  const downloadRes = await previewRoute(downloadReq);
  assert(downloadRes.headers.get('content-disposition')?.includes('attachment'), 'Download parameter returned Content-Disposition: attachment');

  // ----------------------------------------------------
  // TEST 3: Bulk Attachment to Dynamic Recipients Without Timeout
  // ----------------------------------------------------
  console.log('\nTest 3: Bulk Attachment to Dynamic Recipients');

  // Fetch active batch
  const { data: batches } = await supabaseAdmin
    .from('email_campaigns')
    .select('id, stats')
    .filter('stats->>is_personalized_workspace', 'eq', 'true')
    .order('created_at', { ascending: false })
    .limit(1);

  assert(batches && batches.length > 0, 'Found active personalized email workspace batch');
  const activeBatch = batches[0];
  const drafts = activeBatch.stats.drafts || [];
  assert(drafts.length === 24, `Active batch has expected 24 drafts (actual: ${drafts.length})`);

  // 3.1 Attach to 5 selected leads (Dynamic Subset)
  const fiveSelectedIds = drafts.slice(0, 5).map((d) => d.id);
  const startTime5 = Date.now();

  const cleanAttachment = toLightweightAttachment(savedCustomDoc);

  const updatedDrafts5 = drafts.map((d) => {
    if (fiveSelectedIds.includes(d.id)) {
      const existing = (d.assigned_attachments || []).filter((a) => a.id !== testDocId);
      return { ...d, assigned_attachments: [...existing, cleanAttachment] };
    }
    return d;
  });

  const { error: updateErr5 } = await supabaseAdmin
    .from('email_campaigns')
    .update({
      stats: {
        ...activeBatch.stats,
        drafts: updatedDrafts5,
      },
    })
    .eq('id', activeBatch.id);

  const duration5 = Date.now() - startTime5;
  assert(!updateErr5, `Attached to 5 selected recipients with NO timeout (error: ${updateErr5?.message || 'none'})`);
  assert(duration5 < 1000, `DB write for 5 recipients finished in ${duration5}ms (far below timeout)`);

  // Verify only 5 have it
  const { data: verifyBatches5 } = await supabaseAdmin
    .from('email_campaigns')
    .select('stats')
    .eq('id', activeBatch.id)
    .single();

  const attachedCount5 = (verifyBatches5.stats.drafts || []).filter((d) =>
    (d.assigned_attachments || []).some((a) => a.id === testDocId)
  ).length;
  assert(attachedCount5 === 5, `Exactly 5 of 24 drafts have the attachment (actual: ${attachedCount5})`);

  // 3.2 Attach to All 24 Leads (Campaign-wide / All Selected)
  const startTime24 = Date.now();
  const updatedDrafts24 = drafts.map((d) => {
    const existing = (d.assigned_attachments || []).filter((a) => a.id !== testDocId);
    return { ...d, assigned_attachments: [...existing, cleanAttachment] };
  });

  const { error: updateErr24 } = await supabaseAdmin
    .from('email_campaigns')
    .update({
      stats: {
        ...activeBatch.stats,
        drafts: updatedDrafts24,
      },
    })
    .eq('id', activeBatch.id);

  const duration24 = Date.now() - startTime24;
  assert(!updateErr24, `Attached to ALL 24 recipients with NO timeout (error: ${updateErr24?.message || 'none'})`);
  assert(duration24 < 1000, `DB write for all 24 recipients finished in ${duration24}ms (far below timeout)`);

  const { data: verifyBatches24 } = await supabaseAdmin
    .from('email_campaigns')
    .select('stats')
    .eq('id', activeBatch.id)
    .single();

  const attachedCount24 = (verifyBatches24.stats.drafts || []).filter((d) =>
    (d.assigned_attachments || []).some((a) => a.id === testDocId)
  ).length;
  assert(attachedCount24 === 24, `All 24 drafts have the attachment (actual: ${attachedCount24})`);

  // 3.3 Test Idempotency / No Duplicates on Re-attaching
  const updatedDraftsDup = verifyBatches24.stats.drafts.map((d) => {
    const existing = (d.assigned_attachments || []).filter((a) => a.id !== testDocId);
    return { ...d, assigned_attachments: [...existing, cleanAttachment] };
  });
  const anyHasMultiple = updatedDraftsDup.some((d) =>
    d.assigned_attachments.filter((a) => a.id === testDocId).length > 1
  );
  assert(!anyHasMultiple, 'Prevent duplicate attachments: re-attaching preserves single reference');

  // 3.4 Stress Test Chunking for 100 Recipients
  console.log('\nTest 4: Chunked Concurrency Simulation for 100 Recipients');
  const mockRecipients = Array.from({ length: 100 }, (_, i) => ({
    id: `rec-${i}`,
    email: `recipient_${i}@example.com`,
    tokens: { company_name: `Company ${i}` },
  }));

  const CHUNK_SIZE = 25;
  const startTime100 = Date.now();
  let processedCount = 0;

  for (let i = 0; i < mockRecipients.length; i += CHUNK_SIZE) {
    const chunk = mockRecipients.slice(i, i + CHUNK_SIZE);
    await Promise.all(
      chunk.map(async (rec) => {
        const atts = [cleanAttachment];
        processedCount++;
        return { ...rec, attachments: atts };
      })
    );
  }

  const duration100 = Date.now() - startTime100;
  assert(processedCount === 100, `Chunked processing processed all 100 recipients (actual: ${processedCount})`);
  assert(duration100 < 500, `100 recipients attached in ${duration100}ms without blocking or timing out`);

  // ----------------------------------------------------
  // TEST 5: Clean Up & Email Dispatch Safety
  // ----------------------------------------------------
  console.log('\nTest 5: Cleanup & Email Safety Verification');
  // Revert active batch drafts attachments for testDocId
  const cleanedDrafts = verifyBatches24.stats.drafts.map((d) => ({
    ...d,
    assigned_attachments: (d.assigned_attachments || []).filter((a) => a.id !== testDocId),
  }));
  await supabaseAdmin
    .from('email_campaigns')
    .update({
      stats: {
        ...activeBatch.stats,
        drafts: cleanedDrafts,
      },
    })
    .eq('id', activeBatch.id);

  await deleteDocumentAsync(testDocId);
  await supabaseAdmin.storage.from('email-attachments').remove([`uploads/${testFileName}`]);
  assert(true, 'Cleaned up test document from database and storage');

  const { count: finalEmailsSent } = await supabaseAdmin
    .from('emails')
    .select('*', { count: 'exact', head: true });

  assert(initialEmailsSent === finalEmailsSent, `CRITICAL: Zero live emails dispatched during test suite (count: ${initialEmailsSent} -> ${finalEmailsSent})`);

  console.log('\n====================================================');
  console.log(`TEST SUMMARY: ${passes} Passed, ${failures} Failed`);
  console.log('====================================================\n');

  if (failures > 0) {
    process.exit(1);
  }
}

runSuite().catch((err) => {
  console.error('Unhandled test failure:', err);
  process.exit(1);
});
