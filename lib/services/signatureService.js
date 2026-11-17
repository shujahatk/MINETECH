/**
 * MineTech Signature Management Service
 * 
 * Provides Gmail signature synchronization, default assignments,
 * rich HTML preservation, and custom signatures.
 */

import {
  getActiveGmailSignature,
  syncGmailSignature,
  OFFICIAL_GMAIL_SIGNATURE_HTML,
} from './gmailSignatureService.js';

export const DEFAULT_MINETECH_SIGNATURE = {
  id: 'sig-gmail-synced',
  name: 'Gmail Signature — Abdullah Rauf (Official)',
  isDefault: true,
  senderName: 'Abdullah Rauf',
  senderTitle: 'Head of Sales',
  senderCompany: 'Minetech Resources BV – Belgium',
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

let customSignatures = [];

export function getAllSignatures() {
  const activeGmail = getActiveGmailSignature();
  const gmailSig = {
    ...DEFAULT_MINETECH_SIGNATURE,
    bodyHtml: activeGmail.signatureHtml || OFFICIAL_GMAIL_SIGNATURE_HTML,
    senderName: activeGmail.displayName || 'Abdullah Rauf',
    senderEmail: activeGmail.sendAsEmail || 'rauf@mine-tech.be',
    source: activeGmail.source,
    lastSyncedAt: activeGmail.lastSyncedAt,
    permissionStatus: activeGmail.permissionStatus,
  };

  return [gmailSig, ...PRECONFIGURED_SIGNATURES.slice(1), ...customSignatures];
}

export function getDefaultSignature() {
  const activeGmail = getActiveGmailSignature();
  return {
    ...DEFAULT_MINETECH_SIGNATURE,
    bodyHtml: activeGmail.signatureHtml || OFFICIAL_GMAIL_SIGNATURE_HTML,
    senderName: activeGmail.displayName || 'Abdullah Rauf',
    senderEmail: activeGmail.sendAsEmail || 'rauf@mine-tech.be',
    source: activeGmail.source,
    lastSyncedAt: activeGmail.lastSyncedAt,
    permissionStatus: activeGmail.permissionStatus,
  };
}

export function formatSignatureHtml(sig = {}) {
  if (sig.bodyHtml) return sig.bodyHtml;

  const name = sig.senderName || sig.name || 'Abdullah Rauf';
  const title = sig.senderTitle || sig.title || 'Head of Sales';
  const company = sig.senderCompany || sig.company || 'Minetech Resources BV – Belgium';
  const phone = sig.phone || sig.senderPhone || '+32 486 287 751';
  const email = sig.email || sig.senderEmail || 'rauf@mine-tech.be';
  const website = sig.website || 'www.mine-tech.be';
  const extra = sig.extra || sig.notes || sig.extraNotes || '';

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

export function addCustomSignature(sig) {
  const bodyHtml = sig.bodyHtml || formatSignatureHtml(sig);

  const newSig = {
    id: `sig-custom-${Date.now()}`,
    name: sig.name || sig.senderName || 'Custom Signature',
    isDefault: false,
    senderName: sig.senderName || sig.name || '',
    senderTitle: sig.senderTitle || '',
    senderCompany: sig.senderCompany || '',
    bodyText: sig.bodyText || `${sig.senderName || ''} - ${sig.senderTitle || ''} | ${sig.senderCompany || ''}`,
    bodyHtml,
    isCustom: true,
  };
  customSignatures.push(newSig);
  return newSig;
}
