import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/middleware/authGuard';
import { supabaseAdmin } from '@/lib/supabase';
import { formatBodyHtml } from '@/lib/services/personalizedEmailExtractor';
import { toLightweightAttachment } from '@/lib/services/documentLibraryService';

export const dynamic = 'force-dynamic';

/**
 * GET /api/email/campaigns/[id]/recipients
 * Retrieves all recipients for a campaign with their personalization tokens
 */
export async function GET(request, { params }) {
  const auth = await requireAuth(request);
  if (auth instanceof Response) return auth;

  try {
    const { id: campaignId } = params;

    const { data: recipients, error } = await supabaseAdmin
      .from('email_recipients')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: true })
      .limit(1000);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      recipients: recipients || [],
      count: (recipients || []).length,
    });
  } catch (err) {
    console.error('[API /api/email/campaigns/[id]/recipients GET Error]:', err);
    return NextResponse.json(
      { success: false, message: err.message || 'Failed to fetch campaign recipients' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/email/campaigns/[id]/recipients
 * Updates recipient records, manages approval, updates content/attachments, or removes recipients
 */
export async function PATCH(request, { params }) {
  const auth = await requireAuth(request);
  if (auth instanceof Response) return auth;

  try {
    const { id: campaignId } = params;
    const body = await request.json();
    const { action } = body;
    const nowIso = new Date().toISOString();

    // 1. Update single recipient details (Subject, Body, Signature, Attachments, Approval)
    if (action === 'update_recipient') {
      const { recipientId, updates } = body;
      if (!recipientId) {
        return NextResponse.json({ success: false, message: 'Recipient ID required' }, { status: 400 });
      }

      const { data: existing, error: fetchErr } = await supabaseAdmin
        .from('email_recipients')
        .select('*')
        .eq('id', recipientId)
        .eq('campaign_id', campaignId)
        .single();

      if (fetchErr || !existing) {
        return NextResponse.json({ success: false, message: 'Recipient not found' }, { status: 404 });
      }

      const existingTokens = existing.tokens || {};
      const newTokens = { ...existingTokens };

      if (updates.customSubject !== undefined) newTokens.custom_subject = updates.customSubject;
      if (updates.customBodyPlain !== undefined) {
        newTokens.custom_body_plain = updates.customBodyPlain;
        newTokens.custom_body_html = updates.customBodyHtml || formatBodyHtml(updates.customBodyPlain);
      } else if (updates.customBodyHtml !== undefined) {
        newTokens.custom_body_html = updates.customBodyHtml;
      }

      if (updates.signatureHtml !== undefined) newTokens.signature_html = updates.signatureHtml;
      if (updates.attachments !== undefined) newTokens.attachments = updates.attachments;
      if (updates.cc !== undefined) newTokens.cc = updates.cc;
      if (updates.bcc !== undefined) newTokens.bcc = updates.bcc;

      if (updates.approvalStatus !== undefined) {
        newTokens.approval_status = updates.approvalStatus;
        newTokens.user_approved = updates.approvalStatus === 'approved';
        newTokens.user_approved_at = updates.approvalStatus === 'approved' ? nowIso : null;
      }

      const recipientUpdate = {
        tokens: newTokens,
        updated_at: nowIso,
      };

      if (updates.to) recipientUpdate.email = updates.to.trim().toLowerCase();

      const { data: updatedDoc, error: updateErr } = await supabaseAdmin
        .from('email_recipients')
        .update(recipientUpdate)
        .eq('id', recipientId)
        .select('*')
        .single();

      if (updateErr) throw updateErr;

      return NextResponse.json({
        success: true,
        message: 'Recipient updated successfully',
        recipient: updatedDoc,
      });
    }

    // 2. Remove single or multiple recipients from campaign
    else if (action === 'remove_recipient' || action === 'bulk_remove') {
      const recipientIds = action === 'remove_recipient' ? [body.recipientId] : (body.recipientIds || []);
      if (recipientIds.length === 0) {
        return NextResponse.json({ success: false, message: 'No recipients specified to remove' }, { status: 400 });
      }

      const { error: delErr } = await supabaseAdmin
        .from('email_recipients')
        .delete()
        .in('id', recipientIds)
        .eq('campaign_id', campaignId);

      if (delErr) throw delErr;

      // Update campaign stats
      const { count } = await supabaseAdmin
        .from('email_recipients')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', campaignId);

      const { data: camp } = await supabaseAdmin
        .from('email_campaigns')
        .select('stats')
        .eq('id', campaignId)
        .single();

      if (camp) {
        await supabaseAdmin
          .from('email_campaigns')
          .update({
            stats: {
              ...(camp.stats || {}),
              totalRecipients: count || 0,
              total: count || 0,
              eligible: count || 0,
              updated_at: nowIso,
            },
            updated_at: nowIso,
          })
          .eq('id', campaignId);
      }

      return NextResponse.json({
        success: true,
        message: `Removed ${recipientIds.length} recipient(s) from campaign.`,
        remainingCount: count || 0,
      });
    }

    // 3. Bulk Assign Signature to selected or all campaign recipients
    else if (action === 'bulk_signature') {
      const { recipientIds, signatureHtml, applyToAll = false } = body;
      
      let query = supabaseAdmin
        .from('email_recipients')
        .select('id, tokens')
        .eq('campaign_id', campaignId);

      if (!applyToAll && Array.isArray(recipientIds) && recipientIds.length > 0) {
        query = query.in('id', recipientIds);
      }

      const { data: targetRecipients, error: fetchErr } = await query;
      if (fetchErr) throw fetchErr;

      for (const rec of targetRecipients || []) {
        const tokens = rec.tokens || {};
        tokens.signature_html = signatureHtml || '';
        await supabaseAdmin
          .from('email_recipients')
          .update({ tokens, updated_at: nowIso })
          .eq('id', rec.id);
      }

      return NextResponse.json({
        success: true,
        message: `Signature updated for ${(targetRecipients || []).length} recipient(s).`,
      });
    }

    // 4. Bulk Assign Attachments to selected or all campaign recipients (Lightweight & Chunked)
    else if (action === 'bulk_attachments') {
      const { recipientIds, attachments = [], mode = 'append', applyToAll = false } = body;
      const sanitizedNew = (Array.isArray(attachments) ? attachments : [])
        .map(toLightweightAttachment)
        .filter(Boolean);

      let query = supabaseAdmin
        .from('email_recipients')
        .select('id, tokens')
        .eq('campaign_id', campaignId);

      if (!applyToAll && Array.isArray(recipientIds) && recipientIds.length > 0) {
        query = query.in('id', recipientIds);
      }

      const { data: targetRecipients, error: fetchErr } = await query;
      if (fetchErr) throw fetchErr;

      const recList = targetRecipients || [];
      const CHUNK_SIZE = 25;
      for (let i = 0; i < recList.length; i += CHUNK_SIZE) {
        const chunk = recList.slice(i, i + CHUNK_SIZE);
        await Promise.all(
          chunk.map((rec) => {
            const tokens = rec.tokens || {};
            let updatedAtts = sanitizedNew;
            if (mode === 'append' && Array.isArray(tokens.attachments)) {
              const existingLightweight = tokens.attachments.map(toLightweightAttachment).filter(Boolean);
              const existingNames = new Set(existingLightweight.map((a) => a.fileName || a.name || a.id));
              const toAdd = sanitizedNew.filter((a) => !existingNames.has(a.fileName || a.name || a.id));
              updatedAtts = [...existingLightweight, ...toAdd];
            }

            tokens.attachments = updatedAtts;
            return supabaseAdmin
              .from('email_recipients')
              .update({ tokens, updated_at: nowIso })
              .eq('id', rec.id);
          })
        );
      }

      return NextResponse.json({
        success: true,
        message: `Attachments updated for ${recList.length} recipient(s).`,
      });
    }

    // 5. Bulk Approve recipients
    else if (action === 'bulk_approve') {
      const { recipientIds, applyToAll = false } = body;

      let query = supabaseAdmin
        .from('email_recipients')
        .select('id, tokens')
        .eq('campaign_id', campaignId);

      if (!applyToAll && Array.isArray(recipientIds) && recipientIds.length > 0) {
        query = query.in('id', recipientIds);
      }

      const { data: targetRecipients, error: fetchErr } = await query;
      if (fetchErr) throw fetchErr;

      for (const rec of targetRecipients || []) {
        const tokens = rec.tokens || {};
        tokens.approval_status = 'approved';
        tokens.user_approved = true;
        tokens.user_approved_at = nowIso;
        await supabaseAdmin
          .from('email_recipients')
          .update({ tokens, updated_at: nowIso })
          .eq('id', rec.id);
      }

      return NextResponse.json({
        success: true,
        message: `Approved ${(targetRecipients || []).length} recipient(s).`,
      });
    }

    return NextResponse.json({ success: false, message: 'Invalid action specified' }, { status: 400 });
  } catch (err) {
    console.error('[API /api/email/campaigns/[id]/recipients PATCH Error]:', err);
    return NextResponse.json(
      { success: false, message: err.message || 'Failed to update campaign recipients' },
      { status: 500 }
    );
  }
}
