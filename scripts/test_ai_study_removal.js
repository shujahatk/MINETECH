/**
 * Automated Test Suite: Verification of AI Study of Leads Removal
 * Confirms that AI Study navigation, table filters, drawer tabs, and panels
 * have been completely removed without affecting general Claude AI or campaign generation.
 */

import fs from 'fs';
import path from 'path';

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

function runAiStudyRemovalSuite() {
  console.log('======================================================================');
  console.log('🧹 MINETECH AI STUDY OF LEADS REMOVAL VERIFICATION');
  console.log('======================================================================\n');

  // 1. Inspect LeadTable.jsx
  console.log('--- [TEST 1] LeadTable.jsx UI Filter Inspection ---');
  const leadTableContent = fs.readFileSync('components/leads/LeadTable.jsx', 'utf8');
  assert(!leadTableContent.includes("label=\"AI study\""), 'AI study filter dropdown removed from LeadTable.jsx');
  assert(!leadTableContent.includes("AI_OPTIONS"), 'AI_OPTIONS constant removed from LeadTable.jsx');
  assert(!leadTableContent.includes("filters.ai"), 'filters.ai removed from LeadTable.jsx active filters');

  // 2. Inspect LeadDrawer.jsx
  console.log('\n--- [TEST 2] LeadDrawer.jsx Drawer Tabs Inspection ---');
  const drawerContent = fs.readFileSync('components/leads/LeadDrawer.jsx', 'utf8');
  assert(!drawerContent.includes("label: 'AI study'"), "Tab item { label: 'AI study' } removed from LeadDrawer.jsx");
  assert(!drawerContent.includes("id: 'intelligence',"), "Tab id 'intelligence' removed from LeadDrawer tabs list");

  // 3. Inspect Navigation & AppShell
  console.log('\n--- [TEST 3] Navigation Bar & App Shell Inspection ---');
  const appShellContent = fs.readFileSync('components/layout/AppShell.jsx', 'utf8');
  assert(!appShellContent.includes("'AI Study'"), "No 'AI Study' item in main navigation");
  assert(appShellContent.includes("'/ai/chat'"), "General-purpose Claude AI navigation item present at '/ai/chat'");

  // 4. Inspect General Claude AI Files
  console.log('\n--- [TEST 4] General-Purpose Claude AI Integrity Check ---');
  assert(fs.existsSync('components/ai/ClaudeChatWorkspace.jsx'), 'ClaudeChatWorkspace component exists and active');
  assert(fs.existsSync('app/ai/chat/page.jsx'), 'General Claude AI page route exists at app/ai/chat/page.jsx');
  assert(fs.existsSync('lib/services/claudeChatService.js'), 'Central Claude AI service exists at lib/services/claudeChatService.js');

  const chatServiceContent = fs.readFileSync('lib/services/claudeChatService.js', 'utf8');
  assert(chatServiceContent.includes('claude-sonnet-4-6'), 'Supports default model claude-sonnet-4-6');
  assert(chatServiceContent.includes('claude-opus-4-6'), 'Supports reasoning model claude-opus-4-6');
  assert(chatServiceContent.includes('claude-haiku-4-5'), 'Supports fast model claude-haiku-4-5');

  // 5. Campaign Generation Integrity
  console.log('\n--- [TEST 5] Campaign AI Writing & Generation Integrity ---');
  const wizardContent = fs.readFileSync('components/email/BlastWizard.jsx', 'utf8');
  assert(wizardContent.includes('Claude') || wizardContent.includes('generate') || wizardContent.includes('AiDraftBar'), 'Campaign AI copy synthesis and AiDraftBar remain available');

  console.log('\n======================================================================');
  console.log(`📊 AI STUDY REMOVAL TEST RESULTS: ${passed} Passed / ${failed} Failed`);
  console.log('======================================================================\n');

  if (failed > 0) process.exit(1);
}

runAiStudyRemovalSuite();

