import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/middleware/authGuard';
import { getDraftById, deleteDraft, saveDraft } from '@/lib/services/draftService';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  const auth = await requireAuth(request);
  if (!auth.authenticated) return auth.response || auth;

  try {
    const { id } = await params;
    const draft = await getDraftById(id);
    if (!draft) {
      return NextResponse.json({ success: false, error: 'Draft not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: draft });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  const auth = await requireAuth(request);
  if (!auth.authenticated) return auth.response || auth;

  try {
    const { id } = await params;
    const body = await request.json();
    const userId = auth.user?.id || auth.user?._id || null;

    const draft = await saveDraft({
      id,
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

export async function DELETE(request, { params }) {
  const auth = await requireAuth(request);
  if (!auth.authenticated) return auth.response || auth;

  try {
    const { id } = await params;
    await deleteDraft(id);
    return NextResponse.json({ success: true, message: 'Draft deleted' });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
