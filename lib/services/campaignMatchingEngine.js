/**
 * MineTech Intelligent Email-to-Company Matching Engine
 * 
 * Powered by Claude & deterministic B2B commercial rules.
 * Matches company/contact records to the most appropriate prewritten email template.
 * 
 * Key Principles:
 * 1. Strict Buyer vs. Supplier separation (buying and sourcing are opposite commercial flows).
 * 2. Multi-product intelligence: Picks single most relevant template, avoiding overlapping blasts.
 * 3. Dual-role recognition: Tracks separate buyer & supplier opportunities per entity.
 * 4. Transparent, explainable scoring & human-readable justification.
 * 5. Dedicated Unmatched & Review Queue with explicit diagnostic reasons.
 */

import { supabaseAdmin } from '../supabase.js';
import { getAllProducts } from './productTaxonomyService.js';
import { heuristicClassifyCompany, analyzeCompanyWithClaude, extractCorporateDomain } from './companyIntelligenceEngine.js';

/**
 * Extract all associated contacts & emails for a company from lead record and siblings
 */
export function extractCompanyContacts(lead = {}, allLeads = []) {
  const compName = (lead.company || lead.company_name || '').toLowerCase().trim();
  const domain = extractCorporateDomain(lead.email, lead.website);
  const contactsMap = new Map();

  // 1. Primary contact from current lead
  if (lead.email) {
    const cleanEmail = lead.email.toLowerCase().trim();
    contactsMap.set(cleanEmail, {
      id: lead.id,
      name: lead.full_name || lead.first_name || 'Primary Contact',
      email: cleanEmail,
      job_title: lead.job_title || 'Commercial Contact',
      phone: lead.phone || '',
      isPrimary: true,
      selected: true
    });
  }

  // 2. Extra contacts from custom_fields
  const additional = lead.custom_fields?.additional_contacts || lead.custom_fields?.contacts || [];
  if (Array.isArray(additional)) {
    for (const ac of additional) {
      const acEmail = (ac.email || '').toLowerCase().trim();
      if (acEmail && !contactsMap.has(acEmail)) {
        contactsMap.set(acEmail, {
          id: ac.id || `${lead.id}-contact-${contactsMap.size}`,
          name: ac.name || ac.full_name || ac.first_name || 'Additional Contact',
          email: acEmail,
          job_title: ac.job_title || ac.role || 'Commercial Contact',
          phone: ac.phone || '',
          isPrimary: Boolean(ac.isPrimary || ac.is_primary),
          selected: false
        });
      }
    }
  }

  // 3. Sibling leads belonging to the same company name or domain
  for (const sibling of allLeads) {
    if (!sibling || sibling.id === lead.id) continue;
    const sibComp = (sibling.company || sibling.company_name || '').toLowerCase().trim();
    const sibDomain = extractCorporateDomain(sibling.email, sibling.website);

    const isSameCompany = (compName && sibComp && compName === sibComp) ||
                          (domain && sibDomain && domain === sibDomain);

    if (isSameCompany && sibling.email) {
      const sibEmail = sibling.email.toLowerCase().trim();
      if (!contactsMap.has(sibEmail)) {
        contactsMap.set(sibEmail, {
          id: sibling.id,
          name: sibling.full_name || sibling.first_name || 'Company Contact',
          email: sibEmail,
          job_title: sibling.job_title || 'Commercial Lead',
          phone: sibling.phone || '',
          isPrimary: false,
          selected: false
        });
      }
    }
  }

  return Array.from(contactsMap.values());
}

/**
 * Extract clean metadata from template record
 */
export function unpackTemplateMetadata(template = {}) {
  let meta = {};
  if (Array.isArray(template.variables)) {
    const metaTag = template.variables.find((v) => typeof v === 'string' && v.startsWith('meta:'));
    if (metaTag) {
      try {
        meta = JSON.parse(metaTag.slice(5));
      } catch {}
    }
  }

  const category = template.category || meta.product_category || 'Industrial Minerals';
  const recipientType = meta.recipient_type || (
    /supplier|sourcing|purchase/i.test(`${template.name} ${template.subject}`) ? 'potential_supplier' : 'prospective_buyer'
  );
  const commercialObjective = meta.commercial_objective || (
    recipientType === 'potential_supplier' ? 'supplier_sourcing' : 'buyer_introduction'
  );
  const sequenceStage = meta.sequence_stage || 'initial_outreach';

  return {
    id: template.id,
    name: template.name,
    subject: template.subject,
    body_plain: template.body_plain,
    body_html: template.body_html,
    product_category: meta.product_category || category,
    recipient_type: recipientType,
    commercial_objective: commercialObjective,
    sequence_stage: sequenceStage,
    confidence: meta.confidence || 'high'
  };
}

/**
 * Match a single contact/lead against a list of available templates
 */
export function matchLeadToTemplates(lead = {}, templates = []) {
  const company = lead.company || lead.company_name || '';
  const email = lead.email || '';
  const customFields = lead.custom_fields || {};
  const intel = customFields.company_intelligence || heuristicClassifyCompany({
    companyName: company,
    email,
    industry: lead.industry || lead.niche,
    notes: lead.notes,
    website: lead.website
  });

  const leadProducts = (intel.relevant_products || []).map((p) => p.toLowerCase());
  const leadRoles = intel.relationship_types || [];
  const isBuyer = intel.buyer_seller_status === 'Buyer' || intel.buyer_seller_status === 'Both' || leadRoles.includes('prospective_buyer');
  const isSupplier = intel.buyer_seller_status === 'Seller' || intel.buyer_seller_status === 'Both' || leadRoles.includes('potential_supplier');

  // If company role is completely unknown
  if (leadRoles.length === 0 || leadRoles.includes('requires_review') || (!isBuyer && !isSupplier)) {
    return {
      lead_id: lead.id,
      company_name: company,
      email,
      matched_template: null,
      match_confidence: 'low',
      recipient_type: 'requires_review',
      product_category: 'Unknown',
      reason: 'Company commercial role is unknown or requires review before matching',
      requires_review: true,
      status: 'unmatched',
      unmatched_reason: 'Company role is undetermined. Cannot differentiate buyer from supplier.'
    };
  }

  // If no templates available
  if (!templates || templates.length === 0) {
    return {
      lead_id: lead.id,
      company_name: company,
      email,
      matched_template: null,
      match_confidence: 'low',
      recipient_type: isBuyer ? 'prospective_buyer' : 'potential_supplier',
      product_category: leadProducts[0] || 'Unknown',
      reason: 'No prewritten email templates currently uploaded to the library',
      requires_review: true,
      status: 'unmatched',
      unmatched_reason: 'No templates available in library.'
    };
  }

  const scoredMatches = [];

  for (const rawTemplate of templates) {
    const tpl = unpackTemplateMetadata(rawTemplate);
    let score = 0;
    const reasons = [];
    const tplProd = (tpl.product_category || '').toLowerCase();
    const tplRole = tpl.recipient_type;

    // 1. Role compatibility check (CRITICAL)
    const isTplBuyer = tplRole === 'prospective_buyer' || tplRole === 'buyer' || tplRole === 'general';
    const isTplSupplier = tplRole === 'potential_supplier' || tplRole === 'supplier';

    if (isBuyer && isTplBuyer) {
      score += 40;
      reasons.push('Buyer-targeted email matches prospective buyer');
    } else if (isSupplier && isTplSupplier) {
      score += 40;
      reasons.push('Supplier sourcing enquiry matches potential mineral producer/supplier');
    } else {
      // Incompatible role (e.g. Sending sourcing enquiry to a prospective buyer or product offer to a supplier)
      continue;
    }

    // 2. Product alignment check
    let productMatched = false;
    for (const lp of leadProducts) {
      if (tplProd.includes(lp) || lp.includes(tplProd)) {
        score += 50;
        productMatched = true;
        reasons.push(`Direct product match for "${tpl.product_category}"`);
        break;
      }
    }

    // General industrial mineral template fallback
    if (!productMatched && (tplProd.includes('industrial') || tplProd.includes('general') || tplProd.includes('minerals'))) {
      score += 20;
      reasons.push('General mineral introduction matched fallback product category');
      productMatched = true;
    }

    // 3. Sequence stage check
    if (tpl.sequence_stage === 'initial_outreach') {
      score += 10;
    }

    if (score > 0 && productMatched) {
      scoredMatches.push({
        template: tpl,
        rawTemplate,
        score,
        reasons
      });
    }
  }

  // Sort descending by score
  scoredMatches.sort((a, b) => b.score - a.score);

  if (scoredMatches.length === 0) {
    return {
      lead_id: lead.id,
      company_name: company,
      email,
      matched_template: null,
      match_confidence: 'low',
      recipient_type: isBuyer ? 'prospective_buyer' : 'potential_supplier',
      product_category: leadProducts[0] || 'Unknown',
      reason: `No compatible ${isBuyer ? 'buyer' : 'supplier'} template found for products [${leadProducts.join(', ')}]`,
      requires_review: true,
      status: 'unmatched',
      unmatched_reason: `Missing matching template for role "${isBuyer ? 'Buyer' : 'Supplier'}" and product "${leadProducts[0] || 'General'}"`
    };
  }

  const bestMatch = scoredMatches[0];
  const confidence = bestMatch.score >= 90 ? 'high' : (bestMatch.score >= 60 ? 'medium' : 'low');

  return {
    lead_id: lead.id,
    company_name: company,
    email,
    matched_template: bestMatch.rawTemplate,
    template_id: bestMatch.template.id,
    template_name: bestMatch.template.name,
    subject: bestMatch.template.subject,
    recipient_type: bestMatch.template.recipient_type,
    product_category: bestMatch.template.product_category,
    match_confidence: confidence,
    match_score: bestMatch.score,
    reason: `Assigned "${bestMatch.template.name}" — ${bestMatch.reasons.join('. ')}.`,
    requires_review: confidence === 'low',
    status: confidence === 'high' ? 'approved' : 'pending_review',
    detected_conflicts: scoredMatches.length > 1 && scoredMatches[1].score === bestMatch.score
      ? [`Multiple equally suitable templates detected: "${bestMatch.template.name}" and "${scoredMatches[1].template.name}"`]
      : []
  };
}

/**
 * Execute bulk matching across all leads and templates
 */
export async function runIntelligentMatching({
  leads = [],
  templates = [],
  autoApproveHighConfidence = false,
  manualOverrides = {},
  contactTargeting = {}
}) {
  const matches = [];
  const highConfidence = [];
  const reviewNeeded = [];
  const unmatched = [];
  const campaignGroups = new Map(); // Grouped by "Product Category :: Recipient Type :: Template ID"

  // Pre-process templates
  const parsedTemplates = (templates || []).map(unpackTemplateMetadata);

  for (const lead of leads) {
    const email = (lead.email || '').toLowerCase().trim();
    const companyContacts = extractCompanyContacts(lead, leads);
    const targetPref = contactTargeting[lead.id] || contactTargeting[email] || {};
    const targetingMode = targetPref.targetingMode || targetPref.mode || 'primary_only';
    
    // Determine selected contacts based on mode
    const updatedContacts = companyContacts.map((c) => {
      let isSelected = false;
      if (Array.isArray(targetPref.selectedEmails) && targetPref.selectedEmails.length > 0) {
        isSelected = targetPref.selectedEmails.map((e) => e.toLowerCase()).includes(c.email.toLowerCase());
      } else if (targetingMode === 'all_contacts') {
        isSelected = true;
      } else {
        isSelected = c.isPrimary;
      }
      return { ...c, selected: isSelected };
    });

    const selectedEmails = updatedContacts.filter((c) => c.selected).map((c) => c.email);

    // Check if manual override exists
    if (manualOverrides[lead.id] || manualOverrides[email]) {
      const override = manualOverrides[lead.id] || manualOverrides[email];
      const assignedTpl = templates.find((t) => t.id === override.template_id) || null;
      const matchObj = {
        lead_id: lead.id,
        company_name: lead.company || lead.company_name,
        email,
        matched_template: assignedTpl,
        template_id: assignedTpl?.id,
        template_name: assignedTpl?.name || 'Custom Assigned Template',
        recipient_type: override.recipient_type || 'manual_assigned',
        product_category: override.product_category || assignedTpl?.category || 'Custom',
        match_confidence: 'high',
        match_score: 100,
        reason: 'Manually assigned by user',
        requires_review: false,
        status: 'approved',
        is_manual_override: true,
        company_contacts: updatedContacts,
        total_contacts: updatedContacts.length,
        targeting_mode: targetingMode,
        selected_emails: selectedEmails.length > 0 ? selectedEmails : [email]
      };
      matches.push(matchObj);
      highConfidence.push(matchObj);
      continue;
    }

    const match = matchLeadToTemplates(lead, templates);
    match.company_contacts = updatedContacts;
    match.total_contacts = updatedContacts.length;
    match.targeting_mode = targetingMode;
    match.selected_emails = selectedEmails.length > 0 ? selectedEmails : [email];
    matches.push(match);

    if (match.status === 'unmatched') {
      unmatched.push(match);
    } else if (match.match_confidence === 'high') {
      if (autoApproveHighConfidence) match.status = 'approved';
      highConfidence.push(match);
    } else {
      reviewNeeded.push(match);
    }

    // Group approved and high-confidence matches into proposed campaigns
    if (match.matched_template) {
      const groupKey = `${match.product_category} — ${match.recipient_type === 'potential_supplier' ? 'Suppliers' : 'Buyers'} (${match.template_name})`;
      if (!campaignGroups.has(groupKey)) {
        campaignGroups.set(groupKey, {
          groupName: groupKey,
          template: match.matched_template,
          product_category: match.product_category,
          recipient_type: match.recipient_type,
          recipients: [],
          targetRecipients: []
        });
      }
      campaignGroups.get(groupKey).recipients.push({ lead, match });

      // Add each selected contact for this company to targetRecipients
      for (const contact of updatedContacts.filter((c) => c.selected)) {
        campaignGroups.get(groupKey).targetRecipients.push({
          leadId: lead.id,
          contactId: contact.id,
          email: contact.email,
          name: contact.name,
          jobTitle: contact.job_title,
          isPrimary: contact.isPrimary
        });
      }
    }
  }

  return {
    totalLeads: leads.length,
    totalTemplates: templates.length,
    matches,
    highConfidenceCount: highConfidence.length,
    reviewNeededCount: reviewNeeded.length,
    unmatchedCount: unmatched.length,
    proposedCampaigns: Array.from(campaignGroups.values()).map((g) => ({
      name: g.groupName,
      templateId: g.template.id,
      templateName: g.template.name,
      subject: g.template.subject,
      product: g.product_category,
      recipientType: g.recipient_type,
      recipientCount: g.targetRecipients.length > 0 ? g.targetRecipients.length : g.recipients.length,
      leadIds: g.recipients.map((r) => r.lead.id),
      targetRecipients: g.targetRecipients
    }))
  };
}

