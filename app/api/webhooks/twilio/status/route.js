import { connectToDatabase } from '@/lib/db/mongoose';
import Call from '@/lib/models/Call';
import ActivityLog from '@/lib/models/ActivityLog';

export async function POST(request) {
  try {
    await connectToDatabase();

    const formData = await request.formData();
    const callSid = formData.get('CallSid');
    const callStatus = formData.get('CallStatus');
    const callDuration = formData.get('CallDuration');
    const recordingUrl = formData.get('RecordingUrl');
    const recordingSid = formData.get('RecordingSid');
    const recordingDuration = formData.get('RecordingDuration');

    if (!callSid) return new Response('OK', { status: 200 });

    const updateData = {};
    if (callStatus) updateData.status = callStatus;
    if (callDuration) updateData.duration = parseInt(callDuration, 10);
    if (recordingUrl) updateData.recordingUrl = recordingUrl;
    if (recordingSid) updateData.recordingSid = recordingSid;
    if (recordingDuration) updateData.recordingDuration = parseInt(recordingDuration, 10);

    if (['completed', 'failed', 'busy', 'no-answer', 'canceled'].includes(callStatus)) {
      updateData.endTime = new Date();
    }

    const updatedCall = await Call.findOneAndUpdate({ callSid }, updateData, { new: true });

    if (updatedCall && updatedCall.leadId && callStatus === 'completed') {
      await ActivityLog.create({
        leadId: updatedCall.leadId,
        action: 'CALL_COMPLETED',
        channel: 'call',
        direction: 'outbound',
        summary: `Call completed (${callDuration || 0}s)`,
        details: { duration: callDuration, recordingUrl },
        timestamp: new Date(),
      });
    }

    return new Response('OK', { status: 200 });
  } catch (err) {
    console.error('[Twilio Status Webhook] Error:', err);
    return new Response('OK', { status: 200 });
  }
}
