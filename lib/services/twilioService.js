import twilio from 'twilio';
import { connectToDatabase } from '@/lib/db/mongoose';
import Lead from '@/lib/models/Lead';
import Call from '@/lib/models/Call';
import SMSMessage from '@/lib/models/SMSMessage';
import ActivityLog from '@/lib/models/ActivityLog';

/**
 * Validates and formats phone number into standard E.164 format
 */
export function validatePhoneNumber(phone) {
  if (!phone || typeof phone !== 'string') {
    return { isValid: false, message: 'Phone number is required' };
  }

  let cleaned = phone.replace(/[\s().-]/g, '');

  if (/^\d{10}$/.test(cleaned)) {
    cleaned = '+1' + cleaned;
  } else if (!cleaned.startsWith('+') && /^\d{11,15}$/.test(cleaned)) {
    cleaned = '+' + cleaned;
  }

  const e164Regex = /^\+[1-9]\d{7,14}$/;
  if (!e164Regex.test(cleaned)) {
    return {
      isValid: false,
      message: 'Invalid phone number. Must be in E.164 format (e.g. +1234567890).',
    };
  }

  return { isValid: true, formattedPhone: cleaned };
}

function getTwilioClient() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken) {
    throw new Error('Twilio credentials (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN) are not configured.');
  }

  const client = twilio(accountSid, authToken);
  return { client, fromNumber };
}

/**
 * Generate Twilio WebRTC Voice Token for browser-based calling
 */
export function generateVoiceToken(identity = 'sales_rep') {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const apiKey = process.env.TWILIO_API_KEY || process.env.TWILIO_ACCOUNT_SID;
  const apiSecret = process.env.TWILIO_API_SECRET || process.env.TWILIO_AUTH_TOKEN;
  const twimlAppSid = process.env.TWILIO_TWIML_APP_SID;

  if (!accountSid || !apiKey || !apiSecret) {
    throw new Error('Twilio WebRTC configuration missing.');
  }

  const { AccessToken } = twilio.jwt;
  const { VoiceGrant } = AccessToken;

  const token = new AccessToken(accountSid, apiKey, apiSecret, { identity });
  const voiceGrant = new VoiceGrant({
    outgoingApplicationSid: twimlAppSid,
    incomingAllow: true,
  });

  token.addGrant(voiceGrant);
  return token.toJwt();
}

/**
 * Initiate an outbound call via Twilio Voice API
 */
export async function makeOutboundCall({ leadId, to, statusCallbackUrl = '' }) {
  await connectToDatabase();
  const phoneValidation = validatePhoneNumber(to);
  if (!phoneValidation.isValid) throw new Error(phoneValidation.message);

  const { client, fromNumber } = getTwilioClient();
  const host = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const twimlUrl = `${host}/api/webhooks/twilio/twiml?to=${encodeURIComponent(phoneValidation.formattedPhone)}`;
  const statusUrl = statusCallbackUrl || `${host}/api/webhooks/twilio/status`;

  let twilioCall;
  try {
    twilioCall = await client.calls.create({
      url: twimlUrl,
      to: phoneValidation.formattedPhone,
      from: fromNumber,
      statusCallback: statusUrl,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
      record: true,
      recordingStatusCallback: statusUrl,
    });
  } catch (err) {
    console.error('[Twilio] Make call error:', err.message);
    throw err;
  }

  const callDoc = await Call.create({
    leadId: leadId || null,
    callSid: twilioCall.sid,
    from: fromNumber,
    to: phoneValidation.formattedPhone,
    status: twilioCall.status || 'queued',
    startTime: new Date(),
  });

  if (leadId) {
    await ActivityLog.create({
      leadId,
      action: 'CALL_STARTED',
      channel: 'call',
      direction: 'outbound',
      summary: `Started call to ${phoneValidation.formattedPhone}`,
      details: { callSid: twilioCall.sid },
      timestamp: new Date(),
    });
  }

  return callDoc;
}

/**
 * Send an SMS message via Twilio
 */
export async function sendSMS({ leadId, to, body }) {
  await connectToDatabase();
  const phoneValidation = validatePhoneNumber(to);
  if (!phoneValidation.isValid) throw new Error(phoneValidation.message);
  if (!body || !body.trim()) throw new Error('SMS message body is required');

  const { client, fromNumber } = getTwilioClient();
  const host = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const statusCallback = `${host}/api/webhooks/twilio/sms-status`;

  let twilioMsg;
  try {
    twilioMsg = await client.messages.create({
      body: body.trim(),
      to: phoneValidation.formattedPhone,
      from: fromNumber,
      statusCallback,
    });
  } catch (err) {
    console.error('[Twilio] Send SMS error:', err.message);
    throw err;
  }

  const msgDoc = await SMSMessage.create({
    leadId: leadId || null,
    messageSid: twilioMsg.sid,
    from: fromNumber,
    to: phoneValidation.formattedPhone,
    body: body.trim(),
    channel: 'sms',
    direction: 'outbound',
    status: twilioMsg.status || 'queued',
  });

  if (leadId) {
    const lead = await Lead.findById(leadId);
    if (lead) {
      lead.lastContactedAt = new Date();
      if (lead.status === 'NEW') lead.status = 'CONTACTED';
      await lead.save();

      await ActivityLog.create({
        leadId,
        action: 'SMS_SENT',
        channel: 'sms',
        direction: 'outbound',
        summary: `Sent SMS: "${body.trim().substring(0, 80)}"`,
        details: { messageSid: twilioMsg.sid },
        timestamp: new Date(),
      });
    }
  }

  return msgDoc;
}

/**
 * Handle Inbound SMS from Twilio Webhook
 */
export async function handleInboundSMS({ From, To, Body, MessageSid }) {
  await connectToDatabase();
  const senderPhone = From;
  const messageBody = (Body || '').trim();

  // Save SMS Record
  const msg = await SMSMessage.create({
    messageSid: MessageSid || `inbound-sms-${Date.now()}`,
    from: senderPhone,
    to: To || '',
    body: messageBody,
    channel: 'sms',
    direction: 'inbound',
    status: 'received',
  });

  // Match Lead
  const lead = await Lead.findOne({ phone: senderPhone });
  if (lead) {
    msg.leadId = lead._id;
    await msg.save();

    lead.hasUnansweredReply = true;
    lead.lastReplySnippet = messageBody.substring(0, 150);
    lead.lastReplyChannel = 'sms';
    lead.lastReplyAt = new Date();
    lead.lastEngagedAt = new Date();
    if (['NEW', 'CONTACTED', 'FOLLOW_UP', 'NO_RESPONSE'].includes(lead.status)) {
      lead.status = 'ENGAGED';
    }
    if (lead.emailSequence && lead.emailSequence.status === 'active') {
      lead.emailSequence.status = 'stopped';
      lead.emailSequence.stopReason = 'inbound-sms';
    }
    await lead.save();

    await ActivityLog.create({
      leadId: lead._id,
      action: 'SMS_RECEIVED',
      channel: 'sms',
      direction: 'inbound',
      summary: `Received SMS reply: "${messageBody.substring(0, 100)}"`,
      details: { messageSid: MessageSid },
      timestamp: new Date(),
    });
  }

  return msg;
}
