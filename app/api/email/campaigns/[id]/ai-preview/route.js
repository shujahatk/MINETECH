import { NextResponse } from 'next/server';
import { requireAuth, requireAdmin } from '@/lib/auth/adminGuard';
import { supabaseAdmin } from '@/lib/supabase';
import { runAiGenerationWorker } from '@/lib/workers/aiGenerationWorker';
import { runEmailBlastWorker } from '@/lib/workers/emailBlastWorker';

export const dynamic = 'force-dynamic';

/**
 * GET /api/email/campaigns/[id]/ai-preview
 * Returns generation progress and sample generated emails from Supabase
 */
export async function GET(request, { params }) {
  const auth = await requireAuth(request);
  if (auth instanceof Response || auth instanceof NextResponse) return auth;

  try {
    const { id } = params;

    const { data: campaign, error: campErr } = await supabaseAdmin
      .from('email_campaigns')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (campErr || !campaign) {
      return NextResponse.json(
        { success: false, error: 'Campaign not found' },
        { status: 404 }
      );
    }

    // Fetch up to 200 recipients from Supabase
    const { data: recipients, error: recErr } = await supabaseAdmin
      .from('email_recipients')
      .select('*')
      .eq('campaign_id', id)
      .order('created_at', { ascending: true })
      .limit(200);

    const recList = recipients || [];
    let pending = 0;
    let generating = 0;
    let ready = 0;
    let failed = 0;

    const leadIdsToFetch = recList
      .slice(0, 10)
      .map((r) => r.lead_id)
      .filter(Boolean);

    let leadsMap = {};
    if (leadIdsToFetch.length > 0) {
      const { data: leads } = await supabaseAdmin
        .from('leads')
        .select('id, full_name, first_name, last_name, company, job_title, industry, email, website')
        .in('id', leadIdsToFetch);

      if (leads) {
        leadsMap = leads.reduce((acc, l) => {
          acc[l.id] = l;
          return acc;
        }, {});
      }
    }

    const samples = [];
    for (const rec of recList) {
      const status = rec.generation_status || rec.tokens?.generation_status || 'ready';
      if (status === 'pending') pending++;
      else if (status === 'generating') generating++;
      else if (status === 'ready') ready++;
      else if (status === 'failed') failed++;

      if (samples.length < 5) {
        const lead = leadsMap[rec.lead_id];
        const leadInfo = {
          name: lead?.full_name || lead?.first_name || rec.tokens?.firstName || 'Prospect',
          company: lead?.company || rec.tokens?.company || 'Company',
          industry: lead?.industry || 'B2B',
          jobTitle: lead?.job_title || rec.tokens?.jobTitle || 'Executive',
          email: rec.email,
          website: lead?.website || '',
        };

        samples.push({
          recipientId: rec.id,
          lead: leadInfo,
          subject: rec.generated_subject || rec.tokens?.generated_subject || campaign.subject,
          body: rec.generated_body || rec.tokens?.generated_body || rec.tokens?.bodyText || campaign.body_plain || campaign.body_html,
          generationStatus: status,
          generationError: rec.error_message || rec.tokens?.generation_error || '',
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        campaignId: id,
        campaignName: campaign.name,
        masterPrompt: campaign.master_prompt || campaign.stats?.master_prompt || '',
        totalRecipients: recList.length,
        generationStats: {
          total: recList.length,
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
 * Triggers batch generation, retries failed rows, or approves & launches
 */
export async function POST(request, { params }) {
  const auth = await requireAdmin(request);
  if (auth instanceof Response || auth instanceof NextResponse) return auth;

  try {
    const { id } = params;
    const body = await request.json().catch(() => ({}));
    const action = body.action || 'generate'; // 'generate' | 'retry_failed' | 'approve_and_launch'

    const { data: campaign, error: campErr } = await supabaseAdmin
      .from('email_campaigns')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (campErr || !campaign) {
      return NextResponse.json({ success: false, error: 'Campaign not found' }, { status: 404 });
    }

    if (action === 'generate') {
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
      const nowIso = new Date().toISOString();
      await supabaseAdmin
        .from('email_recipients')
        .update({
          generation_status: 'pending',
          error_message: null,
          updated_at: nowIso,
        })
        .eq('campaign_id', id)
        .eq('generation_status', 'failed');

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
      const { data: recipients } = await supabaseAdmin
        .from('email_recipients')
        .select('id, generation_status, tokens')
        .eq('campaign_id', id);

      const unready = (recipients || []).filter((r) => {
        const genStatus = r.generation_status || r.tokens?.generation_status || 'ready';
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

      await supabaseAdmin
        .from('email_campaigns')
        .update({
          status: 'RUNNING',
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

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
