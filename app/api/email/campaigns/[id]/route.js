import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/mongoose';
import EmailCampaign from '@/lib/models/EmailCampaign';
import EmailRecipient from '@/lib/models/EmailRecipient';
import { requireAuth } from '@/lib/middleware/authGuard';
import {
  launchCampaign,
  pauseCampaign,
  resumeCampaign,
  cancelCampaign,
  retryFailedCampaignRecipients,
} from '@/lib/services/campaignService';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  const auth = await requireAuth(request);
  if (!auth.authenticated) return auth.response;

  try {
    await connectToDatabase();
    const campaign = await EmailCampaign.findById(params.id);
    if (!campaign) return NextResponse.json({ success: false, message: 'Campaign not found' }, { status: 404 });

    const recentRecipients = await EmailRecipient.find({ campaignId: params.id })
      .populate('leadId', 'fullName firstName lastName email company status')
      .sort({ updatedAt: -1 })
      .limit(50)
      .lean();

    return NextResponse.json({
      success: true,
      data: {
        campaign,
        recipients: recentRecipients,
      },
    });
  } catch (err) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  const auth = await requireAuth(request);
  if (!auth.authenticated) return auth.response;

  try {
    const { action } = await request.json(); // 'launch', 'pause', 'resume', 'cancel', 'retry'

    let campaign;
    if (action === 'launch') {
      campaign = await launchCampaign(params.id);
    } else if (action === 'pause') {
      campaign = await pauseCampaign(params.id);
    } else if (action === 'resume') {
      campaign = await resumeCampaign(params.id);
    } else if (action === 'cancel') {
      campaign = await cancelCampaign(params.id);
    } else if (action === 'retry') {
      campaign = await retryFailedCampaignRecipients(params.id);
    } else {
      return NextResponse.json({ success: false, message: `Unknown action: ${action}` }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: campaign });
  } catch (err) {
    return NextResponse.json({ success: false, message: err.message }, { status: 400 });
  }
}
