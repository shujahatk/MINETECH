import { NextResponse } from 'next/server';
import { sendLeadEmail } from '@/lib/services/emailService';
import { requireAuth } from '@/lib/middleware/authGuard';
import { guardAiDraftSend, recordAiDraftSent } from '@/lib/ai/brain/sendGuard';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const auth = await requireAuth(request);
  if (!auth.authenticated) {
    return auth.response;
  }

  try {
    const {
      leadId,
      subject,
      bodyHtml,
      bodyText,
      cc,
      bcc,
      replyTo,
      attachments,
      inboxId,
      templateId,
      aiDecisionId,
    } = await request.json();

    if (!leadId || !subject || (!bodyHtml && !bodyText)) {
      return NextResponse.json({ success: false, message: 'leadId, subject, and body are required' }, { status: 400 });
    }

    const userId = auth.user.id || auth.user._id;

    // Only active when sending an AI-drafted email: the AI Brain drafts, policy checks, a human sends.
    const guard = await guardAiDraftSend({ aiDecisionId, leadId, subject, bodyText, bodyHtml, user: auth.user });
    if (!guard.ok) {
      return NextResponse.json({ success: false, message: guard.message, blockedBy: guard.blockedBy }, { status: guard.status });
    }

    const result = await sendLeadEmail({
      leadId,
      subject,
      bodyHtml,
      bodyText,
      cc,
      bcc,
      replyTo,
      attachments,
      inboxId,
      templateId,
      userId,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          message: result.error || 'Failed to dispatch email via Resend',
          code: result.code || 'EMAIL_SEND_FAILED',
        },
        { status: 400 }
      );
    }

    await recordAiDraftSent({ aiDecisionId: guard.decision ? aiDecisionId : null, bodyText, bodyHtml, userId });

    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    console.error('[Send Email API] Error:', err);
    return NextResponse.json({ success: false, message: err.message }, { status: 400 });
  }
}
