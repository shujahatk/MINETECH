import { NextResponse } from 'next/server';
import { requireAuth, requireAdmin } from '@/lib/auth/adminGuard';
import {
  getCampaignById,
  updateCampaign,
  deleteCampaign,
  getCampaignDeletionImpact,
} from '@/lib/services/campaignService';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse || auth instanceof Response) return auth;

  try {
    const { id } = params;
    const url = new URL(request.url);
    if (url.searchParams.get('action') === 'deletion_impact' || url.searchParams.get('impact') === 'true') {
      const impact = await getCampaignDeletionImpact(id);
      return NextResponse.json({ success: true, data: impact });
    }

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
    const body = await request.json().catch(() => ({}));
    const url = new URL(request.url);
    const deleteLeadsParam = url.searchParams.get('deleteLeads');
    const deleteAssociatedLeads =
      body.deleteAssociatedLeads === true ||
      body.deleteLeads === true ||
      deleteLeadsParam === 'true';

    const result = await deleteCampaign(id, { deleteAssociatedLeads });
    return NextResponse.json({
      success: true,
      message: result.message,
      deletedId: id,
      totalAssociated: result.totalAssociated,
      deletedExclusiveCount: result.deletedExclusiveCount,
      retainedSharedCount: result.retainedSharedCount,
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

