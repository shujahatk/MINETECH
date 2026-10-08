import twilio from 'twilio';
import { supabaseAdmin } from '../supabase.js';

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

export function getTwilioClient() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER || '+15005550006';

  if (!accountSid || !authToken) {
    return { client: null, fromNumber };
  }

  const client = twilio(accountSid, authToken);
  return { client, fromNumber };
}

/**
 * Validates incoming Twilio webhook cryptographic signature (HMAC-SHA1)
 */
export function verifyTwilioWebhookSignature(requestUrl, params, signature) {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) {
    return false;
  }
  if (!signature) {
    return false;
  }
  try {
    return twilio.validateRequest(authToken, signature, requestUrl, params);
  } catch (err) {
    console.error('[Twilio Signature Verification Error]:', err.message);
    return false;
  }
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
    throw new Error('Twilio voice credentials (TWILIO_ACCOUNT_SID, TWILIO_API_KEY, TWILIO_API_SECRET) are not configured.');
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
 * Initiate an outbound call via Twilio Voice API with Supabase Logging
 */
export async function makeOutboundCall({ leadId, to, statusCallbackUrl = '', userId = null }) {
  const phoneValidation = validatePhoneNumber(to);
  if (!phoneValidation.isValid) throw new Error(phoneValidation.message);

  const { client, fromNumber } = getTwilioClient();
  if (!client) {
    throw new Error('Twilio credentials (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN) are not configured.');
  }

  const host = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const twimlUrl = `${host}/api/webhooks/twilio/twiml?to=${encodeURIComponent(phoneValidation.formattedPhone)}`;
  const statusUrl = statusCallbackUrl || `${host}/api/webhooks/twilio/status`;

  // Real Twilio API Call
  const twilioCall = await client.calls.create({
    url: twimlUrl,
    to: phoneValidation.formattedPhone,
    from: fromNumber,
    statusCallback: statusUrl,
    statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
    record: true,
    recordingStatusCallback: statusUrl,
  });

  const callSid = twilioCall.sid;
  const callStatus = twilioCall.status || 'initiated';
  const nowIso = new Date().toISOString();

  // Fetch lead name if available
  let leadName = 'Prospect';
  if (leadId) {
    const { data: l } = await supabaseAdmin
      .from('leads')
      .select('full_name, first_name, company')
      .eq('id', leadId)
      .maybeSingle();
    if (l) leadName = l.full_name || l.first_name || l.company || 'Prospect';
  }

  // 1. Record call in Supabase with initial duration = 0
  const { data: callRecord, error: callErr } = await supabaseAdmin
    .from('calls')
    .insert({
      lead_id: leadId || null,
      user_id: userId || null,
      call_sid: callSid,
      direction: 'outbound',
      from_number: fromNumber,
      to_number: phoneValidation.formattedPhone,
      status: callStatus,
      duration: 0,
      notes: 'Outbound telephony interaction initiated.',
      created_at: nowIso,
      updated_at: nowIso,
    })
    .select()
    .single();

  if (callErr) {
    console.error('[Twilio] Failed to record call in Supabase:', callErr.message);
  }

  // 2. Record activity log in Supabase
  await supabaseAdmin.from('activity_logs').insert({
    lead_id: leadId || null,
    user_id: userId || null,
    type: 'CALL_PLACED',
    description: `Placed outbound phone call to ${leadName} (${phoneValidation.formattedPhone}) [CallSid: ${callSid}]`,
    metadata: { callSid, to: phoneValidation.formattedPhone, status: callStatus },
  });

  // 3. Update lead status if NEW
  if (leadId) {
    await supabaseAdmin
      .from('leads')
      .update({ status: 'CONTACTED', updated_at: nowIso })
      .eq('id', leadId)
      .eq('status', 'NEW');
  }

  return callRecord || { call_sid: callSid, status: callStatus, to_number: phoneValidation.formattedPhone };
}

/**
 * Terminate an active Twilio Call
 */
export async function terminateCall(callSid) {
  if (!callSid) throw new Error('Call SID is required to terminate call');

  const { client } = getTwilioClient();
  let twilioUpdated = null;

  if (client) {
    try {
      twilioUpdated = await client.calls(callSid).update({ status: 'completed' });
    } catch (err) {
      console.warn(`[Twilio Terminate Warning for ${callSid}]:`, err.message);
    }
  }

  const nowIso = new Date().toISOString();
  const { data: updatedCall } = await supabaseAdmin
    .from('calls')
    .update({
      status: 'completed',
      updated_at: nowIso,
    })
    .eq('call_sid', callSid)
    .select()
    .maybeSingle();

  return updatedCall || { call_sid: callSid, status: 'completed' };
}

/**
 * Send an SMS message via Twilio with Supabase Logging
 */
export async function sendSMS({ leadId, to, body, userId = null }) {
  const phoneValidation = validatePhoneNumber(to);
  if (!phoneValidation.isValid) throw new Error(phoneValidation.message);
  if (!body || !body.trim()) throw new Error('SMS message body is required');

  const { client, fromNumber } = getTwilioClient();
  if (!client) {
    throw new Error('Twilio credentials (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN) are not configured.');
  }

  const twilioMsg = await client.messages.create({
    body: body.trim(),
    to: phoneValidation.formattedPhone,
    from: fromNumber,
  });

  const messageSid = twilioMsg.sid;
  const smsStatus = twilioMsg.status || 'sent';
  const nowIso = new Date().toISOString();

  // Fetch lead name if available
  let leadName = 'Prospect';
  if (leadId) {
    const { data: l } = await supabaseAdmin
      .from('leads')
      .select('full_name, first_name, company')
      .eq('id', leadId)
      .maybeSingle();
    if (l) leadName = l.full_name || l.first_name || l.company || 'Prospect';
  }

  // 1. Record SMS in Supabase
  const { data: smsRecord } = await supabaseAdmin
    .from('sms_messages')
    .insert({
      lead_id: leadId || null,
      user_id: userId || null,
      message_sid: messageSid,
      direction: 'outbound',
      from_number: fromNumber,
      to_number: phoneValidation.formattedPhone,
      body: body.trim(),
      status: smsStatus,
      created_at: nowIso,
      updated_at: nowIso,
    })
    .select()
    .single();

  // 2. Record Activity in Supabase
  await supabaseAdmin.from('activity_logs').insert({
    lead_id: leadId || null,
    user_id: userId || null,
    type: 'SMS_SENT',
    description: `Sent outbound SMS to ${leadName} (${phoneValidation.formattedPhone}): "${body.trim().substring(0, 70)}"`,
    metadata: { messageSid, to: phoneValidation.formattedPhone },
  });

  // 3. Update Lead Status
  if (leadId) {
    await supabaseAdmin
      .from('leads')
      .update({ status: 'CONTACTED', updated_at: nowIso })
      .eq('id', leadId)
      .eq('status', 'NEW');
  }

  return smsRecord || { message_sid: messageSid, status: smsStatus, to_number: phoneValidation.formattedPhone };
}

/**
 * Process inbound SMS webhook from Twilio
 */
export async function handleInboundSMS({ From, To, Body, MessageSid }) {
  const phoneValidation = validatePhoneNumber(From);
  const formattedFrom = phoneValidation.isValid ? phoneValidation.formattedPhone : From;
  const nowIso = new Date().toISOString();

  // 1. Locate Lead in Supabase CRM by phone number
  let lead = null;
  if (formattedFrom) {
    const { data: matchingLeads } = await supabaseAdmin
      .from('leads')
      .select('*')
      .or(`phone.eq.${formattedFrom},phone.eq.${From}`)
      .limit(1);

    if (matchingLeads && matchingLeads.length > 0) {
      lead = matchingLeads[0];
    }
  }

  // 2. Record Inbound SMS in Supabase
  const { data: smsRecord } = await supabaseAdmin
    .from('sms_messages')
    .insert({
      lead_id: lead?.id || null,
      message_sid: MessageSid || `SM_IN_${Date.now()}`,
      direction: 'inbound',
      from_number: formattedFrom,
      to_number: To || process.env.TWILIO_PHONE_NUMBER || '',
      body: (Body || '').trim(),
      status: 'received',
      created_at: nowIso,
      updated_at: nowIso,
    })
    .select()
    .single();

  // 3. Update Lead status to ENGAGED & set unanswered reply flag
  if (lead) {
    const customFields = {
      ...(lead.custom_fields || {}),
      has_unanswered_reply: true,
      last_reply_snippet: (Body || '').trim().substring(0, 150),
      last_reply_channel: 'sms',
      last_reply_at: nowIso,
      last_engaged_at: nowIso,
    };

    await supabaseAdmin
      .from('leads')
      .update({
        status: 'ENGAGED',
        custom_fields: customFields,
        updated_at: nowIso,
      })
      .eq('id', lead.id);
  }

  // 4. Record Activity Log in Supabase
  await supabaseAdmin.from('activity_logs').insert({
    lead_id: lead?.id || null,
    type: 'SMS_RECEIVED',
    description: `Received inbound SMS from ${lead?.full_name || lead?.first_name || formattedFrom} (${formattedFrom}): "${(Body || '').trim().substring(0, 70)}"`,
    metadata: { messageSid: MessageSid, from: formattedFrom, body: Body },
  });

  return smsRecord;
}

const twilioService = {
  validatePhoneNumber,
  getTwilioClient,
  verifyTwilioWebhookSignature,
  generateVoiceToken,
  makeOutboundCall,
  terminateCall,
  sendSMS,
  handleInboundSMS,
};

export default twilioService;
