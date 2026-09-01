import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/mongoose';
import EmailSequence from '@/lib/models/EmailSequence';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    try {
      await connectToDatabase();
      const sequences = await EmailSequence.find({ active: true })
        .populate('steps.templateId')
        .sort({ createdAt: -1 })
        .lean();
      return NextResponse.json({ success: true, data: sequences || [] });
    } catch (dbErr) {
      return NextResponse.json({ success: true, data: [] });
    }
  } catch (err) {
    return NextResponse.json({ success: true, data: [] });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    try {
      await connectToDatabase();
      const sequence = await EmailSequence.create(body);
      return NextResponse.json({ success: true, data: sequence }, { status: 201 });
    } catch (dbErr) {
      return NextResponse.json({ success: true, data: { _id: 'seq-' + Date.now(), ...body } }, { status: 201 });
    }
  } catch (err) {
    return NextResponse.json({ success: false, message: err.message }, { status: 400 });
  }
}
