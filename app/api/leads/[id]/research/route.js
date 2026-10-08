import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/middleware/authGuard';
import { getLeadById } from '@/lib/services/leadService';
import { researchLeadProfile } from '@/lib/services/aiService';
import Lead from '@/lib/models/Lead';

export const dynamic = 'force-dynamic';

export async function POST(request, { params }) {
  const auth = await requireAuth(request);
  if (auth instanceof Response) return auth;

  try {
    const leadId = params.id;
    const lead = await getLeadById(leadId);
    if (!lead) return NextResponse.json({ success: false, error: 'Lead not found' }, { status: 404 });

    const research = await researchLeadProfile({
      leadContext: {
        name: lead.fullName || `${lead.firstName || ''} ${lead.lastName || ''}`.trim(),
        company: lead.company,
        jobTitle: lead.jobTitle,
        industry: lead.industry || lead.niche,
        notes: lead.notes,
      },
    });

    // Persist research into lead document
    await Lead.findByIdAndUpdate(leadId, {
      aiResearch: {
        ...research,
        researchedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, data: research });
  } catch (err) {
    console.error('[Lead Research API Error]:', err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
