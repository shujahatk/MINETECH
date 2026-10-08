import { NextResponse } from 'next/server';
import { ConversationIntelligenceService } from '@/lib/services/conversationIntelligenceService';
import { requireAuth } from '@/lib/middleware/authGuard';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const auth = await requireAuth(request);
  if (!auth.authenticated) return auth.response;

  try {
    const body = await request.json();
    const { leadId, objective = '', tone = 'Professional' } = body;

    if (!leadId) {
      return NextResponse.json({ success: false, message: 'leadId is required' }, { status: 400 });
    }

    const draft = await ConversationIntelligenceService.generateContextualReplyDraft({
      leadId,
      objective,
      tone,
    });

    return NextResponse.json({
      success: true,
      data: draft,
    });
  } catch (err) {
    console.error('[API Inbox Generate Reply] Error:', err);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
