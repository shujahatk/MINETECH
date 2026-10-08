import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/middleware/authGuard';
import { LeadIntelligenceService } from '@/lib/services/leadIntelligenceService';

export const dynamic = 'force-dynamic';

/**
 * GET /api/leads/[id]/intelligence
 * Fetch canonical AI Lead Study with freshness status
 */
export async function GET(request, { params }) {
  const auth = await requireAuth(request);
  if (!auth.authenticated) return auth.response;

  try {
    const study = await LeadIntelligenceService.getIntelligence(params.id);
    if (!study) {
      return NextResponse.json({ success: false, message: 'Lead not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: study });
  } catch (err) {
    console.error('[API/intelligence] GET error:', err);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

/**
 * POST /api/leads/[id]/intelligence
 * Analyze / Refresh study / Keep Existing / Update Human Override
 */
export async function POST(request, { params }) {
  const auth = await requireAuth(request);
  if (!auth.authenticated) return auth.response;

  try {
    const body = await request.json().catch(() => ({}));
    const { action = 'refresh', force = false, humanContext = '' } = body;

    let result;
    if (action === 'keep_existing') {
      result = await LeadIntelligenceService.keepExisting(params.id);
    } else if (action === 'update_override') {
      result = await LeadIntelligenceService.updateHumanOverride(params.id, humanContext);
    } else {
      result = await LeadIntelligenceService.generateOrRefresh(params.id, {
        force: force || action === 'force_refresh',
        humanContext,
      });
    }

    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    console.error('[API/intelligence] POST error:', err);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
