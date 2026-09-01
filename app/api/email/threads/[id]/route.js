import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/mongoose';
import EmailThread from '@/lib/models/EmailThread';
import EmailMessage from '@/lib/models/EmailMessage';
import Lead from '@/lib/models/Lead';
import { sendLeadEmail } from '@/lib/services/emailService';

export async function GET(request, { params }) {
  try {
    await connectToDatabase();

    const thread = await EmailThread.findById(params.id)
      .populate('leadId')
      .populate('campaignId', 'name subject');

    if (!thread) {
      return NextResponse.json({ success: false, message: 'Thread not found' }, { status: 404 });
    }

    // Mark as read
    if (thread.unread) {
      thread.unread = false;
      await thread.save();

      if (thread.leadId) {
        await Lead.findByIdAndUpdate(thread.leadId._id, { hasUnansweredReply: false });
      }
    }

    const messages = await EmailMessage.find({ threadId: params.id })
      .sort({ createdAt: 1 })
      .lean();

    return NextResponse.json({
      success: true,
      data: {
        thread,
        messages,
      },
    });
  } catch (err) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

/**
 * Send reply in this thread
 */
export async function POST(request, { params }) {
  try {
    await connectToDatabase();
    const { bodyHtml, bodyText, subject } = await request.json();

    const thread = await EmailThread.findById(params.id);
    if (!thread) return NextResponse.json({ success: false, message: 'Thread not found' }, { status: 404 });

    const lastInboundMsg = await EmailMessage.findOne({ threadId: params.id, direction: 'inbound' })
      .sort({ createdAt: -1 });

    const replySubject = subject || (thread.subject.startsWith('Re:') ? thread.subject : `Re: ${thread.subject}`);

    const result = await sendLeadEmail({
      leadId: thread.leadId,
      subject: replySubject,
      bodyHtml,
      bodyText,
      threadId: thread._id,
      inReplyTo: lastInboundMsg?.messageId || null,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    return NextResponse.json({ success: false, message: err.message }, { status: 400 });
  }
}

/**
 * Archive or delete thread
 */
export async function PUT(request, { params }) {
  try {
    await connectToDatabase();
    const { status, unread } = await request.json();

    const update = {};
    if (status !== undefined) update.status = status;
    if (unread !== undefined) update.unread = unread;

    const thread = await EmailThread.findByIdAndUpdate(params.id, update, { new: true });
    return NextResponse.json({ success: true, data: thread });
  } catch (err) {
    return NextResponse.json({ success: false, message: err.message }, { status: 400 });
  }
}
