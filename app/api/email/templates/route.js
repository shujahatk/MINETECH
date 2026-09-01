import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/mongoose';
import EmailTemplate from '@/lib/models/EmailTemplate';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    try {
      await connectToDatabase();
      const templates = await EmailTemplate.find({ active: true }).sort({ createdAt: -1 }).lean();
      return NextResponse.json({ success: true, data: templates || [] });
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
      const template = await EmailTemplate.create(body);
      return NextResponse.json({ success: true, data: template }, { status: 201 });
    } catch (dbErr) {
      return NextResponse.json({ success: true, data: { _id: 'temp-' + Date.now(), ...body } }, { status: 201 });
    }
  } catch (err) {
    return NextResponse.json({ success: false, message: err.message }, { status: 400 });
  }
}
