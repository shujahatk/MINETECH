import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/middleware/authGuard';
import { getBrain } from '@/lib/ai/brain/MineTechBrain';

export const dynamic = 'force-dynamic';
// Claude calls can take a while; the Leads page itself never waits on this route.
export const maxDuration = 60;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/ai/brain/leads/[id]
 * Cached AI intelligence + deterministic next-best-action. NEVER calls Claude, so it is safe
 * to call whenever the drawer opens.
 */
export async function GET(request, { params }) {
  const auth = await requireAuth(request);
  if (!auth.authenticated) return auth.response;

  const leadId = params.id;
  if (!UUID_RE.test(leadId)) {
    return NextResponse.json({ success: false, message: 'Invalid lead id' }, { status: 400 });
  }

  try {
    const brain = getBrain();
    const [state, recommendation] = await Promise.all([brain.getIntelligenceState(leadId), brain.recommend(leadId)]);
    if (!state) return NextResponse.json({ success: false, message: 'Lead not found' }, { status: 404 });

    return NextResponse.json({ success: true, data: { ...state, recommendation } });
  } catch (err) {
    console.error('[AI Brain] GET lead error:', err);
    return NextResponse.json({ success: false, message: 'Failed to load AI intelligence' }, { status: 500 });
  }
}

/**
 * POST /api/ai/brain/leads/[id]
 *   { action: 'analyze', force?: boolean }
 *   { action: 'draft_email', objective?: string, kind?: 'INITIAL'|'FOLLOW_UP' }
 * Human-triggered. Drafts are suggestions only; nothing is sent.
 */
export async function POST(request, { params }) {
  const auth = await requireAuth(request);
  if (!auth.authenticated) return auth.response;

  const leadId = params.id;
  if (!UUID_RE.test(leadId)) {
    return NextResponse.json({ success: false, message: 'Invalid lead id' }, { status: 400 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const action = body.action || 'analyze';
    const userId = auth.user?.id || auth.user?._id || null;
    const brain = getBrain();

    if (action === 'analyze') {
      const result = await brain.analyzeLead(leadId, { force: Boolean(body.force) });
      const recommendation = await brain.recommend(leadId).catch(() => null);
      return NextResponse.json({ success: result.status !== 'FAILED', data: { ...result, recommendation } });
    }

    if (action === 'draft_email') {
      const result = await brain.personalizeEmail(leadId, {
        objective: String(body.objective || 'Open a conversation').slice(0, 300),
        kind: body.kind === 'FOLLOW_UP' ? 'FOLLOW_UP' : 'INITIAL',
        userId,
      });
      return NextResponse.json({ success: result.status === 'READY', data: result });
    }

    return NextResponse.json({ success: false, message: `Unknown action "${action}"` }, { status: 400 });
  } catch (err) {
    console.error('[AI Brain] POST lead error:', err);
    const notFound = /not found/i.test(err.message || '');
    return NextResponse.json(
      { success: false, message: notFound ? 'Lead not found' : 'AI request failed' },
      { status: notFound ? 404 : 500 }
    );
  }
}
