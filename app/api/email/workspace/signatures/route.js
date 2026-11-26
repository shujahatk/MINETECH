import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/middleware/authGuard';
import {
  getAllSignaturesAsync,
  getDefaultSignature,
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

export async function GET(request) {
  const auth = await requireAuth(request);
  if (auth instanceof Response) return auth;

  try {
    const signatures = await getAllSignaturesAsync();
    const defaultSig = getDefaultSignature();
    const activeGmail = getActiveGmailSignature();
    const configuredSignature = await getConfiguredSignatureAsync();

    return NextResponse.json({
      success: true,
      signatures,
      defaultSignature: defaultSig,
      activeGmailSignature: activeGmail,
      configuredSignature,
    });
  } catch (err) {
    console.error('[API /api/email/workspace/signatures GET Error]:', err);
    return NextResponse.json(
      { success: false, message: 'Failed to load email signatures' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  const auth = await requireAuth(request);
  if (auth instanceof Response) return auth;

  try {
    const body = await request.json();

    if (body.action === 'manual_html') {
      const updated = setManualSignatureHtml(body.signatureHtml, body.senderEmail);
      const signatures = await getAllSignaturesAsync();
      return NextResponse.json({
        success: true,
        signature: updated,
        signatures,
        message: 'Manual Gmail HTML signature updated and saved.',
      });
    }

    // Save or update existing signature record in Supabase (preventing duplicates)
    const savedSignature = await saveOrUpdateSignature(body);

    // If applyToAll is requested, also update all drafts in the active batch
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

    return NextResponse.json({
      success: true,
      signature: savedSignature,
      signatures,
      configuredSignature: savedSignature,
      message: 'Signature configuration saved successfully.',
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
  const auth = await requireAuth(request);
  if (auth instanceof Response) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, message: 'Signature ID is required' }, { status: 400 });
    }

    await deleteSignatureAsync(id);
    const signatures = await getAllSignaturesAsync();

    return NextResponse.json({
      success: true,
      message: 'Signature permanently deleted.',
      signatures,
    });
  } catch (err) {
    console.error('[API /api/email/workspace/signatures DELETE Error]:', err);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function PATCH(request) {
  const auth = await requireAuth(request);
  if (auth instanceof Response) return auth;

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
    return NextResponse.json({
      success: true,
      signatures,
      message: 'Signatures updated successfully.',
    });
  } catch (err) {
    console.error('[API /api/email/workspace/signatures PATCH Error]:', err);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
