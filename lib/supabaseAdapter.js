import { supabaseAdmin } from './supabase.js';
import bcrypt from 'bcryptjs';

// Helper to convert camelCase keys to snake_case for Postgres
export function toSnakeCase(str) {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

// Helper to convert snake_case keys to camelCase for JS
export function toCamelCase(str) {
  return str.replace(/_([a-z0-9])/g, (g) => g[1].toUpperCase());
}

export const ALLOWED_COLUMNS = {
  users: ['id', 'email', 'password', 'name', 'role', 'approved', 'created_at', 'updated_at'],
  leads: ['id', 'first_name', 'last_name', 'full_name', 'email', 'phone', 'company', 'job_title', 'website', 'industry', 'niche', 'location', 'status', 'pipeline_stage', 'custom_fields', 'tags', 'score', 'is_dnc', 'dnc_reason', 'assigned_to', 'enrich_data', 'notes', 'created_at', 'updated_at'],
  calls: ['id', 'call_sid', 'lead_id', 'user_id', 'direction', 'from_number', 'to_number', 'duration', 'status', 'recording_url', 'transcription', 'notes', 'outcome', 'sentiment', 'created_at', 'updated_at'],
  sms_messages: ['id', 'message_sid', 'lead_id', 'user_id', 'direction', 'from_number', 'to_number', 'body', 'status', 'created_at', 'updated_at'],
  sending_inboxes: ['id', 'email', 'display_name', 'provider', 'daily_limit', 'sent_today', 'warmup_active', 'status', 'created_at', 'updated_at'],
  email_templates: ['id', 'name', 'subject', 'body_html', 'body_plain', 'category', 'variables', 'created_by', 'created_at', 'updated_at'],
  email_sequences: ['id', 'name', 'description', 'steps', 'is_active', 'created_by', 'created_at', 'updated_at'],
  email_campaigns: ['id', 'name', 'subject', 'body_html', 'body_plain', 'status', 'template_id', 'sending_inbox_id', 'scheduled_at', 'stats', 'created_by', 'created_at', 'updated_at'],
  email_recipients: ['id', 'campaign_id', 'lead_id', 'email', 'status', 'scheduled_at', 'locked_at', 'claimed_by', 'sent_at', 'opened_at', 'clicked_at', 'replied_at', 'bounced_at', 'resend_id', 'error_message', 'tokens', 'created_at', 'updated_at'],
  email_threads: ['id', 'lead_id', 'subject', 'last_message_at', 'status', 'snippet', 'unread_count', 'created_at', 'updated_at'],
  email_messages: ['id', 'thread_id', 'lead_id', 'direction', 'sender', 'recipient', 'subject', 'body_html', 'body_plain', 'resend_id', 'status', 'sent_at', 'created_at'],
  activity_logs: ['id', 'lead_id', 'user_id', 'type', 'description', 'metadata', 'created_at'],
  audit_logs: ['id', 'user_id', 'action', 'entity_type', 'entity_id', 'details', 'ip_address', 'created_at'],
  email_webhook_events: ['id', 'event_id', 'event_type', 'provider_message_id', 'payload', 'created_at'],
};

export function transformToDb(obj, tableName) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj) || obj instanceof Date) {
    return obj;
  }
  const result = {};
  const allowed = tableName ? ALLOWED_COLUMNS[tableName] : null;

  // Handle recipient tokens embedding for AI personalization fields
  if (tableName === 'email_recipients') {
    const tokens = { ...(obj.tokens || {}) };
    if (obj.generatedSubject || obj.generated_subject) tokens.generated_subject = obj.generatedSubject || obj.generated_subject;
    if (obj.generatedBody || obj.generated_body) tokens.generated_body = obj.generatedBody || obj.generated_body;
    if (obj.generationStatus || obj.generation_status) tokens.generation_status = obj.generationStatus || obj.generation_status;
    if (obj.generationError || obj.generation_error) tokens.generation_error = obj.generationError || obj.generation_error;
    if (obj.generationLockedAt || obj.generation_locked_at) tokens.generation_locked_at = obj.generationLockedAt || obj.generation_locked_at;
    if (obj.generationClaimedBy || obj.generation_claimed_by) tokens.generation_claimed_by = obj.generationClaimedBy || obj.generation_claimed_by;
    result.tokens = tokens;
  }

  // Handle campaign stats embedding for master_prompt, campaign_type, sender, etc.
  if (tableName === 'email_campaigns') {
    const stats = { ...(obj.stats || {}) };
    if (obj.masterPrompt || obj.master_prompt) stats.master_prompt = obj.masterPrompt || obj.master_prompt;
    if (obj.campaignType || obj.campaign_type) stats.campaign_type = obj.campaignType || obj.campaign_type;
    if (obj.sender) stats.sender = obj.sender;
    if (obj.personalization) stats.personalization = obj.personalization;
    if (obj.filterCriteria) stats.filterCriteria = obj.filterCriteria;
    if (obj.sendingSettings) stats.sendingSettings = obj.sendingSettings;
    if (obj.tracking) stats.tracking = obj.tracking;
    if (obj.compliance) stats.compliance = obj.compliance;
    result.stats = stats;
  }

  // Handle audit_logs alias mappings (entity_type, user_id, details)
  if (tableName === 'audit_logs') {
    result.entity_type = obj.entityType || obj.entity_type || obj.targetResource || obj.target_resource || obj.targetType || obj.target_type || 'SYSTEM';
    result.user_id = obj.userId || obj.user_id || obj.actorId || obj.actor_id || null;
    result.entity_id = obj.entityId || obj.entity_id || obj.targetId || obj.target_id || null;
    result.details = obj.details || obj.metadata || (obj.summary ? { summary: obj.summary, actorEmail: obj.actorEmail || obj.actor_email } : {});
  }

  // Handle email_messages field mappings
  if (tableName === 'email_messages') {
    if (obj.bodyText || obj.body_text || obj.text || obj.bodyPlain || obj.body_plain) {
      result.body_plain = obj.body_plain || obj.bodyPlain || obj.bodyText || obj.body_text || obj.text || '';
    }
    if (obj.bodyHtml || obj.body_html || obj.html) {
      result.body_html = obj.body_html || obj.bodyHtml || obj.html || '';
    }
    if (obj.sender || obj.from) {
      result.sender = obj.sender || (typeof obj.from === 'object' ? obj.from.email : String(obj.from));
    }
    if (obj.recipient || obj.to) {
      result.recipient = obj.recipient || (Array.isArray(obj.to) ? obj.to[0]?.email : (typeof obj.to === 'object' ? obj.to.email : String(obj.to)));
    }
  }

  for (const [key, value] of Object.entries(obj)) {
    if (key === '_id') {
      result.id = value;
      continue;
    }
    // Handle $set from mongo updates
    if (key === '$set' && typeof value === 'object') {
      Object.assign(result, transformToDb(value, tableName));
      continue;
    }
    // Ignore other mongo operators like $inc, $push, function properties
    if (key.startsWith('$') || typeof value === 'function') {
      continue;
    }

    const snakeKey = toSnakeCase(key);
    if (allowed) {
      if (allowed.includes(snakeKey)) {
        result[snakeKey] = value;
      }
    } else {
      // Include all standard columns (avoiding schema cache errors for non-existent columns)
      const baseAllowed = [
        'id', 'email', 'name', 'password', 'role', 'approved', 'status', 'created_at', 'updated_at',
        'first_name', 'last_name', 'full_name', 'phone', 'company', 'job_title', 'website', 'industry',
        'niche', 'location', 'pipeline_stage', 'custom_fields', 'tags', 'score', 'is_dnc', 'dnc_reason',
        'assigned_to', 'enrich_data', 'notes', 'call_sid', 'lead_id', 'user_id', 'direction', 'from_number',
        'to_number', 'duration', 'recording_url', 'transcription', 'outcome', 'sentiment', 'message_sid',
        'body', 'display_name', 'provider', 'daily_limit', 'sent_today', 'warmup_active', 'subject',
        'body_html', 'body_plain', 'category', 'variables', 'created_by', 'description', 'steps',
        'is_active', 'template_id', 'sending_inbox_id', 'scheduled_at', 'stats', 'campaign_id',
        'locked_at', 'claimed_by', 'sent_at', 'opened_at', 'clicked_at', 'replied_at', 'bounced_at',
        'error_message', 'tokens', 'thread_id', 'sender', 'recipient', 'resend_id', 'type', 'metadata',
        'action', 'entity_type', 'entity_id', 'details', 'ip_address', 'last_message_at', 'snippet', 'unread_count'
      ];
      if (baseAllowed.includes(snakeKey)) {
        result[snakeKey] = value;
      }
    }
  }
  return result;
}

export function transformFromDb(row) {
  if (!row || typeof row !== 'object') return row;
  const result = { ...row };
  result._id = row.id; // provide mongo _id alias
  result.id = row.id;

  for (const [key, value] of Object.entries(row)) {
    const camelKey = toCamelCase(key);
    if (camelKey !== key) {
      result[camelKey] = value;
    }
  }

  // Extract embedded tokens for recipients
  if (row.tokens && typeof row.tokens === 'object') {
    if (row.tokens.generated_subject && !result.generatedSubject) result.generatedSubject = row.tokens.generated_subject;
    if (row.tokens.generated_subject && !result.generated_subject) result.generated_subject = row.tokens.generated_subject;
    if (row.tokens.generated_body && !result.generatedBody) result.generatedBody = row.tokens.generated_body;
    if (row.tokens.generated_body && !result.generated_body) result.generated_body = row.tokens.generated_body;
    if (row.tokens.generation_status && !result.generationStatus) result.generationStatus = row.tokens.generation_status;
    if (row.tokens.generation_status && !result.generation_status) result.generation_status = row.tokens.generation_status;
    if (row.tokens.generation_error && !result.generationError) result.generationError = row.tokens.generation_error;
    if (row.tokens.generation_error && !result.generation_error) result.generation_error = row.tokens.generation_error;
    if (row.tokens.generation_locked_at && !result.generationLockedAt) result.generationLockedAt = row.tokens.generation_locked_at;
    if (row.tokens.generation_claimed_by && !result.generationClaimedBy) result.generationClaimedBy = row.tokens.generation_claimed_by;
  }

  // Extract embedded stats for campaigns
  if (row.stats && typeof row.stats === 'object') {
    if (row.stats.master_prompt && !result.masterPrompt) result.masterPrompt = row.stats.master_prompt;
    if (row.stats.master_prompt && !result.master_prompt) result.master_prompt = row.stats.master_prompt;
    if (row.stats.campaign_type && !result.campaignType) result.campaignType = row.stats.campaign_type;
    if (row.stats.campaign_type && !result.campaign_type) result.campaign_type = row.stats.campaign_type;
  }

  // Alias email messages body text/html fields
  if (row.body_plain !== undefined && !result.bodyText) {
    result.bodyText = row.body_plain;
    result.bodyPlain = row.body_plain;
  }
  if (row.body_html !== undefined && !result.bodyHtml) {
    result.bodyHtml = row.body_html;
  }

  // Add mock mongoose doc methods dynamically referencing this
  result.toObject = function () {
    const copy = { ...this };
    delete copy.toObject;
    delete copy.toJSON;
    return copy;
  };
  result.toJSON = function () {
    const copy = { ...this };
    delete copy.toObject;
    delete copy.toJSON;
    return copy;
  };
  
  return result;
}


/**
 * Base Supabase Model providing Mongoose-compatible query interfaces
 */
export class SupabaseModel {
  constructor(tableName, options = {}) {
    this.tableName = tableName;
    this.options = options;
  }

  get client() {
    return supabaseAdmin;
  }

  async create(data) {
    const isArray = Array.isArray(data);
    const rows = isArray ? data.map((d) => transformToDb(d, this.tableName)) : [transformToDb(data, this.tableName)];

    // Handle special password hashing for users
    if (this.tableName === 'users') {
      for (const row of rows) {
        if (row.password && !row.password.startsWith('$2a$') && !row.password.startsWith('$2b$')) {
          const salt = await bcrypt.genSalt(10);
          row.password = await bcrypt.hash(row.password, salt);
        }
      }
    }

    // Handle activity_logs field normalization
    if (this.tableName === 'activity_logs') {
      for (const row of rows) {
        if (!row.type) row.type = row.action || 'ACTIVITY';
        if (!row.description) row.description = row.summary || row.action || 'Activity recorded';
        if (!row.metadata && row.details) row.metadata = row.details;
      }
    }

    // Handle audit_logs field normalization
    if (this.tableName === 'audit_logs') {
      for (const row of rows) {
        if (!row.entity_type) row.entity_type = row.target_resource || row.target_type || row.entityType || 'SYSTEM';
        if (!row.user_id && row.actor_id) row.user_id = row.actor_id;
        if (!row.entity_id && row.target_id) row.entity_id = row.target_id;
        if (!row.details) row.details = row.metadata || (row.summary ? { summary: row.summary } : {});
      }
    }

    // Handle email_messages field normalization
    if (this.tableName === 'email_messages') {
      for (const row of rows) {
        if (!row.sender && row.from) row.sender = typeof row.from === 'object' ? row.from.email : String(row.from);
        if (!row.recipient && row.to) row.recipient = Array.isArray(row.to) ? row.to[0]?.email : (typeof row.to === 'object' ? row.to.email : String(row.to));
        if (!row.sender) row.sender = 'outreach@8020aquisition.com';
        if (!row.recipient) row.recipient = 'prospect@example.com';
      }
    }

    let { data: created, error } = await this.client
      .from(this.tableName)
      .insert(rows)
      .select();

    if (error) {
      // If foreign key constraint failed on audit_logs or activity_logs, retry with user_id = null
      if (['audit_logs', 'activity_logs'].includes(this.tableName) && error.message.includes('foreign key')) {
        for (const row of rows) {
          row.user_id = null;
        }
        const retry = await this.client.from(this.tableName).insert(rows).select();
        if (!retry.error) {
          created = retry.data;
          error = null;
        }
      }
    }

    if (error) {
      throw new Error(`[Supabase ${this.tableName}.create Error]: ${error.message}`);
    }

    const instances = (created || []).map((row) => this._wrapInstance(row));
    return isArray ? instances : instances[0];
  }

  async insertMany(docs) {
    return this.create(docs);
  }

  find(filter = {}) {
    const query = new SupabaseQuery(this.tableName, filter, this);
    return query;
  }

  async findOne(filter = {}) {
    const query = new SupabaseQuery(this.tableName, filter, this);
    return query.limit(1).maybeSingle();
  }

  async findById(id) {
    if (!id) return null;
    const cleanId = typeof id === 'object' && id._id ? id._id : id.toString();
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('id', cleanId)
      .maybeSingle();

    if (error || !data) return null;
    return this._wrapInstance(data);
  }

  async findByIdAndUpdate(id, update = {}, options = {}) {
    if (!id) return null;
    const cleanId = typeof id === 'object' && id._id ? id._id : id.toString();
    const payload = transformToDb(update, this.tableName);
    payload.updated_at = new Date().toISOString();

    const { data, error } = await this.client
      .from(this.tableName)
      .update(payload)
      .eq('id', cleanId)
      .select()
      .maybeSingle();

    if (error) {
      throw new Error(`[Supabase ${this.tableName}.findByIdAndUpdate Error]: ${error.message}`);
    }
    return data ? this._wrapInstance(data) : null;
  }

  async findOneAndUpdate(filter = {}, update = {}, options = {}) {
    const existing = await this.findOne(filter);
    if (!existing) return null;
    return this.findByIdAndUpdate(existing.id, update, options);
  }

  async updateOne(filter = {}, update = {}) {
    const existing = await this.findOne(filter);
    if (!existing) return { modifiedCount: 0 };
    await this.findByIdAndUpdate(existing.id, update);
    return { modifiedCount: 1, acknowledged: true };
  }

  async updateMany(filter = {}, update = {}) {
    let q = this.client.from(this.tableName).update(transformToDb(update, this.tableName));
    q = applyFilterToSupabaseQuery(q, filter);
    const { data, error } = await q.select('id');
    if (error) throw new Error(error.message);
    return { modifiedCount: data ? data.length : 0, acknowledged: true };
  }

  async findByIdAndDelete(id) {
    if (!id) return null;
    const cleanId = typeof id === 'object' && id._id ? id._id : id.toString();
    const existing = await this.findById(cleanId);
    if (!existing) return null;
    await this.client.from(this.tableName).delete().eq('id', cleanId);
    return existing;
  }

  async deleteOne(filter = {}) {
    const existing = await this.findOne(filter);
    if (!existing) return { deletedCount: 0 };
    await this.client.from(this.tableName).delete().eq('id', existing.id);
    return { deletedCount: 1 };
  }

  async deleteMany(filter = {}) {
    let q = this.client.from(this.tableName).delete();
    q = applyFilterToSupabaseQuery(q, filter);
    const { error } = await q;
    if (error) throw new Error(error.message);
    return { acknowledged: true };
  }

  async countDocuments(filter = {}) {
    let q = this.client.from(this.tableName).select('id', { count: 'exact', head: true });
    q = applyFilterToSupabaseQuery(q, filter);
    const { count, error } = await q;
    if (error) return 0;
    return count || 0;
  }

  async distinct(field, filter = {}) {
    const dbField = toSnakeCase(field);
    let q = this.client.from(this.tableName).select(dbField);
    q = applyFilterToSupabaseQuery(q, filter);
    const { data, error } = await q;
    if (error || !data) return [];
    return [...new Set(data.map((r) => r[dbField]))].filter(Boolean);
  }

  _wrapInstance(rawRow) {
    const instance = transformFromDb(rawRow);
    const model = this;

    instance.save = async function () {
      const dbPayload = transformToDb(this, model.tableName);
      dbPayload.updated_at = new Date().toISOString();
      const { data, error } = await model.client
        .from(model.tableName)
        .update(dbPayload)
        .eq('id', this.id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      Object.assign(instance, transformFromDb(data));
      return instance;
    };

    if (this.tableName === 'users') {
      if (instance.active === undefined || instance.active === null) instance.active = true;
      if (instance.approved === undefined || instance.approved === null) instance.approved = true;
      instance.matchPassword = async function (enteredPassword) {
        if (!this.password || !enteredPassword) return false;
        return bcrypt.compare(enteredPassword, this.password);
      };
    }

    return instance;
  }
}

function applyFilterToSupabaseQuery(q, filter, tableName) {
  if (!filter || Object.keys(filter).length === 0) return q;
  const allowed = tableName ? ALLOWED_COLUMNS[tableName] : null;

  for (const [rawKey, val] of Object.entries(filter)) {
    if (rawKey === '$or' && Array.isArray(val)) {
      // Supabase or filter
      const orClauses = val.map((clause) => {
        const k = Object.keys(clause)[0];
        const v = clause[k];
        const col = toSnakeCase(k === '_id' ? 'id' : k);
        if (allowed && !allowed.includes(col)) return null;
        if (typeof v === 'string') return `${col}.ilike.%${v}%`;
        return `${col}.eq.${v}`;
      }).filter(Boolean);
      if (orClauses.length > 0) {
        q = q.or(orClauses.join(','));
      }
      continue;
    }

    const key = rawKey === '_id' ? 'id' : toSnakeCase(rawKey);
    if (allowed && !allowed.includes(key)) {
      // Ignore filter columns that do not physically exist on this table
      continue;
    }

    if (val === null || val === undefined) {
      q = q.is(key, null);
    } else if (typeof val === 'object' && !Array.isArray(val) && !(val instanceof Date)) {
      // Handle operators: $in, $ne, $gte, $lte, $regex
      if (val.$in) q = q.in(key, val.$in);
      else if (val.$ne !== undefined) q = q.neq(key, val.$ne);
      else if (val.$gt !== undefined) q = q.gt(key, val.$gt);
      else if (val.$gte !== undefined) q = q.gte(key, val.$gte);
      else if (val.$lt !== undefined) q = q.lt(key, val.$lt);
      else if (val.$lte !== undefined) q = q.lte(key, val.$lte);
      else if (val.$regex) {
        const pattern = typeof val.$regex === 'string' ? val.$regex : val.$regex.source;
        q = q.ilike(key, `%${pattern.replace(/\^|\$/g, '')}%`);
      }
    } else if (Array.isArray(val)) {
      q = q.overlaps(key, val);
    } else {
      q = q.eq(key, val);
    }
  }
  return q;
}

class SupabaseQuery {
  constructor(tableName, filter, model) {
    this.tableName = tableName;
    this.filter = filter;
    this.model = model;
    this._limit = null;
    this._skip = 0;
    this._sort = null;
    this._select = '*';
  }

  select(fields) {
    if (typeof fields === 'string') {
      this._select = fields.split(' ').map(toSnakeCase).join(', ') || '*';
    }
    return this;
  }

  sort(sortSpec) {
    this._sort = sortSpec;
    return this;
  }

  limit(n) {
    this._limit = n;
    return this;
  }

  skip(n) {
    this._skip = n;
    return this;
  }

  lean() {
    return this;
  }

  populate(pathOrOptions, select) {
    if (!this._populates) this._populates = [];
    if (typeof pathOrOptions === 'string') {
      this._populates.push({ path: pathOrOptions, select });
    } else if (typeof pathOrOptions === 'object' && pathOrOptions) {
      this._populates.push(pathOrOptions);
    }
    return this;
  }

  async exec() {
    const allowed = ALLOWED_COLUMNS[this.tableName];
    let q = this.model.client.from(this.tableName).select(this._select);
    q = applyFilterToSupabaseQuery(q, this.filter, this.tableName);

    if (this._sort) {
      if (typeof this._sort === 'string') {
        const isDesc = this._sort.startsWith('-');
        const col = toSnakeCase(this._sort.replace(/^-/, ''));
        if (!allowed || allowed.includes(col)) {
          q = q.order(col, { ascending: !isDesc });
        }
      } else if (typeof this._sort === 'object') {
        for (const [k, dir] of Object.entries(this._sort)) {
          const col = toSnakeCase(k === '_id' ? 'id' : k);
          if (!allowed || allowed.includes(col)) {
            q = q.order(col, { ascending: dir === 1 || dir === 'asc' });
          }
        }
      }
    } else if (!allowed || allowed.includes('created_at')) {
      // Default order by created_at desc if exists
      q = q.order('created_at', { ascending: false, nullsFirst: false });
    }

    if (this._limit !== null) {
      const from = this._skip;
      const to = from + this._limit - 1;
      q = q.range(from, to);
    } else if (this._skip > 0) {
      q = q.range(this._skip, this._skip + 100);
    }

    const { data, error } = await q;
    if (error) {
      throw new Error(`[Supabase Query Error on ${this.tableName}]: ${error.message}`);
    }

    const instances = (data || []).map((row) => this.model._wrapInstance(row));

    // Handle relational populations if requested
    if (this._populates && this._populates.length > 0 && instances.length > 0) {
      for (const pop of this._populates) {
        const rawPath = typeof pop === 'string' ? pop : pop.path;
        const selectFields = pop.select ? (typeof pop.select === 'string' ? pop.select.split(' ').map(toSnakeCase).join(', ') : '*') : '*';

        let targetTable = null;
        let fkKey = null;

        if (rawPath === 'leadId' || rawPath === 'lead_id') {
          targetTable = 'leads';
          fkKey = 'lead_id';
        } else if (rawPath === 'userId' || rawPath === 'user_id') {
          targetTable = 'users';
          fkKey = 'user_id';
        } else if (rawPath === 'campaignId' || rawPath === 'campaign_id') {
          targetTable = 'email_campaigns';
          fkKey = 'campaign_id';
        } else if (rawPath === 'sequenceId' || rawPath === 'sequence_id') {
          targetTable = 'email_sequences';
          fkKey = 'sequence_id';
        } else if (rawPath === 'templateId' || rawPath === 'template_id') {
          targetTable = 'email_templates';
          fkKey = 'template_id';
        } else if (rawPath === 'threadId' || rawPath === 'thread_id') {
          targetTable = 'email_threads';
          fkKey = 'thread_id';
        } else if (rawPath === 'emailSequence.sequenceId') {
          targetTable = 'email_sequences';
        }

        if (targetTable) {
          try {
            if (rawPath === 'emailSequence.sequenceId') {
              const seqIds = [
                ...new Set(
                  instances
                    .map((inst) => inst.emailSequence?.sequenceId || inst.custom_fields?.emailSequence?.sequenceId)
                    .filter((id) => id && typeof id === 'string')
                ),
              ];
              if (seqIds.length > 0) {
                const { data: seqs } = await this.model.client.from(targetTable).select(selectFields).in('id', seqIds);
                const seqMap = new Map((seqs || []).map((s) => [s.id, transformFromDb(s)]));
                for (const inst of instances) {
                  const sId = inst.emailSequence?.sequenceId || inst.custom_fields?.emailSequence?.sequenceId;
                  if (sId && seqMap.has(sId)) {
                    if (!inst.emailSequence) inst.emailSequence = {};
                    inst.emailSequence.sequenceId = seqMap.get(sId);
                  }
                }
              }
            } else {
              const fkValues = [
                ...new Set(
                  instances
                    .map((inst) => inst[fkKey] || inst[toCamelCase(fkKey)] || inst[rawPath])
                    .filter((id) => id && typeof id === 'string')
                ),
              ];
              if (fkValues.length > 0) {
                const { data: relatedRows } = await this.model.client.from(targetTable).select(selectFields).in('id', fkValues);
                const relMap = new Map((relatedRows || []).map((r) => [r.id, transformFromDb(r)]));
                for (const inst of instances) {
                  const fVal = inst[fkKey] || inst[toCamelCase(fkKey)] || inst[rawPath];
                  if (fVal && relMap.has(fVal)) {
                    const populatedObj = relMap.get(fVal);
                    inst[rawPath] = populatedObj;
                    inst[toCamelCase(rawPath)] = populatedObj;
                    inst[toSnakeCase(rawPath)] = populatedObj;
                  }
                }
              }
            }
          } catch (popErr) {
            console.warn(`[Supabase Populate Warning on ${rawPath}]:`, popErr.message);
          }
        }
      }
    }

    return instances;
  }

  async maybeSingle() {
    this._limit = 1;
    const results = await this.exec();
    return results.length > 0 ? results[0] : null;
  }

  // Thenable for direct await
  then(resolve, reject) {
    return this.exec().then(resolve, reject);
  }
}

export function createSupabaseModel(tableName, options = {}) {
  return new SupabaseModel(tableName, options);
}

export default createSupabaseModel;
