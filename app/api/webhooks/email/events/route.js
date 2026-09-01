import { NextResponse } from 'next/server';
import { processEmailEvent } from '@/lib/services/inboundEmailService';

export async function POST(request) {
  try {
    const events = await request.json();

    if (Array.isArray(events)) {
      for (const ev of events) {
        await processEmailEvent({
          event: ev.event,
          email: ev.email,
          messageId: ev['smtp-id'] || ev.sg_message_id,
          campaignId: ev.campaignId,
        });
      }
    } else if (events && events.event) {
      await processEmailEvent(events);
    }

    return NextResponse.json({ success: true, message: 'Events processed' });
  } catch (err) {
    console.error('[Email Events Webhook] Error:', err);
    return NextResponse.json({ success: true, message: 'Processed with errors' });
  }
}
