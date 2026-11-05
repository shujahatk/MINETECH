import { NextResponse } from 'next/server';
import { requireAuth, requireAdmin } from '@/lib/auth/adminGuard';
import {
  getCampaignById,
  updateCampaign,
  deleteCampaign,
} from '@/lib/services/campaignService';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse || auth instanceof Response) return auth;

  try {
    const { id } = params;
    const campaign = await getCampaignById(id);
    if (!campaign) {
      return NextResponse.json({ success: false, message: 'Campaign not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: campaign });
  } catch (err) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse || auth instanceof Response) return auth;

  try {
    const { id } = params;
    const result = await deleteCampaign(id);
    return NextResponse.json({
      success: true,
      message: result.message,
      deletedId: id,
    });
  } catch (err) {
    const statusCode = err.statusCode || (err.message === 'Campaign not found' ? 404 : 500);
    return NextResponse.json(
      { success: false, message: err.message },
      { status: statusCode }
    );
  }
}

export async function PATCH(request, { params }) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse || auth instanceof Response) return auth;

  try {
    const { id } = params;
    const body = await request.json();
    const updated = await updateCampaign(id, body);
    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    return NextResponse.json({ success: false, message: err.message }, { status: 400 });
  }
}
