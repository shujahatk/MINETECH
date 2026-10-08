import { NextResponse } from 'next/server';
import { sendSMS } from '@/lib/services/twilioService';
import { connectToDatabase } from '@/lib/db/mongoose';
import SMSMessage from '@/lib/models/SMSMessage';
import Lead from '@/lib/models/Lead';
import { isLeadSuppressed } from '@/lib/services/leadService';
import { requireAuth } from '@/lib/middleware/authGuard';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const auth = await requireAuth(request);
  if (auth instanceof Response) return auth;

  try {
    await connectToDatabase();
    const messages = await SMSMessage.find().sort({ createdAt: -1 }).limit(50).lean();
    return NextResponse.json({ success: true, data: messages || [] });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  const auth = await requireAuth(request);
  if (auth instanceof Response) return auth;

  try {
    const { leadId, to, body } = await request.json();
    if (!to || !body || !body.trim()) {
      return NextResponse.json({ success: false, error: 'Phone number and message body are required' }, { status: 400 });
    }

    await connectToDatabase();

    // DNC & Suppression check
    if (leadId) {
      const lead = await Lead.findById(leadId);
      if (lead && isLeadSuppressed(lead, 'sms')) {
        return NextResponse.json(
          { success: false, error: 'Cannot send SMS: Lead phone/SMS channel is suppressed by DNC policy.' },
          { status: 403 }
        );
      }
    }

    const messageRecord = await sendSMS({ leadId, to, body });
    return NextResponse.json({ success: true, data: messageRecord }, { status: 201 });
  } catch (err) {
    console.error('[Twilio SMS Error]:', err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}
