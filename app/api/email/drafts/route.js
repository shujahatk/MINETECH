import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/middleware/authGuard';
import { listDrafts, saveDraft } from '@/lib/services/draftService';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const auth = await requireAuth(request);
  if (!auth.authenticated) return auth.response || auth;

  try {
    const userId = auth.user?.id || auth.user?._id || null;
    const drafts = await listDrafts(userId);
    return NextResponse.json({ success: true, data: drafts });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  const auth = await requireAuth(request);
  if (!auth.authenticated) return auth.response || auth;

  try {
    const body = await request.json();
    const userId = auth.user?.id || auth.user?._id || null;

    const draft = await saveDraft({
      id: body.id,
      userId,
      leadId: body.leadId,
      to: body.recipient || body.to,
      toList: body.toList,
      cc: body.cc,
      bcc: body.bcc,
      subject: body.subject,
      bodyHtml: body.bodyHtml,
      bodyText: body.bodyText,
      attachments: body.attachments,
      scheduledAt: body.scheduledAt || body.scheduled_at,
    });

    return NextResponse.json({ success: true, data: draft });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
