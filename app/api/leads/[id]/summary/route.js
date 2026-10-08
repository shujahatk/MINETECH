import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/middleware/authGuard';
import { getLeadSummary } from '@/lib/services/leadService';

export const dynamic = 'force-dynamic';

/**
 * Lightweight per-lead summary for the drawer Overview tab:
 * last contacted + the campaigns this lead is enrolled in. Fetched only when the drawer opens.
 */
export async function GET(request, { params }) {
  const auth = await requireAuth(request);
  if (!auth?.authenticated && !auth?.user) return auth?.response || auth;

  try {
    const data = await getLeadSummary(params.id);
    return NextResponse.json({ success: true, data }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (err) {
    console.error('[GET /api/leads/:id/summary]', err);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
