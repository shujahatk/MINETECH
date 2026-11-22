/**
 * MineTech Workspace Persistent Settings Service
 * 
 * Provides permanent, database-backed persistence via Supabase for:
 * 1. User custom & configured signatures (HTML, text, sender profile fields).
 * 2. Connected/synced Gmail signature state & manual fallback HTML.
 * 3. Document library custom uploads, renames, and permanently deleted documents.
 * 
 * Guarantees that configurations survive page reloads, restarts, logouts, and logins.
 */

import { supabaseAdmin } from '../supabase.js';

let memoryCache = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 2000; // 2 seconds cache for speed, revalidated on mutation

/**
 * Fetch the global workspace settings record from Supabase
 */
export async function getWorkspaceSettings(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && memoryCache && (now - lastCacheTime < CACHE_TTL_MS)) {
    return memoryCache;
  }

  try {
    const { data: rows, error } = await supabaseAdmin
      .from('email_campaigns')
      .select('*')
      .filter('stats->>is_workspace_settings', 'eq', 'true')
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('[workspaceSettingsService] Error querying settings:', error);
      if (memoryCache) return memoryCache;
    }

    let record = rows && rows.length > 0 ? rows[0] : null;

    if (!record) {
      // Initialize settings record in Supabase
      const defaultStats = {
        is_workspace_settings: true,
        custom_signatures: [],
        configured_signature: null,
        active_signature_id: 'sig-gmail-synced',
        active_gmail_signature: null,
        custom_documents: [],
        deleted_doc_ids: [],
        renamed_docs: {},
        updated_at: new Date().toISOString(),
      };

      const { data: inserted, error: insertErr } = await supabaseAdmin
        .from('email_campaigns')
        .insert({
          name: 'MineTech Workspace Global Settings',
          status: 'SETTINGS',
          subject: 'Workspace Global Settings',
          body_html: '<p>Workspace Global Settings</p>',
          body_plain: 'Workspace Global Settings',
          stats: defaultStats,
        })
        .select('*')
        .single();

      if (insertErr) {
        console.error('[workspaceSettingsService] Failed to insert initial settings:', insertErr);
      } else {
        record = inserted;
      }
    }

    if (record) {
      memoryCache = {
        id: record.id,
        stats: record.stats || {},
      };
      lastCacheTime = now;
      return memoryCache;
    }
  } catch (err) {
    console.error('[workspaceSettingsService] Exception in getWorkspaceSettings:', err);
  }

  // Fallback to empty safe structure if Supabase is temporarily unreachable
  return memoryCache || {
    id: null,
    stats: {
      is_workspace_settings: true,
      custom_signatures: [],
      configured_signature: null,
      active_signature_id: 'sig-gmail-synced',
      active_gmail_signature: null,
      custom_documents: [],
      deleted_doc_ids: [],
      renamed_docs: {},
    },
  };
}

/**
 * Persist an update patch into the Supabase settings record
 */
export async function updateWorkspaceSettings(patch = {}) {
  const current = await getWorkspaceSettings(true);
  const updatedStats = {
    ...current.stats,
    ...patch,
    updated_at: new Date().toISOString(),
  };

  memoryCache = {
    id: current.id,
    stats: updatedStats,
  };
  lastCacheTime = Date.now();

  if (current.id) {
    try {
      const { error } = await supabaseAdmin
        .from('email_campaigns')
        .update({
          stats: updatedStats,
          updated_at: new Date().toISOString(),
        })
        .eq('id', current.id);

      if (error) {
        console.error('[workspaceSettingsService] Failed to save settings to Supabase:', error);
      }
    } catch (err) {
      console.error('[workspaceSettingsService] Exception saving settings:', err);
    }
  }

  return updatedStats;
}
