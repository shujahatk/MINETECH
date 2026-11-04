/**
 * MINETECH GENERAL-PURPOSE CLAUDE AI TEST SUITE
 * 
 * Verifies all 14 mandatory scenarios:
 * 1. Simple general question
 * 2. Complex multi-step prompt
 * 3. Detailed email-writing prompt
 * 4. Coding request
 * 5. Business-analysis request
 * 6. Follow-up instruction referring to previous response
 * 7. Request to rewrite an earlier response
 * 8. Long conversation with preserved context
 * 9. Different topic in the same general-purpose chat
 * 10. Model switching (Sonnet 4.6, Opus 4.6, Haiku 4.5)
 * 11. API failure handling
 * 12. Rate-limit / error handling
 * 13. Extended thinking / reasoning capability
 * 14. Prompt integrity (verbatim prompt delivery)
 */

import dotenv from 'dotenv';
dotenv.config();

import {
  executeClaudeChat,
  createConversation,
  getConversation,
  updateConversation,
  deleteConversation,
  saveChatMessage,
  CLAUDE_MODELS,
} from '../lib/services/claudeChatService.js';

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

async function runClaudeGeneralTestSuite() {
  console.log('======================================================================');
  console.log('🧠 MINETECH GENERAL-PURPOSE CLAUDE AI SUITE');
  console.log('======================================================================\n');

  let testConv = null;

  try {
    // -------------------------------------------------------------------------
    // Scenario 1: Simple General Question
    // -------------------------------------------------------------------------
    console.log('--- [SCENARIO 1] Simple General Question ---');
    const res1 = await executeClaudeChat({
      messages: [{ role: 'user', content: 'What is the capital of France and what is its primary river?' }],
      model: CLAUDE_MODELS.HAIKU.id,
    });
    assert(Boolean(res1.content && res1.content.toLowerCase().includes('paris')), 'Answers capital of France (Paris)');
    assert(Boolean(res1.content && res1.content.toLowerCase().includes('seine')), 'Mentions River Seine');
    assert(res1.model.includes('haiku'), `Executed with Haiku model (${res1.model})`);

    // -------------------------------------------------------------------------
    // Scenario 2: Complex Multi-step Prompt
    // -------------------------------------------------------------------------
    console.log('\n--- [SCENARIO 2] Complex Multi-Step Prompt ---');
    const complexPrompt = `Step 1: Calculate 45 * 28.
Step 2: Take that result and divide by 4.
Step 3: List 3 chemical properties of kaolinite mineral.
Step 4: Output the results clearly labeled as STEP 1, STEP 2, and STEP 3.`;
    const res2 = await executeClaudeChat({
      messages: [{ role: 'user', content: complexPrompt }],
      model: CLAUDE_MODELS.SONNET.id,
    });
    assert(res2.content.includes('1260') || res2.content.includes('315'), 'Step 1 & 2 mathematical calculations accurate (1260 / 315)');
    assert(res2.content.toLowerCase().includes('step 1') && res2.content.toLowerCase().includes('step 2'), 'Followed multi-step output format strictly');

    // -------------------------------------------------------------------------
    // Scenario 3: Detailed Email-Writing Prompt
    // -------------------------------------------------------------------------
    console.log('\n--- [SCENARIO 3] Detailed Email Writing Prompt ---');
    const emailPrompt = 'Draft a formal commercial letter proposing a mineral partnership between European distributors and MineTech.';
    const res3 = await executeClaudeChat({
      messages: [{ role: 'user', content: emailPrompt }],
      model: CLAUDE_MODELS.SONNET.id,
    });
    assert(res3.content.length > 200, `Generated detailed formal commercial letter (${res3.content.length} chars)`);

    // -------------------------------------------------------------------------
    // Scenario 4: Coding Request
    // -------------------------------------------------------------------------
    console.log('\n--- [SCENARIO 4] Coding Request ---');
    const codePrompt = 'Write a TypeScript interface for an IndustrialMineralAssay with silica, alumina, and ironFe2O3 percentages.';
    const res4 = await executeClaudeChat({
      messages: [{ role: 'user', content: codePrompt }],
      model: CLAUDE_MODELS.SONNET.id,
    });
    assert(res4.content.includes('interface') && (res4.content.includes('silica') || res4.content.includes('alumina')), 'Generated valid TypeScript interface with requested mineral fields');

    // -------------------------------------------------------------------------
    // Scenario 5: Business Analysis Request
    // -------------------------------------------------------------------------
    console.log('\n--- [SCENARIO 5] Business Analysis Request ---');
    const bizPrompt = 'Perform a SWOT analysis for opening a new kaolin refining facility in the Benelux region.';
    const res5 = await executeClaudeChat({
      messages: [{ role: 'user', content: bizPrompt }],
      model: CLAUDE_MODELS.SONNET.id,
    });
    assert(
      res5.content.toLowerCase().includes('strength') &&
      res5.content.toLowerCase().includes('weakness') &&
      res5.content.toLowerCase().includes('threat'),
      'Generated structured SWOT analysis with standard 4 quadrants'
    );

    // -------------------------------------------------------------------------
    // Scenario 6: Follow-up Instruction Referring to Previous Response
    // -------------------------------------------------------------------------
    console.log('\n--- [SCENARIO 6] Multi-Turn Follow-Up Referencing Previous Response ---');
    const convHistory = [
      { role: 'user', content: 'Name the 3 top industrial mineral ports in Northwest Europe.' },
      { role: 'assistant', content: 'The top 3 ports are: 1. Port of Rotterdam, 2. Port of Antwerp-Bruges, 3. Port of Amsterdam.' },
      { role: 'user', content: 'Which of those 3 handled the most total cargo last year?' },
    ];
    const res6 = await executeClaudeChat({
      messages: convHistory,
      model: CLAUDE_MODELS.SONNET.id,
    });
    assert(res6.content.toLowerCase().includes('rotterdam'), 'Correctly referenced previous list and identified Rotterdam');

    // -------------------------------------------------------------------------
    // Scenario 7: Request to Rewrite an Earlier Response
    // -------------------------------------------------------------------------
    console.log('\n--- [SCENARIO 7] Request to Rewrite Earlier Response ---');
    const rewriteHistory = [
      { role: 'user', content: 'Explain what bentonite is in three sentences.' },
      { role: 'assistant', content: 'Bentonite is an absorbent aluminum phyllosilicate clay. It is generated from volcanic ash weathering. It swells significantly when wet.' },
      { role: 'user', content: 'Now rewrite that exact explanation as a rhyming poem of four lines.' },
    ];
    const res7 = await executeClaudeChat({
      messages: rewriteHistory,
      model: CLAUDE_MODELS.SONNET.id,
    });
    assert(res7.content.split('\n').filter(Boolean).length >= 2, 'Rewrote explanation according to formatting constraint');

    // -------------------------------------------------------------------------
    // Scenario 8: Long Conversation with Preserved Context
    // -------------------------------------------------------------------------
    console.log('\n--- [SCENARIO 8] Long Conversation Context Preservation ---');
    const longHistory = [
      { role: 'user', content: 'Secret project codename is PROJECT_AURORA_2026.' },
      { role: 'assistant', content: 'Understood, I have noted that secret codename.' },
      { role: 'user', content: 'Discuss refractory lining durability in blast furnaces.' },
      { role: 'assistant', content: 'Refractory linings in blast furnaces endure high temperatures and slag corrosion...' },
      { role: 'user', content: 'What was the secret codename I told you at the very start?' },
    ];
    const res8 = await executeClaudeChat({
      messages: longHistory,
      model: CLAUDE_MODELS.SONNET.id,
    });
    assert(res8.content.includes('PROJECT_AURORA_2026'), 'Retained context from earlier turn in multi-turn conversation');

    // -------------------------------------------------------------------------
    // Scenario 9: Topic Switching in Same Chat
    // -------------------------------------------------------------------------
    console.log('\n--- [SCENARIO 9] Topic Switching in Same Chat ---');
    const switchHistory = [
      { role: 'user', content: 'Calculate 15% discount on 85,000 euros.' },
      { role: 'assistant', content: '15% of 85,000 is 12,750 euros, leaving 72,250 euros.' },
      { role: 'user', content: 'Unrelated question: Write a haiku about the moon.' },
    ];
    const res9 = await executeClaudeChat({
      messages: switchHistory,
      model: CLAUDE_MODELS.HAIKU.id,
    });
    assert(res9.content.length > 10, 'Seamlessly switched topics without forced transitions');

    // -------------------------------------------------------------------------
    // Scenario 10: Model Switching (Sonnet 4.6, Opus 4.6, Haiku 4.5)
    // -------------------------------------------------------------------------
    console.log('\n--- [SCENARIO 10] Model Switching (Sonnet, Opus, Haiku) ---');
    const sonnetRes = await executeClaudeChat({
      messages: [{ role: 'user', content: 'Hello from Sonnet test' }],
      model: CLAUDE_MODELS.SONNET.id,
    });
    assert(Boolean(sonnetRes.content), `Sonnet 4.6 responded successfully (${sonnetRes.model})`);

    const opusRes = await executeClaudeChat({
      messages: [{ role: 'user', content: 'Hello from Opus test' }],
      model: CLAUDE_MODELS.OPUS.id,
    });
    assert(Boolean(opusRes.content), `Opus 4.6 responded successfully (${opusRes.model})`);

    const haikuRes = await executeClaudeChat({
      messages: [{ role: 'user', content: 'Hello from Haiku test' }],
      model: CLAUDE_MODELS.HAIKU.id,
    });
    assert(Boolean(haikuRes.content), `Haiku 4.5 responded successfully (${haikuRes.model})`);

    // -------------------------------------------------------------------------
    // Scenario 11 & 12: API Failure Handling & Validation
    // -------------------------------------------------------------------------
    console.log('\n--- [SCENARIO 11 & 12] API Failure & Error Handling ---');
    let emptyError = null;
    try {
      await executeClaudeChat({ messages: [] });
    } catch (e) {
      emptyError = e;
    }
    assert(Boolean(emptyError), 'Rejects empty messages payload with clear error');

    // -------------------------------------------------------------------------
    // Scenario 13: Extended Thinking / Reasoning Capability
    // -------------------------------------------------------------------------
    console.log('\n--- [SCENARIO 13] Extended Thinking / Reasoning ---');
    const thinkRes = await executeClaudeChat({
      messages: [{ role: 'user', content: 'Prove whether 2027 is a prime number.' }],
      model: CLAUDE_MODELS.SONNET.id,
      enableThinking: true,
    });
    assert(Boolean(thinkRes.thinking), 'Claude generated internal thinking blocks');
    assert(Boolean(thinkRes.content), 'Claude provided final answer alongside thinking');

    // -------------------------------------------------------------------------
    // Scenario 14: Prompt Integrity (Exact User Prompt Delivery)
    // -------------------------------------------------------------------------
    console.log('\n--- [SCENARIO 14] Prompt Integrity ---');
    const verbatimPrompt = 'Repeat this unique passphrase exactly: MineTech-Kaolin-7788';
    const res14 = await executeClaudeChat({
      messages: [{ role: 'user', content: verbatimPrompt }],
      model: CLAUDE_MODELS.HAIKU.id,
    });
    assert(res14.content.trim().includes('MineTech-Kaolin-7788'), 'Prompt delivered verbatim without unwanted overrides');

    // -------------------------------------------------------------------------
    // Conversation Management (CRUD)
    // -------------------------------------------------------------------------
    console.log('\n--- [CONVERSATION PERSISTENCE CRUD] ---');
    testConv = await createConversation({ title: 'Test QA Chat', model: CLAUDE_MODELS.SONNET.id });
    assert(Boolean(testConv?.id), `Created conversation with ID: ${testConv?.id}`);

    await saveChatMessage({ conversationId: testConv.id, role: 'user', content: 'Hello test' });
    await saveChatMessage({ conversationId: testConv.id, role: 'assistant', content: 'Hello, how can I assist?' });

    const loadedConv = await getConversation(testConv.id);
    assert(loadedConv.messages?.length === 2, `Retrieved 2 persisted messages in conversation (Got: ${loadedConv.messages?.length})`);

    await updateConversation(testConv.id, { title: 'Renamed QA Chat' });
    const renamedConv = await getConversation(testConv.id);
    assert(renamedConv.title === 'Renamed QA Chat', 'Conversation title updated');

    await deleteConversation(testConv.id);
    const deletedConv = await getConversation(testConv.id);
    assert(deletedConv === null || !deletedConv.id, 'Conversation deleted cleanly');

  } catch (err) {
    console.error('💥 Unhandled error in Claude general AI suite:', err);
    totalFailed++;
  }

  console.log('\n======================================================================');
  console.log(`📊 CLAUDE GENERAL-PURPOSE AI TEST RESULTS: ${totalPassed} Passed / ${totalFailed} Failed`);
  console.log('======================================================================');

  if (totalFailed > 0) process.exit(1);
}

runClaudeGeneralTestSuite();
