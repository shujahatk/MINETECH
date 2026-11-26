/**
 * MineTech Official Signature Management Service
 *
 * Provides permanent Supabase-backed persistence for:
 * - The Official MineTech Default Email Signature (Abdullah Rauf)
 * - Additional saved workspace signatures
 * - Admin-controlled company-wide default selection & field editing
 * - Rich HTML formatting with clickable mailto: and https:// links + plain-text preservation
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

export const OFFICIAL_RAUF_SIGNATURE_ID = 'sig-official-rauf';

export const OFFICIAL_RAUF_SIGNATURE_TEXT = `Regards,
Abdullah Rauf - Head of Sales | Mo. +32 486 287 751 | rauf@mine-tech.be
Minetech Resources BV – Belgium | BTW No. BE 1011004868 | www.mine-tech.be

Facility Address: Frederik Hendrikstraat 60, 4586 AC, Lamswaarde, Netherlands
Registered Office Address: Kernenergiestraat 19, Bus W16, 2610 Antwerpen, Belgium`;

export const OFFICIAL_RAUF_SIGNATURE_HTML = `<div dir="ltr" class="gmail_signature" data-smartmail="gmail_signature"><div dir="ltr"><p style="margin-top: 16px; margin-bottom: 0; font-family: Arial, Helvetica, sans-serif; font-size: 13px; line-height: 1.5; color: #1f2937;">Regards,<br/><strong style="color: #0f172a;">Abdullah Rauf</strong> - Head of Sales | Mo. +32 486 287 751 | <a href="mailto:rauf@mine-tech.be" style="color: #0284c7; text-decoration: none;" target="_blank">rauf@mine-tech.be</a><br/><strong style="color: #0f172a;">Minetech Resources BV – Belgium</strong> | BTW No. BE 1011004868 | <a href="https://www.mine-tech.be" target="_blank" style="color: #0284c7; text-decoration: none;">www.mine-tech.be</a></p><p style="margin-top: 8px; margin-bottom: 0; font-family: Arial, Helvetica, sans-serif; font-size: 11px; line-height: 1.4; color: #6b7280;">Facility Address: Frederik Hendrikstraat 60, 4586 AC, Lamswaarde, Netherlands<br/>Registered Office Address: Kernenergiestraat 19, Bus W16, 2610 Antwerpen, Belgium</p></div></div>`;

export const DEFAULT_MINETECH_SIGNATURE = {
  id: OFFICIAL_RAUF_SIGNATURE_ID,
  name: 'Official MineTech Signature — Abdullah Rauf',
  isDefault: true,
  isCompanyDefault: true,
  senderName: 'Abdullah Rauf',
  senderTitle: 'Head of Sales',
  senderCompany: 'Minetech Resources BV – Belgium',
  senderVat: 'BE 1011004868',
  senderPhone: '+32 486 287 751',
  senderEmail: 'rauf@mine-tech.be',
  senderWebsite: 'www.mine-tech.be',
  facilityAddress: 'Frederik Hendrikstraat 60, 4586 AC, Lamswaarde, Netherlands',
  registeredOfficeAddress: 'Kernenergiestraat 19, Bus W16, 2610 Antwerpen, Belgium',
  senderExtra:
    'BTW No. BE 1011004868\nFacility Address: Frederik Hendrikstraat 60, 4586 AC, Lamswaarde, Netherlands\nRegistered Office Address: Kernenergiestraat 19, Bus W16, 2610 Antwerpen, Belgium',
  bodyText: OFFICIAL_RAUF_SIGNATURE_TEXT,
  bodyHtml: OFFICIAL_RAUF_SIGNATURE_HTML,
};

export const PRECONFIGURED_SIGNATURES = [
  DEFAULT_MINETECH_SIGNATURE,
  {
    id: 'sig-minetech-sourcing-desk',
    name: 'MineTech Sourcing & Trading Desk',
    isDefault: false,
    senderName: 'MineTech Sourcing Desk',
    senderTitle: 'Global Mineral Procurement',
    senderCompany: 'Minetech Resources BV – Belgium',
    senderPhone: '+32 486 287 751',
    senderEmail: 'sourcing@mine-tech.be',
    senderWebsite: 'www.mine-tech.be',
    bodyText: `Regards,
Commercial Sourcing Desk | sourcing@mine-tech.be | +32 486 287 751
Minetech Resources BV – Belgium | www.mine-tech.be`,
    bodyHtml: `<div dir="ltr" class="gmail_signature"><p style="margin-top: 16px; margin-bottom: 0; font-family: Arial, Helvetica, sans-serif; font-size: 13px; line-height: 1.5; color: #1f2937;">Regards,<br/><strong style="color: #0f172a;">Commercial Sourcing Desk</strong> | <a href="mailto:sourcing@mine-tech.be" style="color: #0284c7; text-decoration: none;">sourcing@mine-tech.be</a> | +32 486 287 751<br/><strong style="color: #0f172a;">Minetech Resources BV – Belgium</strong> | <a href="https://www.mine-tech.be" target="_blank" style="color: #0284c7; text-decoration: none;">www.mine-tech.be</a></p></div>`,
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
let inMemoryActiveSignatureId = OFFICIAL_RAUF_SIGNATURE_ID;

export function formatSignatureText(sig = {}) {
  if (sig.bodyText && String(sig.bodyText).trim()) return sig.bodyText;

  const name = sig.senderName || sig.name || 'Abdullah Rauf';
  const title = sig.senderTitle || sig.title || '';
  const company = sig.senderCompany || sig.company || 'Minetech Resources BV – Belgium';
  const vat = sig.senderVat || sig.vat || 'BE 1011004868';
  const phone = sig.phone || sig.senderPhone || '';
  const email = sig.email || sig.senderEmail || '';
  const website = sig.website || sig.senderWebsite || '';
  const facility = sig.facilityAddress || '';
  const office = sig.registeredOfficeAddress || '';
  const extra = sig.extra || sig.notes || sig.extraNotes || sig.senderExtra || '';

  const line1Parts = [
    title ? `${name} - ${title}` : name,
    phone ? `Mo. ${phone}` : '',
    email || '',
  ].filter(Boolean);

  const line2Parts = [
    company,
    vat && !extra.includes(vat) ? `BTW No. ${vat}` : '',
    website || '',
  ].filter(Boolean);

  const lines = ['Regards,', line1Parts.join(' | '), line2Parts.join(' | ')];

  if (facility || office) {
    lines.push('');
    if (facility) lines.push(`Facility Address: ${facility}`);
    if (office) lines.push(`Registered Office Address: ${office}`);
  } else if (extra) {
    lines.push('');
    lines.push(extra);
  }

  return lines.join('\n').trim();
}

export function formatSignatureHtml(sig = {}) {
  if (sig.bodyHtml && String(sig.bodyHtml).trim()) return sig.bodyHtml;

  const name = sig.senderName || sig.name || 'Abdullah Rauf';
  const title = sig.senderTitle || sig.title || '';
  const company = sig.senderCompany || sig.company || 'Minetech Resources BV – Belgium';
  const vat = sig.senderVat || sig.vat || 'BE 1011004868';
  const phone = sig.phone || sig.senderPhone || '';
  const email = sig.email || sig.senderEmail || '';
  const website = sig.website || sig.senderWebsite || '';
  const facility = sig.facilityAddress || '';
  const office = sig.registeredOfficeAddress || '';
  const extra = sig.extra || sig.notes || sig.extraNotes || sig.senderExtra || '';

  let html = `<div dir="ltr" class="gmail_signature" data-smartmail="gmail_signature"><div dir="ltr"><p style="margin-top: 16px; margin-bottom: 0; font-family: Arial, Helvetica, sans-serif; font-size: 13px; line-height: 1.5; color: #1f2937;">`;
  html += `Regards,<br/><strong style="color: #0f172a;">${name}</strong>`;
  if (title) html += ` - ${title}`;
  if (phone) html += ` | Mo. ${phone}`;
  if (email) {
    html += ` | <a href="mailto:${email}" style="color: #0284c7; text-decoration: none;" target="_blank">${email}</a>`;
  }
  html += `<br/>`;
  html += `<strong style="color: #0f172a;">${company}</strong>`;
  if (vat) html += ` | BTW No. ${vat}`;
  if (website) {
    const href = /^https?:\/\//i.test(website) ? website : `https://${website}`;
    html += ` | <a href="${href}" target="_blank" style="color: #0284c7; text-decoration: none;">${website}</a>`;
  }
  html += `</p>`;

  if (facility || office) {
    const addrLines = [
      facility ? `Facility Address: ${facility}` : '',
      office ? `Registered Office Address: ${office}` : '',
    ].filter(Boolean);
    html += `<p style="margin-top: 8px; margin-bottom: 0; font-family: Arial, Helvetica, sans-serif; font-size: 11px; line-height: 1.4; color: #6b7280;">${addrLines.join('<br/>')}</p>`;
  } else if (extra) {
    html += `<p style="margin-top: 8px; margin-bottom: 0; font-family: Arial, Helvetica, sans-serif; font-size: 11px; line-height: 1.4; color: #6b7280;">${extra.replace(/\n/g, '<br/>')}</p>`;
  }

  html += `</div></div>`;
  return html;
}

function buildResolvedSignatureList(customSigs = [], activeId = OFFICIAL_RAUF_SIGNATURE_ID) {
  const effectiveDefaultId = activeId || OFFICIAL_RAUF_SIGNATURE_ID;
  const dedupedCustom = [];
  const seenIds = new Set();

  for (const sig of customSigs) {
    if (!sig || !sig.id) continue;
    if (seenIds.has(sig.id)) continue;
    seenIds.add(sig.id);
    dedupedCustom.push({
      ...sig,
      bodyText: sig.bodyText !== undefined ? sig.bodyText : formatSignatureText(sig),
      bodyHtml: sig.bodyHtml !== undefined ? sig.bodyHtml : formatSignatureHtml(sig),
      isDefault: sig.id === effectiveDefaultId,
    });
  }

  // Ensure the Official Rauf signature is always present (using Admin-edited version if saved in Supabase)
  const hasOfficial = dedupedCustom.some((s) => s.id === OFFICIAL_RAUF_SIGNATURE_ID);
  const officialEntry = hasOfficial
    ? null
    : {
        ...DEFAULT_MINETECH_SIGNATURE,
        isDefault: effectiveDefaultId === OFFICIAL_RAUF_SIGNATURE_ID || effectiveDefaultId === 'sig-gmail-synced',
      };

  const preconfiguredExtras = PRECONFIGURED_SIGNATURES.slice(1)
    .filter((p) => !seenIds.has(p.id))
    .map((p) => ({
      ...p,
      isDefault: p.id === effectiveDefaultId,
    }));

  const combined = [
    ...(officialEntry ? [officialEntry] : []),
    ...dedupedCustom,
    ...preconfiguredExtras,
  ];

  // Guarantee exactly one default signature
  if (!combined.some((s) => s.isDefault) && combined.length > 0) {
    combined[0] = { ...combined[0], isDefault: true };
  }

  return combined;
}

/**
 * Ensure the official Rauf signature is permanently seeded in Supabase workspace settings
 */
export async function ensureOfficialDefaultSignatureInSupabase() {
  const settings = await getWorkspaceSettings(true);
  const stats = settings.stats || {};
  const existingCustom = Array.isArray(stats.custom_signatures) ? stats.custom_signatures : [];

  const hasOfficial = existingCustom.some((s) => s.id === OFFICIAL_RAUF_SIGNATURE_ID);
  if (!hasOfficial) {
    const cleanExisting = existingCustom.filter(
      (s, idx, arr) => s && s.id && arr.findIndex((x) => x.id === s.id) === idx
    );
    const officialRecord = {
      ...DEFAULT_MINETECH_SIGNATURE,
      isDefault: true,
      isCustom: false,
      updatedAt: new Date().toISOString(),
    };
    const nextList = [
      officialRecord,
      ...cleanExisting.map((s) => ({ ...s, isDefault: false })),
    ];

    await updateWorkspaceSettings({
      custom_signatures: nextList,
      configured_signature: officialRecord,
      active_signature_id: OFFICIAL_RAUF_SIGNATURE_ID,
    });

    inMemoryCustomSignatures = nextList;
    inMemoryConfiguredSignature = officialRecord;
    inMemoryActiveSignatureId = OFFICIAL_RAUF_SIGNATURE_ID;
    return officialRecord;
  }

  return existingCustom.find((s) => s.id === OFFICIAL_RAUF_SIGNATURE_ID);
}

/**
 * Synchronous getter using hydrated memory state
 */
export function getAllSignatures() {
  return buildResolvedSignatureList(inMemoryCustomSignatures, inMemoryActiveSignatureId);
}

/**
 * Async getter that reads authoritative saved signatures from Supabase
 */
export async function getAllSignaturesAsync() {
  try {
    await ensureOfficialDefaultSignatureInSupabase();
    const settings = await getWorkspaceSettings(true);
    const stats = settings.stats || {};

    if (stats.active_gmail_signature) {
      hydrateGmailSignatureFromSettings(stats.active_gmail_signature);
    }

    inMemoryCustomSignatures = Array.isArray(stats.custom_signatures) ? stats.custom_signatures : [];
    inMemoryConfiguredSignature = stats.configured_signature || null;
    inMemoryActiveSignatureId = stats.active_signature_id || OFFICIAL_RAUF_SIGNATURE_ID;
  } catch (e) {
    console.error('[getAllSignaturesAsync] Error loading settings:', e);
  }

  return getAllSignatures();
}

export async function getDefaultSignatureAsync() {
  const all = await getAllSignaturesAsync();
  return all.find((s) => s.isDefault) || all[0] || DEFAULT_MINETECH_SIGNATURE;
}

export function getDefaultSignature() {
  const all = getAllSignatures();
  return all.find((s) => s.isDefault) || all[0] || DEFAULT_MINETECH_SIGNATURE;
}

/**
 * Get saved configured signature (for auto-populating Configure Signature modal)
 */
export async function getConfiguredSignatureAsync() {
  const def = await getDefaultSignatureAsync();
  const settings = await getWorkspaceSettings();
  const stats = settings.stats || {};
  return stats.configured_signature || def || DEFAULT_MINETECH_SIGNATURE;
}

/**
 * Save or update signature permanently in Supabase (Admin-only via API)
 */
export async function saveOrUpdateSignature(sigData = {}) {
  await ensureOfficialDefaultSignatureInSupabase();
  const settings = await getWorkspaceSettings(true);
  const stats = settings.stats || {};
  let currentCustomSigs = Array.isArray(stats.custom_signatures) ? [...stats.custom_signatures] : [];

  const targetId = sigData.id || `sig-custom-${Date.now()}`;
  const isOfficial = targetId === OFFICIAL_RAUF_SIGNATURE_ID;

  // Rebuild formatted text & HTML when structured fields are edited
  const bodyText =
    sigData.bodyText !== undefined && String(sigData.bodyText).trim()
      ? sigData.bodyText
      : formatSignatureText({ ...sigData, bodyText: '' });

  const bodyHtml =
    sigData.bodyHtml !== undefined && String(sigData.bodyHtml).trim()
      ? sigData.bodyHtml
      : formatSignatureHtml({ ...sigData, bodyHtml: '' });

  const existing = currentCustomSigs.find((s) => s.id === targetId);
  const makeDefault =
    sigData.isDefault !== undefined
      ? Boolean(sigData.isDefault)
      : existing
        ? Boolean(existing.isDefault)
        : false;

  const updatedRecord = {
    ...(existing || {}),
    id: targetId,
    name: sigData.name || (isOfficial ? DEFAULT_MINETECH_SIGNATURE.name : sigData.senderName || 'Custom Signature'),
    isDefault: makeDefault,
    isCompanyDefault: isOfficial || makeDefault,
    senderName: sigData.senderName ?? existing?.senderName ?? '',
    senderTitle: sigData.senderTitle ?? existing?.senderTitle ?? '',
    senderCompany: sigData.senderCompany ?? existing?.senderCompany ?? '',
    senderVat: sigData.senderVat ?? existing?.senderVat ?? 'BE 1011004868',
    senderPhone: sigData.senderPhone ?? sigData.phone ?? existing?.senderPhone ?? '',
    senderEmail: sigData.senderEmail ?? sigData.email ?? existing?.senderEmail ?? '',
    senderWebsite: sigData.senderWebsite ?? sigData.website ?? existing?.senderWebsite ?? '',
    facilityAddress: sigData.facilityAddress ?? existing?.facilityAddress ?? '',
    registeredOfficeAddress: sigData.registeredOfficeAddress ?? existing?.registeredOfficeAddress ?? '',
    senderExtra: sigData.senderExtra ?? sigData.extra ?? sigData.notes ?? existing?.senderExtra ?? '',
    bodyText,
    bodyHtml,
    activeTab: sigData.activeTab || 'custom',
    isCustom: !isOfficial,
    updatedAt: new Date().toISOString(),
  };

  if (makeDefault) {
    currentCustomSigs = currentCustomSigs.map((s) => ({ ...s, isDefault: s.id === targetId }));
  }

  const existingIdx = currentCustomSigs.findIndex((s) => s.id === targetId);
  if (existingIdx !== -1) {
    currentCustomSigs[existingIdx] = updatedRecord;
  } else {
    currentCustomSigs.push(updatedRecord);
  }

  const nextActiveId = makeDefault ? targetId : (stats.active_signature_id || OFFICIAL_RAUF_SIGNATURE_ID);

  inMemoryCustomSignatures = currentCustomSigs;
  inMemoryConfiguredSignature = updatedRecord;
  inMemoryActiveSignatureId = nextActiveId;

  await updateWorkspaceSettings({
    custom_signatures: currentCustomSigs,
    configured_signature: updatedRecord,
    active_signature_id: nextActiveId,
  });

  return updatedRecord;
}

export function addCustomSignature(sig) {
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
    bodyText: formatSignatureText(sig),
    bodyHtml: formatSignatureHtml(sig),
    isCustom: true,
    updatedAt: new Date().toISOString(),
  };

  saveOrUpdateSignature(newSig).catch((e) => console.error('[addCustomSignature] Save failed:', e));
  return newSig;
}

/**
 * Permanently delete a custom signature record from Supabase (cannot delete the official company default)
 */
export async function deleteSignatureAsync(id) {
  if (id === OFFICIAL_RAUF_SIGNATURE_ID) {
    throw new Error('The official MineTech default signature cannot be deleted; edit its fields instead.');
  }

  const settings = await getWorkspaceSettings(true);
  const stats = settings.stats || {};
  let currentCustomSigs = Array.isArray(stats.custom_signatures) ? [...stats.custom_signatures] : [];

  currentCustomSigs = currentCustomSigs.filter((s) => s.id !== id);
  inMemoryCustomSignatures = currentCustomSigs;

  let nextActiveId = stats.active_signature_id || OFFICIAL_RAUF_SIGNATURE_ID;
  if (nextActiveId === id) {
    nextActiveId = OFFICIAL_RAUF_SIGNATURE_ID;
    currentCustomSigs = currentCustomSigs.map((s) => ({
      ...s,
      isDefault: s.id === OFFICIAL_RAUF_SIGNATURE_ID,
    }));
  }

  let configured = stats.configured_signature;
  if (configured?.id === id) {
    configured = currentCustomSigs.find((s) => s.id === nextActiveId) || currentCustomSigs[0] || DEFAULT_MINETECH_SIGNATURE;
  }

  inMemoryConfiguredSignature = configured;
  inMemoryActiveSignatureId = nextActiveId;

  await updateWorkspaceSettings({
    custom_signatures: currentCustomSigs,
    configured_signature: configured,
    active_signature_id: nextActiveId,
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
    isCompanyDefault: false,
    updatedAt: new Date().toISOString(),
  };

  return saveOrUpdateSignature(copy);
}

/**
 * Set a signature as the company-wide default workspace signature (Admin-only via API)
 */
export async function setDefaultSignatureAsync(id) {
  await ensureOfficialDefaultSignatureInSupabase();
  const settings = await getWorkspaceSettings(true);
  const stats = settings.stats || {};
  let currentCustomSigs = Array.isArray(stats.custom_signatures) ? [...stats.custom_signatures] : [];

  currentCustomSigs = currentCustomSigs.map((s) => ({
    ...s,
    isDefault: s.id === id,
  }));

  inMemoryCustomSignatures = currentCustomSigs;
  inMemoryActiveSignatureId = id;

  const target = currentCustomSigs.find((s) => s.id === id) || PRECONFIGURED_SIGNATURES.find((s) => s.id === id);
  if (target) inMemoryConfiguredSignature = target;

  await updateWorkspaceSettings({
    custom_signatures: currentCustomSigs,
    active_signature_id: id,
    ...(target ? { configured_signature: target } : {}),
  });

  return target || { id, isDefault: true };
}
