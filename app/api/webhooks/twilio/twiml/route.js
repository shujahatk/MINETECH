import twilio from 'twilio';

export async function GET(request) {
  return generateTwiML(request);
}

export async function POST(request) {
  return generateTwiML(request);
}

async function generateTwiML(request) {
  const { searchParams } = new URL(request.url);
  let to = searchParams.get('to') || '';

  if (!to) {
    try {
      const formData = await request.formData();
      to = formData.get('To') || formData.get('to') || '';
    } catch {}
  }

  const response = new twilio.twiml.VoiceResponse();
  const callerId = process.env.TWILIO_PHONE_NUMBER;

  response.say('Connecting your 80/20 Outbound call.');

  if (to) {
    const dial = response.dial({ callerId });
    dial.number(to);
  } else {
    response.say('No destination phone number was supplied. Hanging up.');
  }

  return new Response(response.toString(), {
    headers: { 'Content-Type': 'text/xml' },
  });
}
