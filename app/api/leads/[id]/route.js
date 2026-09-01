import { NextResponse } from 'next/server';
import { getLeadById, updateLead, deleteLead } from '@/lib/services/leadService';

export async function GET(request, { params }) {
  try {
    const lead = await getLeadById(params.id);
    if (!lead) return NextResponse.json({ success: false, message: 'Lead not found' }, { status: 404 });
    return NextResponse.json({ success: true, data: lead });
  } catch (err) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const body = await request.json();
    const updated = await updateLead(params.id, body);
    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    return NextResponse.json({ success: false, message: err.message }, { status: 400 });
  }
}

export async function DELETE(request, { params }) {
  try {
    await deleteLead(params.id);
    return NextResponse.json({ success: true, message: 'Lead deleted' });
  } catch (err) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
