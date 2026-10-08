import dotenv from 'dotenv';
dotenv.config();

import {
  ensureMineTechSignatureText,
  ensureMineTechSignatureHtml,
  SIGNATURE_TEXT,
  SIGNATURE_HTML,
} from '../lib/utils/signature.js';
import { generateAIEmailDraft } from '../lib/services/aiService.js';

async function runTests() {
  console.log('--- Testing Signature Utilities ---');

  // Test 1: Plain text with generic signature
  const text1 = 'Hi John,\n\nI loved your latest announcement.\n\nBest regards,\nAlex';
  const outText1 = ensureMineTechSignatureText(text1);
  console.log('\n[Test 1: Replace generic signature]');
  console.log(outText1);
  if (!outText1.endsWith('Regards,\nMineTech Outbound')) {
    throw new Error('Test 1 failed to append Regards,\nMineTech Outbound');
  }

  // Test 2: Plain text with no signature
  const text2 = 'Hi Sarah,\n\nWould you be open for a quick demo this week?';
  const outText2 = ensureMineTechSignatureText(text2);
  console.log('\n[Test 2: Append missing signature]');
  console.log(outText2);
  if (!outText2.endsWith('Regards,\nMineTech Outbound')) {
    throw new Error('Test 2 failed to append Regards,\nMineTech Outbound');
  }

  // Test 3: Plain text already containing MineTech Outbound
  const text3 = 'Hi Mike,\n\nQuick follow up.\n\nRegards,\nMineTech Outbound';
  const outText3 = ensureMineTechSignatureText(text3);
  console.log('\n[Test 3: Existing signature idempotency]');
  console.log(outText3);
  if (!outText3.endsWith('Regards,\nMineTech Outbound') || (outText3.match(/MineTech Outbound/g) || []).length !== 1) {
    throw new Error('Test 3 failed: duplicated signature');
  }

  // Test 4: HTML replacement
  const html1 = '<p>Hi Alex,</p><p>Great to connect.</p><p>Best regards,<br/>Sales Team</p>';
  const outHtml1 = ensureMineTechSignatureHtml(html1);
  console.log('\n[Test 4: HTML replacement]');
  console.log(outHtml1);
  if (!outHtml1.includes('Regards,<br/>MineTech Outbound')) {
    throw new Error('Test 4 failed to replace HTML signature');
  }

  // Test 5: Claude AI Live Generation with Signature
  console.log('\n--- Testing Live Claude Generation ---');
  const aiDraft = await generateAIEmailDraft({
    prompt: 'Pitch our outbound prospecting pipeline acceleration service',
    tone: 'Professional',
    goal: 'Book Intro Call',
    leadContext: {
      name: 'David Miller',
      company: 'Miller Analytics',
      jobTitle: 'VP Growth',
      industry: 'B2B SaaS',
    },
  });

  console.log('\n[Claude Generated Subject]:', aiDraft.subject);
  console.log('[Claude Generated Body]:\n', aiDraft.body);
  console.log('[Telemetry Model Used]:', aiDraft.telemetry.model);

  if (!aiDraft.body.includes('MineTech Outbound')) {
    throw new Error('Claude AI draft failed to include MineTech Outbound sign-off');
  }

  console.log('\n✅ ALL MINETECH SIGNATURE VERIFICATION TESTS PASSED SUCCESSFULLY!');
}

runTests().catch((err) => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
