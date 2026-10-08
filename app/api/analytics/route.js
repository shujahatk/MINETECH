import { NextResponse } from 'next/server';
import { getPerformanceAnalytics } from '@/lib/services/analyticsService';
import { requireAuth } from '@/lib/middleware/authGuard';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request) {
  const auth = await requireAuth(request);
  if (!auth.authenticated) {
    return auth.response;
  }

  try {
    const analytics = await getPerformanceAnalytics();
    return NextResponse.json(
      { success: true, data: analytics },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
          Pragma: 'no-cache',
          Expires: '0',
        },
      }
    );
  } catch (err) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
