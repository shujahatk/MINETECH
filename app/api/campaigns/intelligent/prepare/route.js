import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/middleware/authGuard';
import { prepareCampaignsFromMatches } from '@/lib/services/intelligentCampaignOrchestrator';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const auth = await requireAuth(request);
  if (auth instanceof Response) return auth;

  try {
    const body = await request.json();
    const {
      proposedCampaigns = [],
      senderEmail = 'rauf@mine-tech.be',
      senderName = 'Abdullah Rauf - MineTech Resources',
      replyTo = 'rauf@mine-tech.be'
    } = body;

    if (!Array.isArray(proposedCampaigns) || proposedCampaigns.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No proposed campaigns provided for preparation' },
        { status: 400 }
      );
    }

    const userId = auth.user?.id || null;

    const prepared = await prepareCampaignsFromMatches({
      proposedCampaigns,
      senderEmail,
      senderName,
      replyTo,
      userId
    });

    return NextResponse.json({
      success: true,
      message: `Successfully prepared ${prepared.length} targeted campaigns from matching plan.`,
      data: prepared
    });
  } catch (err) {
    console.error('[API /api/campaigns/intelligent/prepare Error]:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
