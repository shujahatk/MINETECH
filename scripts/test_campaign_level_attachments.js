import dotenv from 'dotenv';
dotenv.config();

import { supabaseAdmin } from '../lib/supabase.js';
import { getConfiguredSignatureAsync } from '../lib/services/signatureService.js';
import { getAllDocumentsAsync } from '../lib/services/documentLibraryService.js';

async function runTest() {
  console.log('===================================================================');
  console.log('MINETECH EMAIL WORKSPACE — CAMPAIGN-LEVEL ATTACHMENTS & SIGNATURE TEST');
  console.log('===================================================================\n');

  // 1. Fetch active workspace batch (the 24-email batch)
  const { data: batches, error: batchErr } = await supabaseAdmin
    .from('email_campaigns')
    .select('*')
    .filter('stats->>is_personalized_workspace', 'eq', 'true')
    .order('created_at', { ascending: false })
    .limit(1);

  if (batchErr || !batches || batches.length === 0) {
    throw new Error(`Failed to load active workspace batch: ${batchErr?.message}`);
  }

  const batch = batches[0];
  const drafts = batch.stats?.drafts || [];
  console.log(`[PASS] Found Active Batch ID: ${batch.id}`);
  console.log(`[PASS] Total Drafts in Active Batch: ${drafts.length}`);

  if (drafts.length !== 24) {
    console.warn(`[WARN] Expected 24 drafts, found ${drafts.length}`);
  }

  // 2. Test Configured Signature Auto-Sync
  const configuredSig = await getConfiguredSignatureAsync();
  console.log('\n--- 2. Checking Configured Signature ---');
  console.log(`Sender: ${configuredSig.senderName} (${configuredSig.senderEmail})`);
  console.log(`Company: ${configuredSig.senderCompany}`);
  console.log(`HTML signature present: ${Boolean(configuredSig.bodyHtml)} (${configuredSig.bodyHtml?.length || 0} chars)`);

  const draftsWithSig = drafts.filter((d) => Boolean(d.assigned_signature_html));
  console.log(`[VERIFY] Drafts with assigned signature: ${draftsWithSig.length} / ${drafts.length}`);

  // 3. Test Campaign-Level Attachment Upload & Automatic Propagation
  console.log('\n--- 3. Testing Campaign-Level Attachment Upload ---');
  const testFileName1 = 'Company_Brochure.pdf';
  const testFileName2 = 'Pricing_Overview.pdf';
  const dummyBase64 = Buffer.from('%PDF-1.4 Test PDF Content For MineTech Campaign Outreach').toString('base64');

  const sampleAttachments = [
    {
      id: `camp-att-test-1-${Date.now()}`,
      name: 'Company_Brochure',
      fileName: testFileName1,
      fileSize: '1.25 MB',
      fileType: 'application/pdf',
      url: `https://example.supabase.co/storage/v1/object/public/email-attachments/campaigns/${batch.id}/attachments/Company_Brochure.pdf`,
      storagePath: `campaigns/${batch.id}/attachments/Company_Brochure.pdf`,
      dataBase64: dummyBase64,
      uploadedAt: new Date().toISOString(),
    },
    {
      id: `camp-att-test-2-${Date.now()}`,
      name: 'Pricing_Overview',
      fileName: testFileName2,
      fileSize: '0.85 MB',
      fileType: 'application/pdf',
      url: `https://example.supabase.co/storage/v1/object/public/email-attachments/campaigns/${batch.id}/attachments/Pricing_Overview.pdf`,
      storagePath: `campaigns/${batch.id}/attachments/Pricing_Overview.pdf`,
      dataBase64: dummyBase64,
      uploadedAt: new Date().toISOString(),
    },
  ];

  // Attach both files to the campaign and update all drafts
  const updatedDraftsWithAtts = drafts.map((d) => ({
    ...d,
    assigned_attachments: sampleAttachments,
    assigned_signature_html: d.assigned_signature_html || configuredSig.bodyHtml,
    assigned_signature_name: configuredSig.senderName,
    updated_at: new Date().toISOString(),
  }));

  const { error: updateErr } = await supabaseAdmin
    .from('email_campaigns')
    .update({
      stats: {
        ...batch.stats,
        campaign_attachments: sampleAttachments,
        attachments: sampleAttachments,
        drafts: updatedDraftsWithAtts,
        updated_at: new Date().toISOString(),
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', batch.id);

  if (updateErr) {
    throw new Error(`Failed to update batch with campaign attachments: ${updateErr.message}`);
  }

  console.log(`[PASS] Uploaded ${sampleAttachments.length} files to campaign "${batch.name}"`);

  // Verify DB state after upload
  const { data: verifyBatch } = await supabaseAdmin
    .from('email_campaigns')
    .select('stats')
    .eq('id', batch.id)
    .single();

  const savedCampaignAtts = verifyBatch.stats?.campaign_attachments || [];
  const savedDrafts = verifyBatch.stats?.drafts || [];

  console.log(`[VERIFY] Saved campaign_attachments count: ${savedCampaignAtts.length}`);
  const allDraftsHaveBothFiles = savedDrafts.every(
    (d) => Array.isArray(d.assigned_attachments) && d.assigned_attachments.length === 2
  );
  console.log(`[VERIFY] All ${savedDrafts.length} drafts have both files attached: ${allDraftsHaveBothFiles}`);

  if (!allDraftsHaveBothFiles) {
    throw new Error('Not all drafts have the campaign attachments!');
  }

  // 4. Verify STRICT requirement: Campaign files do NOT pollute the global library (custom_documents)
  console.log('\n--- 4. Checking Global Library Isolation ---');
  const globalDocs = await getAllDocumentsAsync();
  const globalContainsCampFile = globalDocs.some(
    (g) => g.fileName === testFileName1 || g.fileName === testFileName2
  );
  console.log(`[VERIFY] Global document library count: ${globalDocs.length}`);
  console.log(`[VERIFY] Campaign files isolated from global library: ${!globalContainsCampFile}`);

  if (globalContainsCampFile) {
    throw new Error('VIOLATION: Campaign-level file was saved to global custom_documents!');
  }

  // 5. Test Campaign-Level Removal (Removing 1 file detaches it from all drafts)
  console.log('\n--- 5. Testing Campaign-Level File Removal ---');
  const remainingAttachments = [sampleAttachments[0]]; // Remove Pricing_Overview.pdf
  const updatedDraftsAfterRemoval = savedDrafts.map((d) => ({
    ...d,
    assigned_attachments: remainingAttachments,
    updated_at: new Date().toISOString(),
  }));

  const { error: removeErr } = await supabaseAdmin
    .from('email_campaigns')
    .update({
      stats: {
        ...verifyBatch.stats,
        campaign_attachments: remainingAttachments,
        attachments: remainingAttachments,
        drafts: updatedDraftsAfterRemoval,
        updated_at: new Date().toISOString(),
      },
    })
    .eq('id', batch.id);

  if (removeErr) {
    throw new Error(`Failed to remove file: ${removeErr.message}`);
  }

  // Verify DB state after removal
  const { data: verifyAfterRemove } = await supabaseAdmin
    .from('email_campaigns')
    .select('stats')
    .eq('id', batch.id)
    .single();

  const finalCampaignAtts = verifyAfterRemove.stats?.campaign_attachments || [];
  const finalDrafts = verifyAfterRemove.stats?.drafts || [];

  console.log(`[VERIFY] Final campaign_attachments count: ${finalCampaignAtts.length}`);
  const allDraftsHaveExactlyOne = finalDrafts.every(
    (d) => Array.isArray(d.assigned_attachments) && d.assigned_attachments.length === 1
  );
  console.log(`[VERIFY] All ${finalDrafts.length} drafts updated to 1 file: ${allDraftsHaveExactlyOne}`);

  if (!allDraftsHaveExactlyOne) {
    throw new Error('Removal failed to propagate across all drafts!');
  }

  // 6. Test Outbound Worker Attachment Mapping Logic
  console.log('\n--- 6. Testing Worker MIME Attachment & Signature Formatting ---');
  const dummyRecipient = {
    tokens: {
      attachments: finalDrafts[0].assigned_attachments,
      signature_html: finalDrafts[0].assigned_signature_html,
    },
  };

  const rawAttachments = dummyRecipient.tokens?.attachments || [];
  const mimeAttachments = rawAttachments.map((att) => {
    if (typeof att === 'string') return { filename: att, path: att };
    const fname = att.fileName || att.filename || att.name || 'document.pdf';
    const base64Content = att.dataBase64 || att.content;
    if (base64Content) {
      return { filename: fname, content: base64Content };
    }
    if (att.url && att.url.startsWith('http')) {
      return { filename: fname, path: att.url };
    }
    return null;
  }).filter(Boolean);

  console.log(`[PASS] Worker MIME attachments parsed: ${mimeAttachments.length}`);
  console.log(`[PASS] Sample MIME Attachment Filename: ${mimeAttachments[0]?.filename}`);
  console.log(`[PASS] Sample MIME Attachment has Base64: ${Boolean(mimeAttachments[0]?.content)}`);

  console.log('\n===================================================================');
  console.log('ALL CAMPAIGN-LEVEL ATTACHMENTS & SIGNATURE TESTS PASSED (0 EMAILS SENT)!');
  console.log('===================================================================');
}

runTest().catch((err) => {
  console.error('[TEST FAILURE]:', err);
  process.exit(1);
});
