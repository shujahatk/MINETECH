import { NextResponse } from 'next/server';
import { generateAIEmailDraft } from '@/lib/services/aiService';
import { requireAuth } from '@/lib/middleware/authGuard';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const auth = await requireAuth(request);
  if (!auth.authenticated || auth instanceof Response) {
    return auth instanceof Response ? auth : auth.response;
  }

  try {
    const body = await request.json();
    const prompt = body.prompt || body.valueProp || body.topic || '';
    const tone = body.tone || 'Professional';
    const goal = body.goal || 'Cold Outreach';
    const leadContext = body.leadContext || {
      name: body.leadName || body.name || '',
      company: body.company || '',
      jobTitle: body.jobTitle || body.title || '',
      industry: body.industry || body.niche || '',
      notes: body.notes || '',
    };

    const result = await generateAIEmailDraft({
      prompt,
      tone,
      goal,
      leadContext,
      leadId: body.leadId || null,
      campaignId: body.campaignId || null,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    console.error('[AI Draft API Error]:', err.message);
    return NextResponse.json({ success: false, message: err.message }, { status: 400 });
  }
}
