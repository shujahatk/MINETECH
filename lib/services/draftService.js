import { supabaseAdmin } from '../supabase.js';
import fs from 'fs';
import path from 'path';

const DRAFTS_DIR = path.join(process.cwd(), '.data', 'drafts');

function ensureDraftsDir() {
  if (!fs.existsSync(DRAFTS_DIR)) {
    fs.mkdirSync(DRAFTS_DIR, { recursive: true });
  }
}

export function getLocalDrafts() {
  ensureDraftsDir();
  const file = path.join(DRAFTS_DIR, 'drafts.json');
  if (fs.existsSync(file)) {
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {}
  }
  return [];
}

export function saveLocalDrafts(drafts) {
  ensureDraftsDir();
  const file = path.join(DRAFTS_DIR, 'drafts.json');
  try {
    fs.writeFileSync(file, JSON.stringify(drafts, null, 2), 'utf8');
  } catch (e) {}
}

export async function listDrafts(userId = null) {
  try {
    let query = supabaseAdmin
      .from('email_drafts')
      .select('*')
      .order('updated_at', { ascending: false });

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;
    if (!error && data) return data;
  } catch (e) {}

  const local = getLocalDrafts();
  return userId ? local.filter((d) => !d.user_id || d.user_id === userId) : local;
}

export async function getDraftById(id) {
  try {
    const { data, error } = await supabaseAdmin
      .from('email_drafts')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (!error && data) return data;
  } catch (e) {}

  const local = getLocalDrafts();
  return local.find((d) => d.id === id) || null;
}

export async function saveDraft({
  id = null,
  userId = null,
  leadId = null,
  to = '',
  toList = [],
  cc = [],
  bcc = [],
  subject = '',
  bodyHtml = '',
  bodyText = '',
  attachments = [],
  scheduledAt = null,
}) {
  const now = new Date().toISOString();
  const draftId = id || `draft_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const draftData = {
    id: draftId,
    user_id: userId,
    lead_id: leadId,
    recipient: to || '',
    to_list: Array.isArray(toList) && toList.length > 0 ? toList : [to].filter(Boolean),
    cc: Array.isArray(cc) ? cc : [],
    bcc: Array.isArray(bcc) ? bcc : [],
    subject: subject || '',
    body_html: bodyHtml || '',
    body_text: bodyText || '',
    attachments: Array.isArray(attachments) ? attachments : [],
    scheduled_at: scheduledAt || null,
    updated_at: now,
  };

  try {
    if (id) {
      const { data, error } = await supabaseAdmin
        .from('email_drafts')
        .update(draftData)
        .eq('id', id)
        .select('*')
        .single();
      if (!error && data) return data;
    } else {
      const { data, error } = await supabaseAdmin
        .from('email_drafts')
        .insert({ ...draftData, created_at: now })
        .select('*')
        .single();
      if (!error && data) return data;
    }
  } catch (e) {}

  // Fallback local
  const drafts = getLocalDrafts();
  const idx = drafts.findIndex((d) => d.id === draftId);
  if (idx >= 0) {
    drafts[idx] = { ...drafts[idx], ...draftData };
  } else {
    drafts.unshift({ ...draftData, created_at: now });
  }
  saveLocalDrafts(drafts);
  return drafts.find((d) => d.id === draftId);
}

export async function deleteDraft(id) {
  try {
    await supabaseAdmin.from('email_drafts').delete().eq('id', id);
  } catch (e) {}

  const drafts = getLocalDrafts().filter((d) => d.id !== id);
  saveLocalDrafts(drafts);
  return true;
}

