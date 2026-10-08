import { NextResponse } from 'next/server.js';
import { supabaseAdmin } from '../../../../../lib/supabase.js';
import { verifyTwilioWebhookSignature } from '../../../../../lib/services/twilioService.js';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const url = request.url;
    const signature = request.headers.get('x-twilio-signature') || '';

    const formData = await request.formData();
    const params = {};
    for (const [key, value] of formData.entries()) {
      params[key] = value;
    }

    // Cryptographic validation
    const isValid = verifyTwilioWebhookSignature(url, params, signature);
    if (!isValid) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Invalid Twilio signature' }, { status: 401 });
    }

    const messageSid = params.MessageSid;
    const messageStatus = params.MessageStatus;

    if (messageSid) {
      const updateData = {
        updated_at: new Date().toISOString(),
      };
      if (messageStatus) updateData.status = messageStatus;

      await supabaseAdmin
        .from('sms_messages')
        .update(updateData)
        .eq('message_sid', messageSid);
    }

    return new Response('<Response></Response>', {
      headers: { 'Content-Type': 'text/xml' },
      status: 200,
    });
  } catch (err) {
    console.error('[SMS Status Webhook] Error:', err);
    return new Response('Internal Server Error', { status: 500 });
  }
}
