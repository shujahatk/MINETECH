import dotenv from 'dotenv';
dotenv.config();

import {
  ensureMineTechSignatureText,
  ensureMineTechSignatureHtml,
  SIGNATURE_TEXT,
  SIGNATURE_HTML,
} from '../lib/utils/signature.js';
import { generateAIEmailDraft } from '../lib/services/aiService.js';
import { validateGeneratedEmail } from '../lib/ai/campaignPromptTemplates.js';

async function runTests() {
  console.log('--- Testing Abdullah Rauf / MineTech Signature Utilities ---');

  // Test 1: Plain text with generic signature
  const text1 = 'Hi John,\n\nI loved your latest announcement.\n\nBest regards,\nAlex';
  const outText1 = ensureMineTechSignatureText(text1);
  console.log('\n[Test 1: Replace generic signature]');
  console.log(outText1);
  if (!outText1.includes('Abdullah Rauf - Head of Sales') || !outText1.includes('Kernenergiestraat 19')) {
    throw new Error('Test 1 failed to append full signature');
  }

  // Test 2: Plain text with no signature
  const text2 = 'Hi Sarah,\n\nWould you be open for a quick demo this week?';
  const outText2 = ensureMineTechSignatureText(text2);
  console.log('\n[Test 2: Append missing signature]');
  console.log(outText2);
  if (!outText2.includes('Abdullah Rauf - Head of Sales') || !outText2.includes('Lamswaarde, Netherlands')) {
    throw new Error('Test 2 failed to append missing signature');
  }

  // Test 3: Upgrade legacy "MineTech Outbound" signature
  const text3 = 'Hi Mike,\n\nQuick follow up.\n\nRegards,\nMineTech Outbound';
  const outText3 = ensureMineTechSignatureText(text3);
  console.log('\n[Test 3: Upgrade legacy signature]');
  console.log(outText3);
  if (outText3.includes('MineTech Outbound') || !outText3.includes('Abdullah Rauf - Head of Sales')) {
    throw new Error('Test 3 failed: legacy signature not cleanly replaced');
  }

  // Test 4: Idempotency (running multiple times does not duplicate)
  const text4 = outText3;
  const outText4 = ensureMineTechSignatureText(text4);
  console.log('\n[Test 4: Idempotency test]');
  const count = (outText4.match(/Abdullah Rauf/g) || []).length;
  if (count !== 1) {
    throw new Error(`Test 4 failed: duplicated signature (found ${count} occurrences)`);
  }
  console.log('  ✅ Idempotency confirmed (exactly 1 signature found).');

  // Test 5: HTML replacement
  const html1 = '<p>Hi Alex,</p><p>Great to connect.</p><p>Best regards,<br/>Sales Team</p>';
  const outHtml1 = ensureMineTechSignatureHtml(html1);
  console.log('\n[Test 5: HTML replacement]');
  console.log(outHtml1);
  if (!outHtml1.includes('Abdullah Rauf') || !outHtml1.includes('BE 1011004868')) {
    throw new Error('Test 5 failed to replace HTML signature');
  }

  // Test 6: Campaign safety enforcement with signature
  console.log('\n[Test 6: Campaign safety enforcement]');
  const campaignEmail = validateGeneratedEmail({
    subject: 'Special Offer on High-Grade Kaolin',
    bodyHtml: '<p>Hi {{firstName}}, here is our latest industrial mineral catalog with complete TDS specifications.</p>',
  });
  console.log('Campaign HTML:\n', campaignEmail.bodyHtml);
  console.log('Campaign Text:\n', campaignEmail.bodyText);
  if (!campaignEmail.bodyHtml.includes('Abdullah Rauf') || !campaignEmail.bodyText.includes('Abdullah Rauf')) {
    throw new Error('Test 6 failed: Campaign email did not include signature');
  }
  console.log('  ✅ Campaign email safety successfully attached signature.');

  // Test 7: Claude AI Live Generation with Signature
  console.log('\n--- Test 7: Testing Live Claude Generation ---');
  const aiDraft = await generateAIEmailDraft({
    prompt: 'Pitch our industrial mineral supply (Kaolin and Bentonite) with TDS certification',
    tone: 'Professional',
    goal: 'Book Intro Call',
    leadContext: {
      name: 'David Miller',
      company: 'Miller Analytics',
      jobTitle: 'VP Growth',
      industry: 'Ceramics & Minerals',
    },
  });

  console.log('\n[Claude Generated Subject]:', aiDraft.subject);
  console.log('[Claude Generated Body]:\n', aiDraft.body);
  console.log('[Telemetry Model Used]:', aiDraft.telemetry.model);

  if (!aiDraft.body.includes('Abdullah Rauf - Head of Sales') || !aiDraft.body.includes('Kernenergiestraat 19')) {
    throw new Error('Claude AI draft failed to include official Abdullah Rauf sign-off');
  }

  console.log('\n======================================================================');
  console.log('🏆 ALL MINETECH SIGNATURE VERIFICATION TESTS PASSED SUCCESSFULLY!');
  console.log('======================================================================\n');
}

runTests().catch((err) => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
