import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/middleware/authGuard';
import { getBrain } from '@/lib/ai/brain/MineTechBrain';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const okId = (v) => v === undefined || v === null || v === '' || UUID_RE.test(String(v));

/**
 * GET /api/ai/brain/replies?leadId=...&messageId=...
 * Stored classification for an inbound message. Never calls Claude.
 */
export async function GET(request) {
  const auth = await requireAuth(request);
  if (!auth.authenticated) return auth.response;

  const { searchParams } = new URL(request.url);
  const leadId = searchParams.get('leadId');
  const messageId = searchParams.get('messageId');

  if (!leadId || !UUID_RE.test(leadId) || !okId(messageId)) {
    return NextResponse.json({ success: false, message: 'Invalid leadId or messageId' }, { status: 400 });
  }

  try {
    const data = await getBrain().getCachedClassification(leadId, { messageId: messageId || null });
    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error('[AI Brain] GET reply error:', err);
    return NextResponse.json({ success: false, message: 'Failed to load reply analysis' }, { status: 500 });
  }
}

/**
 * POST /api/ai/brain/replies
 *   { leadId, messageId?, threadId?, action: 'classify' | 'draft', objective?, force? }
 * 'classify' -> classification + recommendation. 'draft' -> classification + a reply DRAFT.
 * Drafts are never sent from here; a human sends through the normal email route.
 */
export async function POST(request) {
  const auth = await requireAuth(request);
  if (!auth.authenticated) return auth.response;

  try {
    const body = await request.json().catch(() => ({}));
    const { leadId, messageId, threadId, action = 'classify' } = body;

    if (!leadId || !UUID_RE.test(leadId) || !okId(messageId) || !okId(threadId)) {
      return NextResponse.json({ success: false, message: 'Invalid leadId, messageId or threadId' }, { status: 400 });
    }

    const userId = auth.user?.id || auth.user?._id || null;
    const brain = getBrain();

    if (action === 'classify') {
      const result = await brain.classifyReply(leadId, {
        messageId: messageId || null,
        threadId: threadId || null,
        userId,
        force: Boolean(body.force),
      });
      return NextResponse.json({ success: result.status === 'READY', data: result });
    }

    if (action === 'draft') {
      const result = await brain.draftReply(leadId, {
        messageId: messageId || null,
        threadId: threadId || null,
        objective: String(body.objective || '').slice(0, 300),
        userId,
      });
      return NextResponse.json({ success: result.status === 'READY', data: result });
    }

    return NextResponse.json({ success: false, message: `Unknown action "${action}"` }, { status: 400 });
  } catch (err) {
    console.error('[AI Brain] POST reply error:', err);
    const notFound = /not found/i.test(err.message || '');
    return NextResponse.json(
      { success: false, message: notFound ? 'Lead not found' : 'AI request failed' },
      { status: notFound ? 404 : 500 }
    );
  }
}
