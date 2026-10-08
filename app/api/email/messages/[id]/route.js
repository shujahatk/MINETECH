import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/middleware/authGuard';

export const dynamic = 'force-dynamic';

/**
 * DELETE /api/email/messages/[id]
 * Permanently delete an individual message from database memory
 */
export async function DELETE(request, { params }) {
  const auth = await requireAuth(request);
  if (!auth.authenticated) return auth.response;

  try {
    const messageId = params.id;
    if (!messageId) {
      return NextResponse.json({ success: false, message: 'Message ID is required' }, { status: 400 });
    }

    // 1. Fetch message to check thread_id
    const { data: msg } = await supabaseAdmin
      .from('email_messages')
      .select('id, thread_id')
      .eq('id', messageId)
      .maybeSingle();

    // 2. Delete message
    const { error } = await supabaseAdmin
      .from('email_messages')
      .delete()
      .eq('id', messageId);

    if (error) {
      throw error;
    }

    // 3. If the message belonged to a thread, update the thread snippet or count
    if (msg?.thread_id) {
      const { data: remainingMsgs } = await supabaseAdmin
        .from('email_messages')
        .select('id, body_plain, body_html, sent_at')
        .eq('thread_id', msg.thread_id)
        .order('sent_at', { ascending: false })
        .limit(1);

      if (remainingMsgs && remainingMsgs.length > 0) {
        const last = remainingMsgs[0];
        const snippet = (last.body_plain || last.body_html?.replace(/<[^>]+>/g, ' ') || '').substring(0, 150);
        await supabaseAdmin
          .from('email_threads')
          .update({
            snippet,
            last_message_at: last.sent_at || new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', msg.thread_id);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Email message permanently deleted from database memory.',
    });
  } catch (err) {
    console.error('[Delete Message API] Error:', err);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
