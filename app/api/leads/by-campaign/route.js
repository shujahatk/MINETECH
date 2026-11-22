import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/middleware/authGuard';

export const dynamic = 'force-dynamic';

function getLeadClassification(lead) {
  const cf = lead?.custom_fields || {};
  const c = lead?.classification || cf.classification;
  if (c === 'Buyer' || c === 'Seller') return c;
  if (c === 'Unclassified') return 'Unclassified';
  const st = (cf.supplier_type || cf.company_type || '').toLowerCase();
  if (st.includes('buyer') || st.includes('client') || st.includes('customer') || st.includes('purchaser')) return 'Buyer';
  if (st.includes('producer') || st.includes('processor') || st.includes('supplier') || st.includes('vendor') || st.includes('mine')) return 'Seller';
  return 'Unclassified';
}

function escapeCsvField(val) {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

export async function GET(request) {
  const auth = await requireAuth(request);
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const campaignId = searchParams.get('campaignId');
    const classificationFilter = searchParams.get('classification'); // 'Buyer', 'Seller', 'Unclassified'
    const statusFilter = searchParams.get('status'); // 'DELIVERED', 'OPENED', 'REPLIED', 'BOUNCED', etc.
    const search = (searchParams.get('search') || '').toLowerCase().trim();
    const format = searchParams.get('format'); // 'csv'

    // If no campaignId provided, return campaign list with breakdown counts
    if (!campaignId) {
      const { data: campaigns, error: campErr } = await supabaseAdmin
        .from('email_campaigns')
        .select('id, name, status, created_at, updated_at')
        .neq('status', 'SETTINGS')
        .order('created_at', { ascending: false });

      if (campErr) throw campErr;

      // Fetch all recipients to calculate exact breakdown per campaign
      const { data: recipients, error: recErr } = await supabaseAdmin
        .from('email_recipients')
        .select('campaign_id, status, lead:leads(id, custom_fields)');

      if (recErr) throw recErr;

      const campaignMap = {};
      (campaigns || []).forEach((c) => {
        campaignMap[c.id] = {
          id: c.id,
          name: c.name || 'Untitled Campaign',
          status: c.status || 'DRAFT',
          createdAt: c.created_at,
          updatedAt: c.updated_at,
          totalLeads: 0,
          buyersCount: 0,
          sellersCount: 0,
          unclassifiedCount: 0,
          deliveredCount: 0,
          openedCount: 0,
          repliedCount: 0,
          bouncedCount: 0,
        };
      });

      (recipients || []).forEach((r) => {
        const item = campaignMap[r.campaign_id];
        if (item) {
          item.totalLeads++;
          const cls = getLeadClassification(r.lead);
          if (cls === 'Buyer') item.buyersCount++;
          else if (cls === 'Seller') item.sellersCount++;
          else item.unclassifiedCount++;

          const st = (r.status || '').toUpperCase();
          if (st === 'DELIVERED') item.deliveredCount++;
          else if (st === 'OPENED') item.openedCount++;
          else if (st === 'REPLIED') item.repliedCount++;
          else if (st === 'BOUNCED') item.bouncedCount++;
        }
      });

      return NextResponse.json({
        success: true,
        data: Object.values(campaignMap),
      });
    }

    // Specific Campaign Leads View
    const { data: campaign, error: campErr } = await supabaseAdmin
      .from('email_campaigns')
      .select('id, name, status, created_at')
      .eq('id', campaignId)
      .maybeSingle();

    if (campErr || !campaign) {
      return NextResponse.json({ success: false, message: 'Campaign not found' }, { status: 404 });
    }

    let query = supabaseAdmin
      .from('email_recipients')
      .select('id, campaign_id, lead_id, status, sent_at, opened_at, replied_at, bounced_at, lead:leads(id, full_name, email, company, job_title, status, score, tags, custom_fields)')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: false });

    if (statusFilter && statusFilter !== 'ALL') {
      query = query.eq('status', statusFilter.toUpperCase());
    }

    const { data: recipients, error: recErr } = await query;
    if (recErr) throw recErr;

    let leads = (recipients || []).map((r) => {
      const lead = r.lead || {};
      const classification = getLeadClassification(lead);
      return {
        recipientId: r.id,
        leadId: r.lead_id,
        emailStatus: r.status || 'PENDING',
        sentAt: r.sent_at,
        openedAt: r.opened_at,
        repliedAt: r.replied_at,
        bouncedAt: r.bounced_at,
        fullName: lead.full_name || 'Prospect',
        email: lead.email || '',
        company: lead.company || '',
        jobTitle: lead.job_title || '',
        classification,
        leadStatus: lead.status || 'NEW',
        score: lead.score || 85,
        tags: lead.tags || [],
        productCategory: lead.custom_fields?.product_category || lead.custom_fields?.materials || '',
        country: lead.custom_fields?.country || '',
      };
    });

    // Apply classification filter
    if (classificationFilter && classificationFilter !== 'ALL') {
      leads = leads.filter((l) => l.classification === classificationFilter);
    }

    // Apply search filter
    if (search) {
      leads = leads.filter(
        (l) =>
          (l.fullName || '').toLowerCase().includes(search) ||
          (l.email || '').toLowerCase().includes(search) ||
          (l.company || '').toLowerCase().includes(search) ||
          (l.productCategory || '').toLowerCase().includes(search)
      );
    }

    // CSV Export option
    if (format === 'csv') {
      const headers = ['Lead Name', 'Email', 'Company', 'Job Title', 'Classification', 'Email Status', 'Lead Status', 'Product Category', 'Country', 'Sent At', 'Opened At', 'Replied At'];
      const csvRows = [headers.join(',')];

      leads.forEach((l) => {
        const row = [
          escapeCsvField(l.fullName),
          escapeCsvField(l.email),
          escapeCsvField(l.company),
          escapeCsvField(l.jobTitle),
          escapeCsvField(l.classification),
          escapeCsvField(l.emailStatus),
          escapeCsvField(l.leadStatus),
          escapeCsvField(l.productCategory),
          escapeCsvField(l.country),
          escapeCsvField(l.sentAt),
          escapeCsvField(l.openedAt),
          escapeCsvField(l.repliedAt),
        ];
        csvRows.push(row.join(','));
      });

      const csvContent = csvRows.join('\r\n');
      const filename = `campaign-${campaign.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-leads.csv`;

      return new Response(csvContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }

    // Calculate breakdown counts for this campaign
    const counts = {
      total: leads.length,
      buyers: leads.filter((l) => l.classification === 'Buyer').length,
      sellers: leads.filter((l) => l.classification === 'Seller').length,
      unclassified: leads.filter((l) => l.classification === 'Unclassified').length,
      delivered: leads.filter((l) => (l.emailStatus || '').toUpperCase() === 'DELIVERED').length,
      opened: leads.filter((l) => (l.emailStatus || '').toUpperCase() === 'OPENED').length,
      replied: leads.filter((l) => (l.emailStatus || '').toUpperCase() === 'REPLIED').length,
      bounced: leads.filter((l) => (l.emailStatus || '').toUpperCase() === 'BOUNCED').length,
    };

    return NextResponse.json({
      success: true,
      campaign,
      counts,
      leads,
    });
  } catch (err) {
    console.error('[Campaign Leads API] Error:', err);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

