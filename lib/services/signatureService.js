/**
 * MineTech Signature Management Service
 * 
 * Provides reusable email signatures, default assignments, editing, and custom signatures.
 */

export const DEFAULT_MINETECH_SIGNATURE = {
  id: 'sig-minetech-head-of-sales',
  name: 'Abdullah Rauf — Head of Sales (Official MineTech)',
  isDefault: true,
  senderName: 'Abdullah Rauf',
  senderTitle: 'Head of Sales',
  senderCompany: 'Minetech Resources BV – Belgium',
  bodyText: `Abdullah Rauf - Head of Sales | Mo. +32 486 287 751 | rauf@mine-tech.be
Minetech Resources BV – Belgium | BTW No. BE 1011004868 | www.mine-tech.be

Facility Address: Frederik Hendrikstraat 60, 4586 AC, Lamswaarde, Netherlands
Registered Office Address: Kernenergiestraat 19, Bus W16, 2610 Antwerpen, Belgium`,
  bodyHtml: `<p style="margin-top: 24px; color: #475569; font-size: 13px; line-height: 1.6; border-top: 1px solid #e2e8f0; padding-top: 16px;">
  <strong style="color: #0f172a;">Abdullah Rauf</strong> - Head of Sales | Mo. +32 486 287 751 | <a href="mailto:rauf@mine-tech.be" style="color: #d97706; text-decoration: none;">rauf@mine-tech.be</a><br/>
  <strong style="color: #0f172a;">Minetech Resources BV</strong> – Belgium | BTW No. BE 1011004868 | <a href="https://www.mine-tech.be" target="_blank" style="color: #d97706; text-decoration: none;">www.mine-tech.be</a><br/><br/>
  <span style="font-size: 11px; color: #64748b;">
    <strong>Facility Address:</strong> Frederik Hendrikstraat 60, 4586 AC, Lamswaarde, Netherlands<br/>
    <strong>Registered Office Address:</strong> Kernenergiestraat 19, Bus W16, 2610 Antwerpen, Belgium
  </span>
</p>`,
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
  return [...PRECONFIGURED_SIGNATURES, ...customSignatures];
}

export function getDefaultSignature() {
  return DEFAULT_MINETECH_SIGNATURE;
}

export function addCustomSignature(sig) {
  const newSig = {
    id: `sig-custom-${Date.now()}`,
    name: sig.name || 'Custom Signature',
    isDefault: false,
    senderName: sig.senderName || '',
    senderTitle: sig.senderTitle || '',
    senderCompany: sig.senderCompany || '',
    bodyText: sig.bodyText || '',
    bodyHtml: sig.bodyHtml || `<p>${(sig.bodyText || '').replace(/\n/g, '<br/>')}</p>`,
    isCustom: true,
  };
  customSignatures.push(newSig);
  return newSig;
}
