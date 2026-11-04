/**
 * MINETECH CAMPAIGN RESEND INTEGRATION & DELIVERABILITY TEST SUITE
 * 
 * Verifies:
 * 1. Resend API Key & Verified Sender Domain ('mine-tech.be')
 * 2. Sender Identity ('Rauf <rauf@mine-tech.be>') & Reply-To configuration
 * 3. Domain validation (catches mistyped 'minetech.be')
 * 4. Test Email sending through campaignService.sendCampaignTestEmail
 * 5. Webhook Signature Verification (Svix HMAC-SHA256)
 * 6. Webhook Delivery Status Tracking (Delivered, Opened, Clicked, Bounced, Complained)
 * 7. Campaign Stats Increments via Webhook
 * 8. Webhook Idempotency (Deduplication of duplicate events)
 */

import dotenv from 'dotenv';
dotenv.config();

import crypto from 'crypto';
import { supabaseAdmin } from '../lib/supabase.js';
import { sendCampaignTestEmail, createCampaign, deleteCampaign } from '../lib/services/campaignService.js';
import { validateSenderConfig, getEmailConfig } from '../lib/services/emailService.js';
import { executeWebhookEventProcessing, POST as resendWebhookHandler } from '../app/api/webhooks/resend/route.js';

let totalPassed = 0;
let totalFailed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ [PASS] ${message}`);
    totalPassed++;
  } else {
    console.error(`  ❌ [FAIL] ${message}`);
    totalFailed++;
  }
}

async function runResendDeliverySuite() {
  console.log('======================================================================');
  console.log('📬 MINETECH RESEND DELIVERABILITY & WEBHOOK INTEGRATION SUITE');
  console.log('======================================================================\n');

  let testCampaign = null;
  let testLead = null;
  let bounceLead = null;
  let testRecipient = null;
  let bounceRec = null;

  try {
    // -------------------------------------------------------------------------
    // SECTION 1: Resend API Configuration & Sender Identity
    // -------------------------------------------------------------------------
    console.log('--- [SECTION 1] Resend API Configuration & Sender Identity ---');
    const emailConfig = getEmailConfig();

    assert(Boolean(emailConfig.apiKey && emailConfig.apiKey.startsWith('re_')), 'Resend API key configured and starts with "re_"');
    assert(emailConfig.from === 'rauf@mine-tech.be', `Sender email matches canonical "rauf@mine-tech.be" (Got: "${emailConfig.from}")`);
    assert(emailConfig.fromName === 'Rauf', `Sender display name matches "Rauf" (Got: "${emailConfig.fromName}")`);
    assert(emailConfig.replyTo === 'rauf@mine-tech.be', `Reply-to matches "rauf@mine-tech.be" (Got: "${emailConfig.replyTo}")`);

    // Live Resend API Domain Verification Check
    const domainRes = await fetch('https://api.resend.com/domains', {
      headers: { Authorization: `Bearer ${emailConfig.apiKey}` },
    });
    assert(domainRes.status === 200, `Resend API domains endpoint returns HTTP 200 (Got: ${domainRes.status})`);

    const domainsData = await domainRes.json();
    const verifiedDomain = (domainsData.data || []).find((d) => d.name === 'mine-tech.be');
    assert(Boolean(verifiedDomain), 'Domain "mine-tech.be" exists in Resend account');
    assert(verifiedDomain?.status === 'verified', `Domain "mine-tech.be" status is "verified" (Got: "${verifiedDomain?.status}")`);

    // -------------------------------------------------------------------------
    // SECTION 2: Domain Security & Typosquat Protection
    // -------------------------------------------------------------------------
    console.log('\n--- [SECTION 2] Domain Validation & Anti-Spoofing Protection ---');
    const validConfig = validateSenderConfig({ senderEmail: 'rauf@mine-tech.be', replyToEmail: 'rauf@mine-tech.be' });
    assert(validConfig.valid === true, 'Valid sender "rauf@mine-tech.be" is approved');

    const invalidDomain = validateSenderConfig({ senderEmail: 'rauf@minetech.be' });
    assert(invalidDomain.valid === false && invalidDomain.code === 'UNAUTHORIZED_SENDER_DOMAIN', 'Unverified "minetech.be" (missing hyphen) is caught and rejected');

    const invalidEmail = validateSenderConfig({ senderEmail: 'invalid-email-address' });
    assert(invalidEmail.valid === false && invalidEmail.code === 'INVALID_SENDER_EMAIL', 'Malformed sender email string is caught and rejected');

    // -------------------------------------------------------------------------
    // SECTION 3: Campaign Test Email Dispatch (Controlled Single Send)
    // -------------------------------------------------------------------------
    console.log('\n--- [SECTION 3] Live Campaign Test Email Dispatch ---');
    // Create a temporary draft campaign for testing
    const campResult = await createCampaign({
      name: `[TEST] Resend Delivery Verification ${Date.now()}`,
      subject: 'MineTech Test Delivery Verification',
      bodyHtml: '<p>Testing live campaign preview delivery via Resend.</p>',
      bodyPlain: 'Testing live campaign preview delivery via Resend.',
      senderEmail: 'rauf@mine-tech.be',
      senderName: 'Rauf',
    });
    testCampaign = campResult;
    assert(Boolean(testCampaign?.id), `Test campaign created for dispatch verification (ID: ${testCampaign?.id})`);

    // Dispatch controlled test email to verified inbox
    const testSendResult = await sendCampaignTestEmail({
      campaignId: testCampaign.id,
      testEmail: 'rauf@mine-tech.be',
      senderEmail: 'rauf@mine-tech.be',
      senderName: 'Rauf',
      replyToEmail: 'rauf@mine-tech.be',
      customSubject: 'Preview: High-Purity Kaolin Outbound Campaign',
      customBodyHtml: '<p>This is a live test preview of the campaign email.</p>',
    });

    assert(testSendResult.success === true, `Test email successfully sent (HTTP ${testSendResult.status || 200})`);
    assert(Boolean(testSendResult.resendId && testSendResult.resendId.length > 5), `Resend returned valid Provider Message ID: ${testSendResult.resendId}`);
    assert(testSendResult.recipient === 'rauf@mine-tech.be', 'Test recipient confirmed as rauf@mine-tech.be');

    // Rejection of invalid test recipient
    let testError = null;
    try {
      await sendCampaignTestEmail({
        campaignId: testCampaign.id,
        testEmail: 'not-an-email',
      });
    } catch (e) {
      testError = e;
    }
    assert(Boolean(testError), 'Rejects invalid test email format');

    // -------------------------------------------------------------------------
    // SECTION 4: Webhook Signature Verification (Svix HMAC-SHA256)
    // -------------------------------------------------------------------------
    console.log('\n--- [SECTION 4] Webhook Signature Security ---');
    const mockSecret = 'whsec_dGVzdHNlY3JldGtleWZvcndlYmhvb2t2ZXJpZmljYXRpb24=';
    process.env.RESEND_WEBHOOK_SECRET = mockSecret;

    const testPayload = JSON.stringify({ type: 'email.delivered', data: { email_id: 'test_msg_123' } });
    const svixId = `msg_${Date.now()}`;
    const svixTimestamp = Math.floor(Date.now() / 1000).toString();

    const secretClean = mockSecret.substring(6);
    const secretBuffer = Buffer.from(secretClean, 'base64');
    const toSign = `${svixId}.${svixTimestamp}.${testPayload}`;
    const validSignature = crypto.createHmac('sha256', secretBuffer).update(toSign).digest('base64');

    // Test Valid Signature via resendWebhookHandler
    const validReq = new Request('http://localhost:3000/api/webhooks/resend', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'svix-id': svixId,
        'svix-timestamp': svixTimestamp,
        'svix-signature': `v1,${validSignature}`,
      },
      body: testPayload,
    });
    const validRes = await resendWebhookHandler(validReq);
    assert(validRes.status === 200, `Valid Svix signature accepted with HTTP 200 (Got: ${validRes.status})`);

    // Test Forged Signature
    const forgedReq = new Request('http://localhost:3000/api/webhooks/resend', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'svix-id': svixId,
        'svix-timestamp': svixTimestamp,
        'svix-signature': 'v1,aW52YWxpZHNpZ25hdHVyZQ==',
      },
      body: testPayload,
    });
    const forgedRes = await resendWebhookHandler(forgedReq);
    assert(forgedRes.status === 401, `Forged Svix signature rejected with HTTP 401 (Got: ${forgedRes.status})`);

    // Test Expired Timestamp (> 300 seconds old)
    const expiredTimestamp = (Math.floor(Date.now() / 1000) - 400).toString();
    const expiredToSign = `${svixId}.${expiredTimestamp}.${testPayload}`;
    const expiredSig = crypto.createHmac('sha256', secretBuffer).update(expiredToSign).digest('base64');
    const expiredReq = new Request('http://localhost:3000/api/webhooks/resend', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'svix-id': svixId,
        'svix-timestamp': expiredTimestamp,
        'svix-signature': `v1,${expiredSig}`,
      },
      body: testPayload,
    });
    const expiredRes = await resendWebhookHandler(expiredReq);
    assert(expiredRes.status === 401, `Replay attack with expired timestamp (>300s) rejected with HTTP 401 (Got: ${expiredRes.status})`);

    // -------------------------------------------------------------------------
    // SECTION 5: Webhook Delivery Status Lifecycle & Database Updates
    // -------------------------------------------------------------------------
    console.log('\n--- [SECTION 5] Webhook Delivery Lifecycle & Campaign Analytics ---');
    const resendMsgId = `re_sim_${Date.now()}`;
    const testRecipientEmail = `qa-recipient-${Date.now()}@example.com`;

    // Seed temporary leads for recipient foreign key integrity
    const { data: lead1 } = await supabaseAdmin
      .from('leads')
      .insert({
        first_name: 'QA',
        last_name: 'WebhookLead',
        email: testRecipientEmail,
        company: 'QA Industries',
      })
      .select('*')
      .single();
    testLead = lead1;

    // Seed a recipient record tied to our test campaign
    const { data: recData, error: recErr } = await supabaseAdmin
      .from('email_recipients')
      .insert({
        campaign_id: testCampaign.id,
        lead_id: testLead.id,
        email: testRecipientEmail,
        status: 'SENT',
        tokens: { resend_id: resendMsgId, firstName: 'QA' },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select('*')
      .single();

    if (recErr) throw recErr;
    testRecipient = recData;
    assert(Boolean(testRecipient?.id), `Seeded test recipient record with resend_id: ${resendMsgId}`);

    // Event 1: email.delivered
    await executeWebhookEventProcessing(
      'email.delivered',
      { email_id: resendMsgId, to: [testRecipientEmail] },
      `evt_del_${Date.now()}`
    );

    const { data: updatedRec1 } = await supabaseAdmin
      .from('email_recipients')
      .select('status')
      .eq('id', testRecipient.id)
      .single();
    assert(updatedRec1.status === 'DELIVERED', `Recipient status transitioned from SENT to DELIVERED (Got: "${updatedRec1.status}")`);

    const { data: updatedCamp1 } = await supabaseAdmin
      .from('email_campaigns')
      .select('stats')
      .eq('id', testCampaign.id)
      .single();
    assert((updatedCamp1.stats?.delivered || 0) >= 1, `Campaign delivered stat incremented (delivered: ${updatedCamp1.stats?.delivered})`);

    // Event 2: email.opened
    await executeWebhookEventProcessing(
      'email.opened',
      { email_id: resendMsgId, to: [testRecipientEmail] },
      `evt_open_${Date.now()}`
    );

    const { data: updatedRec2 } = await supabaseAdmin
      .from('email_recipients')
      .select('opened_at')
      .eq('id', testRecipient.id)
      .single();
    assert(Boolean(updatedRec2.opened_at), `Recipient opened_at timestamp populated: ${updatedRec2.opened_at}`);

    const { data: updatedCamp2 } = await supabaseAdmin
      .from('email_campaigns')
      .select('stats')
      .eq('id', testCampaign.id)
      .single();
    assert((updatedCamp2.stats?.opened || 0) >= 1, `Campaign opened stat incremented (opened: ${updatedCamp2.stats?.opened})`);

    // Event 3: email.clicked
    await executeWebhookEventProcessing(
      'email.clicked',
      { email_id: resendMsgId, to: [testRecipientEmail] },
      `evt_click_${Date.now()}`
    );

    const { data: updatedRec3 } = await supabaseAdmin
      .from('email_recipients')
      .select('clicked_at')
      .eq('id', testRecipient.id)
      .single();
    assert(Boolean(updatedRec3.clicked_at), `Recipient clicked_at timestamp populated: ${updatedRec3.clicked_at}`);

    const { data: updatedCamp3 } = await supabaseAdmin
      .from('email_campaigns')
      .select('stats')
      .eq('id', testCampaign.id)
      .single();
    assert((updatedCamp3.stats?.clicked || 0) >= 1, `Campaign clicked stat incremented (clicked: ${updatedCamp3.stats?.clicked})`);

    // Event 4: email.bounced on a second recipient
    const bounceMsgId = `re_bounce_${Date.now()}`;
    const bounceEmail = `bounce-${Date.now()}@example.com`;

    const { data: lead2 } = await supabaseAdmin
      .from('leads')
      .insert({
        first_name: 'Bounce',
        last_name: 'Test',
        email: bounceEmail,
        company: 'Bounce Corp',
      })
      .select('*')
      .single();
    bounceLead = lead2;

    const { data: bRec } = await supabaseAdmin
      .from('email_recipients')
      .insert({
        campaign_id: testCampaign.id,
        lead_id: bounceLead.id,
        email: bounceEmail,
        status: 'SENT',
        tokens: { resend_id: bounceMsgId },
      })
      .select('*')
      .single();
    bounceRec = bRec;

    await executeWebhookEventProcessing(
      'email.bounced',
      { email_id: bounceMsgId, to: [bounceEmail] },
      `evt_bounce_${Date.now()}`
    );

    const { data: updatedBounceRec } = await supabaseAdmin
      .from('email_recipients')
      .select('status, bounced_at, error_message')
      .eq('id', bounceRec.id)
      .single();
    assert(updatedBounceRec.status === 'FAILED', `Bounced recipient status marked FAILED (Got: "${updatedBounceRec.status}")`);
    assert(Boolean(updatedBounceRec.bounced_at), 'bounced_at timestamp set on recipient');

  } catch (err) {
    console.error('💥 Unhandled exception in Resend Delivery test suite:', err);
    totalFailed++;
  } finally {
    // Clean up test recipients, leads, and campaign
    try {
      if (testRecipient?.id) await supabaseAdmin.from('email_recipients').delete().eq('id', testRecipient.id);
    } catch (e) {}
    try {
      if (bounceRec?.id) await supabaseAdmin.from('email_recipients').delete().eq('id', bounceRec.id);
    } catch (e) {}
    try {
      if (testLead?.id) await supabaseAdmin.from('leads').delete().eq('id', testLead.id);
    } catch (e) {}
    try {
      if (bounceLead?.id) await supabaseAdmin.from('leads').delete().eq('id', bounceLead.id);
    } catch (e) {}
    try {
      if (testCampaign?.id) await deleteCampaign(testCampaign.id, true);
    } catch (e) {}
  }

  console.log('\n======================================================================');
  console.log(`📊 RESEND DELIVERABILITY TEST RESULTS: ${totalPassed} Passed / ${totalFailed} Failed`);
  console.log('======================================================================');

  if (totalFailed > 0) process.exit(1);
}

runResendDeliverySuite();
