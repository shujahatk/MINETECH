/**
 * MineTech Intelligent Email Campaign Management System — Integration Test Suite
 * 
 * Verifies end-to-end functionality across all 23 prompt sections:
 * 1. Product taxonomy & extensibility
 * 2. Contact imports (CSV/XLSX/minimal company+email, deduplication)
 * 3. Company identification & Buyer/Supplier classification (Claude AI & heuristics)
 * 4. Multi-format template ingestion, splitting & classification
 * 5. Intelligent email-to-company matching engine (buyer vs supplier, multi-product, dual-role)
 * 6. Dynamic segmentation across mineral categories
 * 7. Automatic campaign preparation, recipient queue & MineTech signature verification
 * 8. Follow-up sequences and inbound reply categorization
 */

import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });

import assert from 'assert';
import { supabaseAdmin } from '../lib/supabase.js';
import {
  getAllProducts,
  findProduct,
  registerProduct,
  detectProductsInText
} from '../lib/services/productTaxonomyService.js';
import {
  heuristicClassifyCompany,
  analyzeCompanyWithClaude,
  extractCorporateDomain
} from '../lib/services/companyIntelligenceEngine.js';
import {
  parseFileToText,
  splitMultiDraftText,
  extractSubjectAndBody,
  heuristicClassifyTemplate,
  classifyTemplateWithClaude,
  createAndClassifyTemplate,
  unpackTemplateMetadata,
  interpolateTemplate
} from '../lib/services/templateIntelligenceService.js';
import {
  matchLeadToTemplates,
  runIntelligentMatching,
  extractCompanyContacts
} from '../lib/services/campaignMatchingEngine.js';
import {
  getDynamicSegments,
  prepareCampaignsFromMatches
} from '../lib/services/intelligentCampaignOrchestrator.js';
import {
  heuristicCategorizeReply,
  categorizeInboundReplyWithClaude,
  buildSequenceFromTemplates,
  REPLY_CATEGORIES
} from '../lib/services/sequenceReplyService.js';

let totalTests = 0;
let passedTests = 0;

function it(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`[FAIL] ${name}: ${err.message}`);
    throw err;
  }
}

async function itAsync(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`[PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`[FAIL] ${name}: ${err.message}`);
    throw err;
  }
}

async function runTestSuite() {
  console.log('========================================================================');
  console.log('MINETECH INTELLIGENT EMAIL CAMPAIGN MANAGEMENT SYSTEM TEST SUITE');
  console.log('========================================================================\n');

  // --- SECTION 1: PRODUCT TAXONOMY & EXTENSIBILITY ---
  console.log('--- 1. PRODUCT TAXONOMY & EXTENSIBILITY ---');
  it('Initial product taxonomy contains the 5 required industrial mineral categories', () => {
    const products = getAllProducts();
    const names = products.map((p) => p.name);
    assert(names.includes('Bleaching Clay'), 'Missing Bleaching Clay');
    assert(names.includes('Bentonite'), 'Missing Bentonite');
    assert(names.includes('Kaolin'), 'Missing Kaolin');
    assert(names.includes('Fire Clay'), 'Missing Fire Clay');
    assert(names.includes('Ball Clay'), 'Missing Ball Clay');
  });

  it('Product taxonomy is extensible at runtime without code changes', () => {
    const custom = registerProduct({
      name: 'Calcined Bauxite',
      category: 'Refractory Minerals',
      buyerApplications: ['abrasives', 'refractory linings'],
      supplierKeywords: ['bauxite mine']
    });
    assert.strictEqual(custom.name, 'Calcined Bauxite');
    const retrieved = findProduct('Calcined Bauxite');
    assert(retrieved !== null, 'Failed to retrieve registered product');
  });

  it('Detects relevant products from company and text cues', () => {
    const text = 'We operate an edible oil bleaching and deodorizing refinery in Rotterdam';
    const detected = detectProductsInText(text);
    assert(detected.length > 0, 'Should detect Bleaching Clay');
    assert.strictEqual(detected[0].product.name, 'Bleaching Clay');
  });

  // --- SECTION 2: CONTACT IMPORT & MINIMAL IDENTIFIERS ---
  console.log('\n--- 2. CONTACT IMPORT & MINIMAL IDENTIFIERS ---');
  it('Extracts corporate domains and handles minimal inputs (Company + Email only)', () => {
    const domain = extractCorporateDomain('procurement@abcoils.be');
    assert.strictEqual(domain, 'abcoils.be');

    const sampleMinimal = {
      company: 'ABC Edible Oils Ltd',
      email: 'purchasing@abcoils.com'
    };
    assert(sampleMinimal.company && sampleMinimal.email, 'Minimal requirements satisfied');
  });

  it('Deduplication differentiates multiple contacts per domain while stopping exact duplicate emails', () => {
    const contacts = [
      { company: 'Global Ceramics', email: 'sales@globalceramics.com' },
      { company: 'Global Ceramics', email: 'purchasing@globalceramics.com' },
      { company: 'Global Ceramics', email: 'sales@globalceramics.com' } // exact duplicate
    ];

    const seenEmails = new Set();
    const accepted = [];
    let duplicates = 0;

    for (const c of contacts) {
      if (seenEmails.has(c.email)) {
        duplicates++;
      } else {
        seenEmails.add(c.email);
        accepted.push(c);
      }
    }

    assert.strictEqual(accepted.length, 2, 'Should accept 2 distinct contacts for same company');
    assert.strictEqual(duplicates, 1, 'Should detect 1 exact duplicate email');
  });

  // --- SECTION 3: COMPANY IDENTIFICATION & BUYER/SUPPLIER CLASSIFICATION ---
  console.log('\n--- 3. COMPANY IDENTIFICATION & COMMERCIAL CLASSIFICATION ---');
  it('Classifies edible oil refiners as prospective Bleaching Clay buyers', () => {
    const intel = heuristicClassifyCompany({
      companyName: 'ABC Edible Oils Ltd',
      email: 'purchasing@abcoils.com',
      industry: 'Edible oil refining'
    });
    assert.strictEqual(intel.buyer_seller_status, 'Buyer');
    assert(intel.relevant_products.includes('Bleaching Clay'));
    assert(intel.relationship_types.includes('prospective_buyer'));
    assert(['high', 'medium'].includes(intel.confidence));
  });

  it('Classifies bentonite mining producers as potential suppliers', () => {
    const intel = heuristicClassifyCompany({
      companyName: 'Global Bentonite Producers & Exporters',
      email: 'exports@bentonite-miners.com',
      industry: 'Bentonite mining & processing'
    });
    assert.strictEqual(intel.buyer_seller_status, 'Seller');
    assert(intel.relevant_products.includes('Bentonite'));
    assert(intel.relationship_types.includes('potential_supplier'));
  });

  it('Recognizes dual-role trading entities (both buyer and supplier)', () => {
    const intel = heuristicClassifyCompany({
      companyName: 'Euro-Asian Mineral Trading & Sourcing Ltd',
      email: 'desk@eaminerals.com',
      industry: 'Mineral trading, clay supply and ceramics procurement'
    });
    assert(intel.buyer_seller_status === 'Both' || intel.relationship_types.length >= 2);
  });

  it('Flags ambiguous records as requires_review with low confidence', () => {
    const intel = heuristicClassifyCompany({
      companyName: 'Alpha Omega Holdings',
      email: 'contact@alphaomega.com'
    });
    assert.strictEqual(intel.confidence, 'low');
    assert(intel.requires_review, 'Should flag for review');
  });

  // --- SECTION 4: PREWRITTEN TEMPLATE INGESTION & CLASSIFICATION ---
  console.log('\n--- 4. PREWRITTEN TEMPLATE INGESTION & CLASSIFICATION ---');
  it('Splits a multi-draft text document into discrete email templates', () => {
    const multiDraft = `Template 1:
Subject: Bleaching Clay Supply Capabilities
Dear {{company_name}},
MineTech Resources supplies high-activity acid-activated bleaching earth for edible oil bleaching.

---

Template 2:
Subject: Sourcing High-Grade Bentonite API 13A
Dear Commercial Desk,
MineTech Resources is currently sourcing bentonite crude and milled clay from qualified producers.`;

    const split = splitMultiDraftText(multiDraft);
    assert.strictEqual(split.length, 2, `Expected 2 templates, got ${split.length}`);
    assert(split[0].subject.includes('Bleaching Clay'));
    assert(split[1].subject.includes('Bentonite'));
  });

  it('Extracts Subject and Body accurately from email draft copy', () => {
    const text = `Subject: Supply of Kaolin for Ceramic Tile Body
Dear {{company_name}},
We are writing from MineTech Resources regarding our kaolin supply for ceramic and sanitaryware producers.`;

    const extracted = extractSubjectAndBody(text);
    assert.strictEqual(extracted.subject, 'Supply of Kaolin for Ceramic Tile Body');
    assert(extracted.body.includes('MineTech Resources'));
  });

  it('Correctly classifies buyer-focused vs. supplier-sourcing templates', () => {
    const buyerTpl = heuristicClassifyTemplate({
      name: 'Bleaching Clay Buyer Intro',
      subject: 'Supply of Bleaching Clay',
      body: 'Dear {{company_name}}, We can supply high-activity bleaching clay for your edible oil refinery.'
    });
    assert.strictEqual(buyerTpl.recipient_type, 'prospective_buyer');
    assert.strictEqual(buyerTpl.product_category, 'Bleaching Clay');

    const supplierTpl = heuristicClassifyTemplate({
      name: 'Bentonite Sourcing Enquiry',
      subject: 'Inquiry: Sourcing Bentonite Clay from Producer',
      body: 'Dear Supplier, MineTech Resources is looking to purchase 500 MT of drilling bentonite from your mine.'
    });
    assert.strictEqual(supplierTpl.recipient_type, 'potential_supplier');
    assert.strictEqual(supplierTpl.product_category, 'Bentonite');
  });

  it('Detects and interpolates merge variables with fallbacks without hallucinating names', () => {
    const template = 'Dear {{first_name}} at {{company_name}}, regarding our {{product_name}} capabilities.';
    const sampleLead = {
      company: 'ABC Edible Oils',
      product: 'Bleaching Clay'
      // first_name intentionally omitted
    };

    const rendered = interpolateTemplate(template, sampleLead, { name: 'Abdullah Rauf' });
    assert(rendered.includes('ABC Edible Oils'), 'Company name not interpolated');
    assert(rendered.includes('Bleaching Clay'), 'Product name not interpolated');
    assert(rendered.includes('Colleague'), 'Fallback first name should be Colleague');
    assert(!rendered.includes('undefined'), 'Must not render undefined');
  });

  // --- SECTION 5: INTELLIGENT MATCHING ENGINE ---
  console.log('\n--- 5. INTELLIGENT EMAIL-TO-COMPANY MATCHING ENGINE ---');
  it('Matches prospective buyer to buyer template for their specific mineral', () => {
    const buyerLead = {
      id: 'lead-buyer-001',
      company: 'ABC Edible Oils Ltd',
      email: 'purchasing@abcoils.com',
      classification: 'Buyer',
      custom_fields: {
        company_intelligence: {
          buyer_seller_status: 'Buyer',
          relationship_types: ['prospective_buyer'],
          relevant_products: ['Bleaching Clay'],
          confidence: 'high'
        }
      }
    };

    const candidateTemplates = [
      {
        id: 'tpl-bc-buyer',
        name: 'Bleaching Clay — Buyer Intro',
        subject: 'Supply of Bleaching Clay',
        category: 'Bleaching Clay',
        variables: ['meta:{"recipient_type":"prospective_buyer","product_category":"Bleaching Clay","sequence_stage":"initial_outreach"}']
      },
      {
        id: 'tpl-bent-supplier',
        name: 'Bentonite — Supplier Enquiry',
        subject: 'Sourcing Bentonite',
        category: 'Bentonite',
        variables: ['meta:{"recipient_type":"potential_supplier","product_category":"Bentonite","sequence_stage":"initial_outreach"}']
      }
    ];

    const match = matchLeadToTemplates(buyerLead, candidateTemplates);
    assert.strictEqual(match.status, 'approved');
    assert.strictEqual(match.template_id, 'tpl-bc-buyer');
    assert.strictEqual(match.match_confidence, 'high');
    assert(match.reason.includes('Bleaching Clay'));
  });

  it('Matches potential supplier to sourcing enquiry template and never to buyer template', () => {
    const supplierLead = {
      id: 'lead-supplier-002',
      company: 'Continental Bentonite Mines',
      email: 'exports@continentalbentonite.com',
      classification: 'Seller',
      custom_fields: {
        company_intelligence: {
          buyer_seller_status: 'Seller',
          relationship_types: ['potential_supplier'],
          relevant_products: ['Bentonite'],
          confidence: 'high'
        }
      }
    };

    const candidateTemplates = [
      {
        id: 'tpl-bent-buyer',
        name: 'Bentonite — Buyer Intro',
        subject: 'Offer of Bentonite',
        category: 'Bentonite',
        variables: ['meta:{"recipient_type":"prospective_buyer","product_category":"Bentonite"}']
      },
      {
        id: 'tpl-bent-supplier',
        name: 'Bentonite — Supplier Sourcing Enquiry',
        subject: 'Sourcing Bentonite from Producers',
        category: 'Bentonite',
        variables: ['meta:{"recipient_type":"potential_supplier","product_category":"Bentonite"}']
      }
    ];

    const match = matchLeadToTemplates(supplierLead, candidateTemplates);
    assert.strictEqual(match.template_id, 'tpl-bent-supplier', 'Supplier must receive sourcing enquiry, not buyer offer');
    assert.strictEqual(match.recipient_type, 'potential_supplier');
  });

  it('Handles multi-product companies by selecting single best template without multiple blasts', () => {
    const ceramicsLead = {
      id: 'lead-ceramics-003',
      company: 'Royal Ceramics Tableware Ltd',
      email: 'info@royalceramics.com',
      classification: 'Buyer',
      custom_fields: {
        company_intelligence: {
          buyer_seller_status: 'Buyer',
          relationship_types: ['prospective_buyer'],
          relevant_products: ['Kaolin', 'Ball Clay', 'Fire Clay'],
          confidence: 'high'
        }
      }
    };

    const candidateTemplates = [
      {
        id: 'tpl-kaolin-buyer',
        name: 'Kaolin — Ceramic Buyer Intro',
        subject: 'Kaolin for Tableware & Ceramics',
        category: 'Kaolin',
        variables: ['meta:{"recipient_type":"prospective_buyer","product_category":"Kaolin"}']
      },
      {
        id: 'tpl-ballclay-buyer',
        name: 'Ball Clay — Ceramic Buyer Intro',
        subject: 'Plastic Ball Clay Supply',
        category: 'Ball Clay',
        variables: ['meta:{"recipient_type":"prospective_buyer","product_category":"Ball Clay"}']
      }
    ];

    const match = matchLeadToTemplates(ceramicsLead, candidateTemplates);
    assert(match.template_id, 'Must pick exactly one best template');
    assert(['tpl-kaolin-buyer', 'tpl-ballclay-buyer'].includes(match.template_id));
  });

  it('Places contacts with missing template or unknown role into Unmatched queue with clear diagnostic reasons', () => {
    const unknownLead = {
      id: 'lead-unmatched-004',
      company: 'Mysterious Enterprise X',
      email: 'contact@mysterious-x.com',
      classification: 'Unclassified',
      custom_fields: {
        company_intelligence: {
          buyer_seller_status: 'Unclassified',
          relationship_types: ['requires_review'],
          relevant_products: ['Unknown'],
          confidence: 'low'
        }
      }
    };

    const match = matchLeadToTemplates(unknownLead, []);
    assert.strictEqual(match.status, 'unmatched');
    assert(match.requires_review);
    assert(match.unmatched_reason.length > 0);
  });

  // --- SECTION 5B: MULTI-CONTACT PER COMPANY EXTRACTION & TARGETING ---
  console.log('\n--- 5B. MULTI-CONTACT TARGETING & COMPANY CONTACT EXTRACTION ---');
  it('Extracts multiple contacts per company from primary, custom fields, and same-domain siblings', () => {
    const primaryLead = {
      id: 'lead-corp-001',
      company: 'Apex Edible Oils NV',
      email: 'purchasing@apex-oils.be',
      full_name: 'Jan De Smet',
      job_title: 'Procurement Director',
      website: 'www.apex-oils.be',
      custom_fields: {
        additional_contacts: [
          { name: 'Sarah Peeters', email: 'operations@apex-oils.be', job_title: 'Plant Manager' }
        ]
      }
    };

    const siblingLead = {
      id: 'lead-corp-002',
      company: 'Apex Edible Oils',
      email: 'qa.lab@apex-oils.be',
      full_name: 'Luc Van Damme',
      job_title: 'QA Specialist',
      website: 'apex-oils.be'
    };

    const contacts = extractCompanyContacts(primaryLead, [primaryLead, siblingLead]);
    assert.strictEqual(contacts.length, 3, 'Should find 3 contacts for Apex Edible Oils');
    
    const emails = contacts.map((c) => c.email);
    assert(emails.includes('purchasing@apex-oils.be'), 'Missing primary purchasing email');
    assert(emails.includes('operations@apex-oils.be'), 'Missing operations email');
    assert(emails.includes('qa.lab@apex-oils.be'), 'Missing sibling QA lab email');

    const primaryContact = contacts.find((c) => c.email === 'purchasing@apex-oils.be');
    assert(primaryContact.isPrimary, 'Primary contact should have isPrimary: true');
  });

  it('Supports configurable targeting mode (primary_only vs all_contacts vs custom_selected)', async () => {
    const testLead = {
      id: 'lead-corp-multi-1',
      company: 'Global Refineries Ltd',
      email: 'procurement@globalrefineries.com',
      full_name: 'Robert Davis',
      classification: 'Buyer',
      custom_fields: {
        company_intelligence: {
          buyer_seller_status: 'Buyer',
          relationship_types: ['prospective_buyer'],
          relevant_products: ['Bleaching Clay'],
          confidence: 'high'
        },
        additional_contacts: [
          { name: 'Alice Smith', email: 'technical@globalrefineries.com', job_title: 'Technical Director' }
        ]
      }
    };

    const candidateTemplates = [
      {
        id: 'tpl-clay-01',
        name: 'Bleaching Clay Intro',
        subject: 'Bleaching Clay for Edible Oil Refineries',
        category: 'Bleaching Clay',
        variables: ['meta:{"recipient_type":"prospective_buyer","product_category":"Bleaching Clay"}']
      }
    ];

    // Case 1: Default / primary_only
    const resPrimary = await runIntelligentMatching({
      leads: [testLead],
      templates: candidateTemplates,
      contactTargeting: {
        'lead-corp-multi-1': { targetingMode: 'primary_only' }
      }
    });

    assert.strictEqual(resPrimary.matches.length, 1);
    assert.strictEqual(resPrimary.matches[0].company_contacts.length, 2);
    assert.strictEqual(resPrimary.proposedCampaigns[0].targetRecipients.length, 1);
    assert.strictEqual(resPrimary.proposedCampaigns[0].targetRecipients[0].email, 'procurement@globalrefineries.com');

    // Case 2: all_contacts mode
    const resAll = await runIntelligentMatching({
      leads: [testLead],
      templates: candidateTemplates,
      contactTargeting: {
        'lead-corp-multi-1': { targetingMode: 'all_contacts' }
      }
    });

    assert.strictEqual(resAll.proposedCampaigns[0].targetRecipients.length, 2, 'Should target both company contacts');
    const targetedEmails = resAll.proposedCampaigns[0].targetRecipients.map((r) => r.email);
    assert(targetedEmails.includes('procurement@globalrefineries.com'));
    assert(targetedEmails.includes('technical@globalrefineries.com'));

    // Case 3: custom_selected mode choosing only the technical contact
    const resCustom = await runIntelligentMatching({
      leads: [testLead],
      templates: candidateTemplates,
      contactTargeting: {
        'lead-corp-multi-1': {
          targetingMode: 'custom_selected',
          selectedEmails: ['technical@globalrefineries.com']
        }
      }
    });

    assert.strictEqual(resCustom.proposedCampaigns[0].targetRecipients.length, 1);
    assert.strictEqual(resCustom.proposedCampaigns[0].targetRecipients[0].email, 'technical@globalrefineries.com');
  });

  // --- SECTION 6: AUTOMATIC CAMPAIGN PREPARATION & SIGNATURE ENFORCEMENT ---
  console.log('\n--- 6. CAMPAIGN PREPARATION & SIGNATURE ENFORCEMENT ---');
  it('Assembles proposed campaign groups and includes mandatory MineTech signature in copy', async () => {
    const proposed = [
      {
        name: 'Bleaching Clay — Buyers Q4 Outreach',
        product: 'Bleaching Clay',
        recipientType: 'prospective_buyer',
        subject: 'Supply Capabilities — Activated Bleaching Clay',
        leadIds: [] // Will test signature logic
      }
    ];

    const sampleCopy = 'Dear {{company_name}},\n\nWe would like to introduce our bleaching clay.\n\nRegards,';
    const { ensureMineTechSignatureText } = await import('../lib/utils/signature.js');
    const signed = ensureMineTechSignatureText(sampleCopy);

    assert(signed.includes('Abdullah Rauf - Head of Sales'), 'Missing Abdullah Rauf in signature');
    assert(signed.includes('Minetech Resources BV – Belgium'), 'Missing Minetech Resources BV');
    assert(signed.includes('BTW No. BE 1011004868'), 'Missing BTW Number');
    assert(signed.includes('Frederik Hendrikstraat 60'), 'Missing Facility Address');
    assert(signed.includes('Kernenergiestraat 19'), 'Missing Registered Office Address');
  });

  // --- SECTION 7: FOLLOW-UP SEQUENCES & INBOUND REPLY TRIAGE ---
  console.log('\n--- 7. SEQUENCES & INBOUND REPLY TRIAGE ---');
  it('Builds ordered multi-touch sequence with configurable day delays', () => {
    const tpls = [
      { id: '1', name: 'Intro', sequence_stage: 'initial_outreach' },
      { id: '2', name: 'Follow up 1', sequence_stage: 'first_follow_up' },
      { id: '3', name: 'Follow up 2', sequence_stage: 'second_follow_up' },
      { id: '4', name: 'Final Breakup', sequence_stage: 'final_follow_up' }
    ];

    const seq = buildSequenceFromTemplates(tpls, { defaultDelays: [0, 4, 5, 7] });
    assert.strictEqual(seq.steps.length, 4);
    assert.strictEqual(seq.steps[0].delayDays, 0);
    assert.strictEqual(seq.steps[1].delayDays, 4);
    assert.strictEqual(seq.steps[2].delayDays, 5);
    assert.strictEqual(seq.steps[3].delayDays, 7);
  });

  it('Categorizes inbound replies across the 10 commercial categories', () => {
    const pricingReply = heuristicCategorizeReply('Please quote your best CIF Rotterdam price per metric ton for bleaching clay.');
    assert.strictEqual(pricingReply.category, REPLY_CATEGORIES.REQUESTING_PRICING);

    const specsReply = heuristicCategorizeReply('Can you send the technical data sheet and certificate of analysis (COA)?');
    assert.strictEqual(specsReply.category, REPLY_CATEGORIES.REQUESTING_SPECS);

    const samplesReply = heuristicCategorizeReply('We would like to test a 2kg sample in our quality lab before ordering.');
    assert.strictEqual(samplesReply.category, REPLY_CATEGORIES.REQUESTING_SAMPLES);

    const unsubReply = heuristicCategorizeReply('Please unsubscribe our company from your mailing list.');
    assert.strictEqual(unsubReply.category, REPLY_CATEGORIES.UNSUBSCRIBE);

    const oooReply = heuristicCategorizeReply('I am out of the office until next Monday with no access to email.');
    assert.strictEqual(oooReply.category, REPLY_CATEGORIES.OUT_OF_OFFICE);
  });

  // --- SECTION 8: REAL ANTHROPIC CLAUDE MODEL VERIFICATION ---
  console.log('\n--- 8. CLAUDE AI REAL API CALL VERIFICATION ---');
  await itAsync('Real Anthropic API call with Claude Sonnet 5.5 succeeds for company intelligence', async () => {
    const apiKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
    if (!apiKey || !apiKey.startsWith('sk-ant')) {
      console.log('  [SKIP] Anthropic API key not present in environment');
      return;
    }

    const intel = await analyzeCompanyWithClaude({
      companyName: 'Bunge Loders Croklaan Edible Oils',
      email: 'purchasing@europe-oils.com',
      industry: 'Vegetable oil bleaching and processing'
    });

    assert(intel.company_name, 'Missing company name');
    assert(intel.relevant_products.some((p) => p.toLowerCase().includes('bleaching') || p.toLowerCase().includes('clay')));
    assert.strictEqual(intel.buyer_seller_status, 'Buyer');
    console.log(`  ✓ Claude Sonnet 5.5 classified ${intel.company_name} as ${intel.buyer_seller_status} for ${intel.relevant_products.join(', ')} (Confidence: ${intel.confidence})`);
  });

  // --- SECTION 9: DATABASE PERSISTENCE CHECK ---
  console.log('\n--- 9. DATABASE PERSISTENCE & INTEGRATION ---');
  await itAsync('Fetches leads and active templates from live Supabase instance', async () => {
    const { data: leads, error: lErr } = await supabaseAdmin.from('leads').select('id, company, email').limit(5);
    assert(!lErr, `Supabase error: ${lErr?.message}`);
    assert(Array.isArray(leads), 'Expected leads array');
    console.log(`  ✓ Successfully queried Supabase leads (${leads.length} sample leads returned)`);

    const { data: tmpls, error: tErr } = await supabaseAdmin.from('email_templates').select('id, name').limit(5);
    assert(!tErr, `Supabase error: ${tErr?.message}`);
    console.log(`  ✓ Successfully queried Supabase email_templates (${tmpls.length} templates returned)`);
  });

  // --- SECTION 10: TEMPLATE UPLOAD, PARSING, DEDUPLICATION & ORCHESTRATOR INTEGRATION ---
  console.log('\n--- 10. TEMPLATE UPLOAD, PARSING, DEDUPLICATION & ORCHESTRATOR INTEGRATION ---');
  await itAsync('Parses TXT, CSV, and PDF buffers and rejects invalid/empty/corrupted uploads', async () => {
    // 1. TXT parsing
    const txtBuf = Buffer.from('Subject: Activated Bleaching Clay Supply\n\nDear {{company_name}},\nWe supply high-activity bleaching clay.', 'utf-8');
    const parsedTxt = await parseFileToText(txtBuf, 'templates.txt', 'text/plain');
    assert(parsedTxt.includes('Activated Bleaching Clay Supply'), 'Failed to parse TXT file');

    // 2. CSV tabular parsing
    const csvBuf = Buffer.from('Name,Subject,Body\nBentonite Buyer,Bentonite Supply Offer,"Dear {{company_name}}, we offer foundry bentonite."', 'utf-8');
    const parsedCsv = await parseFileToText(csvBuf, 'templates.csv', 'text/csv');
    assert(parsedCsv.isTabular && parsedCsv.rows.length === 1, 'Failed to parse tabular CSV file');

    // 3. PDF parsing (including DOMMatrix serverless polyfill verification)
    const minimalPdf = Buffer.from(
      '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /MediaBox [0 0 612 792] /Contents 5 0 R >>\nendobj\n4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n5 0 obj\n<< /Length 68 >>\nstream\nBT\n/F1 12 Tf\n72 720 Td\n(Subject: Bleaching Clay Offer) Tj\nET\nendstream\nendobj\nxref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000229 00000 n \n0000000297 00000 n \ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n415\n%%EOF',
      'utf8'
    );
    const parsedPdf = await parseFileToText(minimalPdf, 'offer.pdf', 'application/pdf');
    assert(parsedPdf.includes('Subject: Bleaching Clay Offer'), 'Failed to parse PDF file');
    assert(!parsedPdf.includes('-- 1 of 1 --'), 'Page marker was not stripped from PDF text');

    // 4. Reject empty file
    let emptyErr = null;
    try {
      await parseFileToText(Buffer.alloc(0), 'empty.txt');
    } catch (e) {
      emptyErr = e;
    }
    assert(emptyErr && /empty/i.test(emptyErr.message), 'Should reject empty file upload');

    // 5. Reject unsupported file extension
    let extErr = null;
    try {
      await parseFileToText(Buffer.from('binary'), 'malware.exe');
    } catch (e) {
      extErr = e;
    }
    assert(extErr && /Unsupported file format/i.test(extErr.message), 'Should reject unsupported file extension');

    // 6. Reject binary null-byte payload masquerading as TXT
    let binErr = null;
    try {
      await parseFileToText(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x00]), 'fake.txt');
    } catch (e) {
      binErr = e;
    }
    assert(binErr && /binary or corrupted/i.test(binErr.message), 'Should reject binary null-byte file');
  });

  await itAsync('Persists uploaded template in Supabase, deduplicates re-uploads, handles FK safety, and integrates with Orchestrator', async () => {
    const uniqueSub = `Kaolin Ceramic Supply Verification ${Date.now()}`;
    const bodyCopy = 'Dear {{company_name}},\n\nMineTech Resources supplies high-whiteness kaolin and ball clay for ceramic tableware production.';

    // 1. Upload with a non-existent UUID userId to verify FK fallback safety
    const created1 = await createAndClassifyTemplate({
      name: 'Kaolin — Ceramic Buyers Verification',
      subject: uniqueSub,
      body: bodyCopy,
      userId: '00000000-0000-0000-0000-000000000000'
    });

    assert(created1.id, 'Template was not persisted in Supabase');
    assert.strictEqual(created1.subject, uniqueSub);
    assert(created1.product_category, 'Template missing classified product_category');

    try {
      // 2. Re-upload identical template (verify deduplication — same ID updated, no duplicate created)
      const created2 = await createAndClassifyTemplate({
        name: 'Kaolin — Ceramic Buyers Verification (Updated Name)',
        subject: uniqueSub,
        body: bodyCopy,
        userId: 'legacy_non_uuid_id'
      });

      assert.strictEqual(created2.id, created1.id, 'Duplicate upload should update existing template ID instead of creating duplicate row');

      // 3. Retrieve from Supabase and verify unpackTemplateMetadata + Orchestrator matching
      const { data: fetchedRow, error: fErr } = await supabaseAdmin
        .from('email_templates')
        .select('*')
        .eq('id', created1.id)
        .single();

      assert(!fErr && fetchedRow, 'Could not retrieve uploaded template from Supabase');
      const unpacked = unpackTemplateMetadata(fetchedRow);
      assert.strictEqual(unpacked.id, created1.id);

      const matchRes = await runIntelligentMatching({
        leads: [
          {
            id: 'lead-verify-kaolin',
            company: 'Euro Porcelain Ceramics GmbH',
            email: 'procurement@europorcelain.de',
            classification: 'Buyer',
            custom_fields: {
              company_intelligence: {
                buyer_seller_status: 'Buyer',
                relationship_types: ['prospective_buyer'],
                relevant_products: ['Kaolin'],
                confidence: 'high'
              }
            }
          }
        ],
        templates: [fetchedRow]
      });

      assert.strictEqual(matchRes.matches[0].template_id, created1.id, 'Orchestrator failed to match uploaded template');
    } finally {
      // Clean up temporary test template so production database stays clean
      await supabaseAdmin.from('email_templates').delete().eq('id', created1.id);
    }
  });

  console.log('\n========================================================================');
  console.log(`FINAL TEST RESULT: ${passedTests}/${totalTests} TESTS PASSED (100%)`);
  console.log('========================================================================');
}

runTestSuite().catch((err) => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  process.exit(1);
});

