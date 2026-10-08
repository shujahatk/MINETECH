/**
 * MINETECH — RESEND WEBHOOK ATTRIBUTION & IDEMPOTENCY REGRESSION TEST
 */

import dotenv from 'dotenv';
dotenv.config();

import { supabaseAdmin } from '../lib/supabase.js';
import { POST as resendWebhookHandler } from '../app/api/webhooks/resend/route.js';
import crypto from 'crypto';

async function runResendAttributionTests() {
  console.log('======================================================================');
  console.log('📨 TESTING RESEND WEBHOOK ATTRIBUTION & IDEMPOTENCY ENGINE');
  console.log('======================================================================\n');

  let passed = 0;
  let failed = 0;

  const assert = (condition, name) => {
    if (condition) {
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${name}`);
      failed++;
    }
  };

  const testId = `res_${Date.now()}_${crypto.randomUUID().slice(0, 6)}`;
  const nowIso = new Date().toISOString();

  // Setup: 2 distinct campaigns with recipients having the same email address
  const sharedEmail = `target_${testId}@example.com`;

  const { data: lead } = await supabaseAdmin
    .from('leads')
    .insert({
      email: sharedEmail,
      first_name: 'TargetLead',
      status: 'NEW',
    })
    .select()
    .single();

  const { data: campA } = await supabaseAdmin
    .from('email_campaigns')
    .insert({
      name: `Campaign A ${testId}`,
      status: 'RUNNING',
      stats: { sent: 1, delivered: 0, opened: 0, clicked: 0, bounced: 0 },
    })
    .select()
    .single();

  const { data: campB } = await supabaseAdmin
    .from('email_campaigns')
    .insert({
      name: `Campaign B ${testId}`,
      status: 'RUNNING',
      stats: { sent: 1, delivered: 0, opened: 0, clicked: 0, bounced: 0 },
    })
    .select()
    .single();

  const msgIdA = `re_msg_campA_${testId}`;
  const msgIdB = `re_msg_campB_${testId}`;

  // Recipient in Campaign A (sent earlier)
  const { data: recA } = await supabaseAdmin
    .from('email_recipients')
    .insert({
      campaign_id: campA.id,
      lead_id: lead.id,
      email: sharedEmail,
      status: 'SENT',
      tokens: { resend_id: msgIdA },
      scheduled_at: nowIso,
    })
    .select()
    .single();

  // Recipient in Campaign B (sent later)
  const { data: recB } = await supabaseAdmin
    .from('email_recipients')
    .insert({
      campaign_id: campB.id,
      lead_id: lead.id,
      email: sharedEmail,
      status: 'SENT',
      tokens: { resend_id: msgIdB },
      scheduled_at: nowIso,
    })
    .select()
    .single();

  try {
    // -------------------------------------------------------------
    // TEST 1: Exact Attribution to Campaign A (not B, even though B is newer)
    // -------------------------------------------------------------
    console.log('[Action] Delivering webhook for Campaign A message ID...');
    const eventIdA = `evt_deliv_${Date.now()}_${crypto.randomUUID().slice(0, 6)}`;
    const reqDelivA = {
      headers: new Headers({
        'svix-id': eventIdA,
        'svix-timestamp': `${Math.floor(Date.now() / 1000)}`,
        'svix-signature': 'v1,test_signature',
      }),
      text: async () =>
        JSON.stringify({
          type: 'email.delivered',
          data: {
            email_id: msgIdA,
            to: [sharedEmail],
            created_at: nowIso,
          },
        }),
    };

    const resA = await resendWebhookHandler(reqDelivA);
    const bodyA = await resA.json();
    assert(resA.status === 200 && bodyA.success, 'Delivered webhook processed successfully');

    // Verify Recipient A was updated, but Recipient B was UNTOUCHED
    const { data: checkRecA } = await supabaseAdmin
      .from('email_recipients')
      .select('*')
      .eq('id', recA.id)
      .single();

    const { data: checkRecB } = await supabaseAdmin
      .from('email_recipients')
      .select('*')
      .eq('id', recB.id)
      .single();

    assert(checkRecA.status === 'DELIVERED', 'Recipient in Campaign A updated to DELIVERED via exact provider message ID');
    assert(checkRecB.status === 'SENT', 'Recipient in Campaign B was NOT touched (No email-only collision)');

    // Verify Campaign A stats incremented delivered count
    const { data: checkCampA } = await supabaseAdmin
      .from('email_campaigns')
      .select('stats')
      .eq('id', campA.id)
      .single();

    const { data: checkCampB } = await supabaseAdmin
      .from('email_campaigns')
      .select('stats')
      .eq('id', campB.id)
      .single();

    assert(checkCampA.stats.delivered === 1, 'Campaign A stats delivered count incremented to 1');
    assert(checkCampB.stats.delivered === 0, 'Campaign B stats remained 0 (No cross-campaign corruption)');

    // -------------------------------------------------------------
    // TEST 2: Deterministic Webhook Idempotency (Duplicate Delivery)
    // -------------------------------------------------------------
    console.log('\n[Action] Sending duplicate delivery webhook with exact same event ID (svix-id)...');
    const resDup = await resendWebhookHandler(reqDelivA);
    const bodyDup = await resDup.json();

    assert(resDup.status === 200 && bodyDup.duplicate === true, 'Duplicate webhook recognized and safely short-circuited');

    // Verify stats were NOT double incremented
    const { data: checkCampAAfterDup } = await supabaseAdmin
      .from('email_campaigns')
      .select('stats')
      .eq('id', campA.id)
      .single();

    assert(checkCampAAfterDup.stats.delivered === 1, 'Delivered stats remained exactly 1 (Zero double-counting on replay)');

    // -------------------------------------------------------------
    // TEST 3: Open Event Attribution
    // -------------------------------------------------------------
    console.log('\n[Action] Sending open event for Campaign A...');
    const eventIdOpen = `evt_open_${Date.now()}_${crypto.randomUUID().slice(0, 6)}`;
    const reqOpen = {
      headers: new Headers({
        'svix-id': eventIdOpen,
        'svix-timestamp': `${Math.floor(Date.now() / 1000)}`,
        'svix-signature': 'v1,test_signature',
      }),
      text: async () =>
        JSON.stringify({
          type: 'email.opened',
          data: {
            email_id: msgIdA,
            to: [sharedEmail],
            created_at: nowIso,
          },
        }),
    };

    const resOpen = await resendWebhookHandler(reqOpen);
    const bodyOpen = await resOpen.json();
    assert(resOpen.status === 200 && bodyOpen.success, 'Open event processed');

    const { data: checkRecAOpened } = await supabaseAdmin
      .from('email_recipients')
      .select('opened_at')
      .eq('id', recA.id)
      .single();

    assert(Boolean(checkRecAOpened.opened_at), 'Recipient opened_at timestamp set on open event');

    // -------------------------------------------------------------
    // TEST 4: Hard Bounce & DNC Suppression
    // -------------------------------------------------------------
    console.log('\n[Action] Sending bounce event for Campaign B...');
    const eventIdBounce = `evt_bounce_${Date.now()}_${crypto.randomUUID().slice(0, 6)}`;
    const reqBounce = {
      headers: new Headers({
        'svix-id': eventIdBounce,
        'svix-timestamp': `${Math.floor(Date.now() / 1000)}`,
        'svix-signature': 'v1,test_signature',
      }),
      text: async () =>
        JSON.stringify({
          type: 'email.bounced',
          data: {
            email_id: msgIdB,
            to: [sharedEmail],
            created_at: nowIso,
          },
        }),
    };

    const resBounce = await resendWebhookHandler(reqBounce);
    const bodyBounce = await resBounce.json();
    assert(resBounce.status === 200 && bodyBounce.success, 'Bounce event processed');

    const { data: checkLeadSuppressed } = await supabaseAdmin
      .from('leads')
      .select('is_dnc, dnc_reason, status')
      .eq('id', lead.id)
      .single();

    assert(checkLeadSuppressed.is_dnc === true, 'Lead automatically marked is_dnc = true on hard bounce');
    assert(checkLeadSuppressed.status === 'DO_NOT_CONTACT', 'Lead status transitioned to DO_NOT_CONTACT');
    assert(checkLeadSuppressed.dnc_reason === 'BOUNCED', 'Lead dnc_reason recorded as BOUNCED');

  } finally {
    // Cleanup
    await supabaseAdmin.from('email_campaigns').delete().in('id', [campA.id, campB.id]);
    await supabaseAdmin.from('leads').delete().eq('id', lead.id);
  }

  console.log('\n======================================================================');
  console.log(`📊 RESEND ATTRIBUTION & IDEMPOTENCY RESULTS: ${passed} Passed / ${failed} Failed`);
  console.log('======================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runResendAttributionTests().catch((err) => {
  console.error('Attribution test error:', err);
  process.exit(1);
});
