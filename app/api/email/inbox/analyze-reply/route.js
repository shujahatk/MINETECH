import { NextResponse } from 'next/server';
import { ConversationIntelligenceService } from '@/lib/services/conversationIntelligenceService';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/middleware/authGuard';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const auth = await requireAuth(request);
  if (!auth.authenticated) return auth.response;

  try {
    const body = await request.json();
    const {
      leadId,
      threadId,
      messageId,
      messageText,
      sender,
      threadContext = '',
    } = body;

    let targetLeadId = leadId;

    // If leadId is not provided, look up lead by thread / sender email
    if (!targetLeadId && sender) {
      const emailOnly = sender.match(/[\w.-]+@[\w.-]+\.\w+/)?.[0]?.toLowerCase() || sender.toLowerCase();
      const { data: matchedLead } = await supabaseAdmin
        .from('leads')
        .select('id')
        .eq('email', emailOnly)
        .maybeSingle();

      if (matchedLead) {
        targetLeadId = matchedLead.id;
      }
    }

    if (!targetLeadId) {
      return NextResponse.json({
        success: false,
        message: 'Could not associate inbound message with an active lead in CRM.',
      }, { status: 400 });
    }

    const intel = await ConversationIntelligenceService.analyzeInboundReply({
      leadId: targetLeadId,
      messageId: messageId || `thread-${threadId || Date.now()}`,
      messageText: messageText || '',
      channel: 'email',
      sender: sender || '',
      threadContext,
    });

    return NextResponse.json({
      success: true,
      data: intel,
    });
  } catch (err) {
    console.error('[API Inbox Analyze Reply] Error:', err);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
