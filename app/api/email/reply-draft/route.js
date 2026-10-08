import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/middleware/authGuard';
import { generateFollowUpEmailDraft } from '@/lib/services/aiService';
import { getLeadById } from '@/lib/services/leadService';

export const dynamic = 'force-dynamic';

/**
 * POST /api/email/reply-draft
 * Context-aware follow-up reply draft using Stored AI Lead Study + thread history
 */
export async function POST(request) {
  const auth = await requireAuth(request);
  if (!auth.authenticated) return auth.response;

  try {
    const body = await request.json();
    const {
      leadId,
      previousEmail = '',
      recipientReply = '',
      threadHistory = [],
      objective = 'Advance to technical evaluation and sample request',
      tone = 'Consultative',
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
          jobTitle: lead.jobTitle || lead.job_title,
          notes: lead.notes,
        };
        leadStudy = lead.enrich_data?.ai_intelligence || lead.custom_fields?.ai_intelligence;
      }
    }

    const draft = await generateFollowUpEmailDraft({
      leadId,
      leadContext,
      leadStudy,
      previousEmail,
      recipientReply,
      threadHistory,
      objective,
      tone,
    });

    return NextResponse.json({
      success: true,
      data: draft,
    });
  } catch (err) {
    console.error('[API/reply-draft] error:', err);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
