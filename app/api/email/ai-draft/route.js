import { NextResponse } from 'next/server';
import { generateAIEmailDraft } from '@/lib/services/aiService';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const body = await request.json();
    const prompt = body.prompt || body.valueProp || body.topic || '';
    const tone = body.tone || 'Professional';
    const goal = body.goal || 'Cold Outreach';
    const leadContext = body.leadContext || {
      name: body.leadName || body.name || '',
      company: body.company || '',
      jobTitle: body.jobTitle || body.title || '',
    };

    const result = await generateAIEmailDraft({ prompt, tone, goal, leadContext });
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    return NextResponse.json({ success: false, message: err.message }, { status: 400 });
  }
}
