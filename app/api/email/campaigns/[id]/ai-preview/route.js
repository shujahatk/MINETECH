import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/adminGuard';
import { supabaseAdmin } from '@/lib/supabase';
import EmailCampaign from '@/lib/models/EmailCampaign';
import EmailRecipient from '@/lib/models/EmailRecipient';
import Lead from '@/lib/models/Lead';
import { runAiGenerationWorker } from '@/lib/workers/aiGenerationWorker';
import { runEmailBlastWorker } from '@/lib/workers/emailBlastWorker';

export const dynamic = 'force-dynamic';

/**
 * GET /api/email/campaigns/[id]/ai-preview
 * Returns generation progress and 3-5 sample generated emails for review
 */
export async function GET(request, { params }) {
  const auth = await requireAuth(request);
  if (auth instanceof Response || auth instanceof NextResponse) return auth;

  try {
    const { id } = params;
    const campaign = await EmailCampaign.findById(id);
    if (!campaign) {
      return NextResponse.json({ success: false, error: 'Campaign not found' }, { status: 404 });
    }

    // Fetch all recipients for this campaign
    const recipients = await EmailRecipient.find({ campaignId: id }).limit(200);

    let total = recipients.length;
    let pending = 0;
    let generating = 0;
    let ready = 0;
    let failed = 0;

    const samples = [];

    for (const rec of recipients) {
      const status = rec.generationStatus || rec.tokens?.generation_status || 'ready';
      if (status === 'pending') pending++;
      else if (status === 'generating') generating++;
      else if (status === 'ready') ready++;
      else if (status === 'failed') failed++;

      if (samples.length < 5) {
        let leadInfo = { name: 'Prospect', company: 'Company', email: rec.email };
        if (rec.leadId || rec.lead_id) {
          const lead = await Lead.findById(rec.leadId || rec.lead_id).catch(() => null);
          if (lead) {
            leadInfo = {
              name: lead.fullName || lead.firstName || 'Prospect',
              company: lead.company || 'Company',
              industry: lead.industry || lead.niche || 'B2B',
              jobTitle: lead.jobTitle || 'Executive',
              email: lead.email,
              website: lead.website || '',
            };
          }
        }

        samples.push({
          recipientId: rec.id,
          lead: leadInfo,
          subject: rec.generatedSubject || rec.tokens?.generated_subject || rec.subject || campaign.subject,
          body: rec.generatedBody || rec.tokens?.generated_body || rec.bodyText || rec.bodyHtml,
          generationStatus: status,
          generationError: rec.generationError || rec.tokens?.generation_error || '',
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        campaignId: id,
        campaignName: campaign.name,
        masterPrompt: campaign.masterPrompt || campaign.master_prompt || campaign.stats?.master_prompt || '',
        stats: {
          total,
          pending,
          generating,
          ready,
          failed,
        },
        samples,
      },
    });
  } catch (err) {
    console.error('[AI Preview GET Error]:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/email/campaigns/[id]/ai-preview
 * Triggers batch generation, retries failed generation rows, or approves & sends
 */
export async function POST(request, { params }) {
  const auth = await requireAuth(request);
  if (auth instanceof Response || auth instanceof NextResponse) return auth;

  try {
    const { id } = params;
    const body = await request.json().catch(() => ({}));
    const action = body.action || 'generate'; // 'generate' | 'retry_failed' | 'approve_and_launch'

    const campaign = await EmailCampaign.findById(id);
    if (!campaign) {
      return NextResponse.json({ success: false, error: 'Campaign not found' }, { status: 404 });
    }

    if (action === 'generate') {
      // Run generation worker in background
      runAiGenerationWorker(id, { concurrency: 3 }).catch((e) =>
        console.error('[AI Preview Background Worker Error]:', e.message)
      );

      return NextResponse.json({
        success: true,
        message: 'AI generation started in background',
        status: 'generating',
      });
    }

    if (action === 'retry_failed') {
      // Reset failed recipients to pending
      const recipients = await EmailRecipient.find({ campaignId: id });
      for (const rec of recipients) {
        const genStatus = rec.generationStatus || rec.tokens?.generation_status;
        if (genStatus === 'failed') {
          const updatedTokens = {
            ...(rec.tokens || {}),
            generation_status: 'pending',
            generation_error: '',
          };
          await EmailRecipient.findByIdAndUpdate(rec.id, { tokens: updatedTokens });
        }
      }

      runAiGenerationWorker(id, { concurrency: 3 }).catch((e) =>
        console.error('[AI Preview Retry Worker Error]:', e.message)
      );

      return NextResponse.json({
        success: true,
        message: 'Retrying failed generation rows in background',
        status: 'generating',
      });
    }

    if (action === 'approve_and_launch') {
      // Require all generation to be completed before launch
      const recipients = await EmailRecipient.find({ campaignId: id });
      const unready = recipients.filter((r) => {
        const genStatus = r.generationStatus || r.tokens?.generation_status || 'ready';
        return genStatus !== 'ready';
      });

      if (unready.length > 0) {
        return NextResponse.json(
          {
            success: false,
            error: `Cannot launch campaign: ${unready.length} recipient(s) are not ready (pending, generating, or failed).`,
          },
          { status: 400 }
        );
      }

      // Mark campaign as running and trigger email blast worker
      campaign.status = 'RUNNING';
      await campaign.save();

      runEmailBlastWorker(id).catch((e) =>
        console.error('[Blast Worker Launch Error]:', e.message)
      );

      return NextResponse.json({
        success: true,
        message: 'Campaign approved and launched successfully',
        status: 'RUNNING',
      });
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    console.error('[AI Preview POST Error]:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
