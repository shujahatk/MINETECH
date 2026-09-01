import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/mongoose';
import Call from '@/lib/models/Call';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    try {
      await connectToDatabase();
      const calls = await Call.find()
        .populate('leadId', 'fullName firstName lastName phone company')
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();

      return NextResponse.json({ success: true, count: (calls || []).length, data: calls || [] });
    } catch (dbErr) {
      return NextResponse.json({ success: true, count: 0, data: [] });
    }
  } catch (err) {
    return NextResponse.json({ success: true, count: 0, data: [] });
  }
}
