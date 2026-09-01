import { NextResponse } from 'next/server';
import { handleListmonkWebhook } from '@/lib/services/listmonkService';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const payload = await request.json();
    const result = await handleListmonkWebhook(payload);
    return NextResponse.json(result);
  } catch (err) {
    console.error('[Listmonk Webhook] Error:', err);
    return NextResponse.json({ success: false, message: err.message }, { status: 400 });
  }
}

export async function GET() {
  return NextResponse.json({ status: 'Listmonk webhook endpoint active' });
}
