import { NextResponse } from 'next/server';
import { sendLeadEmail } from '@/lib/services/emailService';
import { requireAuth } from '@/lib/middleware/authGuard';
import { guardAiDraftSend, recordAiDraftSent } from '@/lib/ai/brain/sendGuard';
import { deleteDraft } from '@/lib/services/draftService';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const auth = await requireAuth(request);
  if (!auth.authenticated) {
    return auth.response;
  }

  try {
    const {
      leadId,
      to,
      subject,
      bodyHtml,
      bodyText,
      cc,
      bcc,
      replyTo,
      senderName,
      senderDisplayName,
      senderEmail,
      campaignId,
      campaignName,
      attachments,
      inboxId,
      templateId,
      aiDecisionId,
      scheduled_at,
      scheduledAt,
      draftId,
    } = await request.json();

    if ((!leadId && !to) || !subject || (!bodyHtml && !bodyText)) {
      return NextResponse.json({ success: false, message: 'Recipient (to or leadId), subject, and body are required' }, { status: 400 });
    }

    const resolvedSenderName = (senderDisplayName || senderName || 'Rauf').trim();
    const resolvedSenderEmail = (senderEmail || 'rauf@mine-tech.be').trim();
    const resolvedReplyTo = (replyTo || resolvedSenderEmail).trim();

    // Prevent unverified domains from failing in Resend
    if (resolvedSenderEmail.includes('@')) {
      const domain = resolvedSenderEmail.split('@')[1].toLowerCase();
      if (domain === 'minetech.be') {
        return NextResponse.json({
          success: false,
          message: 'Configured sender domain "minetech.be" is invalid. The verified Resend sending domain is "mine-tech.be" (with a hyphen).',
          code: 'UNAUTHORIZED_SENDER_DOMAIN',
        }, { status: 400 });
      }
    }

    const userId = auth.user.id || auth.user._id;

    // Only active when sending an AI-drafted email: the AI Brain drafts, policy checks, a human sends.
    const guard = await guardAiDraftSend({ aiDecisionId, leadId, subject, bodyText, bodyHtml, user: auth.user });
    if (!guard.ok) {
      return NextResponse.json({ success: false, message: guard.message, blockedBy: guard.blockedBy }, { status: guard.status });
    }

    const result = await sendLeadEmail({
      leadId,
      to,
      subject,
      bodyHtml,
      bodyText,
      cc,
      bcc,
      replyTo: resolvedReplyTo,
      senderName: resolvedSenderName,
      senderEmail: resolvedSenderEmail,
      campaignId: campaignId || null,
      attachments,
      inboxId,
      templateId,
      userId,
      scheduled_at: scheduled_at || scheduledAt || null,
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

    // Clean up draft if one existed
    if (draftId) {
      try {
        await deleteDraft(draftId);
      } catch (e) {
        console.warn('Failed to delete draft after send:', e.message);
      }
    }

    await recordAiDraftSent({ aiDecisionId: guard.decision ? aiDecisionId : null, bodyText, bodyHtml, userId });

    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    console.error('[Send Email API] Error:', err);
    return NextResponse.json({ success: false, message: err.message }, { status: 400 });
  }
}
