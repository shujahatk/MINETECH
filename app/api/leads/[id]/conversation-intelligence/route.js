import { NextResponse } from 'next/server';
import { ConversationIntelligenceService } from '@/lib/services/conversationIntelligenceService';
import { requireAuth } from '@/lib/middleware/authGuard';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  const auth = await requireAuth(request);
  if (!auth.authenticated) return auth.response;

  try {
    const { id } = params;
    const intel = await ConversationIntelligenceService.getConversationIntelligence(id);

    return NextResponse.json({
      success: true,
      data: intel,
    });
  } catch (err) {
    console.error('[API Conversation Intelligence GET] Error:', err);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  const auth = await requireAuth(request);
  if (!auth.authenticated) return auth.response;

  try {
    const { id } = params;
    const body = await request.json();
    const {
      action = 'analyze',
      messageId = null,
      messageText = '',
      channel = 'email',
      sender = '',
      threadContext = '',
      humanContext = '',
      force = false,
    } = body;

    if (action === 'update_override') {
      const updated = await ConversationIntelligenceService.updateHumanOverride(id, humanContext);
      return NextResponse.json({ success: true, data: updated });
    }

    if (action === 'generate_reply') {
      const reply = await ConversationIntelligenceService.generateContextualReplyDraft({
        leadId: id,
        objective: body.objective || '',
        tone: body.tone || 'Professional',
      });
      return NextResponse.json({ success: true, data: reply });
    }

    const intel = await ConversationIntelligenceService.analyzeInboundReply({
      leadId: id,
      messageId,
      messageText,
      channel,
      sender,
      threadContext,
      humanContext,
      force,
    });

    return NextResponse.json({
      success: true,
      data: intel,
    });
  } catch (err) {
    console.error('[API Conversation Intelligence POST] Error:', err);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
