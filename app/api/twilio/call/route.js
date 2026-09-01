import { NextResponse } from 'next/server';
import { makeOutboundCall } from '@/lib/services/twilioService';

export async function POST(request) {
  try {
    const { leadId, to } = await request.json();
    if (!to) return NextResponse.json({ success: false, message: 'Phone number is required' }, { status: 400 });

    const callRecord = await makeOutboundCall({ leadId, to });
    return NextResponse.json({ success: true, data: callRecord }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ success: false, message: err.message }, { status: 400 });
  }
}
