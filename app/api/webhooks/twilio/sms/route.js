import { NextResponse } from 'next/server.js';
import { handleInboundSMS, verifyTwilioWebhookSignature } from '../../../../../lib/services/twilioService.js';

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

    // Cryptographic signature validation
    const isValid = verifyTwilioWebhookSignature(url, params, signature);
    if (!isValid) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Invalid Twilio signature' }, { status: 401 });
    }

    const From = params.From || '';
    const To = params.To || '';
    const Body = params.Body || '';
    const MessageSid = params.MessageSid || '';

    if (From && Body) {
      await handleInboundSMS({ From, To, Body, MessageSid });
    }

    return new Response('<Response></Response>', {
      headers: { 'Content-Type': 'text/xml' },
      status: 200,
    });
  } catch (err) {
    console.error('[Twilio Inbound SMS Webhook] Error:', err);
    return new Response('<Response></Response>', {
      headers: { 'Content-Type': 'text/xml' },
      status: 200,
    });
  }
}
