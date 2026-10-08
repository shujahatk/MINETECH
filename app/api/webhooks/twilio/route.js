import { NextResponse } from 'next/server.js';
import { supabaseAdmin } from '../../../../lib/supabase.js';
import { verifyTwilioWebhookSignature } from '../../../../lib/services/twilioService.js';

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

    const callSid = params.CallSid;
    const callStatus = params.CallStatus || 'completed';
    const duration = parseInt(params.CallDuration || params.Duration || '0', 10);
    const recordingUrl = params.RecordingUrl || '';
    const leadId = params.LeadId || params.lead_id || null;
    const disposition = params.Disposition || callStatus;
    const notes = params.Notes || '';

    if (!callSid) {
      return new Response('Missing CallSid', { status: 400 });
    }

    const nowIso = new Date().toISOString();

    const callDoc = {
      call_sid: callSid,
      duration,
      status: callStatus,
      outcome: disposition,
      recording_url: recordingUrl,
      notes,
      updated_at: nowIso,
    };
    if (leadId) {
      callDoc.lead_id = leadId;
    }

    await supabaseAdmin
      .from('calls')
      .upsert(callDoc, { onConflict: 'call_sid' });

    return new Response('<Response></Response>', {
      status: 200,
      headers: { 'Content-Type': 'text/xml' },
    });
  } catch (err) {
    console.error('[Twilio Webhook Error]:', err.message);
    return new Response('Internal Server Error', { status: 500 });
  }
}
