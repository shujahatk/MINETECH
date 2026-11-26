import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/middleware/authGuard';
import { requireAdmin } from '@/lib/auth/adminGuard';
import {
  getAllSignaturesAsync,
  getDefaultSignatureAsync,
  saveOrUpdateSignature,
  getConfiguredSignatureAsync,
  deleteSignatureAsync,
  duplicateSignatureAsync,
  setDefaultSignatureAsync,
} from '@/lib/services/signatureService';
import {
  getActiveGmailSignature,
  setManualSignatureHtml,
} from '@/lib/services/gmailSignatureService';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

function isUserAdmin(user) {
  const role = String(user?.role || '').toLowerCase().trim();
  return role === 'admin' || role === 'superadmin' || role === 'owner';
}

export async function GET(request) {
  const auth = await requireAuth(request);
  if (!auth.authenticated) return auth.response || auth;

  try {
    const signatures = await getAllSignaturesAsync();
    const defaultSig = await getDefaultSignatureAsync();
    const activeGmail = getActiveGmailSignature();
    const configuredSignature = await getConfiguredSignatureAsync();

    return NextResponse.json(
      {
        success: true,
        signatures,
        defaultSignature: defaultSig,
        activeGmailSignature: activeGmail,
        configuredSignature,
        canManageSignatures: isUserAdmin(auth.user),
      },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (err) {
    console.error('[API /api/email/workspace/signatures GET Error]:', err);
    return NextResponse.json(
      { success: false, message: 'Failed to load email signatures' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  const auth = await requireAdmin(request);
  if (auth instanceof Response || !auth?.user) return auth;

  try {
    const body = await request.json();

    if (body.action === 'manual_html') {
      const updated = setManualSignatureHtml(body.signatureHtml, body.senderEmail);
      const signatures = await getAllSignaturesAsync();
      const defaultSignature = await getDefaultSignatureAsync();
      return NextResponse.json({
        success: true,
        signature: updated,
        signatures,
        defaultSignature,
        message: 'Manual HTML signature updated and saved.',
      });
    }

    const savedSignature = await saveOrUpdateSignature(body);

    // If applyToAll is requested, also update all drafts in the active batch (never mutates sent emails)
    if (body.applyToAll) {
      const nowIso = new Date().toISOString();
      const { data: batches } = await supabaseAdmin
        .from('email_campaigns')
        .select('*')
        .filter('stats->>is_personalized_workspace', 'eq', 'true')
        .order('created_at', { ascending: false })
        .limit(1);

      if (batches && batches.length > 0 && batches[0].stats?.drafts) {
        const batch = batches[0];
        const updatedDrafts = (batch.stats.drafts || []).map((d) => ({
          ...d,
          assigned_signature_id: savedSignature.id,
          assigned_signature_html: savedSignature.bodyHtml,
          updated_at: nowIso,
        }));

        await supabaseAdmin
          .from('email_campaigns')
          .update({
            stats: { ...batch.stats, drafts: updatedDrafts, updated_at: nowIso },
            updated_at: nowIso,
          })
          .eq('id', batch.id);
      }
    }

    const signatures = await getAllSignaturesAsync();
    const defaultSignature = await getDefaultSignatureAsync();

    return NextResponse.json({
      success: true,
      signature: savedSignature,
      signatures,
      defaultSignature,
      configuredSignature: savedSignature,
      message: 'Signature configuration saved permanently.',
    });
  } catch (err) {
    console.error('[API /api/email/workspace/signatures POST Error]:', err);
    return NextResponse.json(
      { success: false, message: err.message || 'Failed to save signature' },
      { status: 500 }
    );
  }
}

export async function DELETE(request) {
  const auth = await requireAdmin(request);
  if (auth instanceof Response || !auth?.user) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, message: 'Signature ID is required' }, { status: 400 });
    }

    await deleteSignatureAsync(id);
    const signatures = await getAllSignaturesAsync();
    const defaultSignature = await getDefaultSignatureAsync();

    return NextResponse.json({
      success: true,
      message: 'Signature permanently deleted.',
      signatures,
      defaultSignature,
    });
  } catch (err) {
    console.error('[API /api/email/workspace/signatures DELETE Error]:', err);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function PATCH(request) {
  const auth = await requireAdmin(request);
  if (auth instanceof Response || !auth?.user) return auth;

  try {
    const body = await request.json();
    const { action, id } = body;

    if (action === 'set_default') {
      await setDefaultSignatureAsync(id);
    } else if (action === 'duplicate') {
      await duplicateSignatureAsync(id);
    } else {
      await saveOrUpdateSignature(body);
    }

    const signatures = await getAllSignaturesAsync();
    const defaultSignature = await getDefaultSignatureAsync();
    return NextResponse.json({
      success: true,
      signatures,
      defaultSignature,
      message: 'Signatures updated successfully.',
    });
  } catch (err) {
    console.error('[API /api/email/workspace/signatures PATCH Error]:', err);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
