import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/middleware/authGuard';
import { getBrain } from '@/lib/ai/brain/MineTechBrain';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACTIONS = new Set(['APPROVE', 'EDIT', 'REJECT', 'DISMISS', 'USEFUL', 'NOT_USEFUL']);

/**
 * POST /api/ai/brain/feedback
 *   { decisionId, action: 'APPROVE'|'EDIT'|'REJECT'|'DISMISS'|'USEFUL'|'NOT_USEFUL', finalText? }
 * Records what a human did with an AI suggestion (learning history). SENT is recorded
 * server-side by the send route, never accepted from the client.
 */
export async function POST(request) {
  const auth = await requireAuth(request);
  if (!auth.authenticated) return auth.response;

  try {
    const body = await request.json().catch(() => ({}));
    const action = String(body.action || '').toUpperCase();

    if (!body.decisionId || !UUID_RE.test(body.decisionId)) {
      return NextResponse.json({ success: false, message: 'Invalid decisionId' }, { status: 400 });
    }
    if (!ACTIONS.has(action)) {
      return NextResponse.json({ success: false, message: 'Invalid feedback action' }, { status: 400 });
    }
    if (action === 'EDIT' && typeof body.finalText !== 'string') {
      return NextResponse.json({ success: false, message: 'finalText is required for EDIT' }, { status: 400 });
    }

    const userId = auth.user?.id || auth.user?._id || null;
    const result = await getBrain().recordFeedback(body.decisionId, {
      action,
      finalText: action === 'EDIT' ? body.finalText : null,
      userId,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    console.error('[AI Brain] feedback error:', err);
    return NextResponse.json({ success: false, message: 'Failed to record feedback' }, { status: 500 });
  }
}
