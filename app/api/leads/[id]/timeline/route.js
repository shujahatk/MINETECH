import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/middleware/authGuard';
import { getLeadUnifiedTimeline } from '@/lib/services/leadService';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  const auth = await requireAuth(request);
  if (!auth.authenticated) return auth.response;

  try {
    const timeline = await getLeadUnifiedTimeline(params.id);
    return NextResponse.json({ success: true, count: timeline.length, data: timeline });
  } catch (err) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
