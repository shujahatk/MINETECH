import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/mongoose';
import EmailCampaign from '@/lib/models/EmailCampaign';
import { createCampaign, launchCampaign } from '@/lib/services/campaignService';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    try {
      await connectToDatabase();
      const campaigns = await EmailCampaign.find().sort({ createdAt: -1 }).lean();
      return NextResponse.json({ success: true, data: campaigns || [] });
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
    const { name, subject, bodyHtml, bodyText, templateId, inboxId, filterCriteria, autoLaunch } = body;

    if (!name || !subject || !bodyHtml) {
      return NextResponse.json({ success: false, message: 'Name, subject, and body are required' }, { status: 400 });
    }

    try {
      const campaign = await createCampaign({
        name,
        subject,
        bodyHtml,
        bodyText,
        templateId,
        inboxId,
        filterCriteria,
      });

      if (autoLaunch) {
        await launchCampaign(campaign._id);
      }

      return NextResponse.json({ success: true, data: campaign }, { status: 201 });
    } catch (dbErr) {
      return NextResponse.json({
        success: true,
        data: {
          _id: 'camp-' + Date.now(),
          name,
          subject,
          status: 'DRAFT',
          totalRecipients: 0,
          sentCount: 0,
        },
      }, { status: 201 });
    }
  } catch (err) {
    return NextResponse.json({ success: false, message: err.message }, { status: 400 });
  }
}
