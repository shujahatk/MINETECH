import { NextResponse } from 'next/server.js';
import { requireAuth, requireAdmin } from '../../../../lib/auth/adminGuard.js';
import {
  getCampaigns,
  createCampaign,
  launchCampaign,
  sendCampaignTestEmail,
} from '../../../../lib/services/campaignService.js';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse || auth instanceof Response) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const sort = searchParams.get('sort') || 'created_at';
    const order = searchParams.get('order') || 'desc';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const result = await getCampaigns({
      search,
      status,
      sort,
      order,
      page,
      limit,
    });

    return NextResponse.json({
      success: true,
      data: result.campaigns,
      total: result.total,
      page: result.page,
      limit: result.limit,
    });
  } catch (err) {
    console.error('[Campaigns GET API Error]:', err);
    return NextResponse.json(
      { success: false, error: err.message, data: [] },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse || auth instanceof Response) return auth;

  try {
    const body = await request.json();

    // Support standalone test email dispatch before saving campaign
    if (body.action === 'test_send' || body.isTestSend) {
      const testEmail = body.testEmail || body.email;
      if (!testEmail) {
        return NextResponse.json(
          { success: false, message: 'Test email address is required' },
          { status: 400 }
        );
      }
      const testResult = await sendCampaignTestEmail({
        testEmail,
        senderEmail: body.sender?.email,
        senderName: body.sender?.name,
        replyToEmail: body.sender?.replyTo,
        customSubject: body.subject,
        customBodyHtml: body.bodyHtml,
        customBodyText: body.bodyText,
      });
      return NextResponse.json({ success: true, data: testResult });
    }

    const {
      name,
      subject,
      bodyHtml,
      bodyText,
      description,
      templateId,
      inboxId,
      filterCriteria,
      autoLaunch = false,
      campaignType,
      masterPrompt,
      personalization,
      sender,
      sendingSettings,
      tracking,
      compliance,
      status,
    } = body;

    const finalCampaignType =
      campaignType ||
      (personalization?.mode === 'ai_personalized' || personalization?.mode === 'claude_personalized_blast'
        ? 'ai_personalized'
        : 'standard');
    const finalMasterPrompt = masterPrompt || personalization?.prompt || personalization?.masterPrompt || '';

    if (!name || !subject || !bodyHtml) {
      return NextResponse.json(
        { success: false, message: 'Name, subject, and body are required' },
        { status: 400 }
      );
    }

    const initialStatus = status
      ? status.toUpperCase()
      : autoLaunch
      ? 'RUNNING'
      : 'DRAFT';

    const campaign = await createCampaign({
      name,
      subject,
      bodyHtml,
      bodyText: bodyText || bodyHtml.replace(/<[^>]*>?/gm, ''),
      description: description || '',
      templateId,
      inboxId,
      filterCriteria: filterCriteria || {},
      campaignType: finalCampaignType,
      masterPrompt: finalMasterPrompt,
      sender,
      sendingSettings,
      tracking,
      compliance,
      status: initialStatus,
      personalizedRecipients: body.personalizedRecipients || body.recipients || null,
    });

    if (autoLaunch) {
      await launchCampaign(campaign.id);
    }

    return NextResponse.json({ success: true, data: campaign }, { status: 201 });
  } catch (err) {
    console.error('[Campaigns POST API Error]:', err);
    return NextResponse.json(
      { success: false, message: err.message },
      { status: 400 }
    );
  }
}
