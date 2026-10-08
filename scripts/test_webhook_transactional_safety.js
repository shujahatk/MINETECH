import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { supabaseAdmin } from '../lib/supabase.js';
import { POST as resendWebhookHandler, retryUnprocessedWebhooks } from '../app/api/webhooks/resend/route.js';

let passed = 0;
let failed = 0;
let skipped = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  ❌ [FAIL] ${message}`);
    failed++;
  }
}

async function runWebhookTransactionalSafetyTests() {
  console.log('======================================================================');
  console.log('📨 TESTING RESEND WEBHOOK TRANSACTIONAL SAFETY & RECONCILIATION');
  console.log('======================================================================\n');

  const testSuffix = `${Date.now()}_${crypto.randomUUID().slice(0, 6)}`;
  let testCampaignId = null;
  let testLeadId = null;
  let testRecipientId = null;
  const testMessageId = `msg_tx_${testSuffix}`;
  const testSvixId = `svix_tx_${testSuffix}`;

  try {
    // 1. Setup Fixtures
    const { data: lead, error: leadErr } = await supabaseAdmin
      .from('leads')
      .insert({
        email: `tx_prospect_${testSuffix}@resend.dev`,
        first_name: 'TxProspect',
      })
      .select()
      .single();

    if (leadErr || !lead) throw new Error(`Setup failed creating lead: ${leadErr?.message}`);
    testLeadId = lead.id;

    const { data: campaign, error: campErr } = await supabaseAdmin
      .from('email_campaigns')
      .insert({
        name: `Tx Campaign ${testSuffix}`,
        stats: { sent: 1, delivered: 0, opened: 0, clicked: 0, bounced: 0 },
      })
      .select()
      .single();

    if (campErr || !campaign) throw new Error(`Setup failed creating campaign: ${campErr?.message}`);
    testCampaignId = campaign.id;

    const { data: recipient, error: recErr } = await supabaseAdmin
      .from('email_recipients')
      .insert({
        campaign_id: testCampaignId,
        lead_id: testLeadId,
        email: lead.email,
        status: 'SENT',
        tokens: { resend_id: testMessageId },
      })
      .select()
      .single();

    if (recErr || !recipient) throw new Error(`Setup failed creating recipient: ${recErr?.message}`);
    testRecipientId = recipient.id;

    // 2. Test: 5 Identical Webhook Deliveries -> Business Update Occurs Once
    console.log('[Test 1] 5 Identical Webhooks Delivered Concurrently / Sequentially:');
    const deliveryPayload = {
      type: 'email.delivered',
      data: {
        email_id: testMessageId,
        to: [lead.email],
        created_at: new Date().toISOString(),
      },
    };

    const makeRequest = (svix) =>
      new Request('https://crm.mine-tech.be/api/webhooks/resend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'svix-id': svix,
          'svix-timestamp': Math.floor(Date.now() / 1000).toString(),
          'svix-signature': 'test_sig',
        },
        body: JSON.stringify(deliveryPayload),
      });

    // Fire 5 times
    const responses = [];
    for (let i = 0; i < 5; i++) {
      const res = await resendWebhookHandler(makeRequest(testSvixId));
      responses.push(await res.json());
    }

    const successfulFirst = responses[0];
    assert(successfulFirst.success === true && !successfulFirst.duplicate, 'First delivery processed business logic');

    const duplicates = responses.slice(1);
    const allDuplicatesHandled = duplicates.every((r) => r.success === true && r.duplicate === true);
    assert(allDuplicatesHandled, 'All subsequent 4 duplicate replays recognized and safely short-circuited');

    // Check stats in DB
    const { data: campAfter } = await supabaseAdmin
      .from('email_campaigns')
      .select('stats')
      .eq('id', testCampaignId)
      .single();

    assert(campAfter.stats.delivered === 1, `Campaign delivered counter is exactly 1 (Zero double-counting: Got ${campAfter.stats.delivered})`);

    // 3. Test: Early Webhook Arriving Before Local Recipient Persistence (Reconciliation)
    console.log('\n[Test 2] Early Webhook Reconciled Once Recipient Appears:');
    const earlyMessageId = `early_msg_${testSuffix}`;
    const earlySvixId = `early_svix_${testSuffix}`;

    const earlyPayload = {
      type: 'email.delivered',
      data: {
        email_id: earlyMessageId,
        to: [`early_${testSuffix}@resend.dev`],
        created_at: new Date().toISOString(),
      },
    };

    const earlyReq = new Request('https://crm.mine-tech.be/api/webhooks/resend', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'svix-id': earlySvixId,
        'svix-timestamp': Math.floor(Date.now() / 1000).toString(),
        'svix-signature': 'test_sig',
      },
      body: JSON.stringify(earlyPayload),
    });

    const earlyRes = await resendWebhookHandler(earlyReq);
    const earlyJson = await earlyRes.json();
    assert(earlyJson.reconciliation_queued === true, 'Early webhook queued for reconciliation without data loss');

    // Now insert a distinct lead and the recipient matching earlyMessageId
    const { data: earlyLead } = await supabaseAdmin
      .from('leads')
      .insert({
        email: `early_${testSuffix}@resend.dev`,
        first_name: 'EarlyProspect',
      })
      .select()
      .single();

    const { data: lateRec, error: lateErr } = await supabaseAdmin
      .from('email_recipients')
      .insert({
        campaign_id: testCampaignId,
        lead_id: earlyLead.id,
        email: earlyLead.email,
        status: 'SENT',
        tokens: { resend_id: earlyMessageId },
      })
      .select()
      .single();

    if (lateErr || !lateRec) throw new Error(`Setup failed creating late recipient: ${lateErr?.message}`);

    // Trigger reconciliation
    const reconResult = await retryUnprocessedWebhooks();
    assert(reconResult.reconciled >= 1, 'Reconciliation worker reconciled pending early webhook');

    const { data: updatedLateRec } = await supabaseAdmin
      .from('email_recipients')
      .select('status')
      .eq('id', lateRec.id)
      .single();

    assert(updatedLateRec.status === 'DELIVERED', 'Late-appearing recipient successfully marked DELIVERED after reconciliation');

    // Clean up late recipient
    await supabaseAdmin.from('email_recipients').delete().eq('id', lateRec.id);

  } catch (err) {
    console.error('❌ [FATAL TEST ERROR]:', err.message);
    failed++;
  } finally {
    // Cleanup
    if (testRecipientId) await supabaseAdmin.from('email_recipients').delete().eq('id', testRecipientId);
    if (testCampaignId) await supabaseAdmin.from('email_campaigns').delete().eq('id', testCampaignId);
    if (testLeadId) await supabaseAdmin.from('leads').delete().eq('id', testLeadId);
    await supabaseAdmin.from('email_webhook_events').delete().in('event_id', [testSvixId, `early_svix_${testSuffix}`]);
  }

  console.log(`\n======================================================================`);
  console.log(`📊 WEBHOOK TRANSACTIONAL SAFETY RESULTS: ${passed} Passed / ${failed} Failed / ${skipped} Skipped`);
  console.log(`======================================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runWebhookTransactionalSafetyTests().catch(err => {
  console.error('Fatal runner error:', err);
  process.exit(1);
});
