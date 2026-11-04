import { NextResponse } from 'next/server.js';
import { requireAuth, requireAdmin } from '../../../../../lib/auth/adminGuard.js';
import {
  getCampaignById,
  updateCampaign,
  deleteCampaign,
  duplicateCampaign,
  archiveCampaign,
  launchCampaign,
  pauseCampaign,
  resumeCampaign,
  cancelCampaign,
  retryFailedCampaignRecipients,
  sendCampaignTestEmail,
} from '../../../../../lib/services/campaignService.js';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse || auth instanceof Response) return auth;

  try {
    const { id } = params;
    const result = await getCampaignById(id);
    if (!result) {
      return NextResponse.json(
        { success: false, message: 'Campaign not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (err) {
    console.error('[Campaign GET ID Error]:', err);
    return NextResponse.json(
      { success: false, message: err.message },
      { status: 500 }
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

    return NextResponse.json({
      success: true,
      data: updated,
      message: 'Campaign updated successfully',
    });
  } catch (err) {
    console.error('[Campaign PATCH Error]:', err);
    const status = err.message === 'Campaign not found' ? 404 : 400;
    return NextResponse.json(
      { success: false, message: err.message },
      { status }
    );
  }
}

export async function PUT(request, context) {
  return PATCH(request, context);
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
    console.error('[Campaign DELETE Error]:', err);
    const statusCode = err.statusCode || (err.code === 'CAMPAIGN_ALREADY_SENT' ? 400 : 500);
    return NextResponse.json(
      {
        success: false,
        message: err.message,
        code: err.code || 'DELETE_FAILED',
      },
      { status: statusCode }
    );
  }
}

export async function POST(request, { params }) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse || auth instanceof Response) return auth;

  try {
    const { id } = params;
    const body = await request.json();
    const { action } = body;

    let result;
    switch (action) {
      case 'launch':
        result = await launchCampaign(id);
        break;
      case 'pause':
        result = await pauseCampaign(id);
        break;
      case 'resume':
        result = await resumeCampaign(id);
        break;
      case 'cancel':
        result = await cancelCampaign(id);
        break;
      case 'retry':
        result = await retryFailedCampaignRecipients(id);
        break;
      case 'duplicate':
        result = await duplicateCampaign(id);
        break;
      case 'archive':
        result = await archiveCampaign(id);
        break;
      case 'test_send':
      case 'send_test':
        result = await sendCampaignTestEmail({
          campaignId: id,
          testEmail: body.testEmail || body.email,
          senderEmail: body.senderEmail,
          senderName: body.senderName,
          replyToEmail: body.replyToEmail,
          customSubject: body.subject,
          customBodyHtml: body.bodyHtml,
          customBodyText: body.bodyText,
        });
        break;
      default:
        return NextResponse.json(
          { success: false, message: `Unknown campaign action: ${action}` },
          { status: 400 }
        );
    }

    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    console.error('[Campaign POST Action Error]:', err);
    return NextResponse.json(
      { success: false, message: err.message },
      { status: 400 }
    );
  }
}
