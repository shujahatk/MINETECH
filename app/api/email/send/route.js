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
    const { leadId, subject, bodyHtml, bodyText, inboxId, templateId, aiDecisionId } = await request.json();

    if (!leadId || !subject || !bodyHtml) {
      return NextResponse.json({ success: false, message: 'leadId, subject, and bodyHtml are required' }, { status: 400 });
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
      inboxId,
      templateId,
      userId,
    });

    await recordAiDraftSent({ aiDecisionId: guard.decision ? aiDecisionId : null, bodyText, bodyHtml, userId });

    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    console.error('[Send Email API] Error:', err);
    return NextResponse.json({ success: false, message: err.message }, { status: 400 });
  }
}
