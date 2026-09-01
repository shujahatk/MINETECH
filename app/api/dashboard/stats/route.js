import { NextResponse } from 'next/server';
import { getDashboardData } from '@/lib/services/analyticsService';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const data = await getDashboardData();
    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error('[Dashboard Stats] Error:', err);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
