import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/middleware/authGuard';
import { getLeadById, updateLead, deleteLead } from '@/lib/services/leadService';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  const auth = await requireAuth(request);
  if (!auth.authenticated) return auth.response;

  try {
    const lead = await getLeadById(params.id);
    if (!lead) return NextResponse.json({ success: false, message: 'Lead not found' }, { status: 404 });
    return NextResponse.json({ success: true, data: lead });
  } catch (err) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  const auth = await requireAuth(request);
  if (!auth.authenticated) return auth.response;

  try {
    const body = await request.json();
    const updated = await updateLead(params.id, body);
    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    return NextResponse.json({ success: false, message: err.message }, { status: 400 });
  }
}

export async function DELETE(request, { params }) {
  const auth = await requireAuth(request);
  if (!auth.authenticated) return auth.response;

  try {
    const result = await deleteLead(params.id);
    return NextResponse.json({
      success: true,
      message: 'Lead permanently deleted',
      data: { id: result.id, affected: result.affected },
    });
  } catch (err) {
    const status = err.status || (err.code === 'NOT_FOUND' ? 404 : 500);
    return NextResponse.json(
      {
        success: false,
        message: err.message || 'Failed to delete lead',
        code: err.code || null,
        dependency: err.dependency || null,
      },
      { status }
    );
  }
}
