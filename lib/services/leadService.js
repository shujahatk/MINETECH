import { connectToDatabase } from '@/lib/db/mongoose';
import Lead from '@/lib/models/Lead';
import ActivityLog from '@/lib/models/ActivityLog';
import EmailMessage from '@/lib/models/EmailMessage';
import Call from '@/lib/models/Call';
import SMSMessage from '@/lib/models/SMSMessage';

const CSV_COLUMN_MAP = {
  name: ['name', 'full_name', 'fullname', 'contact_name', 'contactname', 'lead_name'],
  first_name: ['first_name', 'firstname', 'first'],
  last_name: ['last_name', 'lastname', 'last'],
  phone: ['phone', 'phone_number', 'phonenumber', 'mobile', 'cell', 'telephone'],
  email: ['email', 'email_address', 'emailaddress', 'e-mail', 'e_mail', 'e_mail_address', 'email_addr'],
  job_title: ['position', 'title', 'job_title', 'jobtitle', 'role'],
  company: ['company', 'company_name', 'companyname', 'organization', 'org'],
  website: ['website', 'company_website', 'companywebsite', 'url'],
  niche: ['niche', 'industry', 'sector', 'category'],
  country: ['country', 'country_code'],
  city: ['city', 'town'],
  tags: ['tags', 'tag', 'list', 'source'],
};

export function mapCsvHeaders(headers = []) {
  const mapped = {};
  const lowerHeaders = headers.map((h) => h.toLowerCase().trim().replace(/[\s-]+/g, '_'));

  for (const [field, aliases] of Object.entries(CSV_COLUMN_MAP)) {
    const idx = lowerHeaders.findIndex((h) => aliases.includes(h));
    if (idx !== -1) mapped[field] = headers[idx];
  }
  return mapped;
}

export async function getLeadsList({
  search = '',
  status = '',
  tag = '',
  page = 1,
  limit = 25,
  sortBy = 'createdAt',
  sortDir = 'desc',
}) {
  try {
    await connectToDatabase();

    const query = {};

    if (search) {
      const searchRegex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [
        { fullName: searchRegex },
        { firstName: searchRegex },
        { lastName: searchRegex },
        { email: searchRegex },
        { phone: searchRegex },
        { company: searchRegex },
      ];
    }

    if (status && status !== 'ALL') {
      query.status = status;
    }

    if (tag) {
      query.tags = tag;
    }

    const skip = (Math.max(1, page) - 1) * limit;
    const sort = { [sortBy]: sortDir === 'asc' ? 1 : -1 };

    const [leads, total] = await Promise.all([
      Lead.find(query).sort(sort).skip(skip).limit(limit).lean(),
      Lead.countDocuments(query),
    ]);

    return {
      leads,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  } catch (err) {
    console.warn('[Leads] Database offline, returning empty leads response');
    return {
      leads: [],
      pagination: {
        total: 0,
        page: Number(page),
        limit: Number(limit),
        totalPages: 1,
      },
    };
  }
}

export async function getLeadById(id) {
  await connectToDatabase();
  return Lead.findById(id);
}

export async function createLead(data) {
  await connectToDatabase();

  if (data.email) {
    const existing = await Lead.findOne({ email: data.email.toLowerCase().trim() });
    if (existing) {
      throw new Error(`A lead with email ${data.email} already exists.`);
    }
  }

  const lead = await Lead.create(data);

  await ActivityLog.create({
    leadId: lead._id,
    action: 'LEAD_CREATED',
    channel: 'system',
    direction: 'system',
    summary: `Lead created: ${lead.fullName || lead.email}`,
    timestamp: new Date(),
  });

  return lead;
}

export async function updateLead(id, updateData) {
  await connectToDatabase();
  const prevLead = await Lead.findById(id);
  if (!prevLead) throw new Error('Lead not found');

  const updatedLead = await Lead.findByIdAndUpdate(id, updateData, { new: true });

  if (updateData.status && updateData.status !== prevLead.status) {
    await ActivityLog.create({
      leadId: id,
      action: 'STATUS_CHANGED',
      channel: 'system',
      direction: 'system',
      summary: `Status changed from ${prevLead.status} to ${updateData.status}`,
      details: { previousStatus: prevLead.status, newStatus: updateData.status },
      timestamp: new Date(),
    });
  }

  return updatedLead;
}

export async function deleteLead(id) {
  await connectToDatabase();
  return Lead.findByIdAndDelete(id);
}

/**
 * Returns unified chronological timeline of all activities for a lead
 */
export async function getLeadUnifiedTimeline(leadId) {
  await connectToDatabase();

  const [activities, emails, calls, messages] = await Promise.all([
    ActivityLog.find({ leadId }).lean(),
    EmailMessage.find({ leadId }).lean(),
    Call.find({ leadId }).lean(),
    SMSMessage.find({ leadId }).lean(),
  ]);

  const timeline = [];

  for (const act of activities) {
    timeline.push({
      id: act._id.toString(),
      type: 'activity',
      action: act.action,
      channel: act.channel,
      direction: act.direction,
      summary: act.summary,
      details: act.details,
      timestamp: act.timestamp || act.createdAt,
    });
  }

  for (const email of emails) {
    // Avoid double counting if already in activity logs
    timeline.push({
      id: email._id.toString(),
      type: 'email',
      action: email.direction === 'inbound' ? 'EMAIL_RECEIVED' : 'EMAIL_SENT',
      channel: 'email',
      direction: email.direction,
      summary: `${email.direction === 'inbound' ? 'Received' : 'Sent'} email: "${email.subject}"`,
      details: {
        subject: email.subject,
        snippet: email.bodyText.substring(0, 150),
        status: email.status,
        threadId: email.threadId,
      },
      timestamp: email.sentAt || email.receivedAt || email.createdAt,
    });
  }

  for (const call of calls) {
    timeline.push({
      id: call._id.toString(),
      type: 'call',
      action: call.status === 'completed' ? 'CALL_COMPLETED' : 'CALL_STARTED',
      channel: 'call',
      direction: 'outbound',
      summary: `Call (${call.status}) - Duration: ${call.duration}s`,
      details: {
        duration: call.duration,
        recordingUrl: call.recordingUrl,
        disposition: call.disposition,
        notes: call.notes,
      },
      timestamp: call.startTime || call.createdAt,
    });
  }

  for (const msg of messages) {
    timeline.push({
      id: msg._id.toString(),
      type: 'sms',
      action: msg.direction === 'inbound' ? 'SMS_RECEIVED' : 'SMS_SENT',
      channel: msg.channel,
      direction: msg.direction,
      summary: `${msg.direction === 'inbound' ? 'Inbound' : 'Outbound'} ${msg.channel.toUpperCase()}: "${msg.body.substring(0, 60)}"`,
      details: {
        body: msg.body,
        status: msg.status,
      },
      timestamp: msg.createdAt,
    });
  }

  // Deduplicate and sort descending by timestamp
  const seen = new Set();
  const deduped = [];

  for (const item of timeline) {
    const key = `${item.action}-${new Date(item.timestamp).getTime()}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(item);
    }
  }

  return deduped.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}
