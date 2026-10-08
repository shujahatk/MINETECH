import { NextResponse } from 'next/server.js';
import { terminateCall } from '../../../../../lib/services/twilioService.js';
import { requireAuth } from '../../../../../lib/middleware/authGuard.js';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const auth = await requireAuth(request);
  if (auth instanceof Response) return auth;

  try {
    const { callSid } = await request.json();
    if (!callSid) {
      return NextResponse.json({ success: false, error: 'Call SID is required' }, { status: 400 });
    }

    const updatedCall = await terminateCall(callSid);
    return NextResponse.json({ success: true, data: updatedCall });
  } catch (err) {
    console.error('[Twilio Terminate Call Error]:', err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
