import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/middleware/authGuard';
import { supabaseAdmin } from '@/lib/supabase';
import { validateAndSanitizeFile } from '@/lib/services/documentLibraryService';

export const dynamic = 'force-dynamic';

/**
 * GET /api/email/workspace/campaign-attachments
 * Retrieves campaign-level attachments for a workspace batch or campaign.
 */
export async function GET(request) {
  const auth = await requireAuth(request);
  if (auth instanceof Response) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const batchId = searchParams.get('batchId') || searchParams.get('campaignId');

    let query = supabaseAdmin
      .from('email_campaigns')
      .select('id, name, stats');

    if (batchId) {
      query = query.eq('id', batchId);
    } else {
      query = query
        .filter('stats->>is_personalized_workspace', 'eq', 'true')
        .order('created_at', { ascending: false })
        .limit(1);
    }

    const { data: rows, error } = await query;
    if (error) throw error;

    const record = rows && rows.length > 0 ? rows[0] : null;
    let attachments = Array.isArray(record?.stats?.campaign_attachments)
      ? record.stats.campaign_attachments
      : [];

    // Fallback: If campaign_attachments is empty, aggregate unique attachments from active drafts
    if (attachments.length === 0 && Array.isArray(record?.stats?.drafts)) {
      const seen = new Set();
      const derived = [];
      for (const d of record.stats.drafts) {
        for (const a of d.assigned_attachments || []) {
          const k = a.id || a.fileName || a.name;
          if (k && !seen.has(k)) {
            seen.add(k);
            derived.push(a);
          }
        }
      }
      if (derived.length > 0) {
        attachments = derived;
      }
    }

    return NextResponse.json({
      success: true,
      campaignId: record?.id || null,
      attachments,
      count: attachments.length,
    });
  } catch (err) {
    console.error('[API /campaign-attachments GET Error]:', err);
    return NextResponse.json(
      { success: false, message: err.message || 'Failed to fetch campaign attachments' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/email/workspace/campaign-attachments
 * Uploads a file scoped STRICTLY to this campaign.
 * Automatically attaches the file to EVERY email draft in the campaign.
 * NEVER adds the file to the global document library!
 */
export async function POST(request) {
  const auth = await requireAuth(request);
  if (auth instanceof Response) return auth;

  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const batchId = formData.get('batchId') || formData.get('campaignId');

    if (!file || typeof file === 'string') {
      return NextResponse.json(
        { success: false, message: 'Please select a file to upload.' },
        { status: 400 }
      );
    }

    // Server-side validation: extension and 25 MB limit
    const { safeFileName } = validateAndSanitizeFile(file.name, file.type, file.size);

    // 1. Fetch the target workspace batch or campaign
    let query = supabaseAdmin
      .from('email_campaigns')
      .select('id, name, stats');

    if (batchId) {
      query = query.eq('id', batchId);
    } else {
      query = query
        .filter('stats->>is_personalized_workspace', 'eq', 'true')
        .order('created_at', { ascending: false })
        .limit(1);
    }

    const { data: rows, error: fetchErr } = await query;
    if (fetchErr) throw fetchErr;

    const targetRecord = rows && rows.length > 0 ? rows[0] : null;
    if (!targetRecord) {
      return NextResponse.json(
        { success: false, message: 'No active workspace batch or campaign found.' },
        { status: 404 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const base64Data = buffer.toString('base64');
    const fileSizeMb = (buffer.length / (1024 * 1024)).toFixed(2) + ' MB';

    // 2. Store in Supabase Storage with campaign-scoped path
    const storagePath = `campaigns/${targetRecord.id}/attachments/${Date.now()}_${safeFileName}`;
    let storageUrl = '';
    try {
      const { data: uploadData, error: uploadErr } = await supabaseAdmin.storage
        .from('email-attachments')
        .upload(storagePath, buffer, {
          contentType: file.type || 'application/pdf',
          upsert: true,
        });

      if (!uploadErr && uploadData) {
        const { data: pubData } = supabaseAdmin.storage
          .from('email-attachments')
          .getPublicUrl(storagePath);
        storageUrl = pubData?.publicUrl || '';
      }
    } catch (storageEx) {
      console.warn('[campaign-attachments POST] Storage warning:', storageEx.message);
    }

    const newAttachment = {
      id: `camp-att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: safeFileName.replace(/\.[^/.]+$/, ''),
      fileName: safeFileName,
      fileSize: fileSizeMb,
      fileType: file.type || 'application/pdf',
      url: storageUrl,
      storagePath,
      dataBase64: base64Data,
      uploadedAt: new Date().toISOString(),
    };

    // 3. Update campaign attachments on the batch/campaign record
    const currentAttachments = Array.isArray(targetRecord.stats?.campaign_attachments)
      ? targetRecord.stats.campaign_attachments
      : [];

    // Deduplicate by filename
    const filteredExisting = currentAttachments.filter(
      (a) => a.fileName !== newAttachment.fileName && a.name !== newAttachment.name
    );
    const updatedCampaignAttachments = [...filteredExisting, newAttachment];

    // 4. AUTOMATICALLY ATTACH TO EVERY EMAIL IN THE CAMPAIGN
    const nowIso = new Date().toISOString();
    let updatedDrafts = [];
    if (Array.isArray(targetRecord.stats?.drafts)) {
      updatedDrafts = targetRecord.stats.drafts.map((draft) => {
        return {
          ...draft,
          assigned_attachments: updatedCampaignAttachments,
          updated_at: nowIso,
        };
      });
    }

    // Save updated batch stats in Supabase
    const { error: saveErr } = await supabaseAdmin
      .from('email_campaigns')
      .update({
        stats: {
          ...targetRecord.stats,
          campaign_attachments: updatedCampaignAttachments,
          attachments: updatedCampaignAttachments,
          drafts: updatedDrafts.length > 0 ? updatedDrafts : targetRecord.stats.drafts,
          updated_at: nowIso,
        },
        updated_at: nowIso,
      })
      .eq('id', targetRecord.id);

    if (saveErr) throw saveErr;

    // 5. If editing an existing campaign draft with recipients, update email_recipients tokens
    try {
      const { data: recs } = await supabaseAdmin
        .from('email_recipients')
        .select('id, tokens')
        .eq('campaign_id', targetRecord.id);

      if (recs && recs.length > 0) {
        for (const rec of recs) {
          const tokens = rec.tokens || {};
          tokens.attachments = updatedCampaignAttachments;
          await supabaseAdmin
            .from('email_recipients')
            .update({ tokens, updated_at: nowIso })
            .eq('id', rec.id);
        }
      }
    } catch (recErr) {
      console.warn('[campaign-attachments POST] Recipient sync warning:', recErr.message);
    }

    return NextResponse.json({
      success: true,
      message: `"${safeFileName}" added and automatically attached to all ${updatedDrafts.length || 'campaign'} emails!`,
      attachment: newAttachment,
      attachments: updatedCampaignAttachments,
      totalAttachedEmails: updatedDrafts.length,
      drafts: updatedDrafts,
    });
  } catch (err) {
    console.error('[API /campaign-attachments POST Error]:', err);
    return NextResponse.json(
      { success: false, message: err.message || 'Failed to upload campaign attachment' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/email/workspace/campaign-attachments
 * Removes a file from the campaign.
 * Automatically detaches the file from EVERY email draft in that campaign.
 * Cleans up campaign-scoped storage object.
 */
export async function DELETE(request) {
  const auth = await requireAuth(request);
  if (auth instanceof Response) return auth;

  try {
    const url = new URL(request.url);
    let attachmentId = url.searchParams.get('id');
    let batchId = url.searchParams.get('batchId') || url.searchParams.get('campaignId');

    if (!attachmentId) {
      const body = await request.json().catch(() => ({}));
      attachmentId = body.id;
      if (!batchId) batchId = body.batchId || body.campaignId;
    }

    if (!attachmentId) {
      return NextResponse.json(
        { success: false, message: 'Attachment ID is required for removal.' },
        { status: 400 }
      );
    }

    // 1. Fetch the target workspace batch or campaign
    let query = supabaseAdmin
      .from('email_campaigns')
      .select('id, name, stats');

    if (batchId) {
      query = query.eq('id', batchId);
    } else {
      query = query
        .filter('stats->>is_personalized_workspace', 'eq', 'true')
        .order('created_at', { ascending: false })
        .limit(1);
    }

    const { data: rows, error: fetchErr } = await query;
    if (fetchErr) throw fetchErr;

    const targetRecord = rows && rows.length > 0 ? rows[0] : null;
    if (!targetRecord) {
      return NextResponse.json(
        { success: false, message: 'No active workspace batch or campaign found.' },
        { status: 404 }
      );
    }

    const currentAttachments = Array.isArray(targetRecord.stats?.campaign_attachments)
      ? targetRecord.stats.campaign_attachments
      : [];

    const isRemoveAll = attachmentId === 'all' || attachmentId === 'clear';

    // Remove from storage if specific file path exists
    if (!isRemoveAll) {
      const fileToDelete = currentAttachments.find(
        (a) => a.id === attachmentId || a.fileName === attachmentId || a.name === attachmentId
      );
      if (fileToDelete?.storagePath) {
        try {
          await supabaseAdmin.storage
            .from('email-attachments')
            .remove([fileToDelete.storagePath]);
        } catch (stgErr) {
          console.warn('[campaign-attachments DELETE] Storage remove warning:', stgErr.message);
        }
      }
    }

    const remainingAttachments = isRemoveAll
      ? []
      : currentAttachments.filter(
          (a) => a.id !== attachmentId && a.fileName !== attachmentId && a.name !== attachmentId
        );

    // 2. AUTOMATICALLY REMOVE FROM EVERY EMAIL DRAFT
    const nowIso = new Date().toISOString();
    let updatedDrafts = [];
    if (Array.isArray(targetRecord.stats?.drafts)) {
      updatedDrafts = targetRecord.stats.drafts.map((draft) => {
        const remainingDraftAtts = isRemoveAll
          ? []
          : (draft.assigned_attachments || []).filter(
              (a) => a.id !== attachmentId && a.fileName !== attachmentId && a.name !== attachmentId
            );
        return {
          ...draft,
          assigned_attachments: remainingDraftAtts,
          updated_at: nowIso,
        };
      });
    }

    // 3. Save updated batch stats in Supabase
    const { error: saveErr } = await supabaseAdmin
      .from('email_campaigns')
      .update({
        stats: {
          ...targetRecord.stats,
          campaign_attachments: remainingAttachments,
          attachments: remainingAttachments,
          drafts: updatedDrafts.length > 0 ? updatedDrafts : targetRecord.stats.drafts,
          updated_at: nowIso,
        },
        updated_at: nowIso,
      })
      .eq('id', targetRecord.id);

    if (saveErr) throw saveErr;

    // 4. If editing campaign with recipients, update email_recipients tokens
    try {
      const { data: recs } = await supabaseAdmin
        .from('email_recipients')
        .select('id, tokens')
        .eq('campaign_id', targetRecord.id);

      if (recs && recs.length > 0) {
        for (const rec of recs) {
          const tokens = rec.tokens || {};
          tokens.attachments = remainingAttachments;
          await supabaseAdmin
            .from('email_recipients')
            .update({ tokens, updated_at: nowIso })
            .eq('id', rec.id);
        }
      }
    } catch (recErr) {
      console.warn('[campaign-attachments DELETE] Recipient sync warning:', recErr.message);
    }

    return NextResponse.json({
      success: true,
      message: `File removed from campaign and detached from all emails.`,
      deletedId: attachmentId,
      attachments: remainingAttachments,
      drafts: updatedDrafts,
    });
  } catch (err) {
    console.error('[API /campaign-attachments DELETE Error]:', err);
    return NextResponse.json(
      { success: false, message: err.message || 'Failed to delete campaign attachment' },
      { status: 500 }
    );
  }
}
