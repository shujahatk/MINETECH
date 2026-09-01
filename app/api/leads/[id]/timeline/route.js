import { NextResponse } from 'next/server';
import { getLeadUnifiedTimeline } from '@/lib/services/leadService';

export async function GET(request, { params }) {
  try {
    const timeline = await getLeadUnifiedTimeline(params.id);
    return NextResponse.json({ success: true, count: timeline.length, data: timeline });
  } catch (err) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
