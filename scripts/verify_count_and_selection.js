import { supabaseAdmin } from '../lib/supabase.js';
import { createCampaign } from '../lib/services/campaignService.js';
import { PRECONFIGURED_DOCUMENTS } from '../lib/services/documentLibraryService.js';

const BATCH_ID = '32533fb2-df20-4aae-a4e5-dfa563d19b4f';

async function verify() {
  console.log('================================================================');
  console.log('   VERIFYING EMAIL WORKSPACE COUNTS, SELECTION & CAMPAIGN');
  console.log('================================================================\n');

  // 1. Fetch active batch
  const { data: batch, error } = await supabaseAdmin
    .from('email_campaigns')
    .select('*')
    .eq('id', BATCH_ID)
    .single();

  if (error || !batch) {
    throw new Error('Batch not found: ' + error?.message);
  }

  const drafts = batch.stats?.drafts || [];
  console.log('Total drafts in database:', drafts.length);

  // 2. Metrics check
  const metrics = batch.stats?.metrics || {};
  console.log('Metrics from database:', metrics);

  const total = drafts.length;
  const approved = drafts.filter((d) => d.approval_status === 'approved' && Boolean(d.user_approved) && Boolean(d.matched_lead?.id)).length;
  const needsReview = drafts.filter((d) => (!d.user_approved || d.approval_status !== 'approved') && Boolean(d.matched_lead?.id) && d.match_status !== 'unmatched').length;
  const unmatched = drafts.filter((d) => !d.matched_lead?.id || d.match_status === 'unmatched').length;
  const matched = drafts.filter((d) => d.match_status === 'matched' && Boolean(d.matched_lead?.id)).length;
  const ready = drafts.filter((d) =>
    d.approval_status === 'approved' &&
    Boolean(d.user_approved) &&
    Boolean(d.matched_lead?.id) &&
    d.match_status === 'matched' &&
    Array.isArray(d.selected_contacts) &&
    d.selected_contacts.length > 0 &&
    d.selected_contacts.some((c) => c.email && c.email.trim())
  ).length;

  console.log('Calculated breakdown:');
  console.log(`- Total: ${total}`);
  console.log(`- Approved: ${approved}`);
  console.log(`- Ready to Send: ${ready}`);
  console.log(`- Needs Review: ${needsReview}`);
  console.log(`- Unmatched: ${unmatched}`);
  console.log(`- CRM Matched: ${matched}`);

  if (approved !== 24 || ready !== 24 || needsReview !== 0 || unmatched !== 0) {
    throw new Error(`Metrics mismatch! Expected 24 approved, 24 ready, 0 needs_review, 0 unmatched.`);
  }

  // 3. Selection check:
  // When user opens the workspace, readyIds will select all ready drafts
  const readyIds = drafts
    .filter((d) =>
      d.approval_status === 'approved' &&
      Boolean(d.user_approved) &&
      d.match_status === 'matched' &&
      Array.isArray(d.selected_contacts) &&
      d.selected_contacts.some((c) => c.email && c.email.trim())
    )
    .map((d) => d.id);

  console.log(`\nSelection verification:`);
  console.log(`- Selected count on page load: ${readyIds.length} of ${total}`);
  if (readyIds.length !== 24) {
    throw new Error(`Selection mismatch! Expected 24, got ${readyIds.length}`);
  }

  // 4. Test Campaign Creation with all 24 drafts
  console.log(`\nTesting Campaign Draft Creation with all 24 drafts...`);
  const brochureDoc = PRECONFIGURED_DOCUMENTS.find((d) => d.id === 'doc-brochure-minetech');

  const personalizedRecipients = drafts.map((d) => {
    const primary = (d.selected_contacts || [])[0] || {};
    return {
      leadId: d.matched_lead.id,
      companyName: d.extracted_company || d.matched_lead.company_name,
      contactName: primary.name || d.matched_lead.contact_name || 'Contact',
      contactEmail: primary.email.trim().toLowerCase(),
      to: primary.email.trim().toLowerCase(),
      customSubject: d.edited_subject || d.extracted_subject,
      customBodyHtml: d.edited_body_html || '<p>Outreach body</p>',
      customBodyPlain: d.edited_body_plain || 'Outreach body',
      attachments: [brochureDoc],
      signatureHtml: d.assigned_signature_html || '',
      draftId: d.id,
      approvalStatus: d.approval_status,
    };
  });

  const testCampaign = await createCampaign({
    name: `Verification Campaign All 24 — ${Date.now()}`,
    subject: `Personalized Outreach (24 companies)`,
    bodyHtml: '<p>Personalized B2B Outreach Batch</p>',
    bodyText: 'Personalized B2B Outreach Batch',
    campaignType: 'personalized_batch',
    status: 'DRAFT',
    personalizedRecipients,
  });

  console.log(`- Campaign created with ID: ${testCampaign.id}`);
  console.log(`- Campaign status: ${testCampaign.status}`);

  // Query staged recipients in Supabase
  const { data: staged, count } = await supabaseAdmin
    .from('email_recipients')
    .select('*', { count: 'exact' })
    .eq('campaign_id', testCampaign.id);

  console.log(`- Staged recipients in email_recipients table: ${staged.length}`);

  if (staged.length !== 24) {
    throw new Error(`Staged recipient count mismatch! Expected 24, got ${staged.length}`);
  }

  // Clean up test campaign safely
  await supabaseAdmin.from('email_recipients').delete().eq('campaign_id', testCampaign.id);
  await supabaseAdmin.from('email_campaigns').delete().eq('id', testCampaign.id);
  console.log(`- Test campaign cleaned up safely. Zero live emails sent.`);

  console.log('\n================================================================');
  console.log('   ALL VERIFICATION CHECKS PASSED SUCCESSFULLY (24/24)');
  console.log('================================================================');
}

verify()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
