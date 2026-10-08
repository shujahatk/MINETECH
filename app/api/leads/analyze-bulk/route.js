import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/middleware/authGuard';
import { LeadIntelligenceService } from '@/lib/services/leadIntelligenceService';

export const dynamic = 'force-dynamic';

/**
 * POST /api/leads/analyze-bulk
 * Bulk analyze leads with controlled concurrency & priority filtering
 */
export async function POST(request) {
  const auth = await requireAuth(request);
  if (!auth.authenticated) return auth.response;

  try {
    const body = await request.json();
    const {
      leadIds = [],
      priorityFilter = null,
      force = false,
      concurrency = 2,
    } = body;

    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'leadIds array is required',
      }, { status: 400 });
    }

    const summary = await LeadIntelligenceService.bulkAnalyze(leadIds, {
      priorityFilter,
      force,
      concurrency: Math.min(concurrency || 2, 4),
    });

    return NextResponse.json({
      success: true,
      data: summary,
    });
  } catch (err) {
    console.error('[API/analyze-bulk] POST error:', err);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
