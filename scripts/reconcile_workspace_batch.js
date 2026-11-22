import { supabaseAdmin } from '../lib/supabase.js';

const BATCH_ID = '32533fb2-df20-4aae-a4e5-dfa563d19b4f';

function hasLineWrapArtifacts(text = '') {
  if (!text) return false;
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 4) return false;

  let wrappedCount = 0;
  for (let i = 0; i < lines.length - 1; i++) {
    const cur = lines[i];
    const nxt = lines[i + 1];
    if (
      cur.length >= 25 &&
      !/[.:?!]$/.test(cur) &&
      !/^[-*•]/.test(cur) &&
      /^[a-z0-9]/i.test(nxt)
    ) {
      wrappedCount++;
    }
  }
  return wrappedCount >= 2;
}

function calculateMetrics(drafts = []) {
  const total = drafts.length;
  const unmatched = drafts.filter((d) => !d.matched_lead?.id || d.match_status === 'unmatched').length;
  const approved = drafts.filter(
    (d) => d.approval_status === 'approved' && Boolean(d.user_approved) && Boolean(d.matched_lead?.id)
  ).length;
  const needs_review = drafts.filter(
    (d) =>
      (!d.user_approved || d.approval_status !== 'approved') &&
      Boolean(d.matched_lead?.id) &&
      d.match_status !== 'unmatched'
  ).length;
  const matched = drafts.filter((d) => d.match_status === 'matched' && Boolean(d.matched_lead?.id)).length;
  const ready = drafts.filter(
    (d) =>
      d.approval_status === 'approved' &&
      Boolean(d.user_approved) &&
      Boolean(d.matched_lead?.id) &&
      d.match_status === 'matched' &&
      Array.isArray(d.selected_contacts) &&
      d.selected_contacts.length > 0 &&
      d.selected_contacts.some((c) => c.email && c.email.trim())
  ).length;

  let formattingIssuesCount = 0;
  const affectedDraftIds = [];
  drafts.forEach((d) => {
    const text = d.edited_body_plain || d.extracted_body_plain || '';
    if (hasLineWrapArtifacts(text)) {
      formattingIssuesCount++;
      affectedDraftIds.push(d.id);
    }
  });

  return {
    total,
    matched,
    unmatched,
    needs_review,
    approved,
    ready,
    formatting_issues: formattingIssuesCount,
    affected_draft_ids: affectedDraftIds,
  };
}

async function reconcile() {
  console.log('Reconciling active batch in Supabase...');

  const { data: batch, error } = await supabaseAdmin
    .from('email_campaigns')
    .select('*')
    .eq('id', BATCH_ID)
    .single();

  if (error || !batch) {
    throw new Error('Batch not found: ' + error?.message);
  }

  const rawDrafts = batch.stats?.drafts || [];
  console.log('Original draft count:', rawDrafts.length);

  const nowIso = new Date().toISOString();
  const normalizedDrafts = rawDrafts.map((d) => {
    const isApprovedAndLinked = d.approval_status === 'approved' && Boolean(d.user_approved) && Boolean(d.matched_lead?.id);
    return {
      ...d,
      match_status: isApprovedAndLinked ? 'matched' : d.match_status,
      content_modified_after_approval: false,
      updated_at: nowIso,
    };
  });

  const newMetrics = calculateMetrics(normalizedDrafts);
  console.log('Calculated Metrics:', newMetrics);

  const updatedStats = {
    ...batch.stats,
    drafts: normalizedDrafts,
    metrics: newMetrics,
    updated_at: nowIso,
  };

  const { error: updateErr } = await supabaseAdmin
    .from('email_campaigns')
    .update({
      stats: updatedStats,
      updated_at: nowIso,
    })
    .eq('id', BATCH_ID);

  if (updateErr) {
    throw new Error('Failed to update batch: ' + updateErr.message);
  }

  console.log('Successfully reconciled batch in Supabase!');

  // Verify from fresh DB query
  const { data: verified } = await supabaseAdmin
    .from('email_campaigns')
    .select('stats')
    .eq('id', BATCH_ID)
    .single();

  const finalDrafts = verified?.stats?.drafts || [];
  const finalMetrics = calculateMetrics(finalDrafts);
  console.log('\n--- VERIFIED STATE FROM SUPABASE ---');
  console.log('Final Metrics:', finalMetrics);

  const table = finalDrafts.map((d, i) => ({
    '#': i + 1,
    id: d.id,
    company: d.extracted_company,
    crm_lead: d.matched_lead?.company_name || 'NONE',
    lead_id: d.matched_lead?.id ? 'YES' : 'NO',
    contact_email: (d.selected_contacts || [])[0]?.email || 'NONE',
    match_status: d.match_status,
    approval_status: d.approval_status,
    user_approved: d.user_approved,
    ready: d.approval_status === 'approved' && d.user_approved && d.match_status === 'matched' && Boolean(d.matched_lead?.id) && (d.selected_contacts || []).some(c => c.email)
  }));
  console.table(table);

  return { metrics: finalMetrics, drafts: finalDrafts };
}

reconcile()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
