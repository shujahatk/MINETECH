import { connectToDatabase } from '@/lib/db/mongoose';
import SMSMessage from '@/lib/models/SMSMessage';

export async function POST(request) {
  try {
    await connectToDatabase();
    const formData = await request.formData();
    const messageSid = formData.get('MessageSid');
    const messageStatus = formData.get('MessageStatus');
    const errorCode = formData.get('ErrorCode');
    const errorMessage = formData.get('ErrorMessage');

    if (messageSid) {
      const updateData = { status: messageStatus };
      if (errorCode) updateData.errorCode = errorCode;
      if (errorMessage) updateData.errorMessage = errorMessage;

      await SMSMessage.findOneAndUpdate({ messageSid }, updateData);
    }

    return new Response('OK', { status: 200 });
  } catch (err) {
    console.error('[SMS Status Webhook] Error:', err);
    return new Response('OK', { status: 200 });
  }
}
