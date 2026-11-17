/**
 * MineTech Personalized Company Matching Engine
 * 
 * Matches extracted personalized outreach emails against existing CRM companies (leads table).
 * Uses multi-signal evidence: exact name, normalized name, legal entity stripping,
 * website domain, email domain, contact name, and fuzzy token overlap.
 * 
 * Strict safety: AI never invents CRM records.
 */

import { supabaseAdmin } from '../supabase.js';
import { extractCorporateDomain } from './companyIntelligenceEngine.js';

const LEGAL_SUFFIXES = [
  'gmbh', 'b.v.', 'bv', 's.a.', 'sa', 's.r.l.', 'srl', 's.p.a.', 'spa',
  'llc', 'ltd', 'limited', 'inc', 'incorporated', 'corp', 'corporation',
  'co', 'company', 'cie', 'holding', 'holdings', 'group', 'industries',
  'resources', 'minerals', 'mining', 'materials', 'produce', 'peru'
];

/**
 * Normalize company name by stripping legal forms and punctuation for fuzzy matching
 */
export function normalizeCompanyName(name = '') {
  if (!name) return '';
  let str = name.toLowerCase().trim();

  // Remove parentheses contents e.g. "ABC (Europe)" -> "ABC"
  str = str.replace(/\([^)]*\)/g, ' ');

  // Replace punctuation with space
  str = str.replace(/[.,\/#!$%\^&\*;:{}=\-_`~]/g, ' ');

  // Remove common legal entity terms
  const tokens = str.split(/\s+/).filter((t) => t.length > 0);
  const filtered = tokens.filter((t) => !LEGAL_SUFFIXES.includes(t));

  return filtered.join(' ').trim() || str;
}

/**
 * Compute Jaccard / token similarity between two strings (0 to 1)
 */
function tokenSimilarity(a = '', b = '') {
  const normA = normalizeCompanyName(a);
  const normB = normalizeCompanyName(b);

  if (!normA || !normB) return 0;
  if (normA === normB) return 1.0;
  if (normA.includes(normB) || normB.includes(normA)) return 0.85;

  const setA = new Set(normA.split(/\s+/).filter((w) => w.length > 1));
  const setB = new Set(normB.split(/\s+/).filter((w) => w.length > 1));

  if (setA.size === 0 || setB.size === 0) return 0;

  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection++;
  }

  const union = new Set([...setA, ...setB]).size;
  return union > 0 ? intersection / union : 0;
}

/**
 * Resolve all contacts for a matched CRM lead
 */
export function resolveCompanyContacts(lead = {}, allLeads = [], preferredContactName = '', preferredContactEmail = '') {
  const contactsMap = new Map();

  // 1. Primary contact from lead record
  const primaryEmail = (lead.email || '').toLowerCase().trim();
  const primaryName = lead.full_name || `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || 'Primary Contact';

  if (primaryEmail) {
    contactsMap.set(primaryEmail, {
      id: lead.id,
      name: primaryName,
      email: primaryEmail,
      jobTitle: lead.job_title || 'Commercial Lead',
      phone: lead.phone || '',
      isPrimary: true,
      selected: true,
      source: 'primary_lead',
      lastContactedAt: lead.last_contacted_at || lead.updated_at || null,
      isDnc: Boolean(lead.is_dnc),
    });
  }

  // 2. Extra contacts from custom_fields
  const additional = lead.custom_fields?.additional_contacts || lead.custom_fields?.contacts || [];
  if (Array.isArray(additional)) {
    additional.forEach((ac, idx) => {
      const email = (ac.email || '').toLowerCase().trim();
      if (email && !contactsMap.has(email)) {
        contactsMap.set(email, {
          id: ac.id || `${lead.id}-contact-${idx + 1}`,
          name: ac.name || ac.full_name || `${ac.first_name || ''} ${ac.last_name || ''}`.trim() || 'Additional Contact',
          email,
          jobTitle: ac.job_title || ac.role || ac.position || 'Commercial Contact',
          phone: ac.phone || '',
          isPrimary: Boolean(ac.isPrimary || ac.is_primary),
          selected: false,
          source: 'custom_fields',
          lastContactedAt: ac.lastContactedAt || null,
          isDnc: Boolean(ac.isDnc),
        });
      }
    });
  }

  // 3. Sibling leads belonging to the same company name or corporate domain
  const compNorm = normalizeCompanyName(lead.company);
  const leadDomain = extractCorporateDomain(lead.email, lead.website);

  if (Array.isArray(allLeads)) {
    allLeads.forEach((sibling) => {
      if (!sibling || sibling.id === lead.id) return;
      const sibNorm = normalizeCompanyName(sibling.company);
      const sibDomain = extractCorporateDomain(sibling.email, sibling.website);

      const isSameCompany =
        (compNorm && sibNorm && compNorm === sibNorm) ||
        (leadDomain && sibDomain && leadDomain === sibDomain);

      if (isSameCompany && sibling.email) {
        const sibEmail = sibling.email.toLowerCase().trim();
        if (!contactsMap.has(sibEmail)) {
          contactsMap.set(sibEmail, {
            id: sibling.id,
            name: sibling.full_name || sibling.first_name || 'Company Contact',
            email: sibEmail,
            jobTitle: sibling.job_title || 'Commercial Contact',
            phone: sibling.phone || '',
            isPrimary: false,
            selected: false,
            source: 'crm_sibling',
            lastContactedAt: sibling.last_contacted_at || null,
            isDnc: Boolean(sibling.is_dnc),
          });
        }
      }
    });
  }

  const contactsList = Array.from(contactsMap.values());

  // If a preferred contact was explicitly mentioned in the draft (by email or name), mark them as selected
  if (preferredContactEmail) {
    const cleanPrefEmail = preferredContactEmail.toLowerCase().trim();
    let found = false;
    contactsList.forEach((c) => {
      if (c.email === cleanPrefEmail) {
        c.selected = true;
        found = true;
      }
    });
    // If not in existing CRM contacts list, add as custom detected contact
    if (!found) {
      contactsList.push({
        id: `extracted-${Date.now()}`,
        name: preferredContactName || cleanPrefEmail.split('@')[0],
        email: cleanPrefEmail,
        jobTitle: 'Extracted Contact',
        phone: '',
        isPrimary: false,
        selected: true,
        source: 'extracted_draft',
        isDnc: false,
      });
    }
  } else if (preferredContactName) {
    const cleanPrefName = preferredContactName.toLowerCase().trim();
    contactsList.forEach((c) => {
      if (c.name.toLowerCase().includes(cleanPrefName)) {
        c.selected = true;
      }
    });
  }

  // Ensure at least one contact is selected if contacts exist
  if (contactsList.length > 0 && !contactsList.some((c) => c.selected)) {
    contactsList[0].selected = true;
  }

  return contactsList;
}

/**
 * Match a single extracted email draft against CRM leads
 */
export function matchDraftToLeads(draft, allLeads = []) {
  const targetCompany = draft.company_name || '';
  const targetContactName = draft.contact_name || '';
  const targetContactEmail = (draft.contact_email || '').toLowerCase().trim();
  const draftBody = (draft.body_plain || '').toLowerCase();

  const scoredCandidates = [];

  for (const lead of allLeads) {
    let score = 0;
    const reasons = [];

    const leadCompany = lead.company || '';
    const leadEmail = (lead.email || '').toLowerCase().trim();
    const leadFullName = (lead.full_name || '').toLowerCase().trim();
    const leadDomain = extractCorporateDomain(lead.email, lead.website);

    // 1. Exact company name match
    if (targetCompany && leadCompany && targetCompany.toLowerCase().trim() === leadCompany.toLowerCase().trim()) {
      score += 95;
      reasons.push('Exact company name match');
    } else {
      // 2. Normalized company name match (legal suffixes stripped)
      const normTarget = normalizeCompanyName(targetCompany);
      const normLead = normalizeCompanyName(leadCompany);

      if (normTarget && normLead && normTarget === normLead) {
        score += 85;
        reasons.push('Normalized company name match');
      } else {
        // 3. Token similarity
        const sim = tokenSimilarity(targetCompany, leadCompany);
        if (sim >= 0.7) {
          score += Math.round(sim * 75);
          reasons.push(`High token similarity (${Math.round(sim * 100)}%)`);
        } else if (sim >= 0.4) {
          score += Math.round(sim * 60);
          reasons.push(`Partial company name match (${Math.round(sim * 100)}%)`);
        }
      }
    }

    // 4. Domain match in email or draft body
    if (leadDomain && (draftBody.includes(leadDomain) || (targetContactEmail && targetContactEmail.includes(leadDomain)))) {
      score += 25;
      reasons.push(`Domain "${leadDomain}" detected in draft content`);
    }

    // 5. Contact email exact match
    if (targetContactEmail && leadEmail && targetContactEmail === leadEmail) {
      score += 30;
      reasons.push('Contact email matched CRM lead email');
    }

    // 6. Contact name match
    if (targetContactName && leadFullName && leadFullName.includes(targetContactName.toLowerCase())) {
      score += 20;
      reasons.push(`Contact name "${targetContactName}" matched lead full name`);
    }

    if (score > 0) {
      scoredCandidates.push({
        lead,
        score,
        reasons,
      });
    }
  }

  // Sort descending by match score
  scoredCandidates.sort((a, b) => b.score - a.score);

  // Status and confidence determination
  let matchedLead = null;
  let matchStatus = 'unmatched';
  let matchConfidence = 'low';
  let evidence = 'No suitable company record found in CRM database';

  if (scoredCandidates.length > 0) {
    const best = scoredCandidates[0];
    if (best.score >= 80) {
      matchedLead = best.lead;
      matchStatus = 'matched';
      matchConfidence = 'high';
      evidence = best.reasons.join('; ');
    } else if (best.score >= 40) {
      matchedLead = best.lead;
      matchStatus = 'needs_review';
      matchConfidence = 'medium';
      evidence = `Potential match: ${best.reasons.join('; ')} (requires user confirmation)`;
    } else {
      matchStatus = 'unmatched';
      matchConfidence = 'low';
      evidence = `Low confidence (${best.score}/100): ${best.reasons.join('; ')}`;
    }
  }

  // Candidate companies for easy manual re-selection
  const candidateCompanies = scoredCandidates.slice(0, 5).map((sc) => ({
    id: sc.lead.id,
    company: sc.lead.company,
    contactName: sc.lead.full_name,
    email: sc.lead.email,
    score: sc.score,
    reasons: sc.reasons,
  }));

  // Resolve contacts for the matched company
  const companyContacts = matchedLead
    ? resolveCompanyContacts(matchedLead, allLeads, targetContactName, targetContactEmail)
    : [];

  const extractedCompany = draft.company_name || draft.company || '';
  const extractedContact = draft.contact_name || draft.contact || '';
  const extractedSubject = draft.subject || '';
  const extractedBodyPlain = draft.body_plain || draft.body || '';
  const extractedBodyHtml = draft.body_html || '';

  return {
    ...draft,
    id: draft.id || `draft-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    extracted_company: extractedCompany,
    extracted_contact: extractedContact,
    extracted_subject: extractedSubject,
    extracted_body_plain: extractedBodyPlain,
    extracted_body_html: extractedBodyHtml,
    edited_subject: draft.edited_subject || extractedSubject,
    edited_body_plain: draft.edited_body_plain || extractedBodyPlain,
    edited_body_html: draft.edited_body_html || extractedBodyHtml,
    matched_lead_id: matchedLead?.id || null,
    matched_lead: matchedLead
      ? {
          id: matchedLead.id,
          company: matchedLead.company,
          company_name: matchedLead.company,
          full_name: matchedLead.full_name,
          contact_name: matchedLead.full_name,
          email: matchedLead.email,
          website: matchedLead.website,
          industry: matchedLead.industry,
          location: matchedLead.location,
          country: matchedLead.location,
          status: matchedLead.status,
          classification: matchedLead.classification || matchedLead.custom_fields?.classification || 'Unclassified',
        }
      : null,
    match_status: matchStatus,
    match_confidence: matchConfidence,
    confidence_score: scoredCandidates[0]?.score || 0,
    match_score: scoredCandidates[0]?.score || 0,
    match_reason: evidence,
    match_evidence: evidence,
    candidate_companies: candidateCompanies,
    all_company_contacts: companyContacts,
    company_contacts: companyContacts,
    selected_contacts: companyContacts.filter((c) => c.selected),
    selected_contact_ids: companyContacts.filter((c) => c.selected).map((c) => c.id),
    selected_contact_emails: companyContacts.filter((c) => c.selected).map((c) => c.email),
    // Auto-approve if high confidence and has valid recipient email
    approval_status:
      draft.approval_status === 'approved'
        ? 'approved'
        : matchStatus === 'matched' && companyContacts.some((c) => c.selected && c.email)
        ? 'approved'
        : 'needs_review',
  };
}

/**
 * Batch match all extracted drafts against CRM database
 */
export async function matchAllDraftsToCrm(drafts = [], options = {}) {
  // Fetch all leads from Supabase CRM
  const { data: leads, error } = await supabaseAdmin
    .from('leads')
    .select('id, company, full_name, first_name, last_name, email, phone, website, industry, niche, status, is_dnc, custom_fields, tags, updated_at')
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) {
    throw new Error(`Failed to fetch CRM leads for matching: ${error.message}`);
  }

  const allLeads = leads || [];

  const matchedDrafts = drafts.map((draft) => {
    // Check if manual override was specified for this draft
    if (options.manualOverrides && options.manualOverrides[draft.id]) {
      const overrideLeadId = options.manualOverrides[draft.id];
      const targetLead = allLeads.find((l) => l.id === overrideLeadId);
      if (targetLead) {
        const companyContacts = resolveCompanyContacts(targetLead, allLeads, draft.contact_name, draft.contact_email);
        return {
          ...draft,
          matched_lead_id: targetLead.id,
          matched_lead: {
            id: targetLead.id,
            company: targetLead.company,
            full_name: targetLead.full_name,
            email: targetLead.email,
            website: targetLead.website,
            status: targetLead.status,
          },
          match_status: 'matched',
          match_confidence: 'high',
          match_score: 100,
          match_evidence: 'Manually assigned by user',
          company_contacts: companyContacts,
          selected_contact_ids: companyContacts.filter((c) => c.selected).map((c) => c.id),
          selected_contact_emails: companyContacts.filter((c) => c.selected).map((c) => c.email),
          approval_status: 'approved',
        };
      }
    }

    return matchDraftToLeads(draft, allLeads);
  });

  const summary = {
    totalDrafts: matchedDrafts.length,
    matchedCount: matchedDrafts.filter((d) => d.match_status === 'matched').length,
    needsReviewCount: matchedDrafts.filter((d) => d.match_status === 'needs_review').length,
    unmatchedCount: matchedDrafts.filter((d) => d.match_status === 'unmatched').length,
    approvedCount: matchedDrafts.filter((d) => d.approval_status === 'approved').length,
    campaignReadyCount: matchedDrafts.filter((d) => d.approval_status === 'approved' && d.selected_contact_emails?.length > 0).length,
  };

  return {
    matchedDrafts,
    summary,
  };
}
