import { NextResponse } from 'next/server';
import { getPerformanceAnalytics } from '@/lib/services/analyticsService';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const analytics = await getPerformanceAnalytics();
    return NextResponse.json({ success: true, data: analytics });
  } catch (err) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
