import { NextResponse } from 'next/server';
import { sendLeadEmail } from '@/lib/services/emailService';

export async function POST(request) {
  try {
    const { leadId, subject, bodyHtml, bodyText, inboxId, templateId } = await request.json();

    if (!leadId || !subject || !bodyHtml) {
      return NextResponse.json({ success: false, message: 'leadId, subject, and bodyHtml are required' }, { status: 400 });
    }

    const result = await sendLeadEmail({
      leadId,
      subject,
      bodyHtml,
      bodyText,
      inboxId,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    console.error('[Send Email API] Error:', err);
    return NextResponse.json({ success: false, message: err.message }, { status: 400 });
  }
}
