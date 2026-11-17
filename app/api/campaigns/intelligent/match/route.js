import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/middleware/authGuard';
import { runIntelligentMatching } from '@/lib/services/campaignMatchingEngine';
import { batchAnalyzeCompanies } from '@/lib/services/companyIntelligenceEngine';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const auth = await requireAuth(request);
  if (auth instanceof Response) return auth;

  try {
    const body = await request.json().catch(() => ({}));
    const {
      leadIds = [],
      autoApproveHighConfidence = false,
      manualOverrides = {},
      contactTargeting = {},
      runAiClassification = true,
      model = 'claude-sonnet-5-5',
      limit = 200
    } = body;

    // 1. Fetch leads
    let leadsQuery = supabaseAdmin
      .from('leads')
      .select('id, company, full_name, first_name, last_name, email, phone, website, industry, niche, notes, custom_fields, tags, status, is_dnc')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (Array.isArray(leadIds) && leadIds.length > 0) {
      leadsQuery = leadsQuery.in('id', leadIds);
    }

    const { data: leads, error: leadErr } = await leadsQuery;
    if (leadErr) {
      return NextResponse.json({ success: false, error: leadErr.message }, { status: 500 });
    }

    // 2. Fetch available email templates from Supabase
    const { data: templates, error: tplErr } = await supabaseAdmin
      .from('email_templates')
      .select('*')
      .order('created_at', { ascending: false });

    if (tplErr) {
      return NextResponse.json({ success: false, error: tplErr.message }, { status: 500 });
    }

    // 3. Optional MineTech AI Company Intelligence enrichment for leads without company_intelligence
    let enrichedLeads = (leads || []).map((l) => ({
      ...l,
      classification: l.classification || l.custom_fields?.classification || l.custom_fields?.company_intelligence?.buyer_seller_status || 'Unclassified'
    }));
    if (runAiClassification && enrichedLeads.length > 0) {
      const leadsNeedingIntel = enrichedLeads.filter(
        (l) => !l.custom_fields?.company_intelligence || l.classification === 'Unclassified'
      ).slice(0, 25); // Batch top 25 at a time for speed

      if (leadsNeedingIntel.length > 0) {
        await batchAnalyzeCompanies(leadsNeedingIntel, { concurrency: 4, model });
        
        // Re-fetch enriched leads
        const { data: refreshed } = await supabaseAdmin
          .from('leads')
          .select('id, company, full_name, first_name, last_name, email, phone, website, industry, niche, notes, custom_fields, tags, status, is_dnc')
          .in('id', enrichedLeads.map((l) => l.id));

        if (refreshed) {
          enrichedLeads = refreshed.map((l) => ({
            ...l,
            classification: l.classification || l.custom_fields?.classification || l.custom_fields?.company_intelligence?.buyer_seller_status || 'Unclassified'
          }));
        }
      }
    }

    // 4. Run Intelligent Matching Engine
    const matchingResult = await runIntelligentMatching({
      leads: enrichedLeads,
      templates: templates || [],
      autoApproveHighConfidence,
      manualOverrides,
      contactTargeting
    });

    return NextResponse.json({
      success: true,
      data: matchingResult
    });
  } catch (err) {
    console.error('[API /api/campaigns/intelligent/match Error]:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PATCH(request) {
  const auth = await requireAuth(request);
  if (auth instanceof Response) return auth;

  try {
    const body = await request.json();
    const { leadId, templateId, recipientType, productCategory, notes } = body;

    if (!leadId) {
      return NextResponse.json({ success: false, error: 'leadId is required' }, { status: 400 });
    }

    // Update lead custom_fields with manual matching override
    const { data: lead, error: fetchErr } = await supabaseAdmin
      .from('leads')
      .select('custom_fields')
      .eq('id', leadId)
      .single();

    if (fetchErr) {
      return NextResponse.json({ success: false, error: fetchErr.message }, { status: 404 });
    }

    const updatedCustom = {
      ...(lead.custom_fields || {}),
      manual_matching_override: {
        template_id: templateId,
        recipient_type: recipientType,
        product_category: productCategory,
        notes: notes || 'Manually assigned by user',
        updated_at: new Date().toISOString()
      }
    };

    const { data: updated, error: updateErr } = await supabaseAdmin
      .from('leads')
      .update({
        custom_fields: updatedCustom,
        updated_at: new Date().toISOString()
      })
      .eq('id', leadId)
      .select()
      .single();

    if (updateErr) {
      return NextResponse.json({ success: false, error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

