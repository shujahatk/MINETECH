/**
 * Memory Service - structured AI memory in Supabase (no fine-tuning, no prompt blobs).
 *
 * Tables (see supabase/migrations/20261009_ai_brain.sql):
 *   ai_lead_intelligence  one cached study per lead (status, source hash, versions, JSON data)
 *   ai_decisions          append-only record of classifications / recommendations / drafts and
 *                         what the human did with them (approve / edit / reject / sent / useful)
 *
 * Graceful degradation: if the migration has not been applied the service keeps working.
 *   - Intelligence falls back to `leads.enrich_data.ai_brain` (same storage idea the legacy
 *     study already uses), so the Leads UI still works.
 *   - Decisions return `{ persisted: false }` and feedback is a no-op instead of throwing.
 */

import { getBrainConfig, BRAIN_VERSION } from './config.js';
import { ANALYSIS_STATUS } from './schemas.js';
import { textSimilarity } from './policyEngine.js';

const isMissingTable = (error) => {
  if (!error) return false;
  const msg = `${error.message || ''} ${error.details || ''}`.toLowerCase();
  return (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    error.code === 'PGRST204' ||
    msg.includes('does not exist') ||
    msg.includes('schema cache') ||
    msg.includes('could not find the table')
  );
};

/** Compact, storable summary of how a human changed an AI draft. */
export function computeEditStats(original = '', finalText = '') {
  const a = String(original || '');
  const b = String(finalText || '');
  let prefix = 0;
  while (prefix < a.length && prefix < b.length && a[prefix] === b[prefix]) prefix += 1;
  let suffix = 0;
  while (
    suffix < a.length - prefix &&
    suffix < b.length - prefix &&
    a[a.length - 1 - suffix] === b[b.length - 1 - suffix]
  ) {
    suffix += 1;
  }
  const removed = a.length - prefix - suffix;
  const added = b.length - prefix - suffix;

  return {
    originalChars: a.length,
    finalChars: b.length,
    charsRemoved: Math.max(0, removed),
    charsAdded: Math.max(0, added),
    similarity: a || b ? Math.round(textSimilarity(a, b) * 100) / 100 : 1,
    wasEdited: a.trim() !== b.trim(),
  };
}

const clipBody = (text, max) => (text == null ? null : String(text).slice(0, max));

export class MemoryService {
  constructor({ db = null, now = () => new Date() } = {}) {
    this._db = db;
    this.now = now;
    this.limits = getBrainConfig().limits;
  }

  async db() {
    if (this._db) return this._db;
    const mod = await import('../../supabase.js');
    this._db = mod.supabaseAdmin;
    return this._db;
  }

  /* ------------------------------ Intelligence ----------------------------- */

  /**
   * @returns {Promise<null | {status, data, sourceHash, analysisVersion, promptVersion, model, priority, confidence, error, analyzedAt, updatedAt}>}
   */
  async getIntelligence(leadId) {
    const db = await this.db();
    const { data, error } = await db.from('ai_lead_intelligence').select('*').eq('lead_id', leadId).maybeSingle();

    if (error) {
      if (isMissingTable(error)) return this.#getIntelligenceFallback(leadId);
      throw new Error(`Failed to read AI intelligence: ${error.message}`);
    }
    if (!data) return null;
    return this.#fromRow(data);
  }

  async markPending(leadId, { sourceHash }) {
    return this.#writeIntelligence(leadId, {
      status: ANALYSIS_STATUS.PENDING,
      source_hash: sourceHash,
      error: null,
    });
  }

  async saveIntelligence(leadId, { data, sourceHash, promptVersion, model }) {
    return this.#writeIntelligence(leadId, {
      status: ANALYSIS_STATUS.READY,
      data,
      source_hash: sourceHash,
      analysis_version: BRAIN_VERSION,
      prompt_version: promptVersion,
      model: model || null,
      priority: data?.priority || null,
      confidence: data?.confidence ?? null,
      error: null,
      analyzed_at: this.now().toISOString(),
    });
  }

  async saveFailure(leadId, { error, sourceHash }) {
    return this.#writeIntelligence(leadId, {
      status: ANALYSIS_STATUS.FAILED,
      source_hash: sourceHash || null,
      error: String(error || 'Analysis failed').slice(0, 300),
    });
  }

  async #writeIntelligence(leadId, patch) {
    const db = await this.db();
    const row = { lead_id: leadId, updated_at: this.now().toISOString(), ...patch };
    const { error } = await db.from('ai_lead_intelligence').upsert(row, { onConflict: 'lead_id' });

    if (error) {
      if (isMissingTable(error)) return this.#writeIntelligenceFallback(leadId, patch);
      throw new Error(`Failed to save AI intelligence: ${error.message}`);
    }
    return { persisted: true };
  }

  #fromRow(row) {
    return {
      status: row.status,
      data: row.data && Object.keys(row.data).length ? row.data : null,
      sourceHash: row.source_hash || null,
      analysisVersion: row.analysis_version || null,
      promptVersion: row.prompt_version || null,
      model: row.model || null,
      priority: row.priority || null,
      confidence: row.confidence == null ? null : Number(row.confidence),
      error: row.error || null,
      analyzedAt: row.analyzed_at || null,
      updatedAt: row.updated_at || null,
    };
  }

  // Fallback storage: leads.enrich_data.ai_brain (only used until the migration is applied).
  async #getIntelligenceFallback(leadId) {
    const db = await this.db();
    const { data: lead } = await db.from('leads').select('enrich_data').eq('id', leadId).maybeSingle();
    const stored = lead?.enrich_data?.ai_brain;
    return stored ? this.#fromRow({ ...stored, data: stored.data || {} }) : null;
  }

  async #writeIntelligenceFallback(leadId, patch) {
    const db = await this.db();
    const { data: lead } = await db.from('leads').select('enrich_data').eq('id', leadId).maybeSingle();
    const enrich = lead?.enrich_data && typeof lead.enrich_data === 'object' ? lead.enrich_data : {};
    const previous = enrich.ai_brain || {};
    const next = { ...previous, ...patch, lead_id: leadId };
    const { error } = await db
      .from('leads')
      .update({ enrich_data: { ...enrich, ai_brain: next }, updated_at: this.now().toISOString() })
      .eq('id', leadId);
    if (error) throw new Error(`Failed to save AI intelligence (fallback): ${error.message}`);
    return { persisted: true, fallback: true };
  }

  /* -------------------------------- Decisions ------------------------------ */

  /**
   * Store one AI output. Prompts and raw responses are NOT stored.
   * @returns {Promise<{ id: string|null, persisted: boolean }>}
   */
  async recordDecision({
    leadId,
    threadId = null,
    messageId = null,
    kind,
    output,
    draftText = null,
    recommendedAction = null,
    classification = null,
    confidence = null,
    policy = null,
    stopReason = null,
    model = null,
    promptVersion = null,
    createdBy = null,
  }) {
    const db = await this.db();
    const row = {
      lead_id: leadId,
      thread_id: threadId,
      message_id: messageId,
      kind,
      status: 'SUGGESTED',
      output: output || {},
      draft_original: clipBody(draftText, this.limits.maxStoredBodyChars),
      recommended_action: recommendedAction,
      classification,
      confidence: confidence == null ? null : Number(confidence),
      policy: policy ? { allowed: policy.allowed, blockedBy: policy.blockedBy, reasons: policy.reasons } : null,
      stop_reason: stopReason,
      model,
      prompt_version: promptVersion,
      created_by: createdBy ? String(createdBy) : null,
    };

    const { data, error } = await db.from('ai_decisions').insert(row).select('id').single();
    if (error) {
      if (isMissingTable(error)) return { id: null, persisted: false };
      throw new Error(`Failed to record AI decision: ${error.message}`);
    }
    return { id: data.id, persisted: true };
  }

  async getDecision(id) {
    const db = await this.db();
    const { data, error } = await db.from('ai_decisions').select('*').eq('id', id).maybeSingle();
    if (error) {
      if (isMissingTable(error)) return null;
      throw new Error(`Failed to read AI decision: ${error.message}`);
    }
    return data || null;
  }

  /** Most recent decision of a kind for an inbound message (used as a cache key). */
  async findDecisionForMessage(messageId, kind) {
    if (!messageId) return null;
    const db = await this.db();
    const { data, error } = await db
      .from('ai_decisions')
      .select('*')
      .eq('message_id', messageId)
      .eq('kind', kind)
      .order('created_at', { ascending: false })
      .limit(1);
    if (error) {
      if (isMissingTable(error)) return null;
      throw new Error(`Failed to read AI decision: ${error.message}`);
    }
    return data?.[0] || null;
  }

  async listDecisions(leadId, { kind = null, limit = 10 } = {}) {
    const db = await this.db();
    let q = db.from('ai_decisions').select('*').eq('lead_id', leadId).order('created_at', { ascending: false }).limit(limit);
    if (kind) q = q.eq('kind', kind);
    const { data, error } = await q;
    if (error) {
      if (isMissingTable(error)) return [];
      throw new Error(`Failed to list AI decisions: ${error.message}`);
    }
    return data || [];
  }

  /**
   * Human feedback on a suggestion.
   * action: APPROVE | EDIT | REJECT | SENT | USEFUL | NOT_USEFUL | DISMISS
   */
  async recordFeedback(decisionId, { action, finalText = null, userId = null, outcome = null }) {
    const decision = await this.getDecision(decisionId);
    if (!decision) return { persisted: false, reason: 'decision_not_found' };

    const db = await this.db();
    const nowIso = this.now().toISOString();
    const patch = {};
    const upper = String(action || '').toUpperCase();

    switch (upper) {
      case 'APPROVE':
        patch.status = 'APPROVED';
        patch.decided_by = userId ? String(userId) : null;
        patch.decided_at = nowIso;
        break;
      case 'EDIT':
        patch.status = 'EDITED';
        patch.draft_final = clipBody(finalText, this.limits.maxStoredBodyChars);
        patch.edit_stats = computeEditStats(decision.draft_original, finalText);
        patch.decided_by = userId ? String(userId) : null;
        patch.decided_at = nowIso;
        break;
      case 'REJECT':
      case 'DISMISS':
        patch.status = upper === 'REJECT' ? 'REJECTED' : 'DISMISSED';
        patch.decided_by = userId ? String(userId) : null;
        patch.decided_at = nowIso;
        break;
      case 'SENT': {
        patch.status = 'SENT';
        patch.draft_final = clipBody(finalText ?? decision.draft_final ?? decision.draft_original, this.limits.maxStoredBodyChars);
        patch.edit_stats = computeEditStats(decision.draft_original, patch.draft_final);
        patch.sent_at = nowIso;
        patch.decided_by = decision.decided_by || (userId ? String(userId) : null);
        patch.decided_at = decision.decided_at || nowIso;
        break;
      }
      case 'USEFUL':
        patch.useful = true;
        break;
      case 'NOT_USEFUL':
        patch.useful = false;
        break;
      default:
        throw new Error(`Unknown feedback action "${action}"`);
    }
    if (outcome) patch.outcome = String(outcome).slice(0, 120);

    const { error } = await db.from('ai_decisions').update(patch).eq('id', decisionId);
    if (error) {
      if (isMissingTable(error)) return { persisted: false };
      throw new Error(`Failed to record feedback: ${error.message}`);
    }
    return { persisted: true, status: patch.status || decision.status, editStats: patch.edit_stats || null };
  }
}

export default MemoryService;
