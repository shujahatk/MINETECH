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

    // Cryptographic signature validation
    const isValid = verifyTwilioWebhookSignature(url, params, signature);
    if (!isValid) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Invalid Twilio signature' }, { status: 401 });
    }

    const callSid = params.CallSid;
    const callStatus = params.CallStatus;
    const callDuration = params.CallDuration ? parseInt(params.CallDuration, 10) : 0;
    const recordingUrl = params.RecordingUrl || '';
    const recordingSid = params.RecordingSid || '';
    const recordingDuration = params.RecordingDuration ? parseInt(params.RecordingDuration, 10) : 0;

    if (!callSid) {
      return new Response('Missing CallSid', { status: 400 });
    }

    const nowIso = new Date().toISOString();
    const updateData = {
      updated_at: nowIso,
    };

    if (callStatus) updateData.status = callStatus;
    if (callDuration > 0) updateData.duration = callDuration;
    if (recordingUrl) updateData.recording_url = recordingUrl;

    const { data: updatedCall, error: updateErr } = await supabaseAdmin
      .from('calls')
      .update(updateData)
      .eq('call_sid', callSid)
      .select()
      .maybeSingle();

    if (updateErr) {
      console.error('[Twilio Status Webhook] Database update error:', updateErr.message);
    }

    if (updatedCall && updatedCall.lead_id && callStatus === 'completed') {
      await supabaseAdmin.from('activity_logs').insert({
        lead_id: updatedCall.lead_id,
        user_id: updatedCall.user_id || null,
        type: 'CALL_COMPLETED',
        description: `Call completed (${callDuration || 0}s)${recordingUrl ? ' with recording' : ''}`,
        metadata: {
          callSid,
          duration: callDuration,
          recordingUrl,
          recordingSid,
          recordingDuration,
        },
      });
    }

    return new Response('<Response></Response>', {
      headers: { 'Content-Type': 'text/xml' },
      status: 200,
    });
  } catch (err) {
    console.error('[Twilio Status Webhook] Error:', err);
    return new Response('Internal Server Error', { status: 500 });
  }
}
