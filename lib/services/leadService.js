import { connectToDatabase } from '../db/mongoose.js';
import { supabaseAdmin } from '../supabase.js';
import Lead from '../models/Lead.js';
import ActivityLog from '../models/ActivityLog.js';
import EmailMessage from '../models/EmailMessage.js';
import Call from '../models/Call.js';
import SMSMessage from '../models/SMSMessage.js';
import { evaluateLeadScoring } from './leadScoringService.js';
import { deriveTemperature } from '../leads/temperature.js';
import { TELEPHONY_ENABLED } from '../config/features.js';
import { getLeadsList, getLeadFilterOptions, getLeadSummary } from './leadListService.js';

const CSV_COLUMN_MAP = {
  first_name: ['first_name', 'firstname', 'first', 'fname'],
  last_name: ['last_name', 'lastname', 'last', 'lname'],
  name: ['name', 'full_name', 'fullname', 'contact_name', 'contactname', 'lead_name', 'public_contact_route', 'contact'],
  phone: ['phone', 'phone_number', 'phonenumber', 'mobile', 'cell', 'telephone', 'direct_phone'],
  email: ['email', 'email_address', 'emailaddress', 'e-mail', 'e_mail', 'e_mail_address', 'email_addr'],
  job_title: ['position', 'title', 'job_title', 'jobtitle', 'role', 'designation'],
  company: ['supplier', 'supplier_name', 'suppliername', 'company', 'company_name', 'companyname', 'organization', 'org', 'account', 'company_group'],
  website: ['website', 'company_website', 'companywebsite', 'url', 'domain'],
  industry: ['industry', 'niche', 'sector', 'category', 'vertical', 'supplier_type', 'suppliertype'],
  country: ['country', 'country_code', 'origin', 'location'],
  state: ['state', 'region', 'province'],
  city: ['city', 'town'],
  timezone: ['timezone', 'tz', 'time_zone'],
  tags: ['tags', 'tag', 'list', 'source'],
  priority: ['priority', 'lead_priority', 'tier', 'rank_tier'],
  rank: ['rank', 'ranking', 'lead_id', 'id'],
  supplier_type: ['supplier_type', 'suppliertype', 'company_type', 'type', 'lead_type'],
  materials: ['materials', 'material', 'mineral', 'minerals', 'product_category', 'product', 'products'],
  product_fit: ['product_/_application_fit', 'product_application_fit', 'product_fit', 'application_fit', 'application', 'applications'],
  evidence: ['public_service_evidence', 'evidence_basis', 'evidence', 'proof', 'raw_evidence'],
  confirm_before_buying: ['confirm_before_buying', 'to_confirm', 'questions_to_confirm', 'confirmation_requirements', 'required_specifications'],
  public_contact_route: ['public_contact_route', 'contact_route', 'contact', 'contact_route_info'],
  source_links: ['source_links', 'source_urls', 'source_link', 'sources', 'product_source_url', 'contact_source_url'],
  location_note: ['location_/_origin_note', 'location_origin_note', 'origin_note', 'location_note', 'location'],
  notes: ['notes', 'note', 'commercial_notes', 'research_notes'],
  status: ['status', 'lead_status', 'stage', 'pipeline_stage'],
  bentonite: ['bentonite'],
  kaolin: ['kaolin'],
  bleaching_earth: ['bleaching_earth', 'bleaching earth'],
  calcium_carbonate: ['calcium_carbonate', 'calcium carbonate'],
};

export function normalizePhoneNumber(phone = '') {
  if (!phone || typeof phone !== 'string') return '';
  let digits = phone.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    digits = digits.substring(1);
  }
  return digits;
}

export function mapCsvHeaders(headers = []) {
  const mapped = {};
  const lowerHeaders = headers.map((h) => h.toLowerCase().trim().replace(/[\s-]+/g, '_'));

  for (const [field, aliases] of Object.entries(CSV_COLUMN_MAP)) {
    const idx = lowerHeaders.findIndex((h) => aliases.includes(h));
    if (idx !== -1) mapped[field] = headers[idx];
  }
  return mapped;
}

/**
 * Check if the lead is currently within permitted contact hours (8:00 AM - 6:00 PM local time)
 */
export function checkContactHours(lead = {}, configHours = { start: 8, end: 18 }) {
  const tz = lead.location?.timezone || lead.timezone || 'America/New_York';
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    });

    const parts = formatter.formatToParts(new Date());
    const hour = parseInt(parts.find((p) => p.type === 'hour')?.value || '12', 10);
    const minute = parts.find((p) => p.type === 'minute')?.value || '00';
    const timeString = `${hour % 12 || 12}:${minute} ${hour >= 12 ? 'PM' : 'AM'}`;

    const canContact = hour >= configHours.start && hour < configHours.end;
    return {
      canContact,
      localTime: timeString,
      timezone: tz,
      reason: canContact
        ? `Within calling hours (${timeString} in ${tz})`
        : `Outside allowed contact hours (Currently ${timeString} in ${tz}. Calling window: 8AM-6PM)`,
    };
  } catch (err) {
    return {
      canContact: true,
      localTime: 'Unknown',
      timezone: 'UTC',
      reason: 'Timezone unavailable — proceeding with caution',
    };
  }
}

/**
 * Global multi-channel suppression check
 */
export function isLeadSuppressed(lead = {}, channel = 'all') {
  if (!lead) return true;
  if (lead.suppression?.isGlobalDnc || lead.status === 'DO_NOT_CONTACT' || lead.status === 'DNC') {
    return true;
  }
  if (channel === 'email' && (lead.suppression?.email || lead.dnc_flags?.email)) return true;
  if (channel === 'phone' && (lead.suppression?.phone || lead.dnc_flags?.phone)) return true;
  if (channel === 'sms' && (lead.suppression?.sms || lead.dnc_flags?.sms)) return true;
  if (channel === 'whatsapp' && lead.suppression?.whatsapp) return true;
  return false;
}

/**
 * Atomic Lead Locking Engine (Duplicate Dial Prevention)
 */
export async function acquireLeadLock(leadId, userId, userName = 'Administrator', durationMinutes = 5) {
  await connectToDatabase();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + durationMinutes * 60 * 1000);

  const filter = {
    _id: leadId,
    $or: [
      { isLocked: false },
      { isLocked: { $exists: false } },
      { lockExpiresAt: { $lt: now } },
      { lockedBy: userId },
    ],
  };

  const update = {
    $set: {
      isLocked: true,
      lockedBy: userId,
      lockedByName: userName,
      lockedAt: now,
      lockExpiresAt: expiresAt,
    },
  };

  const lockedLead = await Lead.findOneAndUpdate(filter, update, { new: true });

  if (!lockedLead) {
    const existing = await Lead.findById(leadId).select('lockedByName lockedAt lockExpiresAt isLocked');
    return {
      success: false,
      acquired: false,
      isLocked: true,
      message: `Lead is currently being worked by ${existing?.lockedByName || 'another rep'}.`,
      lockedBy: existing?.lockedByName,
      lockExpiresAt: existing?.lockExpiresAt,
    };
  }

  return { success: true, acquired: true, isLocked: true, lead: lockedLead };
}

/**
 * Release lead lock
 */
export async function releaseLeadLock(leadId, userId = null) {
  await connectToDatabase();
  const query = { _id: leadId };
  if (userId) {
    query.$or = [{ lockedBy: userId }, { lockExpiresAt: { $lt: new Date() } }];
  }

  const result = await Lead.updateOne(query, {
    $set: {
      isLocked: false,
      lockedBy: null,
      lockedByName: '',
      lockedAt: null,
      lockExpiresAt: null,
    },
  });

  return { success: true, released: true, result };
}

/**
 * Smart Priority Lead Queue Engine
 * Ranks leads from Supabase PostgreSQL by score descending with ICP Fit, Intent, and Engagement breakdown
 */
export async function getSmartLeadQueue({ userId = null, limit = 50 }) {
  try {
    let query = supabaseAdmin
      .from('leads')
      .select('*')
      .eq('is_dnc', false)
      .not('status', 'in', '("DO_NOT_CONTACT","DNC","CUSTOMER","NOT_INTERESTED")')
      .order('score', { ascending: false })
      .limit(limit);

    if (userId) {
      query = query.or(`assigned_to.eq.${userId},assigned_to.is.null`);
    }

    const { data: rawLeads, error } = await query;
    if (error || !rawLeads) {
      console.warn('[SmartQueue] Supabase query warning:', error?.message);
      return [];
    }

    return rawLeads.map((l, index) => {
      const scoring = l.custom_fields?.scoring || {
        fitScore: Number(l.score) || 85,
        intentScore: 80,
        engagementScore: 75,
        compositeScore: Number(l.score) || 85,
      };

      return {
        id: l.id,
        _id: l.id,
        firstName: l.first_name || (l.full_name ? l.full_name.split(' ')[0] : 'Prospect'),
        lastName: l.last_name || '',
        fullName: l.full_name || `${l.first_name || ''} ${l.last_name || ''}`.trim(),
        email: l.email || '',
        phone: l.phone || '',
        company: l.company || '',
        jobTitle: l.job_title || '',
        industry: l.industry || l.niche || '',
        website: l.website || '',
        status: l.status || 'NEW',
        pipelineStage: l.pipeline_stage || 'NEW',
        score: Number(l.score) || scoring.compositeScore || 75,
        leadScore: Number(l.score) || scoring.compositeScore || 75,
        scoring,
        custom_fields: l.custom_fields || {},
        priorityRank: index + 1,
        priorityReason: scoring.reason || `${l.job_title || 'Decision Maker'} @ ${l.company || 'Enterprise'} (Score ${l.score || 80}/100)`,
      };
    });
  } catch (err) {
    console.error('[SmartQueue] Error:', err);
    return [];
  }
}

/**
 * Process Call Outcome and Trigger Next Actions
 */
export async function processCallOutcome(leadId, outcomeData = {}, userId = null) {
  await connectToDatabase();
  const lead = await Lead.findById(leadId);
  if (!lead) throw new Error('Lead not found');

  const {
    outcome,
    duration = 0,
    recordingUrl = '',
    notes = '',
    callbackDate = null,
    callbackTimezone = 'UTC',
    closer = '',
    meetingUrl = '',
  } = outcomeData;

  const now = new Date();
  const prevStatus = lead.status;
  const updateFields = {
    lastContactedAt: now,
    notes: notes ? `${lead.notes ? lead.notes + '\n\n' : ''}[Call Outcome: ${outcome}] ${notes}` : lead.notes,
  };

  switch (outcome) {
    case 'No Answer':
    case 'no-answer':
      updateFields.status = 'NO_RESPONSE';
      updateFields.nextFollowUpAt = new Date(now.getTime() + 60 * 60 * 1000); // 1 hr retry
      break;

    case 'Busy':
    case 'busy':
      updateFields.status = 'NO_RESPONSE';
      updateFields.nextFollowUpAt = new Date(now.getTime() + 30 * 60 * 1000); // 30 min retry
      break;

    case 'Voicemail':
    case 'voicemail':
      updateFields.status = 'CONTACTED';
      updateFields.nextFollowUpAt = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hr retry
      break;

    case 'Callback':
    case 'callback':
      updateFields.status = 'FOLLOW_UP';
      updateFields.callback = {
        scheduledAt: callbackDate ? new Date(callbackDate) : new Date(now.getTime() + 24 * 60 * 60 * 1000),
        notes,
        timezone: callbackTimezone,
      };
      updateFields.nextFollowUpAt = updateFields.callback.scheduledAt;
      break;

    case 'Interested':
    case 'interested':
      updateFields.status = 'INTERESTED';
      updateFields.pipelineStage = 'INTERESTED';
      updateFields.nextFollowUpAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      break;

    case 'Book Meeting':
    case 'meeting-booked':
      updateFields.status = 'CUSTOMER';
      updateFields.pipelineStage = 'MEETING';
      updateFields.booking = {
        isBooked: true,
        meetingDate: callbackDate ? new Date(callbackDate) : new Date(now.getTime() + 48 * 60 * 60 * 1000),
        meetingTimezone: callbackTimezone,
        closer,
        meetingUrl,
        notes,
        bookedAt: now,
      };
      updateFields['emailSequence.status'] = 'stopped';
      updateFields['emailSequence.stopReason'] = 'Meeting Booked';
      break;

    case 'Not Interested':
    case 'not-interested':
      updateFields.status = 'NOT_INTERESTED';
      updateFields.pipelineStage = 'LOST';
      updateFields['emailSequence.status'] = 'stopped';
      break;

    case 'Wrong Number':
    case 'wrong-number':
      updateFields.status = 'DO_NOT_CONTACT';
      updateFields['suppression.phone'] = true;
      updateFields['dnc_flags.phone'] = true;
      break;

    case 'DNC':
    case 'dnc':
      updateFields.status = 'DO_NOT_CONTACT';
      updateFields.suppression = {
        email: true,
        phone: true,
        sms: true,
        whatsapp: true,
        isGlobalDnc: true,
        reason: 'Requested Do Not Contact on Call',
        suppressedAt: now,
      };
      updateFields.dnc_flags = { email: true, phone: true, sms: true };
      updateFields['emailSequence.status'] = 'stopped';
      break;

    default:
      updateFields.status = 'CONTACTED';
  }

  // Release lock upon logging outcome
  updateFields.isLocked = false;
  updateFields.lockedBy = null;
  updateFields.lockedByName = '';
  updateFields.lockedAt = null;
  updateFields.lockExpiresAt = null;

  // Re-calculate updated score
  const updatedDoc = { ...lead.toObject(), ...updateFields };
  const newScoring = evaluateLeadScoring(updatedDoc);
  Object.assign(updateFields, newScoring);

  const savedLead = await Lead.findByIdAndUpdate(leadId, updateFields, { new: true });

  // Log Call Record
  await Call.create({
    leadId,
    userId,
    callSid: outcomeData.callSid || `call_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    from: outcomeData.from || process.env.TWILIO_PHONE_NUMBER || '+18005550199',
    to: outcomeData.to || lead.phone || '+18005550100',
    status: 'completed',
    duration,
    recordingUrl,
    disposition: outcome,
    notes,
    createdAt: now,
  });

  // Log Unified Activity Record
  await ActivityLog.create({
    leadId,
    userId,
    action: 'CALL_COMPLETED',
    channel: 'call',
    direction: 'outbound',
    summary: `Call Outcome: ${outcome} (${duration}s)`,
    details: { outcome, duration, recordingUrl, notes, previousStatus: prevStatus, newStatus: savedLead.status },
    timestamp: now,
  });

  return savedLead;
}

// getLeadsList now lives in leadListService (server-side filters, narrow selects, single-request pagination).
export { getLeadsList, getLeadFilterOptions, getLeadSummary };

function mapLeadDetail(lead) {
  const cf = lead.custom_fields || {};
  return {
    id: lead.id,
    _id: lead.id,
    firstName: lead.first_name || (lead.full_name ? lead.full_name.split(' ')[0] : 'Prospect'),
    lastName: lead.last_name || '',
    fullName: lead.full_name || `${lead.first_name || ''} ${lead.last_name || ''}`.trim(),
    name: lead.full_name || `${lead.first_name || ''} ${lead.last_name || ''}`.trim(),
    email: lead.email || '',
    phone: lead.phone || '',
    company: lead.company || '',
    jobTitle: lead.job_title || '',
    status: lead.status || 'NEW',
    pipelineStage: lead.status || 'NEW',
    score: lead.score || lead.lead_score || 85,
    leadScore: lead.score || lead.lead_score || 85,
    tags: lead.tags || [],
    customFields: cf,
    custom_fields: cf,
    // MineTech Extended Fields
    opportunityStatus: cf.opportunity_status || cf.opportunityStatus || 'ACTIVE',
    productCategory: cf.product_category || cf.productCategory || 'Kaolin',
    productCategories: cf.product_categories || (cf.product_category ? [cf.product_category] : ['Kaolin']),
    productGrade: cf.product_grade || cf.productGrade || '',
    industry: cf.industry || lead.industry || 'Ceramics',
    application: cf.application || cf.industry_application || 'Sanitaryware',
    country: cf.country || lead.country || 'Germany',
    city: cf.city || '',
    address: cf.address || '',
    companyType: cf.company_type || cf.companyType || 'Manufacturer',
    estimatedSize: cf.estimated_size || cf.estimatedSize || '',
    estimatedMonthlyTonnage: cf.estimated_monthly_tonnage || cf.estimatedMonthlyTonnage || '',
    estimatedAnnualTonnage: cf.estimated_annual_tonnage || cf.estimatedAnnualTonnage || '',
    packagingRequirement: cf.packaging_requirement || cf.packagingRequirement || '1,000 kg Big Bags (Jumbo with PE liner)',
    incoterm: cf.incoterm || 'CIF',
    deliveryLocation: cf.delivery_location || cf.deliveryLocation || '',
    targetPrice: cf.target_price || cf.targetPrice || '',
    currentPrice: cf.current_price || cf.currentPrice || '',
    currentSupplier: cf.current_supplier || cf.currentSupplier || '',
    currentProductGrade: cf.current_product_grade || cf.currentProductGrade || '',
    requiredSpecifications: cf.required_specifications || cf.requiredSpecifications || '',
    commercialNotes: cf.commercial_notes || cf.commercialNotes || '',
    technicalNotes: cf.technical_notes || cf.technicalNotes || '',
    expectedDecisionDate: cf.expected_decision_date || cf.expectedDecisionDate || '',
    sampleStatus: cf.sample_status || cf.sampleStatus || 'Requirements Not Yet Received',
    trialStatus: cf.trial_status || cf.trialStatus || 'Trial Discussed',
    priority: cf.priority || deriveTemperature({ score: lead.score }),
    temperature: deriveTemperature({ priority: cf.priority, score: lead.score }),
    nextAction: cf.next_action || cf.nextAction || '',
    nextActionDate: cf.next_action_date || cf.nextActionDate || lead.next_follow_up_at || '',
    leadSource: cf.lead_source || cf.leadSource || 'Cold Outreach',
    tradeShowEvent: cf.trade_show_event || cf.tradeShowEvent || '',
    assignedSalesperson: cf.assigned_salesperson || cf.assignedSalesperson || 'MineTech Sales',
    department: cf.department || 'Purchasing / Procurement',
    decisionMakerRole: cf.decision_maker_role || cf.decisionMakerRole || 'Decision Maker',
    contacts: cf.contacts || [],
    suppression: lead.suppression || {},
    isDnc: lead.is_dnc || false,
    is_dnc: lead.is_dnc || false,
    notes: lead.notes || '',
    nextFollowUpAt: lead.next_follow_up_at,
    lastContactedAt: lead.last_contacted_at,
    createdAt: lead.created_at,
    updated_at: lead.updated_at,
  };
}

export async function getLeadById(id) {
  try {
    const { data: lead, error } = await supabaseAdmin
      .from('leads')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !lead) {
      return null;
    }

    return mapLeadDetail(lead);
  } catch (err) {
    console.error('getLeadById error:', err);
    return null;
  }
}

export async function updateLeadById(id, updateData) {
  try {
    const dbPayload = {
      updated_at: new Date().toISOString(),
    };

    if (updateData.status) dbPayload.status = updateData.status;
    if (updateData.notes !== undefined) dbPayload.notes = updateData.notes;
    if (updateData.nextFollowUpAt !== undefined) dbPayload.next_follow_up_at = updateData.nextFollowUpAt;
    if (updateData.score !== undefined) dbPayload.score = updateData.score;
    if (updateData.tags !== undefined) dbPayload.tags = updateData.tags;
    if (updateData.suppression !== undefined) dbPayload.suppression = updateData.suppression;
    if (updateData.isDnc !== undefined) dbPayload.is_dnc = updateData.isDnc;
    if (updateData.is_dnc !== undefined) dbPayload.is_dnc = updateData.is_dnc;
    if (updateData.firstName) dbPayload.first_name = updateData.firstName;
    if (updateData.lastName) dbPayload.last_name = updateData.lastName;
    if (updateData.fullName) dbPayload.full_name = updateData.fullName;
    if (updateData.company) dbPayload.company = updateData.company;
    if (updateData.phone) dbPayload.phone = updateData.phone;
    if (updateData.email) dbPayload.email = updateData.email;

    // Fetch existing custom_fields to merge safely
    const { data: currentLead } = await supabaseAdmin
      .from('leads')
      .select('custom_fields')
      .eq('id', id)
      .single();

    const existingCustom = currentLead?.custom_fields || {};
    const newCustom = {
      ...existingCustom,
      ...(updateData.customFields || updateData.custom_fields || {}),
    };

    // Helper mapper for MineTech opportunity fields
    const directFieldMap = [
      ['opportunityStatus', 'opportunity_status'],
      ['productCategory', 'product_category'],
      ['productCategories', 'product_categories'],
      ['productGrade', 'product_grade'],
      ['industry', 'industry'],
      ['application', 'application'],
      ['country', 'country'],
      ['city', 'city'],
      ['address', 'address'],
      ['companyType', 'company_type'],
      ['estimatedSize', 'estimated_size'],
      ['estimatedMonthlyTonnage', 'estimated_monthly_tonnage'],
      ['estimatedAnnualTonnage', 'estimated_annual_tonnage'],
      ['packagingRequirement', 'packaging_requirement'],
      ['incoterm', 'incoterm'],
      ['deliveryLocation', 'delivery_location'],
      ['targetPrice', 'target_price'],
      ['currentPrice', 'current_price'],
      ['currentSupplier', 'current_supplier'],
      ['currentProductGrade', 'current_product_grade'],
      ['requiredSpecifications', 'required_specifications'],
      ['commercialNotes', 'commercial_notes'],
      ['technicalNotes', 'technical_notes'],
      ['expectedDecisionDate', 'expected_decision_date'],
      ['sampleStatus', 'sample_status'],
      ['trialStatus', 'trial_status'],
      ['priority', 'priority'],
      ['nextAction', 'next_action'],
      ['nextActionDate', 'next_action_date'],
      ['leadSource', 'lead_source'],
      ['tradeShowEvent', 'trade_show_event'],
      ['assignedSalesperson', 'assigned_salesperson'],
      ['department', 'department'],
      ['decisionMakerRole', 'decision_maker_role'],
      ['contacts', 'contacts'],
    ];

    directFieldMap.forEach(([camel, snake]) => {
      if (updateData[camel] !== undefined) {
        newCustom[snake] = updateData[camel];
        newCustom[camel] = updateData[camel];
      } else if (updateData[snake] !== undefined) {
        newCustom[snake] = updateData[snake];
        newCustom[camel] = updateData[snake];
      }
    });

    dbPayload.custom_fields = newCustom;

    const { data: updated, error } = await supabaseAdmin
      .from('leads')
      .update(dbPayload)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return mapLeadDetail(updated);
  } catch (err) {
    console.error('updateLeadById error:', err);
    throw err;
  }
}

export const updateLead = updateLeadById;

export async function createLead(leadData) {
  try {
    const fullName = leadData.fullName || `${leadData.firstName || ''} ${leadData.lastName || ''}`.trim() || 'Prospect';
    const customFields = {
      ...(leadData.customFields || leadData.custom_fields || {}),
    };

    const directFieldMap = [
      ['opportunityStatus', 'opportunity_status'],
      ['productCategory', 'product_category'],
      ['productCategories', 'product_categories'],
      ['productGrade', 'product_grade'],
      ['industry', 'industry'],
      ['application', 'application'],
      ['country', 'country'],
      ['city', 'city'],
      ['address', 'address'],
      ['companyType', 'company_type'],
      ['estimatedSize', 'estimated_size'],
      ['estimatedMonthlyTonnage', 'estimated_monthly_tonnage'],
      ['estimatedAnnualTonnage', 'estimated_annual_tonnage'],
      ['packagingRequirement', 'packaging_requirement'],
      ['incoterm', 'incoterm'],
      ['deliveryLocation', 'delivery_location'],
      ['targetPrice', 'target_price'],
      ['currentPrice', 'current_price'],
      ['currentSupplier', 'current_supplier'],
      ['currentProductGrade', 'current_product_grade'],
      ['requiredSpecifications', 'required_specifications'],
      ['commercialNotes', 'commercial_notes'],
      ['technicalNotes', 'technical_notes'],
      ['expectedDecisionDate', 'expected_decision_date'],
      ['sampleStatus', 'sample_status'],
      ['trialStatus', 'trial_status'],
      ['priority', 'priority'],
      ['nextAction', 'next_action'],
      ['nextActionDate', 'next_action_date'],
      ['leadSource', 'lead_source'],
      ['tradeShowEvent', 'trade_show_event'],
      ['assignedSalesperson', 'assigned_salesperson'],
      ['department', 'department'],
      ['decisionMakerRole', 'decision_maker_role'],
      ['contacts', 'contacts'],
    ];

    directFieldMap.forEach(([camel, snake]) => {
      if (leadData[camel] !== undefined) {
        customFields[snake] = leadData[camel];
        customFields[camel] = leadData[camel];
      } else if (leadData[snake] !== undefined) {
        customFields[snake] = leadData[snake];
        customFields[camel] = leadData[snake];
      }
    });

    const dbPayload = {
      first_name: leadData.firstName || fullName.split(' ')[0] || 'Prospect',
      last_name: leadData.lastName || fullName.split(' ').slice(1).join(' ') || '',
      full_name: fullName,
      email: (leadData.email || '').toLowerCase().trim(),
      phone: leadData.phone || '',
      company: leadData.company || '',
      job_title: leadData.jobTitle || leadData.job_title || '',
      industry: leadData.industry || leadData.niche || '',
      status: leadData.status || 'NEW',
      score: leadData.score || leadData.leadScore || 85,
      tags: leadData.tags || [],
      custom_fields: customFields,
      suppression: leadData.suppression || {},
      is_dnc: leadData.isDnc || leadData.is_dnc || false,
      notes: leadData.notes || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: created, error } = await supabaseAdmin
      .from('leads')
      .insert(dbPayload)
      .select()
      .single();

    if (error) throw error;
    return getLeadById(created.id);
  } catch (err) {
    console.error('createLead error:', err);
    throw err;
  }
}

export async function deleteLead(id) {
  try {
    const { error } = await supabaseAdmin
      .from('leads')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return { success: true, id };
  } catch (err) {
    console.error('deleteLead error:', err);
    throw err;
  }
}

// Narrow column lists: the drawer timeline never needs the whole row (e.g. generation bookkeeping, locks).
const EMAIL_MESSAGE_TIMELINE_COLUMNS =
  'id, direction, subject, sender, recipient, body_plain, body_html, status, resend_id, sent_at, created_at';
const EMAIL_RECIPIENT_TIMELINE_COLUMNS =
  'id, campaign_id, email, status, sent_at, opened_at, clicked_at, bounced_at, resend_id, tokens, generated_subject, generated_body, created_at';

// Use the narrow column list; if the live schema has drifted and a column is missing, fall back to '*'
// so the timeline never silently goes blank.
async function narrowOrAll(columns, build) {
  const res = await build(columns);
  return res.error ? build('*') : res;
}

export async function getLeadUnifiedTimeline(leadId) {
  const timeline = [];

  try {
    // 1. Fetch Lead to get email/phone for multi-key matching
    let leadEmail = '';
    let leadPhone = '';
    const { data: leadData } = await supabaseAdmin
      .from('leads')
      .select('id, email, phone, full_name, first_name, company')
      .eq('id', leadId)
      .maybeSingle();

    if (leadData) {
      leadEmail = (leadData.email || '').toLowerCase().trim();
      leadPhone = (leadData.phone || '').trim();
    }

    // 2. Fetch all channels in parallel: email_messages, email_recipients, calls, sms_messages, activity_logs
    const [
      { data: emails },
      { data: recipients },
      { data: calls },
      { data: smsMsgs },
      { data: activities },
    ] = await Promise.all([
      // Supabase 1-to-1 and Inbound Emails
      narrowOrAll(EMAIL_MESSAGE_TIMELINE_COLUMNS, (cols) => {
        const q = supabaseAdmin.from('email_messages').select(cols);
        return (leadEmail
          ? q.or(`lead_id.eq.${leadId},recipient.ilike.%${leadEmail}%`)
          : q.eq('lead_id', leadId)
        )
          .order('created_at', { ascending: false })
          .limit(50);
      }),

      // Supabase Campaign Blast & Sequence Email Recipients
      narrowOrAll(EMAIL_RECIPIENT_TIMELINE_COLUMNS, (cols) => {
        const q = supabaseAdmin.from('email_recipients').select(cols);
        return (leadEmail
          ? q.or(`lead_id.eq.${leadId},email.ilike.%${leadEmail}%`)
          : q.eq('lead_id', leadId)
        )
          .order('created_at', { ascending: false })
          .limit(50);
      }),

      // Calls / SMS history — only queried while telephony is enabled (rollback flag).
      TELEPHONY_ENABLED
        ? supabaseAdmin
            .from('calls')
            .select('id, direction, disposition, status, duration, notes, recording_url, start_time, created_at')
            .or(`lead_id.eq.${leadId}${leadPhone ? `,to_number.eq.${leadPhone}` : ''}`)
            .order('created_at', { ascending: false })
            .limit(30)
        : Promise.resolve({ data: [] }),

      TELEPHONY_ENABLED
        ? supabaseAdmin
            .from('sms_messages')
            .select('id, direction, body, status, created_at')
            .or(`lead_id.eq.${leadId}${leadPhone ? `,to_number.eq.${leadPhone}` : ''}`)
            .order('created_at', { ascending: false })
            .limit(30)
        : Promise.resolve({ data: [] }),

      // Supabase Activity Logs
      supabaseAdmin
        .from('activity_logs')
        .select('id, type, description, metadata, created_at')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false })
        .limit(50),
    ]);

    // Fetch Campaign Titles for all campaign recipients in parallel
    const campaignIds = [...new Set((recipients || []).map((r) => r.campaign_id || r.blast_id).filter(Boolean))];
    const campaignsMap = {};
    if (campaignIds.length > 0) {
      const { data: camps } = await supabaseAdmin
        .from('email_campaigns')
        .select('id, name, subject, body_plain')
        .in('id', campaignIds);

      (camps || []).forEach((c) => {
        campaignsMap[c.id] = c;
      });
    }

    // A. Format Campaign Blast Recipients into Timeline
    (recipients || []).forEach((rec) => {
      const camp = campaignsMap[rec.campaign_id || rec.blast_id] || {};
      const subject =
        rec.generated_subject ||
        rec.custom_subject ||
        rec.tokens?.generated_subject ||
        camp.subject ||
        camp.name ||
        'Campaign Blast Email';
      const bodyText =
        rec.generated_body ||
        rec.custom_body ||
        rec.tokens?.generated_body ||
        camp.body_plain ||
        '';
      const sentTime = rec.sent_at || rec.created_at;

      timeline.push({
        id: `blast_rec_${rec.id}`,
        _id: `blast_rec_${rec.id}`,
        type: 'email',
        action: 'BLAST_EMAIL_SENT',
        channel: 'email',
        direction: 'outbound',
        isBlast: true,
        isIndividual: false,
        dispatchSource: 'blast',
        sourceLabel: camp.name ? `Blast Campaign (${camp.name})` : 'Blast Campaign',
        subject,
        bodyText,
        status: rec.status || 'SENT',
        recipient: rec.email || leadEmail,
        sender: 'MineTech Outbound <outreach@minetechresources.com>',
        summary: `Campaign Blast: "${subject}" [Status: ${rec.status || 'SENT'}]`,
        details: {
          campaignName: camp.name || 'Outbound Blast',
          campaignId: rec.campaign_id || rec.blast_id,
          subject,
          snippet: bodyText ? bodyText.substring(0, 200) : 'Outbound campaign message',
          status: rec.status,
          sentAt: sentTime,
          openedAt: rec.opened_at,
          clickedAt: rec.clicked_at,
          bouncedAt: rec.bounced_at,
          resendId: rec.resend_id || rec.tokens?.resend_id,
          isBlast: true,
          isIndividual: false,
          dispatchSource: 'blast',
        },
        timestamp: sentTime,
        createdAt: rec.created_at,
      });
    });

    // B. Format Supabase 1-to-1 and Inbound Emails
    (emails || []).forEach((email) => {
      const isOutbound = email.direction === 'outbound';
      const isReply = email.direction === 'inbound';
      const subject = email.subject || (isReply ? 'Prospect Reply' : 'Outbound Message');
      const bodyText = email.body_plain || (email.body_html || '').replace(/<[^>]+>/g, ' ').trim();
      const sentTime = email.sent_at || email.created_at;

      timeline.push({
        id: email.id,
        _id: email.id,
        type: 'email',
        action: isOutbound ? 'EMAIL_SENT' : 'EMAIL_RECEIVED',
        channel: 'email',
        direction: email.direction || 'outbound',
        isBlast: false,
        isIndividual: isOutbound,
        dispatchSource: isReply ? 'reply' : 'individual',
        sourceLabel: isReply ? 'Prospect Reply' : '1-to-1 Direct Send',
        subject,
        bodyText,
        status: email.status || 'delivered',
        recipient: email.recipient || leadEmail,
        sender: email.sender || (isReply ? leadEmail : 'outreach@minetechresources.com'),
        summary: isOutbound
          ? `1-to-1 Direct email: "${subject}"`
          : `Received prospect reply: "${subject}"`,
        details: {
          subject,
          snippet: bodyText ? bodyText.substring(0, 200) : (isReply ? 'Prospect reply message' : 'Direct email message'),
          status: email.status,
          sentAt: sentTime,
          resendId: email.resend_id,
          isBlast: false,
          isIndividual: isOutbound,
          dispatchSource: isReply ? 'reply' : 'individual',
        },
        timestamp: sentTime,
        createdAt: email.created_at,
      });
    });

    // C. Format Supabase Calls
    (calls || []).forEach((call) => {
      const callTime = call.start_time || call.created_at;
      timeline.push({
        id: call.id,
        _id: call.id,
        type: 'call',
        action: 'CALL_COMPLETED',
        channel: 'call',
        direction: call.direction || 'outbound',
        disposition: call.disposition || call.status || 'completed',
        duration: call.duration || 0,
        notes: call.notes,
        summary: `Call Placed: ${call.disposition || call.status || 'completed'} (${call.duration || 0}s)`,
        details: {
          duration: call.duration,
          recordingUrl: call.recording_url,
          disposition: call.disposition,
          notes: call.notes,
        },
        timestamp: callTime,
        createdAt: call.created_at,
      });
    });

    // D. Format Supabase SMS
    (smsMsgs || []).forEach((msg) => {
      const isInbound = msg.direction === 'inbound';
      timeline.push({
        id: msg.id,
        _id: msg.id,
        type: 'sms',
        action: isInbound ? 'SMS_RECEIVED' : 'SMS_SENT',
        channel: 'sms',
        direction: msg.direction || 'outbound',
        body: msg.body,
        summary: `${isInbound ? 'Inbound' : 'Outbound'} SMS: "${(msg.body || '').substring(0, 60)}"`,
        details: { body: msg.body, status: msg.status },
        timestamp: msg.created_at,
        createdAt: msg.created_at,
      });
    });

    // E. Format Activity Logs
    (activities || []).forEach((act) => {
      timeline.push({
        id: act.id,
        _id: act.id,
        type: 'activity',
        action: act.type || 'ACTIVITY',
        channel: 'system',
        direction: 'system',
        summary: act.description,
        details: act.metadata,
        timestamp: act.created_at,
        createdAt: act.created_at,
      });
    });
  } catch (err) {
    console.error('[getLeadUnifiedTimeline Error]:', err);
  }

  // Deduplicate and Sort chronologically descending
  const seen = new Set();
  const deduped = [];
  for (const item of timeline) {
    const key = `${item.id || item.action}-${new Date(item.timestamp || item.createdAt).getTime()}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(item);
    }
  }

  return deduped.sort((a, b) => new Date(b.timestamp || b.createdAt).getTime() - new Date(a.timestamp || a.createdAt).getTime());
}

export default {
  acquireLeadLock,
  releaseLeadLock,
  getSmartLeadQueue,
  processCallOutcome,
  getLeadsList,
  getLeadById,
  createLead,
  updateLead,
  deleteLead,
  getLeadUnifiedTimeline,
};
