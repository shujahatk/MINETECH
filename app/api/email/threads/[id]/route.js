import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { transformFromDb, transformToDb } from '@/lib/supabaseAdapter';
import { sendLeadEmail } from '@/lib/services/emailService';
import { requireAuth } from '@/lib/middleware/authGuard';
import { guardAiDraftSend, recordAiDraftSent } from '@/lib/ai/brain/sendGuard';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/email/threads/[id]
 * Fetch thread details, populated lead record, and full conversation stream
 */
export async function GET(request, { params }) {
  const auth = await requireAuth(request);
  if (!auth.authenticated) return auth.response;

  try {
    const threadId = params.id;
    if (!threadId) {
      return NextResponse.json({ success: false, message: 'Thread ID is required' }, { status: 400 });
    }

    // 1. Fetch Thread Record
    const { data: rawThread, error: threadErr } = await supabaseAdmin
      .from('email_threads')
      .select('*')
      .eq('id', threadId)
      .maybeSingle();

    if (threadErr || !rawThread) {
      return NextResponse.json({ success: false, message: 'Thread not found' }, { status: 404 });
    }

    const thread = transformFromDb(rawThread);

    // 2. Fetch Associated Lead Record
    let lead = null;
    const targetLeadId = thread.lead_id || thread.leadId;
    if (targetLeadId) {
      const { data: rawLead } = await supabaseAdmin
        .from('leads')
        .select('*')
        .eq('id', targetLeadId)
        .maybeSingle();

      if (rawLead) {
        lead = transformFromDb(rawLead);
      }
    }

    thread.leadId = lead || {
      id: targetLeadId,
      _id: targetLeadId,
      fullName: 'Prospect',
      email: 'prospect@example.com',
    };
    thread.lead = thread.leadId;

    // 3. Mark Thread as Read if unread
    if (thread.unread_count > 0 || thread.unread) {
      await supabaseAdmin
        .from('email_threads')
        .update({ unread_count: 0, updated_at: new Date().toISOString() })
        .eq('id', threadId);

      thread.unread_count = 0;
      thread.unread = false;

      // Update lead flag
      if (targetLeadId) {
        try {
          await supabaseAdmin
            .from('leads')
            .update({ custom_fields: { hasUnansweredReply: false }, updated_at: new Date().toISOString() })
            .eq('id', targetLeadId);
        } catch (e) {}
      }
    }

    // Determine if thread was sent via blast campaign or individual 1-to-1
    let isBlastThread = false;
    if (targetLeadId) {
      const { data: recipientRecord } = await supabaseAdmin
        .from('email_recipients')
        .select('id, campaign_id, status')
        .eq('lead_id', targetLeadId)
        .eq('status', 'SENT')
        .maybeSingle();

      if (recipientRecord || (thread.subject || '').toLowerCase().includes('pipeline')) {
        isBlastThread = true;
      }
    }

    thread.isBlast = isBlastThread;
    thread.isIndividual = !isBlastThread;
    thread.dispatchType = isBlastThread ? 'blast' : 'individual';

    // 4. Fetch All Messages for this Thread
    const { data: rawMessages, error: msgErr } = await supabaseAdmin
      .from('email_messages')
      .select('*')
      .eq('thread_id', threadId)
      .order('sent_at', { ascending: true });

    let messages = (rawMessages || []).map((m) => {
      const trans = transformFromDb(m);
      const isMsgBlast = isBlastThread && trans.direction === 'outbound';
      const isMsgIndividual = !isBlastThread && trans.direction === 'outbound';

      return {
        ...trans,
        _id: trans.id,
        direction: trans.direction || 'outbound',
        dispatchType: trans.direction === 'inbound' ? 'reply' : (isMsgBlast ? 'blast' : 'individual'),
        isBlast: isMsgBlast,
        isIndividual: isMsgIndividual,
        subject: trans.subject || thread.subject,
        bodyHtml: trans.body_html || trans.bodyHtml,
        bodyText: trans.body_plain || trans.bodyText || (trans.body_html || '').replace(/<[^>]+>/g, ' '),
        from: {
          email: trans.sender || 'outreach@minetechresources.com',
          name: trans.direction === 'inbound' ? (lead?.fullName || 'Prospect') : 'MineTech Outbound',
        },
        to: [
          {
            email: trans.recipient || lead?.email || 'prospect@example.com',
            name: trans.direction === 'inbound' ? 'MineTech Outbound' : (lead?.fullName || 'Prospect'),
          },
        ],
        sentAt: trans.sent_at || trans.created_at,
        createdAt: trans.created_at || trans.sent_at,
      };
    });

    // Fallback: If no messages linked directly by thread_id, check by lead_id
    if (messages.length === 0 && targetLeadId) {
      const { data: fallbackMsgs } = await supabaseAdmin
        .from('email_messages')
        .select('*')
        .eq('lead_id', targetLeadId)
        .order('sent_at', { ascending: true });

      if (fallbackMsgs && fallbackMsgs.length > 0) {
        messages = fallbackMsgs.map((m) => {
          const trans = transformFromDb(m);
          const isMsgBlast = isBlastThread && trans.direction === 'outbound';
          const isMsgIndividual = !isBlastThread && trans.direction === 'outbound';

          return {
            ...trans,
            _id: trans.id,
            direction: trans.direction || 'outbound',
            dispatchType: trans.direction === 'inbound' ? 'reply' : (isMsgBlast ? 'blast' : 'individual'),
            isBlast: isMsgBlast,
            isIndividual: isMsgIndividual,
            subject: trans.subject || thread.subject,
            bodyHtml: trans.body_html || trans.bodyHtml,
            bodyText: trans.body_plain || trans.bodyText || (trans.body_html || '').replace(/<[^>]+>/g, ' '),
            from: {
              email: trans.sender || 'outreach@minetechresources.com',
              name: trans.direction === 'inbound' ? (lead?.fullName || 'Prospect') : 'MineTech Outbound',
            },
            to: [
              {
                email: trans.recipient || lead?.email || 'prospect@example.com',
                name: trans.direction === 'inbound' ? 'MineTech Outbound' : (lead?.fullName || 'Prospect'),
              },
            ],
            sentAt: trans.sent_at || trans.created_at,
            createdAt: trans.created_at || trans.sent_at,
          };
        });
      }
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          thread,
          messages,
        },
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
          Pragma: 'no-cache',
          Expires: '0',
        },
      }
    );
  } catch (err) {
    console.error('[Thread Detail API] Error:', err);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

/**
 * POST /api/email/threads/[id]
 * Send a reply in this thread directly to the prospect
 */
export async function POST(request, { params }) {
  const auth = await requireAuth(request);
  if (!auth.authenticated) return auth.response;

  try {
    const threadId = params.id;
    const body = await request.json();
    const { bodyHtml, bodyText, subject, aiDecisionId } = body;

    if (!bodyHtml && !bodyText) {
      return NextResponse.json({ success: false, message: 'Reply content is required' }, { status: 400 });
    }

    // 1. Fetch Thread Record
    const { data: rawThread, error: threadErr } = await supabaseAdmin
      .from('email_threads')
      .select('*')
      .eq('id', threadId)
      .maybeSingle();

    if (threadErr || !rawThread) {
      return NextResponse.json({ success: false, message: 'Thread not found' }, { status: 404 });
    }

    const thread = transformFromDb(rawThread);
    const targetLeadId = thread.lead_id || thread.leadId;

    if (!targetLeadId) {
      return NextResponse.json({ success: false, message: 'Thread is not linked to a lead' }, { status: 400 });
    }

    // 2. Fetch Last Inbound Message to form In-Reply-To Header
    const { data: lastInbound } = await supabaseAdmin
      .from('email_messages')
      .select('id, resend_id, subject')
      .eq('thread_id', threadId)
      .eq('direction', 'inbound')
      .order('sent_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const replySubject = subject || (thread.subject.startsWith('Re:') ? thread.subject : `Re: ${thread.subject}`);

    // 2b. AI-drafted reply? The AI Brain only drafts: verify the draft + run the send policy first.
    //     Plain human replies (no aiDecisionId) skip this entirely.
    const guard = await guardAiDraftSend({
      aiDecisionId,
      leadId: targetLeadId,
      subject: replySubject,
      bodyText,
      bodyHtml,
      user: auth.user,
    });
    if (!guard.ok) {
      return NextResponse.json({ success: false, message: guard.message, blockedBy: guard.blockedBy }, { status: guard.status });
    }

    // 3. Dispatch Live Reply via sendLeadEmail
    const sendResult = await sendLeadEmail({
      leadId: targetLeadId,
      subject: replySubject,
      bodyHtml: bodyHtml || `<p>${(bodyText || '').replace(/\n/g, '<br/>')}</p>`,
      bodyText: bodyText || bodyHtml?.replace(/<[^>]+>/g, ' '),
      threadId: threadId,
      inReplyTo: lastInbound?.resend_id || null,
    });

    await recordAiDraftSent({
      aiDecisionId: guard.decision ? aiDecisionId : null,
      bodyText,
      bodyHtml,
      userId: auth.user?.id || auth.user?._id || null,
    });

    // 4. Update Thread Timestamp & Snippet
    await supabaseAdmin
      .from('email_threads')
      .update({
        last_message_at: new Date().toISOString(),
        snippet: (bodyText || bodyHtml?.replace(/<[^>]+>/g, ' ') || 'Outbound reply').substring(0, 150),
        status: 'OPEN',
        updated_at: new Date().toISOString(),
      })
      .eq('id', threadId);

    return NextResponse.json({
      success: true,
      data: sendResult,
    });
  } catch (err) {
    console.error('[Send Reply API] Error:', err);
    return NextResponse.json({ success: false, message: err.message }, { status: 400 });
  }
}

/**
 * PUT /api/email/threads/[id]
 * Update thread status (e.g. ARCHIVED / OPEN) or unread state
 */
export async function PUT(request, { params }) {
  const auth = await requireAuth(request);
  if (!auth.authenticated) return auth.response;

  try {
    const threadId = params.id;
    const { status, unread } = await request.json();

    const payload = { updated_at: new Date().toISOString() };
    if (status !== undefined) payload.status = status;
    if (unread !== undefined) payload.unread_count = unread ? 1 : 0;

    const { data, error } = await supabaseAdmin
      .from('email_threads')
      .update(payload)
      .eq('id', threadId)
      .select()
      .maybeSingle();

    if (error) throw error;
    return NextResponse.json({ success: true, data: transformFromDb(data) });
  } catch (err) {
    return NextResponse.json({ success: false, message: err.message }, { status: 400 });
  }
}

/**
 * DELETE /api/email/threads/[id]
 * Permanently delete thread and all its messages from database memory
 */
export async function DELETE(request, { params }) {
  const auth = await requireAuth(request);
  if (!auth.authenticated) return auth.response;

  try {
    const threadId = params.id;
    if (!threadId) {
      return NextResponse.json({ success: false, message: 'Thread ID is required' }, { status: 400 });
    }

    // 1. Delete all messages in email_messages belonging to this thread
    const { error: msgDeleteErr } = await supabaseAdmin
      .from('email_messages')
      .delete()
      .eq('thread_id', threadId);

    if (msgDeleteErr) {
      console.warn('[Delete Thread API] Warning deleting messages:', msgDeleteErr.message);
    }

    // 2. Delete the thread from email_threads
    const { error: threadDeleteErr } = await supabaseAdmin
      .from('email_threads')
      .delete()
      .eq('id', threadId);

    if (threadDeleteErr) {
      throw threadDeleteErr;
    }

    return NextResponse.json({
      success: true,
      message: 'Thread and associated messages permanently deleted from database memory.',
    });
  } catch (err) {
    console.error('[Delete Thread API] Error:', err);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}


