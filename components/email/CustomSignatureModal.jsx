'use client';

import React, { useState, useEffect } from 'react';
import {
  FileSignature,
  Building,
  User,
  Mail,
  Phone,
  Globe,
  Check,
  X,
  Loader2,
  Sparkles,
  Eye,
  Edit3
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';

export default function CustomSignatureModal({
  isOpen,
  onClose,
  totalDraftsCount = 0,
  selectedDraftsCount = 0,
  selectedDraftIds = [],
  onSignatureApplied,
}) {
  const [signatures, setSignatures] = useState([]);
  const [selectedSigId, setSelectedSigId] = useState('sig-minetech-head-of-sales');
  const [mode, setMode] = useState('preset'); // 'preset' | 'custom'
  const [loading, setLoading] = useState(false);

  // Custom signature form
  const [customName, setCustomName] = useState('Abdullah Rauf');
  const [customTitle, setCustomTitle] = useState('Head of Sales');
  const [customCompany, setCustomCompany] = useState('Minetech Resources BV – Belgium');
  const [customPhone, setCustomPhone] = useState('+32 486 287 751');
  const [customEmail, setCustomEmail] = useState('rauf@mine-tech.be');
  const [customWebsite, setCustomWebsite] = useState('www.mine-tech.be');
  const [customExtra, setCustomExtra] = useState(
    'BTW No. BE 1011004868\nFacility Address: Frederik Hendrikstraat 60, 4586 AC, Lamswaarde, Netherlands\nRegistered Office Address: Kernenergiestraat 19, Bus W16, 2610 Antwerpen, Belgium'
  );

  useEffect(() => {
    if (isOpen) {
      fetch('/api/email/workspace/signatures')
        .then((r) => r.json())
        .then((d) => {
          if (d.success && d.signatures) {
            setSignatures(d.signatures);
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Generate HTML preview for custom signature
  const generateCustomHtml = () => {
    return `<p style="margin-top: 24px; color: #475569; font-size: 13px; line-height: 1.6; border-top: 1px solid #e2e8f0; padding-top: 16px;">
  <strong style="color: #0f172a;">${customName}</strong>${customTitle ? ` - ${customTitle}` : ''}${customPhone ? ` | Mo. ${customPhone}` : ''}${customEmail ? ` | <a href="mailto:${customEmail}" style="color: #d97706; text-decoration: none;">${customEmail}</a>` : ''}<br/>
  <strong style="color: #0f172a;">${customCompany}</strong> | <a href="https://${customWebsite.replace(/^https?:\/\//, '')}" target="_blank" style="color: #d97706; text-decoration: none;">${customWebsite}</a><br/>
  ${customExtra ? `<span style="font-size: 11px; color: #64748b; margin-top: 6px; display: inline-block;">${customExtra.replace(/\n/g, '<br/>')}</span>` : ''}
</p>`;
  };

  const handleApplySignature = async (applyToAll = true) => {
    setLoading(true);
    try {
      let finalSigHtml = '';
      let sigId = selectedSigId;

      if (mode === 'custom') {
        finalSigHtml = generateCustomHtml();
        sigId = `sig-custom-${Date.now()}`;

        // Save custom signature
        await fetch('/api/email/workspace/signatures', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: `${customName} (${customTitle || 'Custom'})`,
            senderName: customName,
            senderTitle: customTitle,
            senderCompany: customCompany,
            bodyText: `${customName} - ${customTitle} | ${customCompany}`,
            bodyHtml: finalSigHtml,
          }),
        }).catch(() => {});
      } else {
        const found = signatures.find((s) => s.id === selectedSigId);
        finalSigHtml = found?.bodyHtml || '';
      }

      const res = await fetch('/api/email/workspace', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'bulk_signature',
          applyToAll,
          draftIds: applyToAll ? undefined : (selectedDraftIds && selectedDraftIds.length > 0 ? selectedDraftIds : undefined),
          signatureId: sigId,
          signatureHtml: finalSigHtml,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to apply signature');
      }

      toast.success(
        applyToAll
          ? `Signature applied to all ${totalDraftsCount} emails in workspace!`
          : `Signature applied to selected emails!`
      );

      onSignatureApplied?.(data.drafts);
      onClose();
    } catch (err) {
      toast.error(err.message || 'Error applying signature');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <Card className="w-full max-w-2xl bg-slate-900 border-slate-700 text-slate-100 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <FileSignature className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">
                Email Signature Manager
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Automatically add an official or custom signature at the end of every email
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Selector */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 p-3 px-6 gap-2">
          <button
            type="button"
            onClick={() => setMode('preset')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              mode === 'preset'
                ? 'bg-amber-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            Choose Preconfigured Signature
          </button>
          <button
            type="button"
            onClick={() => setMode('custom')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              mode === 'custom'
                ? 'bg-amber-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <Edit3 className="w-3.5 h-3.5 inline mr-1.5" />
            Create Custom Signature
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {mode === 'preset' ? (
            <div className="space-y-3">
              <label className="text-xs font-semibold text-slate-300 block">
                Select Signature Preset:
              </label>
              <div className="space-y-2">
                {signatures.map((sig) => {
                  const isSelected = selectedSigId === sig.id;
                  return (
                    <div
                      key={sig.id}
                      onClick={() => setSelectedSigId(sig.id)}
                      className={`p-3 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'border-amber-500 bg-amber-500/10 text-white shadow-sm'
                          : 'border-slate-800 bg-slate-950/40 hover:bg-slate-800/40 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-white">{sig.name}</span>
                          {sig.isDefault && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              Default
                            </span>
                          )}
                        </div>
                        <div
                          className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                            isSelected ? 'border-amber-500 bg-amber-500 text-slate-950' : 'border-slate-600'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                      </div>

                      {sig.bodyHtml && (
                        <div
                          className="mt-2.5 p-2.5 rounded bg-slate-900 border border-slate-800/80 text-[11px] text-slate-300"
                          dangerouslySetInnerHTML={{ __html: sig.bodyHtml }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    Sender Full Name:
                  </label>
                  <Input
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="e.g. Abdullah Rauf"
                    className="h-8 text-xs bg-slate-950 border-slate-700 text-white focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    Job Title / Role:
                  </label>
                  <Input
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    placeholder="e.g. Head of Sales"
                    className="h-8 text-xs bg-slate-950 border-slate-700 text-white focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    Company Name:
                  </label>
                  <Input
                    value={customCompany}
                    onChange={(e) => setCustomCompany(e.target.value)}
                    placeholder="e.g. Minetech Resources BV – Belgium"
                    className="h-8 text-xs bg-slate-950 border-slate-700 text-white focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    Mobile / Phone Number:
                  </label>
                  <Input
                    value={customPhone}
                    onChange={(e) => setCustomPhone(e.target.value)}
                    placeholder="e.g. +32 486 287 751"
                    className="h-8 text-xs bg-slate-950 border-slate-700 text-white focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    Email Address:
                  </label>
                  <Input
                    value={customEmail}
                    onChange={(e) => setCustomEmail(e.target.value)}
                    placeholder="e.g. rauf@mine-tech.be"
                    className="h-8 text-xs bg-slate-950 border-slate-700 text-white focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    Website URL:
                  </label>
                  <Input
                    value={customWebsite}
                    onChange={(e) => setCustomWebsite(e.target.value)}
                    placeholder="e.g. www.mine-tech.be"
                    className="h-8 text-xs bg-slate-950 border-slate-700 text-white focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                  Addresses / VAT No. / Legal Footnote:
                </label>
                <Textarea
                  value={customExtra}
                  onChange={(e) => setCustomExtra(e.target.value)}
                  rows={3}
                  placeholder="e.g. BTW No. BE 1011004868&#10;Facility Address: Netherlands&#10;Registered Office: Belgium"
                  className="bg-slate-950 border-slate-700 text-white text-xs leading-relaxed focus:border-amber-500"
                />
              </div>

              {/* Live Preview Card */}
              <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-950/60 space-y-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5" />
                  Live Signature Preview (appended at end of each email):
                </span>
                <div
                  className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300"
                  dangerouslySetInnerHTML={{ __html: generateCustomHtml() }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 px-6 border-t border-slate-800 bg-slate-950/80 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-slate-400">
            {totalDraftsCount} total emails in workspace
          </span>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={onClose}
              className="border-slate-700 text-slate-300 hover:bg-slate-800 text-xs"
            >
              Cancel
            </Button>

            {selectedDraftsCount > 0 && selectedDraftsCount < totalDraftsCount && (
              <Button
                variant="secondary"
                disabled={loading}
                onClick={() => handleApplySignature(false)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs"
              >
                Apply to Selected ({selectedDraftsCount})
              </Button>
            )}

            <Button
              disabled={loading}
              onClick={() => handleApplySignature(true)}
              className="bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs shadow"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
              Apply Signature to All Emails ({totalDraftsCount})
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
