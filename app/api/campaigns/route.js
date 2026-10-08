import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth/adminGuard';
import {
  checkListmonkHealth,
  getOrCreateList,
  syncSubscribersToListmonk,
  createListmonkCampaign,
  updateListmonkCampaignStatus,
} from '@/lib/services/listmonkService';
import { runEmailBlastWorker } from '@/lib/workers/emailBlastWorker';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { data: campaigns, error } = await supabaseAdmin
      .from('email_campaigns')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: campaigns || [] });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const { name, subject, body_html, bodyHtml, body_text, bodyText, lead_ids, leadIds, template_id, sending_inbox_id } = body;

    const emailSubject = subject || 'Outbound Update';
    const emailHtml = body_html || bodyHtml || '<p>Hello {{firstName}},</p>';
    const emailText = body_text || bodyText || '';
    const rawLeadIds = lead_ids || leadIds || [];

    if (!name || !emailSubject || !emailHtml) {
      return NextResponse.json(
        { success: false, error: 'Campaign name, subject, and body are required' },
        { status: 400 }
      );
    }

    const nowIso = new Date().toISOString();

    // 1. Fetch Candidate Leads
    let leads = [];
    if (Array.isArray(rawLeadIds) && rawLeadIds.length > 0) {
      const { data: leadData } = await supabaseAdmin
        .from('leads')
        .select('*')
        .in('id', rawLeadIds);
      leads = leadData || [];
    } else {
      const { data: leadData } = await supabaseAdmin
        .from('leads')
        .select('*')
        .limit(500);
      leads = leadData || [];
    }

    // 2. Filter against DNC / Suppression
    const eligibleLeads = [];
    let suppressedCount = 0;

    for (const lead of leads) {
      const email = (lead.email || '').trim().toLowerCase();
      if (!email) continue;

      const isSuppressed = Boolean(
        lead.is_dnc ||
        lead.status === 'DO_NOT_CONTACT' ||
        lead.status === 'DNC'
      );

      if (isSuppressed) {
        suppressedCount++;
      } else {
        eligibleLeads.push(lead);
      }
    }

    // 3. Create Campaign Record in Supabase
    const { data: campaign, error: campErr } = await supabaseAdmin
      .from('email_campaigns')
      .insert({
        name,
        subject: emailSubject,
        body_html: emailHtml,
        body_plain: emailText,
        status: 'RUNNING',
        template_id: template_id || null,
        sending_inbox_id: sending_inbox_id || null,
        stats: {
          total: eligibleLeads.length,
          sent: 0,
          delivered: 0,
          opened: 0,
          clicked: 0,
          replied: 0,
          bounced: 0,
          failed: 0,
          suppressed: suppressedCount,
        },
        created_at: nowIso,
        updated_at: nowIso,
      })
      .select()
      .single();

    if (campErr || !campaign) {
      throw new Error(campErr?.message || 'Failed to create campaign record');
    }

    const campaignId = campaign.id;

    // 4. Bulk Insert Records into email_recipients with status: 'PENDING'
    if (eligibleLeads.length > 0) {
      const recipientDocs = eligibleLeads.map((lead) => ({
        campaign_id: campaignId,
        lead_id: lead.id,
        email: lead.email.toLowerCase().trim(),
        status: 'PENDING',
        scheduled_at: nowIso,
        created_at: nowIso,
        updated_at: nowIso,
      }));

      await supabaseAdmin
        .from('email_recipients')
        .upsert(recipientDocs, { onConflict: 'campaign_id,lead_id', ignoreDuplicates: true });
    }

    // 5. Call Listmonk API if available
    let listmonkInfo = null;
    try {
      const lmHealth = await checkListmonkHealth();
      if (lmHealth.connected) {
        const listId = await getOrCreateList(`80/20 - ${name}`);
        const syncRes = await syncSubscribersToListmonk(eligibleLeads, listId);
        const lmCamp = await createListmonkCampaign({
          name,
          subject: emailSubject,
          bodyHtml: emailHtml,
          listIds: [listId],
        });

        if (lmCamp.success) {
          listmonkInfo = { campaignId: lmCamp.campaignId, synced: syncRes.synced, status: 'draft' };
          // Application-managed blasts are executed exclusively by emailBlastWorker. Listmonk-synchronized campaigns remain draft to prevent duplicate delivery.
        }
      }
    } catch (lmErr) {
      console.warn('[Listmonk Integration] Synced in background fallback mode:', lmErr.message);
    }

    // 6. Dispatch Background Worker Immediately without blocking HTTP response
    runEmailBlastWorker(campaignId).catch((err) => {
      console.error('[Background Worker Error]:', err.message);
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          id: campaignId,
          _id: campaignId,
          name,
          status: 'RUNNING',
          total_recipients: eligibleLeads.length,
          suppressed_count: suppressedCount,
          listmonk: listmonkInfo,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error('[Campaign API Error]:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

