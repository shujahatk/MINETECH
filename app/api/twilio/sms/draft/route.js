import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/middleware/authGuard';
import { generateSMSDraft } from '@/lib/services/aiService';
import { getLeadById } from '@/lib/services/leadService';

export const dynamic = 'force-dynamic';

/**
 * POST /api/twilio/sms/draft
 * Generate concise SMS using Stored AI Lead Study
 */
export async function POST(request) {
  const auth = await requireAuth(request);
  if (!auth.authenticated) return auth.response;

  try {
    const body = await request.json();
    const {
      leadId,
      objective = 'Quick introduction and meeting confirmation',
    } = body;

    let leadContext = {};
    let leadStudy = null;

    if (leadId) {
      const lead = await getLeadById(leadId);
      if (lead) {
        leadContext = {
          firstName: lead.firstName || lead.full_name?.split(' ')[0],
          fullName: lead.fullName || lead.full_name,
          company: lead.company,
          industry: lead.industry,
        };
        leadStudy = lead.enrich_data?.ai_intelligence || lead.custom_fields?.ai_intelligence;
      }
    }

    const draft = await generateSMSDraft({
      leadId,
      leadContext,
      leadStudy,
      objective,
    });

    return NextResponse.json({
      success: true,
      data: draft,
    });
  } catch (err) {
    console.error('[API/sms/draft] error:', err);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
