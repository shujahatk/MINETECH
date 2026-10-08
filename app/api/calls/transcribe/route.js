import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/middleware/authGuard';
import { summarizeCallTranscript, generateSalesCoaching } from '@/lib/services/aiService';
import Call from '@/lib/models/Call';
import ActivityLog from '@/lib/models/ActivityLog';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const auth = await requireAuth(request);
  if (auth instanceof Response) return auth;

  try {
    const body = await request.json();
    const { callId, transcript = '', leadContext = {}, outcome = 'Completed' } = body;

    const [summary, coaching] = await Promise.all([
      summarizeCallTranscript({ transcript, leadContext }),
      generateSalesCoaching({ transcript, outcome }),
    ]);

    if (callId) {
      await Call.findByIdAndUpdate(callId, {
        summary: summary.executiveSummary,
        aiAnalysis: {
          ...summary,
          coaching,
          analyzedAt: new Date(),
        },
      }).catch(() => null);

      if (leadContext.leadId) {
        await ActivityLog.create({
          leadId: leadContext.leadId,
          userId: auth.user?.id,
          action: 'CALL_ANALYZED',
          channel: 'call',
          direction: 'system',
          summary: `AI Call Analysis: ${summary.prospectInterest} Interest — ${summary.recommendedNextAction}`,
          details: { summary, coaching },
          timestamp: new Date(),
        }).catch(() => null);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        summary,
        coaching,
      },
    });
  } catch (err) {
    console.error('[Call Transcription API Error]:', err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
