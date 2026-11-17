/**
 * MineTech Intelligent Campaign Orchestrator
 * 
 * Bridges intelligent matching decisions to production bulk campaigns.
 * Handles:
 * - Dynamic segmentation across B2B mineral categories & roles
 * - Automatic Campaign Plan generation with pre-send recipient auditing
 * - Personalization resolution with safe fallbacks
 * - Mandatory MineTech corporate signature formatting
 * - Explicit user approval workflow
 * - Test email dispatch
 * - Batch execution via Resend with delivery safeguards (DNC, suppression, deduplication)
 */

import { supabaseAdmin } from '../supabase.js';
import { interpolateTemplate } from './templateIntelligenceService.js';
import { ensureMineTechSignatureHtml, ensureMineTechSignatureText } from '../utils/signature.js';
import { dispatchViaResend, isValidEmail } from './emailService.js';

/**
 * Compute dynamic segment counts across all leads in the database
 */
export async function getDynamicSegments() {
  const { data: leads, error } = await supabaseAdmin
    .from('leads')
    .select('id, company, email, classification, custom_fields, tags, status, is_dnc');

  if (error || !leads) {
    return [];
  }

  const segmentDefinitions = [
    { id: 'bleaching_clay_buyers', name: 'Bleaching Clay — Prospective Buyers', product: 'Bleaching Clay', role: 'Buyer' },
    { id: 'bleaching_clay_suppliers', name: 'Bleaching Clay — Potential Suppliers', product: 'Bleaching Clay', role: 'Seller' },
    { id: 'bentonite_buyers', name: 'Bentonite — Prospective Buyers', product: 'Bentonite', role: 'Buyer' },
    { id: 'bentonite_suppliers', name: 'Bentonite — Potential Suppliers', product: 'Bentonite', role: 'Seller' },
    { id: 'kaolin_buyers', name: 'Kaolin — Prospective Buyers', product: 'Kaolin', role: 'Buyer' },
    { id: 'kaolin_suppliers', name: 'Kaolin — Potential Suppliers', product: 'Kaolin', role: 'Seller' },
    { id: 'fire_clay_buyers', name: 'Fire Clay — Prospective Buyers', product: 'Fire Clay', role: 'Buyer' },
    { id: 'ball_clay_buyers', name: 'Ball Clay — Prospective Buyers', product: 'Ball Clay', role: 'Buyer' },
    { id: 'existing_customers', name: 'Existing Customers', isCustomer: true },
    { id: 'existing_suppliers', name: 'Existing Suppliers', isExistingSupplier: true },
    { id: 'trading_partners', name: 'Trading Partners & Distributors', isPartner: true },
    { id: 'unclassified', name: 'Unclassified / Requires Review', isUnclassified: true }
  ];

  const result = segmentDefinitions.map((def) => {
    const matchingLeads = leads.filter((l) => {
      if (l.is_dnc || l.status === 'DNC') return false;
      const custom = l.custom_fields || {};
      const intel = custom.company_intelligence || {};
      const products = (intel.relevant_products || []).map((p) => p.toLowerCase());
      const role = l.classification || intel.buyer_seller_status || 'Unclassified';

      if (def.isUnclassified) {
        return role === 'Unclassified' || intel.requires_review;
      }
      if (def.isCustomer) {
        return (intel.relationship_types || []).includes('existing_customer') || (l.tags || []).includes('customer');
      }
      if (def.isExistingSupplier) {
        return (intel.relationship_types || []).includes('existing_supplier') || (l.tags || []).includes('existing-supplier');
      }
      if (def.isPartner) {
        return (intel.relationship_types || []).includes('trading_partner') || (l.tags || []).includes('partner');
      }

      const prodMatch = products.some((p) => p.includes(def.product.toLowerCase()));
      const roleMatch = role === def.role || role === 'Both';
      return prodMatch && roleMatch;
    });

    return {
      id: def.id,
      name: def.name,
      product: def.product || 'General',
      role: def.role || 'General',
      count: matchingLeads.length,
      leadIds: matchingLeads.map((l) => l.id)
    };
  });

  return result;
}

/**
 * Automatically prepare reviewable campaign drafts from intelligent matching groups
 */
export async function prepareCampaignsFromMatches({
  proposedCampaigns = [],
  senderEmail = 'rauf@mine-tech.be',
  senderName = 'Abdullah Rauf - MineTech Resources',
  replyTo = 'rauf@mine-tech.be',
  userId = null
}) {
  const preparedCampaigns = [];

  for (const group of proposedCampaigns) {
    if (!group.leadIds || group.leadIds.length === 0) continue;

    // Fetch candidate leads
    const { data: leads } = await supabaseAdmin
      .from('leads')
      .select('*')
      .in('id', group.leadIds);

    if (!leads || leads.length === 0) continue;

    // Recipient audit
    let eligible = 0;
    let excluded = 0;
    const seenEmails = new Set();
    const eligibleLeads = [];
    const excludedList = [];

    for (const lead of leads) {
      const email = (lead.email || '').toLowerCase().trim();

      if (!email || !isValidEmail(email)) {
        excluded++;
        excludedList.push({ id: lead.id, name: lead.company || lead.full_name, reason: 'Invalid or missing email address' });
        continue;
      }

      if (seenEmails.has(email)) {
        excluded++;
        excludedList.push({ id: lead.id, email, name: lead.company || lead.full_name, reason: 'Duplicate email address in list' });
        continue;
      }
      seenEmails.add(email);

      if (lead.is_dnc || lead.status === 'DNC' || lead.status === 'DO_NOT_CONTACT') {
        excluded++;
        excludedList.push({ id: lead.id, email, name: lead.company || lead.full_name, reason: 'Suppressed (DNC / Opt-Out)' });
        continue;
      }

      eligible++;
      eligibleLeads.push(lead);
    }

    // Fetch the template copy
    let bodyPlain = '';
    let bodyHtml = '';
    let subject = group.subject || 'Commercial Inquiry — MineTech Resources';

    if (group.templateId) {
      const { data: tpl } = await supabaseAdmin
        .from('email_templates')
        .select('*')
        .eq('id', group.templateId)
        .maybeSingle();

      if (tpl) {
        bodyPlain = tpl.body_plain || '';
        bodyHtml = tpl.body_html || '';
        subject = tpl.subject || subject;
      }
    }

    // Enforce official MineTech signature
    bodyPlain = ensureMineTechSignatureText(bodyPlain);
    bodyHtml = ensureMineTechSignatureHtml(bodyHtml);

    // Prepare candidate recipients with multi-contact selection
    const candidatesToQueue = [];
    const queuedEmails = new Set();
    if (Array.isArray(group.targetRecipients) && group.targetRecipients.length > 0) {
      for (const tr of group.targetRecipients) {
        const parentLead = leads.find((l) => l.id === tr.leadId) || {};
        const email = (tr.email || parentLead.email || '').toLowerCase().trim();
        if (email && isValidEmail(email) && !queuedEmails.has(email)) {
          queuedEmails.add(email);
          candidatesToQueue.push({
            lead: parentLead,
            leadId: tr.leadId || parentLead.id,
            email,
            contactName: tr.name || parentLead.full_name || parentLead.first_name,
            jobTitle: tr.jobTitle || parentLead.job_title
          });
        }
      }
    } else {
      for (const l of eligibleLeads) {
        const email = (l.email || '').toLowerCase().trim();
        if (email && !queuedEmails.has(email)) {
          queuedEmails.add(email);
          candidatesToQueue.push({
            lead: l,
            leadId: l.id,
            email,
            contactName: l.full_name || l.first_name,
            jobTitle: l.job_title
          });
        }
      }
    }

    // Save campaign in DRAFT state
    const campaignName = group.name || `${group.product} — ${group.recipientType === 'potential_supplier' ? 'Suppliers' : 'Buyers'} Campaign`;

    const safeUserId = userId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(userId).trim())
      ? String(userId).trim()
      : null;

    const campaignPayload = {
      name: campaignName,
      subject,
      body_plain: bodyPlain,
      body_html: bodyHtml,
      status: 'DRAFT',
      template_id: group.templateId || null,
      stats: {
        total_candidates: Array.isArray(group.targetRecipients) && group.targetRecipients.length > 0 ? group.targetRecipients.length : leads.length,
        eligible_recipients: candidatesToQueue.length,
        excluded_recipients: excluded,
        sent: 0,
        delivered: 0,
        replied: 0,
        bounced: 0,
        product: group.product,
        recipient_type: group.recipientType,
        sender: { email: senderEmail, name: senderName, replyTo }
      },
      created_by: safeUserId
    };

    let insertCampRes = await supabaseAdmin
      .from('email_campaigns')
      .insert(campaignPayload)
      .select()
      .single();

    if (insertCampRes.error && campaignPayload.created_by && /foreign key|uuid|created_by/i.test(insertCampRes.error.message)) {
      insertCampRes = await supabaseAdmin
        .from('email_campaigns')
        .insert({ ...campaignPayload, created_by: null })
        .select()
        .single();
    }

    const { data: savedCampaign, error: campErr } = insertCampRes;

    if (campErr) {
      console.error('[prepareCampaignsFromMatches] Failed to insert campaign:', campErr.message);
      continue;
    }

    const recipientRecords = candidatesToQueue.map((item) => {
      const personalLeadObj = {
        ...item.lead,
        full_name: item.contactName,
        first_name: item.contactName ? item.contactName.split(' ')[0] : 'Colleague',
        email: item.email,
        job_title: item.jobTitle
      };

      const personalSubject = interpolateTemplate(subject, personalLeadObj, { name: senderName });
      const personalBodyText = interpolateTemplate(bodyPlain, personalLeadObj, { name: senderName });
      const personalBodyHtml = interpolateTemplate(bodyHtml, personalLeadObj, { name: senderName });

      return {
        campaign_id: savedCampaign.id,
        lead_id: item.leadId,
        email: item.email,
        status: 'PENDING',
        tokens: {
          company_name: item.lead.company || item.lead.company_name,
          contact_name: item.contactName,
          rendered_subject: personalSubject,
          rendered_body_text: personalBodyText,
          rendered_body_html: personalBodyHtml
        }
      };
    });

    if (recipientRecords.length > 0) {
      const { error: recipErr } = await supabaseAdmin
        .from('email_recipients')
        .insert(recipientRecords);

      if (recipErr) {
        console.error('[prepareCampaignsFromMatches] Error inserting recipients:', recipErr.message);
      }
    }

    preparedCampaigns.push({
      campaignId: savedCampaign.id,
      name: campaignName,
      subject,
      product: group.product,
      recipientType: group.recipientType,
      totalCandidates: leads.length,
      eligibleRecipients: recipientRecords.length > 0 ? recipientRecords.length : eligible,
      excludedRecipients: excluded,
      excludedList: excludedList.slice(0, 10),
      status: 'DRAFT'
    });
  }

  return preparedCampaigns;
}

/**
 * Send a single personalized test email to sender before approving campaign
 */
export async function sendTestEmailForCampaign({
  campaignId,
  testEmail,
  sampleLead = null,
  senderEmail = 'rauf@mine-tech.be',
  senderName = 'Abdullah Rauf - Head of Sales'
}) {
  if (!testEmail || !isValidEmail(testEmail)) {
    throw new Error('A valid test email address is required');
  }

  const { data: campaign, error } = await supabaseAdmin
    .from('email_campaigns')
    .select('*')
    .eq('id', campaignId)
    .single();

  if (error || !campaign) {
    throw new Error('Campaign not found');
  }

  const dummyLead = sampleLead || {
    company: 'Sample Industrial Client Ltd',
    first_name: 'Alexander',
    last_name: 'Vermeulen',
    product: campaign.stats?.product || 'Bleaching Clay',
    country: 'Belgium'
  };

  const personalizedSubject = `[TEST] ${interpolateTemplate(campaign.subject, dummyLead, { name: senderName })}`;
  let personalizedHtml = interpolateTemplate(campaign.body_html, dummyLead, { name: senderName });
  personalizedHtml = ensureMineTechSignatureHtml(personalizedHtml);

  let personalizedText = interpolateTemplate(campaign.body_plain, dummyLead, { name: senderName });
  personalizedText = ensureMineTechSignatureText(personalizedText);

  const resendResult = await dispatchViaResend({
    to: testEmail,
    from: `${senderName} <${senderEmail}>`,
    subject: personalizedSubject,
    html: personalizedHtml,
    text: personalizedText
  });

  return {
    success: true,
    testEmail,
    messageId: resendResult?.id || 'simulated-test-id',
    renderedSubject: personalizedSubject
  };
}

/**
 * Approve and launch bulk campaign
 */
export async function approveAndLaunchCampaign(campaignId, { scheduledAt = null } = {}) {
  const status = scheduledAt ? 'SCHEDULED' : 'APPROVED';

  const { data: updated, error } = await supabaseAdmin
    .from('email_campaigns')
    .update({
      status,
      scheduled_at: scheduledAt || new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', campaignId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to approve campaign: ${error.message}`);
  }

  return updated;
}

