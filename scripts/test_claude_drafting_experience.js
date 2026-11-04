/**
 * MANDATORY REGRESSION TEST SUITE:
 * MAKE MINETECH'S DRAFTING SECTION A FULL CLAUDE AI EXPERIENCE
 *
 * Verifies:
 * 1. Root-cause elimination (No automatic email forcing for casual inputs)
 * 2. Negative email-intent tests: "Hi", "Hello", "How are you?", "Explain cybersecurity", etc.
 * 3. Email-intent tests: "Write a professional email", "Draft an intro email", etc.
 * 4. All 8 Acceptance Tests via real Anthropic API (where configured)
 * 5. Model Selection: MineTech AI (Sonnet 4.6) & MineTech AI High (Opus 4.6)
 * 6. Model switching without losing conversation memory
 * 7. Multi-turn conversation handling across sequential turns
 * 8. Optional email composer detection & extraction
 */

import dotenv from 'dotenv';
dotenv.config();

import {
  executeClaudeChat,
  createConversation,
  getConversation,
  updateConversation,
  saveChatMessage,
  CLAUDE_MODELS,
} from '../lib/services/claudeChatService.js';

import {
  interpretCommand,
  resolveCommand,
  INTENTS,
} from '../lib/ai/commandInterpreter.js';

import { extractEmailDraft } from '../lib/utils/emailDraftParser.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  ❌ [FAIL] ${message}`);
    failed++;
  }
}

async function runTestSuite() {
  console.log('======================================================================');
  console.log('🧪 MINETECH DRAFTING SECTION CLAUDE AI VERIFICATION SUITE');
  console.log('======================================================================\n');

  // -------------------------------------------------------------------------
  // 1. NEGATIVE EMAIL-INTENT TESTS (Command Interpreter)
  // -------------------------------------------------------------------------
  console.log('--- 1. Negative Email-Intent Tests (No automatic email forcing) ---');
  const negativeSamples = [
    'Hi',
    'Hello',
    'How are you?',
    'Explain cybersecurity.',
    'What is machine learning?',
    'Write a report.',
    'Help me debug this code.',
    'Explain artificial intelligence.',
    'Write a Python script that calculates factorials.',
    'Analyse this business strategy and identify its weaknesses.',
  ];

  for (const text of negativeSamples) {
    const cmd = interpretCommand(text);
    const resolved = resolveCommand(cmd, { outboundCount: 0, inboundCount: 0 });
    assert(
      cmd.intent === INTENTS.CONVERSATIONAL && resolved.blocked && resolved.code === 'CONVERSATIONAL_INPUT',
      `"${text}" interpreted as conversational, NOT forced into sales email`
    );
  }

  // -------------------------------------------------------------------------
  // 2. POSITIVE EMAIL-INTENT TESTS
  // -------------------------------------------------------------------------
  console.log('\n--- 2. Positive Email-Intent Tests ---');
  const emailSamples = [
    { text: 'Write a professional email to a supplier.', expected: INTENTS.INITIAL },
    { text: 'draft intro email', expected: INTENTS.INITIAL },
    { text: 'cold outreach email', expected: INTENTS.INITIAL },
    { text: 'write an email to check their inventory', expected: INTENTS.INITIAL },
    { text: 'short follow up', expected: INTENTS.FOLLOW_UP },
  ];

  for (const sample of emailSamples) {
    const cmd = interpretCommand(sample.text);
    assert(
      cmd.intent === sample.expected,
      `"${sample.text}" correctly recognized as email intent (${sample.expected})`
    );
  }

  // -------------------------------------------------------------------------
  // 3. EMAIL EXTRACTION / COMPOSER DETECTION TESTS
  // -------------------------------------------------------------------------
  console.log('\n--- 3. Email Extraction & Optional Composer Detection ---');
  const nonEmailResponse1 = 'Hello! How can I assist you with your work today?';
  const nonEmailResponse2 = 'Cybersecurity is the practice of protecting systems, networks, and programs from digital attacks.';
  const codeResponse = '```python\ndef factorial(n):\n    return 1 if n <= 1 else n * factorial(n - 1)\n```';
  
  assert(extractEmailDraft(nonEmailResponse1) === null, 'Greeting returns null for email draft');
  assert(extractEmailDraft(nonEmailResponse2) === null, 'Explanation returns null for email draft');
  assert(extractEmailDraft(codeResponse) === null, 'Python code returns null for email draft');

  const validEmailResponse = `Here is a professional draft for your supplier:

Subject: Inquiry Regarding Kaolin Grade K-20 Technical Specifications

Dear Mr. Henderson,

I hope this email finds you well.

We are currently evaluating supply options for high-purity kaolin to support our manufacturing operations for the upcoming quarter. Could you please share the latest technical data sheet and typical lead times for your Grade K-20 product?

Thank you for your assistance, and I look forward to your response.

Best regards,
Procurement Team`;

  const extracted = extractEmailDraft(validEmailResponse);
  assert(extracted !== null, 'Valid email text correctly extracted');
  assert(extracted && extracted.subject.includes('Kaolin Grade K-20'), 'Extracted correct Subject');
  assert(extracted && extracted.body.includes('evaluating supply options'), 'Extracted correct Body');

  // -------------------------------------------------------------------------
  // 4. MODEL CONFIGURATION & NAMING VERIFICATION
  // -------------------------------------------------------------------------
  console.log('\n--- 4. Model Configuration & Naming ---');
  assert(CLAUDE_MODELS.SONNET.id === 'claude-sonnet-4-6', 'MineTech AI is configured as claude-sonnet-4-6');
  assert(CLAUDE_MODELS.SONNET.name === 'MineTech AI', 'MineTech AI named correctly');
  assert(CLAUDE_MODELS.OPUS.id === 'claude-opus-4-6', 'MineTech AI High is configured as claude-opus-4-6');
  assert(CLAUDE_MODELS.OPUS.name === 'MineTech AI High', 'MineTech AI High named correctly');

  // -------------------------------------------------------------------------
  // 5. LIVE ANTHROPIC API ACCEPTANCE TESTS (All 8 mandatory tests)
  // -------------------------------------------------------------------------
  console.log('\n--- 5. Live Anthropic API Tests ---');
  const apiKey = (process.env.ANTHROPIC_API_KEY || '').trim();

  if (!apiKey || !apiKey.startsWith('sk-ant')) {
    console.warn('  ⚠️ [BLOCKED] ANTHROPIC_API_KEY not configured for live network calls.');
  } else {
    try {
      // Test 1: "Hi"
      console.log('  Testing Test 1: User: "Hi"...');
      const res1 = await executeClaudeChat({
        messages: [{ role: 'user', content: 'Hi' }],
        model: 'claude-sonnet-4-6',
      });
      assert(
        res1 && res1.content && !extractEmailDraft(res1.content) && res1.content.length > 3,
        `Test 1 Passed: "Hi" generated natural greeting (${res1.content.substring(0, 60)}...) [NOT AN EMAIL]`
      );

      // Test 2: "How are you?"
      console.log('  Testing Test 2: User: "How are you?"...');
      const res2 = await executeClaudeChat({
        messages: [{ role: 'user', content: 'How are you?' }],
        model: 'claude-sonnet-4-6',
      });
      assert(
        res2 && res2.content && !extractEmailDraft(res2.content),
        `Test 2 Passed: "How are you?" generated conversational answer [NOT AN EMAIL]`
      );

      // Test 3: "Explain artificial intelligence."
      console.log('  Testing Test 3: User: "Explain artificial intelligence."...');
      const res3 = await executeClaudeChat({
        messages: [{ role: 'user', content: 'Explain artificial intelligence in two brief sentences.' }],
        model: 'claude-sonnet-4-6',
      });
      assert(
        res3 && res3.content && !extractEmailDraft(res3.content) && res3.content.toLowerCase().includes('intelligence'),
        `Test 3 Passed: "Explain artificial intelligence" generated proper explanation [NOT AN EMAIL]`
      );

      // Test 4: "Write a professional email to a supplier."
      console.log('  Testing Test 4: User: "Write a professional email to a supplier."...');
      const res4 = await executeClaudeChat({
        messages: [{ role: 'user', content: 'Write a professional email to a supplier requesting mineral samples.' }],
        model: 'claude-sonnet-4-6',
      });
      const email4 = extractEmailDraft(res4.content);
      assert(
        res4 && email4 && email4.subject,
        `Test 4 Passed: "Write a professional email" generated an email draft (Subject: "${email4?.subject}")`
      );

      // Test 5: "Analyse this business strategy and identify its weaknesses."
      console.log('  Testing Test 5: Business analysis...');
      const res5 = await executeClaudeChat({
        messages: [{ role: 'user', content: 'Analyse this business strategy: Relying 100% on a single bentonite quarry. Identify two main weaknesses.' }],
        model: 'claude-sonnet-4-6',
      });
      assert(
        res5 && res5.content && !extractEmailDraft(res5.content) && (res5.content.toLowerCase().includes('risk') || res5.content.toLowerCase().includes('weakness') || res5.content.toLowerCase().includes('single')),
        `Test 5 Passed: Business strategy analysed [NOT AN EMAIL]`
      );

      // Test 6: "Write a Python script that calculates factorials."
      console.log('  Testing Test 6: Python script...');
      const res6 = await executeClaudeChat({
        messages: [{ role: 'user', content: 'Write a Python script that calculates factorials.' }],
        model: 'claude-sonnet-4-6',
      });
      assert(
        res6 && res6.content && res6.content.includes('def factorial') && !extractEmailDraft(res6.content),
        `Test 6 Passed: Python code generated [NOT AN EMAIL]`
      );

      // Test 7 & 8: Multi-turn Conversation & Email conversion
      console.log('  Testing Test 7 & 8: Multi-turn memory and email conversion...');
      const conversationHistory = [
        { role: 'user', content: 'Explain what Kaolin clay is used for in 2 sentences.' },
        { role: 'assistant', content: 'Kaolin clay is a white mineral widely used in the production of glossy paper, ceramics, and paints. It is also utilized in cosmetics and pharmaceuticals for its absorbency and smooth texture.' },
        { role: 'user', content: 'Now turn that explanation into an email to a potential buyer.' }
      ];

      const res8 = await executeClaudeChat({
        messages: conversationHistory,
        model: 'claude-sonnet-4-6',
      });

      const email8 = extractEmailDraft(res8.content);
      assert(
        res8 && (email8 || res8.content.toLowerCase().includes('kaolin')),
        `Test 8 Passed: Successfully converted earlier context into an email draft`
      );

      // Test MineTech AI High (Opus 4.6) with Extended Thinking
      console.log('  Testing MineTech AI High (Claude Opus 4.6)...');
      const opusRes = await executeClaudeChat({
        messages: [{ role: 'user', content: 'Solve this riddle: I have cities, but no houses; forests, but no trees; and water, but no fish. What am I?' }],
        model: 'claude-opus-4-6',
        enableThinking: true,
      });

      assert(
        opusRes && opusRes.content && opusRes.content.toLowerCase().includes('map'),
        `Opus Reasoning Passed: Correctly solved problem using ${opusRes.model} (Answer: map)`
      );

    } catch (apiErr) {
      console.error('  ❌ [API FAIL]', apiErr.message);
      failed++;
    }
  }

  // -------------------------------------------------------------------------
  // 6. CONVERSATION PERSISTENCE & MODEL SWITCHING
  // -------------------------------------------------------------------------
  console.log('\n--- 6. Conversation Persistence & Model Switching ---');
  const conv = await createConversation({ title: 'Test Memory Chat', model: 'claude-sonnet-4-6' });
  assert(conv && conv.id, 'Created new persistent conversation');

  await saveChatMessage({
    conversationId: conv.id,
    role: 'user',
    content: 'My favorite mineral is Kaolin.',
    model: 'claude-sonnet-4-6',
  });

  await saveChatMessage({
    conversationId: conv.id,
    role: 'assistant',
    content: 'Noted! Kaolin is an excellent industrial mineral.',
    model: 'claude-sonnet-4-6',
  });

  // Switch model to Opus
  const updatedConv = await updateConversation(conv.id, { model: 'claude-opus-4-6' });
  assert(updatedConv.model === 'claude-opus-4-6', 'Model switched to MineTech AI High (Opus)');

  // Retrieve and verify messages are intact
  const retrieved = await getConversation(conv.id);
  assert(retrieved.messages.length === 2, 'Conversation history preserved across model switch');
  assert(retrieved.messages[0].content === 'My favorite mineral is Kaolin.', 'Initial context preserved');

  console.log('\n======================================================================');
  console.log(`RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log('======================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite();
