import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/adminGuard';
import { getLeadFilterOptions } from '@/lib/services/leadService';

export const dynamic = 'force-dynamic';

/** Owners + campaigns for the Leads filter dropdowns. Small, cached server-side for 60s. */
export async function GET(request) {
  const auth = await requireAdmin(request);
  if (auth instanceof Response || !auth?.user) return auth;

  try {
    const data = await getLeadFilterOptions();
    return NextResponse.json(
      { success: true, data },
      { headers: { 'Cache-Control': 'private, max-age=30' } }
    );
  } catch (err) {
    console.error('[GET /api/leads/filters]', err);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
