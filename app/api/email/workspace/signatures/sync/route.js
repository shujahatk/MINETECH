import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/middleware/authGuard';
import { syncGmailSignature, getActiveGmailSignature } from '@/lib/services/gmailSignatureService';
import { getAllSignatures } from '@/lib/services/signatureService';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const auth = await requireAuth(request);
  if (auth instanceof Response) return auth;

  try {
    const body = await request.json().catch(() => ({}));
    const targetEmail = body.targetEmail || body.email || null;

    const syncResult = await syncGmailSignature({ targetEmail });
    const allSignatures = getAllSignatures();

    return NextResponse.json({
      success: syncResult.success,
      reason: syncResult.reason || null,
      requiredScope: syncResult.requiredScope || null,
      message: syncResult.message || (syncResult.success ? 'Gmail signature synced successfully.' : 'Sync completed with notice.'),
      notice: syncResult.notice || null,
      signatureHtml: syncResult.signatureHtml,
      sendAsEmail: syncResult.sendAsEmail,
      displayName: syncResult.displayName,
      lastSyncedAt: syncResult.lastSyncedAt,
      source: syncResult.source,
      signatures: allSignatures,
    });
  } catch (err) {
    console.error('[API /api/email/workspace/signatures/sync Error]:', err);
    return NextResponse.json(
      {
        success: false,
        message: err.message || 'Failed to sync Gmail signature',
        activeSignature: getActiveGmailSignature(),
      },
      { status: 500 }
    );
  }
}
