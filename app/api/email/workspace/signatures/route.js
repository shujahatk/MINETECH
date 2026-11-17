import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/middleware/authGuard';
import { getAllSignatures, getDefaultSignature, addCustomSignature } from '@/lib/services/signatureService';
import { getActiveGmailSignature, setManualSignatureHtml } from '@/lib/services/gmailSignatureService';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const auth = await requireAuth(request);
  if (auth instanceof Response) return auth;

  try {
    const signatures = getAllSignatures();
    const defaultSig = getDefaultSignature();
    const activeGmail = getActiveGmailSignature();

    return NextResponse.json({
      success: true,
      signatures,
      defaultSignature: defaultSig,
      activeGmailSignature: activeGmail,
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
      return NextResponse.json({
        success: true,
        signature: updated,
        signatures: getAllSignatures(),
        message: 'Manual Gmail HTML signature updated.',
      });
    }

    const savedSignature = addCustomSignature(body);
    return NextResponse.json({
      success: true,
      signature: savedSignature,
      signatures: getAllSignatures(),
      message: 'Signature created successfully.',
    });
  } catch (err) {
    console.error('[API /api/email/workspace/signatures POST Error]:', err);
    return NextResponse.json(
      { success: false, message: err.message || 'Failed to save signature' },
      { status: 500 }
    );
  }
}
