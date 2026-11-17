import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/middleware/authGuard';
import { supabaseAdmin } from '@/lib/supabase';
import { resolveCompanyContacts } from '@/lib/services/personalizedCompanyMatcher';
import {
  unwrapPdfLineArtifacts,
  formatBodyHtml,
  normalizeEmailParagraphs,
  hasLineWrapArtifacts
} from '@/lib/services/personalizedEmailExtractor';

export const dynamic = 'force-dynamic';

/**
 * GET /api/email/workspace
 * 
 * Retrieves the current active email workspace batch or searches CRM leads for manual matching.
 */
export async function GET(request) {
  const auth = await requireAuth(request);
  if (auth instanceof Response) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const batchId = searchParams.get('batchId');

    // Action: Search CRM leads for manual rematching modal
    if (action === 'search_leads') {
      const q = (searchParams.get('q') || '').trim();
      if (!q || q.length < 2) {
        return NextResponse.json({ success: true, leads: [] });
      }

      const { data: leads, error } = await supabaseAdmin
        .from('leads')
        .select('id, company, full_name, email, phone, website, industry, location, status, custom_fields')
        .or(`company.ilike.%${q}%,full_name.ilike.%${q}%,email.ilike.%${q}%,website.ilike.%${q}%`)
        .order('company', { ascending: true })
        .limit(25);

      if (error) {
        throw error;
      }

      const formattedLeads = (leads || []).map((l) => ({
        ...l,
        company_name: l.company,
        contact_name: l.full_name,
        country: l.location,
      }));

      return NextResponse.json({
        success: true,
        leads: formattedLeads,
      });
    }

    // Default: Retrieve active workspace batch
    let query = supabaseAdmin
      .from('email_campaigns')
      .select('id, name, status, stats, created_at, updated_at');

    if (batchId) {
      query = query.eq('id', batchId);
    } else {
      query = query
        .filter('stats->>is_personalized_workspace', 'eq', 'true')
        .order('created_at', { ascending: false })
        .limit(1);
    }

    const { data: batches, error } = await query;

    if (error) {
      throw error;
    }

    const batchRecord = batches && batches.length > 0 ? batches[0] : null;

    if (!batchRecord || !batchRecord.stats?.drafts) {
      return NextResponse.json({
        success: true,
        batch: null,
        drafts: [],
        metrics: {
          total: 0,
          matched: 0,
          needs_review: 0,
          unmatched: 0,
          approved: 0,
          ready: 0,
        },
      });
    }

    let needsBatchSave = false;
    const rawDrafts = batchRecord.stats.drafts || [];
    const drafts = rawDrafts.map((d) => {
      let updated = { ...d };
      const currentText = updated.edited_body_plain || updated.extracted_body_plain || '';
      const hasArtifacts = hasLineWrapArtifacts(currentText);
      updated.has_formatting_issues = hasArtifacts;

      // Critical Rule: Matching does not mean approved. Normalize previous auto-approved drafts that were never reviewed by user.
      if (updated.approval_status === 'approved' && !updated.user_approved) {
        updated.approval_status = 'needs_review';
        updated.user_approved = false;
        needsBatchSave = true;
      }

      return updated;
    });

    if (needsBatchSave) {
      await supabaseAdmin
        .from('email_campaigns')
        .update({
          stats: {
            ...batchRecord.stats,
            drafts,
            updated_at: new Date().toISOString(),
          },
        })
        .eq('id', batchRecord.id);
    }

    const metrics = calculateMetrics(drafts);

    return NextResponse.json({
      success: true,
      batch: {
        id: batchRecord.id,
        name: batchRecord.name,
        status: batchRecord.status,
        createdAt: batchRecord.created_at,
        updatedAt: batchRecord.updated_at,
        extractionSummary: batchRecord.stats.extraction_summary || {},
        matchingSummary: batchRecord.stats.matching_summary || {},
      },
      drafts,
      metrics,
    });
  } catch (err) {
    console.error('[API /api/email/workspace GET Error]:', err);
    return NextResponse.json(
      { success: false, message: err.message || 'Failed to load email workspace' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/email/workspace
 * 
 * Updates a specific draft, performs bulk operations, or rematches companies.
 */
export async function PATCH(request) {
  const auth = await requireAuth(request);
  if (auth instanceof Response) return auth;

  try {
    const body = await request.json();
    const { batchId, action = 'update_draft', draftId, updates, draftIds, leadId, signatureId, signatureHtml, attachments } = body;

    let targetBatch = null;

    if (batchId) {
      const { data } = await supabaseAdmin
        .from('email_campaigns')
        .select('*')
        .eq('id', batchId)
        .single();
      targetBatch = data;
    } else {
      const { data } = await supabaseAdmin
        .from('email_campaigns')
        .select('*')
        .filter('stats->>is_personalized_workspace', 'eq', 'true')
        .order('created_at', { ascending: false })
        .limit(1);
      targetBatch = data && data.length > 0 ? data[0] : null;
    }

    if (!targetBatch || !targetBatch.stats?.drafts) {
      return NextResponse.json(
        { success: false, message: 'No active email workspace batch found.' },
        { status: 404 }
      );
    }

    let drafts = [...(targetBatch.stats.drafts || [])];
    const nowIso = new Date().toISOString();

    // 1. Single Draft Update
    if (action === 'update_draft') {
      const draftIndex = drafts.findIndex((d) => d.id === draftId);
      if (draftIndex === -1) {
        return NextResponse.json(
          { success: false, message: `Draft with ID ${draftId} not found.` },
          { status: 404 }
        );
      }

      const existingDraft = drafts[draftIndex];

      // CRITICAL REQUIREMENT:
      // If the user edits the email body, subject, signature, or attachments after approval,
      // the approval status must automatically reset to 'needs_review' requiring renewed approval.
      const isApproving = updates.approval_status === 'approved';
      const isUnapproving = updates.approval_status === 'needs_review';

      const contentChanged =
        (updates.edited_body_plain !== undefined && updates.edited_body_plain !== existingDraft.edited_body_plain) ||
        (updates.edited_subject !== undefined && updates.edited_subject !== existingDraft.edited_subject) ||
        (updates.assigned_signature_id !== undefined && updates.assigned_signature_id !== existingDraft.assigned_signature_id) ||
        (updates.assigned_attachments !== undefined && JSON.stringify(updates.assigned_attachments) !== JSON.stringify(existingDraft.assigned_attachments));

      let finalApproval = existingDraft.approval_status || 'needs_review';
      let userApproved = Boolean(existingDraft.user_approved);
      let contentModified = Boolean(existingDraft.content_modified_after_approval);

      if (isApproving) {
        finalApproval = 'approved';
        userApproved = true;
        contentModified = false;
      } else if (isUnapproving) {
        finalApproval = 'needs_review';
        userApproved = false;
        contentModified = false;
      } else if (contentChanged && existingDraft.approval_status === 'approved') {
        finalApproval = 'needs_review';
        userApproved = false;
        contentModified = true;
      }

      const mergedDraft = {
        ...existingDraft,
        ...updates,
        approval_status: finalApproval,
        user_approved: userApproved,
        user_approved_at: isApproving ? nowIso : (userApproved ? existingDraft.user_approved_at : null),
        content_modified_after_approval: contentModified,
        updated_at: nowIso,
      };

      drafts[draftIndex] = mergedDraft;

      // If user selected "Apply Signature to All Emails"
      if (updates.applySignatureToAll && updates.assigned_signature_id) {
        drafts = drafts.map((d) => ({
          ...d,
          assigned_signature_id: updates.assigned_signature_id,
          assigned_signature_html: updates.assigned_signature_html,
          updated_at: nowIso,
        }));
      }

      // If user selected "Apply Attachments to All Emails"
      if (updates.applyAttachmentsToAll && Array.isArray(updates.assigned_attachments)) {
        drafts = drafts.map((d) => ({
          ...d,
          assigned_attachments: updates.assigned_attachments,
          updated_at: nowIso,
        }));
      }
    }

    // 2. Rematch Lead (Manual Override / Assignment)
    else if (action === 'rematch_lead') {
      const draftIndex = drafts.findIndex((d) => d.id === draftId);
      if (draftIndex === -1) {
        return NextResponse.json(
          { success: false, message: `Draft with ID ${draftId} not found.` },
          { status: 404 }
        );
      }

      if (!leadId) {
        return NextResponse.json(
          { success: false, message: 'Please select a valid CRM lead to match.' },
          { status: 400 }
        );
      }

      // Fetch lead and siblings
      const { data: matchedLead, error: leadErr } = await supabaseAdmin
        .from('leads')
        .select('*')
        .eq('id', leadId)
        .single();

      if (leadErr || !matchedLead) {
        return NextResponse.json(
          { success: false, message: 'Selected lead not found in CRM.' },
          { status: 404 }
        );
      }

      // Fetch all sibling leads with same company name or domain for complete contact discovery
      const leadComp = matchedLead.company || matchedLead.company_name || '';
      const { data: siblingLeads } = await supabaseAdmin
        .from('leads')
        .select('*')
        .or(`company.ilike.%${leadComp}%,website.ilike.%${matchedLead.website || 'xyz-none'}%`)
        .limit(20);

      const resolvedContacts = resolveCompanyContacts(
        matchedLead,
        siblingLeads || [matchedLead],
        drafts[draftIndex].extracted_contact || '',
        ''
      );

      const targetDraft = drafts[draftIndex];
      drafts[draftIndex] = {
        ...targetDraft,
        matched_lead: {
          id: matchedLead.id,
          company: leadComp,
          company_name: leadComp,
          full_name: matchedLead.full_name || matchedLead.contact_name,
          contact_name: matchedLead.full_name || matchedLead.contact_name,
          email: matchedLead.email,
          phone: matchedLead.phone,
          website: matchedLead.website,
          industry: matchedLead.industry,
          country: matchedLead.location || matchedLead.country,
          location: matchedLead.location || matchedLead.country,
          status: matchedLead.status,
        },
        all_company_contacts: resolvedContacts,
        company_contacts: resolvedContacts,
        selected_contacts: resolvedContacts.length > 0 ? [resolvedContacts[0]] : [],
        match_status: 'matched',
        confidence_score: 100,
        match_score: 100,
        match_reason: 'Manually verified and linked to CRM record by user',
        approval_status: targetDraft.user_approved ? 'approved' : 'needs_review',
        user_approved: Boolean(targetDraft.user_approved),
        updated_at: nowIso,
      };
    }

    // 3. Bulk Approve
    else if (action === 'bulk_approve') {
      const targetIds = draftIds && draftIds.length > 0 ? new Set(draftIds) : null;
      drafts = drafts.map((d) => {
        if (!targetIds || targetIds.has(d.id)) {
          return {
            ...d,
            approval_status: 'approved',
            user_approved: true,
            user_approved_at: nowIso,
            content_modified_after_approval: false,
            updated_at: nowIso,
          };
        }
        return d;
      });
    }

    // 4. Bulk Assign Signature (to selected or all emails)
    else if (action === 'bulk_signature') {
      const applyToAll = body.applyToAll || !draftIds || draftIds.length === 0 || draftIds === 'all';
      const targetIds = applyToAll ? null : new Set(draftIds);

      drafts = drafts.map((d) => {
        if (!targetIds || targetIds.has(d.id)) {
          return {
            ...d,
            assigned_signature_id: signatureId,
            assigned_signature_html: signatureHtml,
            updated_at: nowIso,
          };
        }
        return d;
      });
    }

    // 5. Bulk Assign Attachments (to selected or all emails)
    else if (action === 'bulk_attachments') {
      const applyToAll = body.applyToAll || !draftIds || draftIds.length === 0 || draftIds === 'all';
      const targetIds = applyToAll ? null : new Set(draftIds);
      const mode = body.mode || 'replace'; // 'replace' | 'append'
      const newAttachments = Array.isArray(attachments) ? attachments : [];

      drafts = drafts.map((d) => {
        if (!targetIds || targetIds.has(d.id)) {
          let updatedAtts = newAttachments;
          if (mode === 'append' && Array.isArray(d.assigned_attachments)) {
            const existingNames = new Set(d.assigned_attachments.map((a) => a.fileName || a.name || a.id));
            const toAdd = newAttachments.filter((a) => !existingNames.has(a.fileName || a.name || a.id));
            updatedAtts = [...d.assigned_attachments, ...toAdd];
          }

          return {
            ...d,
            assigned_attachments: updatedAtts,
            updated_at: nowIso,
          };
        }
        return d;
      });
    }

    // 6. Preview Formatting Fix (Non-destructive Before/After comparison)
    else if (action === 'preview_formatting_fix') {
      const targetDraft = drafts.find((d) => d.id === draftId);
      if (!targetDraft) {
        return NextResponse.json(
          { success: false, message: `Draft with ID ${draftId} not found.` },
          { status: 404 }
        );
      }

      const currentPlain = targetDraft.edited_body_plain || targetDraft.extracted_body_plain || '';
      const fixedPlain = normalizeEmailParagraphs(currentPlain);
      const changed = fixedPlain !== currentPlain.trim();
      const origWords = currentPlain.trim().split(/\s+/).filter(Boolean);
      const fixedWords = fixedPlain.trim().split(/\s+/).filter(Boolean);

      return NextResponse.json({
        success: true,
        draftId,
        companyName: targetDraft.company_name || targetDraft.extracted_company || '',
        contactName: targetDraft.contact_name || targetDraft.extracted_contact || '',
        before_plain: currentPlain,
        after_plain: fixedPlain,
        before_html: targetDraft.edited_body_html || formatBodyHtml(currentPlain),
        after_html: formatBodyHtml(fixedPlain),
        changed,
        origWordCount: origWords.length,
        fixedWordCount: fixedWords.length,
        wordCountMatch: origWords.length === fixedWords.length,
        isManuallyEdited: Boolean(targetDraft.manually_edited),
        approvalStatus: targetDraft.approval_status || 'needs_review',
        userApproved: Boolean(targetDraft.user_approved),
      });
    }

    // 7. Apply Formatting Fix (Reconstruct paragraphs verbatim, invalidating approval if content changes)
    else if (action === 'apply_formatting_fix') {
      const targetIds = draftIds && draftIds !== 'all' && Array.isArray(draftIds) && draftIds.length > 0
        ? new Set(draftIds)
        : null;
      const includeManuallyEdited = Boolean(body.includeManuallyEdited);

      let updatedCount = 0;
      let skippedCount = 0;

      drafts = drafts.map((d) => {
        if (targetIds && !targetIds.has(d.id)) {
          return d;
        }

        if (d.manually_edited && !includeManuallyEdited) {
          skippedCount++;
          return d;
        }

        const currentPlain = d.edited_body_plain || d.extracted_body_plain || '';
        const fixedPlain = normalizeEmailParagraphs(currentPlain);

        if (fixedPlain !== currentPlain.trim()) {
          updatedCount++;
          const fixedHtml = formatBodyHtml(fixedPlain);
          const wasApproved = d.approval_status === 'approved' || Boolean(d.user_approved);

          return {
            ...d,
            edited_body_plain: fixedPlain,
            edited_body_html: fixedHtml,
            has_formatting_issues: false,
            formatting_fixed: true,
            formatting_fixed_at: nowIso,
            approval_status: wasApproved ? 'needs_review' : (d.approval_status || 'needs_review'),
            user_approved: wasApproved ? false : Boolean(d.user_approved),
            content_modified_after_approval: wasApproved ? true : Boolean(d.content_modified_after_approval),
            updated_at: nowIso,
          };
        }

        return {
          ...d,
          has_formatting_issues: false,
        };
      });
    }

    // Save updated batch stats back to Supabase
    const updatedStats = {
      ...targetBatch.stats,
      drafts,
      updated_at: nowIso,
    };

    const { error: updateErr } = await supabaseAdmin
      .from('email_campaigns')
      .update({
        stats: updatedStats,
        updated_at: nowIso,
      })
      .eq('id', targetBatch.id);

    if (updateErr) {
      throw updateErr;
    }

    const metrics = calculateMetrics(drafts);

    return NextResponse.json({
      success: true,
      message: 'Workspace updated successfully',
      drafts,
      metrics,
    });
  } catch (err) {
    console.error('[API /api/email/workspace PATCH Error]:', err);
    return NextResponse.json(
      { success: false, message: err.message || 'Failed to update email workspace' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/email/workspace
 * 
 * Clears or deletes the active workspace batch.
 */
export async function DELETE(request) {
  const auth = await requireAuth(request);
  if (auth instanceof Response) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const batchId = searchParams.get('batchId');

    let deleteQuery = supabaseAdmin
      .from('email_campaigns')
      .delete();

    if (batchId) {
      deleteQuery = deleteQuery.eq('id', batchId);
    } else {
      deleteQuery = deleteQuery.filter('stats->>is_personalized_workspace', 'eq', 'true');
    }

    const { error } = await deleteQuery;
    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: 'Email workspace cleared successfully.',
    });
  } catch (err) {
    console.error('[API /api/email/workspace DELETE Error]:', err);
    return NextResponse.json(
      { success: false, message: err.message || 'Failed to clear workspace' },
      { status: 500 }
    );
  }
}

function calculateMetrics(drafts = []) {
  const total = drafts.length;
  const matched = drafts.filter((d) => d.match_status === 'matched').length;
  const unmatched = drafts.filter((d) => d.match_status === 'unmatched').length;
  const approved = drafts.filter((d) => d.approval_status === 'approved' && Boolean(d.user_approved)).length;
  const needs_review = drafts.filter(
    (d) => d.match_status !== 'matched' || d.approval_status !== 'approved' || !d.user_approved
  ).length;
  const ready = drafts.filter(
    (d) =>
      d.approval_status === 'approved' &&
      Boolean(d.user_approved) &&
      d.match_status === 'matched' &&
      Array.isArray(d.selected_contacts) &&
      d.selected_contacts.length > 0 &&
      d.selected_contacts.some((c) => c.email)
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
    needs_review,
    unmatched,
    approved,
    ready,
    formattingIssuesCount,
    affectedDraftIds,
  };
}
