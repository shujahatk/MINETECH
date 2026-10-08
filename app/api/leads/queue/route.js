import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/middleware/authGuard';
import { getSmartLeadQueue } from '@/lib/services/leadService';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const auth = await requireAuth(request);
  if (auth instanceof Response) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const userId = auth.user?.role === 'salesperson' ? auth.user.id : null;

    const queue = await getSmartLeadQueue({ userId, limit });
    return NextResponse.json({ success: true, count: queue.length, data: queue });
  } catch (err) {
    console.error('[Smart Queue API Error]:', err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
