import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/middleware/authGuard';
import {
  getConversation,
  deleteConversation,
  updateConversation,
} from '@/lib/services/claudeChatService';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  const auth = await requireAuth(request);
  if (!auth.authenticated) return auth.response || auth;

  try {
    const { id } = await params;
    const userId = auth.user?.id || auth.user?._id || null;
    const conv = await getConversation(id, userId);
    if (!conv) {
      return NextResponse.json({ success: false, error: 'Conversation not found' }, { status: 404 });
    }
    return NextResponse.json({
      success: true,
      data: {
        id: conv.id,
        conversationId: conv.id,
        title: conv.title,
        model: conv.model,
        created_at: conv.created_at,
        updated_at: conv.updated_at,
        messages: conv.messages || [],
      },
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  const auth = await requireAuth(request);
  if (!auth.authenticated) return auth.response || auth;

  try {
    const { id } = await params;
    const body = await request.json();
    const userId = auth.user?.id || auth.user?._id || null;

    if (body.title === undefined && body.model === undefined) {
      return NextResponse.json({ success: false, error: 'Title or model is required' }, { status: 400 });
    }
    const updated = await updateConversation(
      id,
      { title: body.title, model: body.model },
      userId
    );
    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const auth = await requireAuth(request);
  if (!auth.authenticated) return auth.response || auth;

  try {
    const { id } = await params;
    const userId = auth.user?.id || auth.user?._id || null;
    await deleteConversation(id, userId);
    return NextResponse.json({ success: true, message: 'Conversation deleted permanently' });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
