import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/middleware/authGuard';
import { runDraftCommand } from '@/lib/ai/draftCommandService';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const okId = (v) => v === undefined || v === null || v === '' || UUID_RE.test(String(v));
const MAX_INSTRUCTION = 300;

/**
 * POST /api/ai/draft
 *   { leadId, instruction, threadId?, campaignId?, surface?: 'compose'|'reply', currentDraft?: { subject, body } }
 *
 * The client only needs { leadId, instruction }. Everything else (research, campaign objective,
 * previous emails and replies, status, playbook) is loaded server-side. `currentDraft` is optional
 * and only used for edit commands such as "make shorter".
 *
 * Returns a DRAFT. This route never sends email: a human reviews it and sends through the normal
 * email route (passing the returned decisionId as aiDecisionId).
 *
 * Response: { success, data }. `success` is true only when a draft was produced; otherwise
 * `data.status` explains why (NOT_APPLICABLE, BLOCKED, FAILED, ...) and `data.error` is user-safe.
 */
export async function POST(request) {
  const auth = await requireAuth(request);
  if (!auth.authenticated) return auth.response;

  try {
    const body = await request.json().catch(() => ({}));
    const { leadId, threadId, campaignId } = body;

    if (!leadId || !UUID_RE.test(String(leadId)) || !okId(threadId) || !okId(campaignId)) {
      return NextResponse.json({ success: false, message: 'Invalid leadId, threadId or campaignId' }, { status: 400 });
    }

    const instruction = typeof body.instruction === 'string' ? body.instruction.trim().slice(0, MAX_INSTRUCTION) : '';
    const surface = body.surface === 'reply' ? 'reply' : 'compose';
    const cd = body.currentDraft && typeof body.currentDraft === 'object' ? body.currentDraft : null;

    const result = await runDraftCommand({
      leadId,
      instruction,
      threadId: threadId || null,
      campaignId: campaignId || null,
      surface,
      currentDraft: cd ? { subject: typeof cd.subject === 'string' ? cd.subject : '', body: typeof cd.body === 'string' ? cd.body : '' } : null,
      userId: auth.user?.id || auth.user?._id || null,
    });

    const status = result.status === 'NOT_FOUND' ? 404 : 200;
    return NextResponse.json({ success: result.status === 'READY', data: result }, { status });
  } catch (err) {
    console.error('[AI Draft] error:', err);
    return NextResponse.json({ success: false, message: 'AI draft failed. Please try again.' }, { status: 500 });
  }
}
