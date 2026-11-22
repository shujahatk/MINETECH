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
  Edit3,
  RefreshCw,
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
  Code,
  Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export default function CustomSignatureModal({
  isOpen,
  onClose,
  totalDraftsCount = 0,
  selectedDraftsCount = 0,
  selectedDraftIds = [],
  onSignatureApplied,
  campaignId = null,
}) {
  const [signatures, setSignatures] = useState([]);
  const [selectedSigId, setSelectedSigId] = useState('sig-gmail-synced');
  const [activeTab, setActiveTab] = useState('gmail'); // 'gmail' | 'manual' | 'preset'
  const [loading, setLoading] = useState(false);
  const [syncingGmail, setSyncingGmail] = useState(false);

  // Active Gmail sync metadata
  const [gmailSyncMeta, setGmailSyncMeta] = useState({
    lastSyncedAt: null,
    source: 'official_reference',
    sendAsEmail: 'rauf@mine-tech.be',
    displayName: 'Abdullah Rauf',
    permissionStatus: 'ready',
    requiredScope: 'https://www.googleapis.com/auth/gmail.settings.basic',
  });

  // Manual raw HTML signature editor
  const [manualHtml, setManualHtml] = useState('');
  const [previewHtml, setPreviewHtml] = useState('');

  // Structured custom signature form
  const [customName, setCustomName] = useState('Abdullah Rauf');
  const [customTitle, setCustomTitle] = useState('Head of Sales');
  const [customCompany, setCustomCompany] = useState('Minetech Resources BV – Belgium');
  const [customPhone, setCustomPhone] = useState('+32 486 287 751');
  const [customEmail, setCustomEmail] = useState('rauf@mine-tech.be');
  const [customWebsite, setCustomWebsite] = useState('www.mine-tech.be');
  const [customExtra, setCustomExtra] = useState(
    'BTW No. BE 1011004868\nFacility Address: Frederik Hendrikstraat 60, 4586 AC, Lamswaarde, Netherlands\nRegistered Office Address: Kernenergiestraat 19, Bus W16, 2610 Antwerpen, Belgium'
  );

  const fetchSignatures = async () => {
    try {
      const res = await fetch('/api/email/workspace/signatures');
      const d = await res.json();
      if (d.success) {
        setSignatures(d.signatures || []);
        if (d.activeGmailSignature) {
          setGmailSyncMeta(d.activeGmailSignature);
          if (!manualHtml) {
            setManualHtml(d.activeGmailSignature.signatureHtml || '');
            setPreviewHtml(d.activeGmailSignature.signatureHtml || '');
          }
        }
        if (d.configuredSignature) {
          const cfg = d.configuredSignature;
          if (cfg.senderName) setCustomName(cfg.senderName);
          if (cfg.senderTitle) setCustomTitle(cfg.senderTitle);
          if (cfg.senderCompany) setCustomCompany(cfg.senderCompany);
          if (cfg.senderPhone) setCustomPhone(cfg.senderPhone);
          if (cfg.senderEmail) setCustomEmail(cfg.senderEmail);
          if (cfg.senderWebsite) setCustomWebsite(cfg.senderWebsite);
          if (cfg.senderExtra !== undefined) setCustomExtra(cfg.senderExtra);
          if (cfg.activeTab) setActiveTab(cfg.activeTab);
          if (cfg.bodyHtml) {
            setManualHtml(cfg.bodyHtml);
            setPreviewHtml(cfg.bodyHtml);
          }
        }
      }
    } catch (e) {
      console.error('Failed to load signatures:', e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchSignatures();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Sync signature from Gmail API
  const handleSyncGmailSignature = async () => {
    setSyncingGmail(true);
    try {
      const res = await fetch('/api/email/workspace/signatures/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetEmail: gmailSyncMeta.sendAsEmail }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        if (data.reason === 'missing_permissions') {
          toast.error(data.message, { duration: 6000 });
          setGmailSyncMeta((prev) => ({
            ...prev,
            permissionStatus: 'missing_permissions',
            requiredScope: data.requiredScope,
          }));
          return;
        }
        throw new Error(data.message || 'Gmail sync failed');
      }

      toast.success(data.message || 'Gmail signature successfully synced!');
      setGmailSyncMeta({
        lastSyncedAt: data.lastSyncedAt,
        source: data.source,
        sendAsEmail: data.sendAsEmail,
        displayName: data.displayName,
        permissionStatus: 'ready',
      });

      if (data.signatureHtml) {
        setManualHtml(data.signatureHtml);
        setPreviewHtml(data.signatureHtml);
      }

      fetchSignatures();
    } catch (err) {
      toast.error(err.message || 'Error syncing signature from Gmail');
    } finally {
      setSyncingGmail(false);
    }
  };

  // Generate HTML from custom structured fields
  const generateCustomHtml = () => {
    return `<div dir="ltr" class="gmail_signature" data-smartmail="gmail_signature">
  <div dir="ltr">
    <p style="margin-top:16px; margin-bottom:0; font-family:Arial, Helvetica, sans-serif; font-size:13px; line-height:1.5; color:#1f2937;">
      Regards,<br/>
      <strong style="color:#0f172a;">${customName}</strong>${customTitle ? ` - ${customTitle}` : ''}${customPhone ? ` | Mo. ${customPhone}` : ''}${customEmail ? ` | <a href="mailto:${customEmail}" style="color:#0284c7; text-decoration:none;" target="_blank">${customEmail}</a>` : ''}<br/>
      <strong style="color:#0f172a;">${customCompany}</strong> | <a href="https://${customWebsite.replace(/^https?:\/\//, '')}" target="_blank" style="color:#0284c7; text-decoration:none;">${customWebsite}</a>
    </p>
    ${customExtra ? `<p style="margin-top:8px; margin-bottom:0; font-family:Arial, Helvetica, sans-serif; font-size:11px; line-height:1.4; color:#6b7280;">${customExtra.replace(/\n/g, '<br/>')}</p>` : ''}
  </div>
</div>`;
  };

  const handleApplySignature = async (applyToAll = true) => {
    setLoading(true);
    try {
      let finalSigHtml = '';
      let sigId = selectedSigId;

      if (activeTab === 'gmail') {
        finalSigHtml = gmailSyncMeta.signatureHtml || manualHtml || generateCustomHtml();
        sigId = 'sig-gmail-synced';
      } else if (activeTab === 'manual') {
        finalSigHtml = manualHtml;
        sigId = 'sig-manual-saved';
      } else {
        finalSigHtml = generateCustomHtml();
        sigId = 'sig-custom-configured';
      }

      // Permanently save the configured signature to database (updating existing record rather than duplicating)
      await fetch('/api/email/workspace/signatures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: sigId,
          name: customName || 'Configured Signature',
          senderName: customName,
          senderTitle: customTitle,
          senderCompany: customCompany,
          senderPhone: customPhone,
          senderEmail: customEmail,
          senderWebsite: customWebsite,
          senderExtra: customExtra,
          activeTab,
          bodyHtml: finalSigHtml,
          applyToAll,
        }),
      }).catch((e) => console.error('Failed to save signature to database:', e));

      // Handle Campaign Recipients scope if campaignId is provided
      if (campaignId) {
        const res = await fetch(`/api/email/campaigns/${campaignId}/recipients`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'bulk_signature',
            applyToAll,
            recipientIds: applyToAll ? undefined : (selectedDraftIds && selectedDraftIds.length > 0 ? selectedDraftIds : undefined),
            signatureHtml: finalSigHtml,
          }),
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.message || 'Failed to apply signature to campaign recipients');
        }

        toast.success(
          applyToAll
            ? `Gmail signature applied to all ${totalDraftsCount} campaign recipients!`
            : `Gmail signature applied to selected recipients!`
        );

        onSignatureApplied?.(finalSigHtml, data);
        onClose();
        return;
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
          ? `Gmail signature applied to all ${totalDraftsCount} emails in workspace!`
          : `Gmail signature applied to selected emails!`
      );

      onSignatureApplied?.(data.drafts);
      onClose();
    } catch (err) {
      toast.error(err.message || 'Error applying signature');
    } finally {
      setLoading(false);
    }
  };

  const formatLastSyncedTime = (isoString) => {
    if (!isoString) return 'Never synced';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (e) {
      return isoString;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <Card className="w-full max-w-3xl bg-card border-border text-foreground shadow-dialog flex flex-col max-h-[90vh] overflow-hidden rounded-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 px-6 border-b border-border bg-muted/20">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-primary/10 border border-primary/20 text-primary">
              <FileSignature className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">
                Gmail Signature Integration
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Exact formatted HTML signature from your connected Gmail sending account
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center justify-between px-6 pt-3 border-b border-border bg-muted/10">
          <div className="flex items-center gap-1 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('gmail')}
              className={`px-3 py-1.5 font-medium border-b-2 transition-colors ${
                activeTab === 'gmail'
                  ? 'border-primary text-primary font-semibold'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Gmail Synchronized Signature
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('manual')}
              className={`px-3 py-1.5 font-medium border-b-2 transition-colors ${
                activeTab === 'manual'
                  ? 'border-primary text-primary font-semibold'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Manual HTML Fallback
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('custom')}
              className={`px-3 py-1.5 font-medium border-b-2 transition-colors ${
                activeTab === 'custom'
                  ? 'border-primary text-primary font-semibold'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Custom Builder
            </button>
          </div>

          <Button
            size="sm"
            variant="outline"
            disabled={syncingGmail}
            onClick={handleSyncGmailSignature}
            className="h-7 text-xs gap-1.5 border-border hover:bg-muted/40 mb-1"
          >
            <RefreshCw className={`w-3 h-3 text-primary ${syncingGmail ? 'animate-spin' : ''}`} />
            Sync Gmail Signature
          </Button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Missing Permission Alert if detected */}
          {gmailSyncMeta.permissionStatus === 'missing_permissions' && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 text-xs text-amber-500">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-amber-400">Gmail Permission Required</p>
                <p className="text-amber-500/90 leading-relaxed">
                  Your Gmail account is connected, but the signature-reading scope (<code>{gmailSyncMeta.requiredScope}</code>) has not been granted. Please request this permission in your Google Workspace admin settings.
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Meanwhile, the verified MineTech official Gmail signature fallback below will be used automatically.
                </p>
              </div>
            </div>
          )}

          {/* Sync Status Banner */}
          <div className="p-3 rounded-xl bg-muted/20 border border-border flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span className="text-muted-foreground">Sender Identity:</span>
              <strong className="text-foreground">{gmailSyncMeta.displayName} &lt;{gmailSyncMeta.sendAsEmail}&gt;</strong>
            </div>

            <div className="flex items-center gap-2 text-muted-foreground text-[11px]">
              <span>Last synced:</span>
              <strong className="text-foreground">{formatLastSyncedTime(gmailSyncMeta.lastSyncedAt)}</strong>
              <span className="px-1.5 py-0.5 rounded bg-muted/60 text-[10px] uppercase font-mono">
                {gmailSyncMeta.source === 'gmail_api' ? 'Gmail API' : 'Official Reference'}
              </span>
            </div>
          </div>

          {/* TAB 1: Gmail Synced Signature View */}
          {activeTab === 'gmail' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground">
                  Live Gmail Signature Preview (Delivered Message Styling):
                </span>
                <span className="text-[11px] text-muted-foreground">
                  Exact font, colors, bolding, hyperlinks, and layout
                </span>
              </div>

              {/* Rendered Signature Box on Paper / Container */}
              <div className="p-6 rounded-xl bg-white text-slate-900 border border-slate-300 shadow-sm overflow-hidden">
                <div
                  dangerouslySetInnerHTML={{
                    __html: manualHtml || gmailSyncMeta.signatureHtml || generateCustomHtml(),
                  }}
                />
              </div>

              <div className="p-3 rounded-lg bg-muted/20 border border-border text-xs text-muted-foreground flex items-center gap-2">
                <Info className="w-4 h-4 text-primary shrink-0" />
                <span>
                  This signature will be appended to outgoing emails and matches your Gmail client view identically. Loop prevention headers guarantee that dual-delivery won&apos;t create duplicates.
                </span>
              </div>
            </div>
          )}

          {/* TAB 2: Manual HTML Fallback */}
          {activeTab === 'manual' && (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1.5">
                  Direct HTML Signature Code:
                </label>
                <Textarea
                  value={manualHtml}
                  onChange={(e) => {
                    setManualHtml(e.target.value);
                    setPreviewHtml(e.target.value);
                  }}
                  rows={8}
                  className="font-mono text-xs bg-background border-border text-foreground"
                  placeholder="<div dir='ltr' class='gmail_signature'>...</div>"
                />
              </div>

              <div>
                <span className="text-xs font-semibold text-foreground block mb-1.5">
                  Live Preview:
                </span>
                <div className="p-6 rounded-xl bg-white text-slate-900 border border-slate-300 shadow-sm overflow-hidden">
                  <div dangerouslySetInnerHTML={{ __html: previewHtml || '<p class="text-slate-400 italic">Enter HTML to preview</p>' }} />
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Structured Custom Builder */}
          {activeTab === 'custom' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">Full Name</label>
                  <Input
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    className="h-8 text-xs bg-background border-border"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">Title / Designation</label>
                  <Input
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    className="h-8 text-xs bg-background border-border"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">Company</label>
                  <Input
                    value={customCompany}
                    onChange={(e) => setCustomCompany(e.target.value)}
                    className="h-8 text-xs bg-background border-border"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">Phone Number</label>
                  <Input
                    value={customPhone}
                    onChange={(e) => setCustomPhone(e.target.value)}
                    className="h-8 text-xs bg-background border-border"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">Email Address</label>
                  <Input
                    value={customEmail}
                    onChange={(e) => setCustomEmail(e.target.value)}
                    className="h-8 text-xs bg-background border-border"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">Company Website</label>
                  <Input
                    value={customWebsite}
                    onChange={(e) => setCustomWebsite(e.target.value)}
                    className="h-8 text-xs bg-background border-border"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Addresses & Registration Details
                </label>
                <Textarea
                  value={customExtra}
                  onChange={(e) => setCustomExtra(e.target.value)}
                  rows={3}
                  className="text-xs bg-background border-border"
                />
              </div>

              <div>
                <span className="text-xs font-semibold text-foreground block mb-1.5">
                  Generated Preview:
                </span>
                <div className="p-6 rounded-xl bg-white text-slate-900 border border-slate-300 shadow-sm overflow-hidden">
                  <div dangerouslySetInnerHTML={{ __html: generateCustomHtml() }} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 px-6 border-t border-border bg-muted/20 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">
            {selectedDraftsCount > 0 ? `${selectedDraftsCount} email(s) selected` : `${totalDraftsCount} total email(s)`}
          </span>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={onClose}
              className="border-border text-foreground hover:bg-muted/40 text-xs"
            >
              Cancel
            </Button>

            {selectedDraftsCount > 0 && selectedDraftsCount < totalDraftsCount && (
              <Button
                variant="secondary"
                disabled={loading}
                onClick={() => handleApplySignature(false)}
                className="bg-muted text-foreground border border-border text-xs"
              >
                Apply to Selected ({selectedDraftsCount})
              </Button>
            )}

            <Button
              disabled={loading}
              onClick={() => handleApplySignature(true)}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs shadow-xs"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Check className="w-3.5 h-3.5 mr-1.5" />}
              Apply Signature to All ({totalDraftsCount})
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
