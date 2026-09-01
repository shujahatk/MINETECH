import { handleInboundSMS } from '@/lib/services/twilioService';

export async function POST(request) {
  try {
    const formData = await request.formData();
    const From = formData.get('From') || '';
    const To = formData.get('To') || '';
    const Body = formData.get('Body') || '';
    const MessageSid = formData.get('MessageSid') || '';

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
