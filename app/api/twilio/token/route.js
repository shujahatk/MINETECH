import { NextResponse } from 'next/server';
import { generateVoiceToken } from '@/lib/services/twilioService';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    try {
      const token = generateVoiceToken('rep_1');
      return NextResponse.json({ success: true, token, identity: 'rep_1', isLive: true });
    } catch (tokenErr) {
      // Graceful fallback for local development without Twilio credentials
      return NextResponse.json({
        success: true,
        token: 'dev-mode-token',
        identity: 'rep_1',
        isLive: false,
        message: 'Twilio credentials not configured. Running in development preview mode.',
      });
    }
  } catch (err) {
    return NextResponse.json({ success: false, message: err.message }, { status: 400 });
  }
}
