import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/middleware/authGuard';
import { sendTestEmailForCampaign } from '@/lib/services/intelligentCampaignOrchestrator';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const auth = await requireAuth(request);
  if (auth instanceof Response) return auth;

  try {
    const body = await request.json();
    const { campaignId, testEmail, sampleLead, senderEmail, senderName } = body;

    if (!campaignId || !testEmail) {
      return NextResponse.json(
        { success: false, error: 'campaignId and testEmail are required' },
        { status: 400 }
      );
    }

    const result = await sendTestEmailForCampaign({
      campaignId,
      testEmail,
      sampleLead,
      senderEmail,
      senderName
    });

    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    console.error('[API /api/campaigns/intelligent/test-send Error]:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
