import { NextResponse } from 'next/server';
import { processInboundEmail } from '@/lib/services/inboundEmailService';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const contentType = request.headers.get('content-type') || '';
    let emailData = {};

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      emailData = {
        from: formData.get('from') || '',
        to: formData.get('to') || '',
        subject: formData.get('subject') || '(No Subject)',
        text: formData.get('text') || '',
        html: formData.get('html') || '',
        messageId: formData.get('message-id') || formData.get('headers')?.match(/Message-ID:\s*([^\r\n]+)/i)?.[1] || '',
        inReplyTo: formData.get('in-reply-to') || formData.get('headers')?.match(/In-Reply-To:\s*([^\r\n]+)/i)?.[1] || '',
      };
    } else {
      emailData = await request.json();
    }

    try {
      const result = await processInboundEmail(emailData);
      return NextResponse.json({ success: true, data: result });
    } catch (processErr) {
      console.warn('[Inbound Email Webhook] Processing in fallback mode:', processErr.message);
      return NextResponse.json({
        success: true,
        data: {
          received: true,
          from: emailData.from,
          subject: emailData.subject,
          fallback: true,
        },
      });
    }
  } catch (err) {
    console.error('[Inbound Email Webhook] Error:', err);
    return NextResponse.json({ success: false, message: err.message }, { status: 400 });
  }
}
