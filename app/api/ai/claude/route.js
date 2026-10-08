import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/middleware/authGuard';
import {
  generateAIEmailDraft,
  personalizeLeadHook,
  regenerateEmailCopy,
} from '@/lib/services/aiService';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const auth = await requireAuth(request);
  if (auth instanceof Response) return auth;

  try {
    const body = await request.json();
    const { action, prompt, tone, goal, leadContext, previousDraft, feedback } = body;

    if (action === 'generate') {
      const result = await generateAIEmailDraft({ prompt, tone, goal, leadContext });
      return NextResponse.json({ success: true, data: result });
    }

    if (action === 'personalize') {
      const result = await personalizeLeadHook({ leadContext, tone, customInstruction: prompt });
      return NextResponse.json({ success: true, data: result });
    }

    if (action === 'regenerate') {
      const result = await regenerateEmailCopy({ previousDraft, feedback, tone });
      return NextResponse.json({ success: true, data: result });
    }

    return NextResponse.json({ success: false, error: 'Unknown action parameter' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
