import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/middleware/authGuard';
import { listConversations, createConversation } from '@/lib/services/claudeChatService';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const auth = await requireAuth(request);
  if (!auth.authenticated) return auth.response || auth;

  try {
    const userId = auth.user?.id || auth.user?._id || null;
    const conversations = await listConversations(userId);
    return NextResponse.json({ success: true, data: conversations });
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
    const conversation = await createConversation({
      title: body.title || 'New Chat',
      model: body.model,
      userId,
    });
    return NextResponse.json({ success: true, data: conversation });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
