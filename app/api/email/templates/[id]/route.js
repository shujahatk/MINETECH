import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/mongoose';
import EmailTemplate from '@/lib/models/EmailTemplate';

export async function GET(request, { params }) {
  try {
    await connectToDatabase();
    const template = await EmailTemplate.findById(params.id);
    if (!template) return NextResponse.json({ success: false, message: 'Template not found' }, { status: 404 });
    return NextResponse.json({ success: true, data: template });
  } catch (err) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    await connectToDatabase();
    const body = await request.json();
    const template = await EmailTemplate.findByIdAndUpdate(params.id, body, { new: true });
    return NextResponse.json({ success: true, data: template });
  } catch (err) {
    return NextResponse.json({ success: false, message: err.message }, { status: 400 });
  }
}

export async function DELETE(request, { params }) {
  try {
    await connectToDatabase();
    await EmailTemplate.findByIdAndDelete(params.id);
    return NextResponse.json({ success: true, message: 'Template deleted' });
  } catch (err) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
