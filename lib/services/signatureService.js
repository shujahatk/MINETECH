/**
 * MineTech Signature Management Service
 * 
 * Provides Gmail signature synchronization, default assignments,
 * rich HTML preservation, custom signatures, and database persistence.
 */

import {
  getActiveGmailSignature,
  syncGmailSignature,
  OFFICIAL_GMAIL_SIGNATURE_HTML,
  hydrateGmailSignatureFromSettings,
} from './gmailSignatureService.js';
import {
  getWorkspaceSettings,
  updateWorkspaceSettings,
} from './workspaceSettingsService.js';

export const DEFAULT_MINETECH_SIGNATURE = {
  id: 'sig-gmail-synced',
  name: 'Gmail Signature — Abdullah Rauf (Official)',
  isDefault: true,
  senderName: 'Abdullah Rauf',
  senderTitle: 'Head of Sales',
  senderCompany: 'Minetech Resources BV – Belgium',
  senderPhone: '+32 486 287 751',
  senderEmail: 'rauf@mine-tech.be',
  senderWebsite: 'www.mine-tech.be',
  bodyText: `Regards,
Abdullah Rauf - Head of Sales | Mo. +32 486 287 751 | rauf@mine-tech.be
Minetech Resources BV – Belgium | BTW No. BE 1011004868 | www.mine-tech.be

Facility Address: Frederik Hendrikstraat 60, 4586 AC, Lamswaarde, Netherlands
Registered Office Address: Kernenergiestraat 19, Bus W16, 2610 Antwerpen, Belgium`,
  bodyHtml: OFFICIAL_GMAIL_SIGNATURE_HTML,
};

export const PRECONFIGURED_SIGNATURES = [
  DEFAULT_MINETECH_SIGNATURE,
  {
    id: 'sig-minetech-sourcing-desk',
    name: 'MineTech Sourcing & Trading Desk',
    isDefault: false,
    senderName: 'MineTech Sourcing Desk',
    senderTitle: 'Global Mineral Procurement',
    senderCompany: 'Minetech Resources BV',
    bodyText: `Commercial Sourcing Desk | sourcing@mine-tech.be | +32 486 287 751
Minetech Resources BV – Belgium | www.mine-tech.be`,
    bodyHtml: `<p style="margin-top: 20px; color: #475569; font-size: 13px; line-height: 1.5; border-top: 1px solid #e2e8f0; padding-top: 14px;">
  <strong style="color: #0f172a;">Commercial Sourcing Desk</strong> | <a href="mailto:sourcing@mine-tech.be" style="color: #d97706;">sourcing@mine-tech.be</a> | +32 486 287 751<br/>
  <strong style="color: #0f172a;">Minetech Resources BV</strong> – Belgium | <a href="https://www.mine-tech.be" style="color: #d97706;">www.mine-tech.be</a>
</p>`,
  },
  {
    id: 'sig-none',
    name: 'No Signature',
    isDefault: false,
    bodyText: '',
    bodyHtml: '',
  },
];

let inMemoryCustomSignatures = [];
let inMemoryConfiguredSignature = null;

export function formatSignatureHtml(sig = {}) {
  if (sig.bodyHtml) return sig.bodyHtml;

  const name = sig.senderName || sig.name || 'Abdullah Rauf';
  const title = sig.senderTitle || sig.title || 'Head of Sales';
  const company = sig.senderCompany || sig.company || 'Minetech Resources BV – Belgium';
  const phone = sig.phone || sig.senderPhone || '+32 486 287 751';
  const email = sig.email || sig.senderEmail || 'rauf@mine-tech.be';
  const website = sig.website || sig.senderWebsite || 'www.mine-tech.be';
  const extra = sig.extra || sig.notes || sig.extraNotes || sig.senderExtra || '';

  let html = `<div dir="ltr" class="gmail_signature" data-smartmail="gmail_signature"><div dir="ltr"><p style="margin-top: 16px; margin-bottom: 0; font-family: Arial, Helvetica, sans-serif; font-size: 13px; line-height: 1.5; color: #1f2937;">`;
  html += `Regards,<br/><strong style="color: #0f172a;">${name}</strong>`;
  if (title) html += ` - ${title}`;
  if (phone) html += ` | Mo. ${phone}`;
  if (email) html += ` | <a href="mailto:${email}" style="color: #0284c7; text-decoration: none;" target="_blank">${email}</a>`;
  html += `<br/>`;
  html += `<strong style="color: #0f172a;">${company}</strong> | BTW No. BE 1011004868 | <a href="https://${website.replace(/^https?:\/\//, '')}" target="_blank" style="color: #0284c7; text-decoration: none;">${website}</a>`;
  html += `</p>`;
  if (extra) {
    html += `<p style="margin-top: 8px; margin-bottom: 0; font-family: Arial, Helvetica, sans-serif; font-size: 11px; line-height: 1.4; color: #6b7280;">${extra.replace(/\n/g, '<br/>')}</p>`;
  } else {
    html += `<p style="margin-top: 8px; margin-bottom: 0; font-family: Arial, Helvetica, sans-serif; font-size: 11px; line-height: 1.4; color: #6b7280;">Facility Address: Frederik Hendrikstraat 60, 4586 AC, Lamswaarde, Netherlands<br/>Registered Office Address: Kernenergiestraat 19, Bus W16, 2610 Antwerpen, Belgium</p>`;
  }
  html += `</div></div>`;

  return html;
}

/**
 * Synchronous getter using memory state (hydrated by async init / route calls)
 */
export function getAllSignatures() {
  const activeGmail = getActiveGmailSignature();
  const gmailSig = {
    ...DEFAULT_MINETECH_SIGNATURE,
    bodyHtml: activeGmail.signatureHtml || OFFICIAL_GMAIL_SIGNATURE_HTML,
    senderName: activeGmail.displayName || inMemoryConfiguredSignature?.senderName || 'Abdullah Rauf',
    senderEmail: activeGmail.sendAsEmail || inMemoryConfiguredSignature?.senderEmail || 'rauf@mine-tech.be',
    source: activeGmail.source,
    lastSyncedAt: activeGmail.lastSyncedAt,
    permissionStatus: activeGmail.permissionStatus,
  };

  return [gmailSig, ...PRECONFIGURED_SIGNATURES.slice(1), ...inMemoryCustomSignatures];
}

/**
 * Async getter that reads persistent settings from Supabase
 */
export async function getAllSignaturesAsync() {
  try {
    const settings = await getWorkspaceSettings();
    const stats = settings.stats || {};

    if (stats.active_gmail_signature) {
      hydrateGmailSignatureFromSettings(stats.active_gmail_signature);
    }

    if (Array.isArray(stats.custom_signatures)) {
      inMemoryCustomSignatures = stats.custom_signatures;
    }

    if (stats.configured_signature) {
      inMemoryConfiguredSignature = stats.configured_signature;
    }
  } catch (e) {
    console.error('[getAllSignaturesAsync] Error loading settings:', e);
  }

  return getAllSignatures();
}

/**
 * Get user's saved configured signature (for auto-populating Configure Signature modal)
 */
export async function getConfiguredSignatureAsync() {
  const settings = await getWorkspaceSettings();
  const stats = settings.stats || {};
  return stats.configured_signature || inMemoryConfiguredSignature || {
    senderName: 'Abdullah Rauf',
    senderTitle: 'Head of Sales',
    senderCompany: 'Minetech Resources BV – Belgium',
    senderPhone: '+32 486 287 751',
    senderEmail: 'rauf@mine-tech.be',
    senderWebsite: 'www.mine-tech.be',
    senderExtra: 'BTW No. BE 1011004868\nFacility Address: Frederik Hendrikstraat 60, 4586 AC, Lamswaarde, Netherlands\nRegistered Office Address: Kernenergiestraat 19, Bus W16, 2610 Antwerpen, Belgium',
    activeTab: 'gmail',
  };
}

export function getDefaultSignature() {
  const activeGmail = getActiveGmailSignature();
  return {
    ...DEFAULT_MINETECH_SIGNATURE,
    bodyHtml: activeGmail.signatureHtml || OFFICIAL_GMAIL_SIGNATURE_HTML,
    senderName: activeGmail.displayName || inMemoryConfiguredSignature?.senderName || 'Abdullah Rauf',
    senderEmail: activeGmail.sendAsEmail || inMemoryConfiguredSignature?.senderEmail || 'rauf@mine-tech.be',
    source: activeGmail.source,
    lastSyncedAt: activeGmail.lastSyncedAt,
    permissionStatus: activeGmail.permissionStatus,
  };
}

/**
 * Save or update signature permanently in Supabase
 * Ensures modifications update the existing record rather than creating duplicates.
 */
export async function saveOrUpdateSignature(sigData = {}) {
  const settings = await getWorkspaceSettings(true);
  const stats = settings.stats || {};
  let currentCustomSigs = Array.isArray(stats.custom_signatures) ? [...stats.custom_signatures] : [];

  const bodyHtml = sigData.bodyHtml || formatSignatureHtml(sigData);
  const targetId = sigData.id || 'sig-user-configured';

  const updatedRecord = {
    id: targetId,
    name: sigData.name || sigData.senderName || 'User Signature',
    isDefault: Boolean(sigData.isDefault),
    senderName: sigData.senderName || sigData.name || '',
    senderTitle: sigData.senderTitle || '',
    senderCompany: sigData.senderCompany || '',
    senderPhone: sigData.senderPhone || sigData.phone || '',
    senderEmail: sigData.senderEmail || sigData.email || '',
    senderWebsite: sigData.senderWebsite || sigData.website || '',
    senderExtra: sigData.senderExtra || sigData.extra || sigData.notes || '',
    bodyText: sigData.bodyText || `${sigData.senderName || ''} - ${sigData.senderTitle || ''} | ${sigData.senderCompany || ''}`,
    bodyHtml,
    activeTab: sigData.activeTab || 'custom',
    isCustom: true,
    updatedAt: new Date().toISOString(),
  };

  // Find if record exists; update in-place to avoid duplicates!
  const existingIdx = currentCustomSigs.findIndex((s) => s.id === targetId || s.name === updatedRecord.name);
  if (existingIdx !== -1) {
    currentCustomSigs[existingIdx] = updatedRecord;
  } else {
    currentCustomSigs.unshift(updatedRecord);
  }

  inMemoryCustomSignatures = currentCustomSigs;
  inMemoryConfiguredSignature = updatedRecord;

  // Persist to Supabase
  await updateWorkspaceSettings({
    custom_signatures: currentCustomSigs,
    configured_signature: updatedRecord,
    active_signature_id: targetId,
  });

  return updatedRecord;
}

export function addCustomSignature(sig) {
  // Synchronous wrapper that immediately updates memory and asynchronously persists to Supabase
  const bodyHtml = sig.bodyHtml || formatSignatureHtml(sig);
  const targetId = sig.id || `sig-custom-${Date.now()}`;

  const newSig = {
    id: targetId,
    name: sig.name || sig.senderName || 'Custom Signature',
    isDefault: false,
    senderName: sig.senderName || sig.name || '',
    senderTitle: sig.senderTitle || '',
    senderCompany: sig.senderCompany || '',
    senderPhone: sig.senderPhone || sig.phone || '',
    senderEmail: sig.senderEmail || sig.email || '',
    senderWebsite: sig.senderWebsite || sig.website || '',
    senderExtra: sig.senderExtra || sig.extra || '',
    bodyText: sig.bodyText || `${sig.senderName || ''} - ${sig.senderTitle || ''} | ${sig.senderCompany || ''}`,
    bodyHtml,
    isCustom: true,
    updatedAt: new Date().toISOString(),
  };

  const existingIdx = inMemoryCustomSignatures.findIndex((s) => s.id === targetId);
  if (existingIdx !== -1) {
    inMemoryCustomSignatures[existingIdx] = newSig;
  } else {
    inMemoryCustomSignatures.push(newSig);
  }
  inMemoryConfiguredSignature = newSig;

  // Non-blocking save to Supabase
  saveOrUpdateSignature(newSig).catch((e) => console.error('[addCustomSignature] Save failed:', e));

  return newSig;
}

/**
 * Permanently delete a signature record from Supabase
 */
export async function deleteSignatureAsync(id) {
  const settings = await getWorkspaceSettings(true);
  const stats = settings.stats || {};
  let currentCustomSigs = Array.isArray(stats.custom_signatures) ? [...stats.custom_signatures] : [];

  currentCustomSigs = currentCustomSigs.filter((s) => s.id !== id);
  inMemoryCustomSignatures = currentCustomSigs;

  let configured = stats.configured_signature;
  if (configured?.id === id) {
    configured = currentCustomSigs[0] || null;
  }
  inMemoryConfiguredSignature = configured;

  await updateWorkspaceSettings({
    custom_signatures: currentCustomSigs,
    configured_signature: configured,
    active_signature_id: configured?.id || 'sig-gmail-synced',
  });

  return { success: true, deletedId: id };
}

/**
 * Duplicate an existing signature
 */
export async function duplicateSignatureAsync(id) {
  const all = await getAllSignaturesAsync();
  const source = all.find((s) => s.id === id);
  if (!source) throw new Error('Signature not found');

  const copy = {
    ...source,
    id: `sig-custom-${Date.now()}`,
    name: `${source.name} (Copy)`,
    isDefault: false,
    updatedAt: new Date().toISOString(),
  };

  return saveOrUpdateSignature(copy);
}

/**
 * Set a signature as default workspace signature
 */
export async function setDefaultSignatureAsync(id) {
  const settings = await getWorkspaceSettings(true);
  const stats = settings.stats || {};
  let currentCustomSigs = Array.isArray(stats.custom_signatures) ? [...stats.custom_signatures] : [];

  currentCustomSigs = currentCustomSigs.map((s) => ({
    ...s,
    isDefault: s.id === id,
  }));

  inMemoryCustomSignatures = currentCustomSigs;

  let target = currentCustomSigs.find((s) => s.id === id);
  if (target) inMemoryConfiguredSignature = target;

  await updateWorkspaceSettings({
    custom_signatures: currentCustomSigs,
    active_signature_id: id,
    ...(target ? { configured_signature: target } : {}),
  });

  return target || { id, isDefault: true };
}
