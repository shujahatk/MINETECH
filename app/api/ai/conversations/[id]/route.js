import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/middleware/authGuard';
import {
  getConversationMessages,
  deleteConversation,
  renameConversation,
} from '@/lib/services/claudeChatService';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  const auth = await requireAuth(request);
  if (!auth.authenticated) return auth.response || auth;

  try {
    const { id } = await params;
    const messages = await getConversationMessages(id);
    return NextResponse.json({ success: true, data: { conversationId: id, messages } });
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
    if (!body.title) {
      return NextResponse.json({ success: false, error: 'Title is required' }, { status: 400 });
    }
    const updated = await renameConversation(id, body.title);
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
    await deleteConversation(id);
    return NextResponse.json({ success: true, message: 'Conversation deleted' });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
