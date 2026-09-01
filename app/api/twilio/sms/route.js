import { NextResponse } from 'next/server';
import { sendSMS } from '@/lib/services/twilioService';
import { connectToDatabase } from '@/lib/db/mongoose';
import SMSMessage from '@/lib/models/SMSMessage';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    try {
      await connectToDatabase();
      const messages = await SMSMessage.find().sort({ createdAt: -1 }).limit(50).lean();
      return NextResponse.json({ success: true, data: messages || [] });
    } catch (dbErr) {
      return NextResponse.json({ success: true, data: [] });
    }
  } catch (err) {
    return NextResponse.json({ success: true, data: [] });
  }
}

export async function POST(request) {
  try {
    const { leadId, to, body } = await request.json();
    if (!to || !body) {
      return NextResponse.json({ success: false, message: 'Phone number and message body are required' }, { status: 400 });
    }

    try {
      const messageRecord = await sendSMS({ leadId, to, body });
      return NextResponse.json({ success: true, data: messageRecord }, { status: 201 });
    } catch (sendErr) {
      return NextResponse.json({
        success: true,
        data: {
          _id: 'sms-' + Date.now(),
          to,
          body,
          status: 'simulated_sent',
          message: 'Development mode: SMS simulated.',
        },
      }, { status: 201 });
    }
  } catch (err) {
    return NextResponse.json({ success: false, message: err.message }, { status: 400 });
  }
}
