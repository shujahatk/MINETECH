'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Send,
  Building,
  User,
  Mail,
  Paperclip,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Trash2,
  Copy,
  Plus,
  Loader2,
  FileSignature,
  Upload,
  Eye,
  Check,
  X,
  ShieldCheck,
  Calendar,
  Layers,
  FileText,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import CustomSignatureModal from './CustomSignatureModal';
import AttachFilesModal from './AttachFilesModal';

export default function CampaignReviewScreen({ campaignId, onBack }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [campaign, setCampaign] = useState(null);
  const [recipients, setRecipients] = useState([]);
  const [selectedRecipientIds, setSelectedRecipientIds] = useState(new Set());
  const [senderEmail, setSenderEmail] = useState('rauf@mine-tech.be');
  const [senderName, setSenderName] = useState('Rauf — MineTech Resources BV');

  // Preview & Editor Modal
  const [previewIndex, setPreviewIndex] = useState(null);
  const [isEditingInPreview, setIsEditingInPreview] = useState(false);
  const [previewSubject, setPreviewSubject] = useState('');
  const [previewBody, setPreviewBody] = useState('');
  const [previewTo, setPreviewTo] = useState('');
  const [previewCc, setPreviewCc] = useState('');
  const [previewBcc, setPreviewBcc] = useState('');
  const [previewSigHtml, setPreviewSigHtml] = useState('');
  const [previewAttachments, setPreviewAttachments] = useState([]);
  const [previewApproval, setPreviewApproval] = useState('approved');
  const [savingRecipient, setSavingRecipient] = useState(false);

  // Modals
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  const [isAttachFilesModalOpen, setIsAttachFilesModalOpen] = useState(false);
  const [isConfirmSendOpen, setIsConfirmSendOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [campaignName, setCampaignName] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);

  // Fetch campaign and recipient details
  const fetchCampaignData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/email/campaigns/${campaignId}`);
      if (!res.ok) throw new Error('Failed to load campaign');
      const data = await res.json();
      const camp = data.data?.campaign || data.data || {};
      setCampaign(camp);
      setCampaignName(camp.name || 'Personalized Outreach');

      // Fetch recipient records
      const recRes = await fetch(`/api/email/campaigns/${campaignId}/recipients`);
      const recData = await recRes.json();
      const recList = recData.recipients || [];
      setRecipients(recList);

      // Default select all approved recipients
      const approvedIds = new Set(
        recList
          .filter((r) => r.tokens?.approval_status === 'approved' || r.tokens?.user_approved)
          .map((r) => r.id)
      );
      setSelectedRecipientIds(approvedIds.size > 0 ? approvedIds : new Set(recList.map((r) => r.id)));
    } catch (err) {
      console.error('Error loading campaign review:', err);
      toast.error(err.message || 'Error loading campaign details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (campaignId) {
      fetchCampaignData();
    }
  }, [campaignId]);

  // Derived metrics
  const totalCount = recipients.length;
  const approvedCount = recipients.filter(
    (r) => r.tokens?.approval_status === 'approved' || r.tokens?.user_approved
  ).length;
  const unapprovedCount = totalCount - approvedCount;
  const totalAttachments = recipients.reduce((sum, r) => {
    const atts = r.tokens?.attachments || [];
    return sum + (Array.isArray(atts) ? atts.length : 0);
  }, 0);

  // Open Preview for specific recipient index
  const openPreviewAt = (idx) => {
    if (idx < 0 || idx >= recipients.length) return;
    const r = recipients[idx];
    setPreviewIndex(idx);
    setIsEditingInPreview(false);
    setPreviewSubject(r.tokens?.custom_subject || campaign?.subject || '');
    setPreviewBody(r.tokens?.custom_body_plain || r.tokens?.custom_body_html?.replace(/<[^>]+>/g, ' ') || '');
    setPreviewTo(r.email || '');
    setPreviewCc((r.tokens?.cc || []).join(', '));
    setPreviewBcc((r.tokens?.bcc || []).join(', '));
    setPreviewSigHtml(r.tokens?.signature_html || '');
    setPreviewAttachments(r.tokens?.attachments || []);
    setPreviewApproval(r.tokens?.approval_status || (r.tokens?.user_approved ? 'approved' : 'needs_review'));
  };

  // Save changes to recipient
  const handleSaveRecipientChanges = async (shouldApprove = null, advanceNext = false) => {
    if (previewIndex === null || !recipients[previewIndex]) return;
    const currentRec = recipients[previewIndex];
    setSavingRecipient(true);

    try {
      const finalApproval = shouldApprove !== null
        ? (shouldApprove ? 'approved' : 'needs_review')
        : previewApproval;

      const parsedCc = previewCc.split(',').map((s) => s.trim()).filter((s) => s.includes('@'));
      const parsedBcc = previewBcc.split(',').map((s) => s.trim()).filter((s) => s.includes('@'));

      const res = await fetch(`/api/email/campaigns/${campaignId}/recipients`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_recipient',
          recipientId: currentRec.id,
          updates: {
            to: previewTo,
            customSubject: previewSubject,
            customBodyPlain: previewBody,
            signatureHtml: previewSigHtml,
            attachments: previewAttachments,
            cc: parsedCc,
            bcc: parsedBcc,
            approvalStatus: finalApproval,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to update recipient');
      }

      toast.success(shouldApprove ? 'Email approved and saved!' : 'Recipient changes saved');

      // Update in local state
      setRecipients((prev) => {
        const next = [...prev];
        next[previewIndex] = data.recipient;
        return next;
      });

      setPreviewApproval(finalApproval);
      setIsEditingInPreview(false);

      if (advanceNext && previewIndex < recipients.length - 1) {
        openPreviewAt(previewIndex + 1);
      }
    } catch (err) {
      toast.error(err.message || 'Error saving changes');
    } finally {
      setSavingRecipient(false);
    }
  };

  // Remove recipient from campaign
  const handleRemoveRecipient = async (recipientId) => {
    if (!confirm('Remove this email and company from this campaign? (It will remain saved in your database)')) {
      return;
    }

    try {
      const res = await fetch(`/api/email/campaigns/${campaignId}/recipients`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'remove_recipient',
          recipientId,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message);

      toast.success('Removed from campaign');
      setRecipients((prev) => prev.filter((r) => r.id !== recipientId));
      if (previewIndex !== null) setPreviewIndex(null);
    } catch (err) {
      toast.error(err.message || 'Failed to remove recipient');
    }
  };

  // Bulk Remove selected recipients
  const handleBulkRemove = async () => {
    const targetIds = Array.from(selectedRecipientIds);
    if (targetIds.length === 0) return;

    if (!confirm(`Remove ${targetIds.length} selected email(s) from this campaign?`)) return;

    try {
      const res = await fetch(`/api/email/campaigns/${campaignId}/recipients`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'bulk_remove',
          recipientIds: targetIds,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message);

      toast.success(`Removed ${targetIds.length} recipient(s)`);
      setRecipients((prev) => prev.filter((r) => !selectedRecipientIds.has(r.id)));
      setSelectedRecipientIds(new Set());
    } catch (err) {
      toast.error(err.message || 'Bulk remove failed');
    }
  };

  // Bulk Approve selected recipients
  const handleBulkApprove = async () => {
    const targetIds = Array.from(selectedRecipientIds);
    if (targetIds.length === 0) return;

    try {
      const res = await fetch(`/api/email/campaigns/${campaignId}/recipients`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'bulk_approve',
          recipientIds: targetIds,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message);

      toast.success(`Approved ${targetIds.length} email(s)!`);
      fetchCampaignData();
    } catch (err) {
      toast.error('Bulk approve failed');
    }
  };

  // Rename Campaign
  const handleRenameCampaign = async () => {
    if (!campaignName.trim()) return;
    try {
      const res = await fetch(`/api/email/campaigns/${campaignId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: campaignName.trim() }),
      });
      if (res.ok) {
        toast.success('Campaign name updated');
        setIsRenaming(false);
      }
    } catch (err) {
      toast.error('Failed to update campaign name');
    }
  };

  // Launch Campaign (Send after final confirmation)
  const handleLaunchCampaign = async () => {
    setSending(true);
    try {
      const res = await fetch(`/api/email/campaigns/${campaignId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'launch' }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to dispatch campaign');
      }

      toast.success(`Campaign launched! ${totalCount} personalized emails dispatched to sending queue.`);
      setIsConfirmSendOpen(false);
      fetchCampaignData();
    } catch (err) {
      toast.error(err.message || 'Error launching campaign');
    } finally {
      setSending(false);
    }
  };

  // Selection toggle
  const toggleSelectAll = () => {
    if (selectedRecipientIds.size === recipients.length) {
      setSelectedRecipientIds(new Set());
    } else {
      setSelectedRecipientIds(new Set(recipients.map((r) => r.id)));
    }
  };

  const toggleSelectOne = (id) => {
    setSelectedRecipientIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="py-28 flex flex-col items-center justify-center text-slate-400 space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
        <p className="text-sm font-medium">Loading campaign preview & review screen...</p>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="py-24 text-center text-slate-400 space-y-3">
        <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto" />
        <h3 className="text-lg font-bold text-white">Campaign Not Found</h3>
        <p className="text-xs text-slate-400">The requested campaign does not exist or was removed.</p>
        <Button onClick={onBack || (() => router.push('/email/blasts'))} className="mt-2 text-xs">
          Return to Campaigns
        </Button>
      </div>
    );
  }

  const currentPreviewRecipient = previewIndex !== null ? recipients[previewIndex] : null;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Header & Breadcrumbs */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack || (() => router.push('/email/blasts'))}
              className="h-8 text-xs text-slate-400 hover:text-white hover:bg-slate-800 -ml-2"
            >
              <ArrowLeft className="w-4 h-4 mr-1.5" />
              Back
            </Button>

            <span className="text-xs text-slate-500">•</span>

            {isRenaming ? (
              <div className="flex items-center gap-2">
                <Input
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  className="h-8 text-sm font-semibold bg-slate-950 border-amber-500 text-white w-72"
                  autoFocus
                />
                <Button size="sm" onClick={handleRenameCampaign} className="h-8 text-xs bg-amber-600 hover:bg-amber-500 text-white">
                  Save
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setIsRenaming(false)} className="h-8 text-xs text-slate-400">
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-white tracking-tight">
                  {campaignName}
                </h1>
                <button
                  onClick={() => setIsRenaming(true)}
                  className="p-1 rounded text-slate-400 hover:text-amber-400 hover:bg-slate-800"
                  title="Rename Campaign"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <Badge className="bg-amber-500/10 text-amber-300 border-amber-500/30 uppercase text-[10px] font-semibold">
              {campaign.status || 'DRAFT'}
            </Badge>
          </div>

          <p className="text-xs text-slate-400 max-w-2xl">
            Dedicated Campaign Review: Inspect every individual outgoing email, verify exact recipients, typography, custom signatures, and file attachments before sending.
          </p>
        </div>

        {/* Header Right Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchCampaignData}
            className="border-slate-700 text-slate-300 hover:bg-slate-800 text-xs h-9"
          >
            Refresh
          </Button>

          <Button
            size="sm"
            onClick={() => setIsConfirmSendOpen(true)}
            disabled={totalCount === 0 || campaign.status === 'RUNNING' || campaign.status === 'COMPLETED'}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs h-9 shadow-lg shadow-emerald-600/20 px-4"
          >
            <Send className="w-3.5 h-3.5 mr-1.5" />
            Send Campaign ({approvedCount}/{totalCount})
          </Button>
        </div>
      </div>

      {/* Campaign Metadata Cards (7 Stats) */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <Card className="p-3.5 bg-slate-900 border-slate-800">
          <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">
            Sender Account
          </span>
          <div className="text-xs font-semibold text-amber-300 mt-1 truncate" title={senderEmail}>
            {senderEmail}
          </div>
          <span className="text-[10px] text-slate-500">{senderName}</span>
        </Card>

        <Card className="p-3.5 bg-slate-900 border-slate-800">
          <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">
            Companies
          </span>
          <div className="text-xl font-bold text-white mt-1">{totalCount}</div>
          <span className="text-[10px] text-slate-500">Unique target accounts</span>
        </Card>

        <Card className="p-3.5 bg-slate-900 border-slate-800">
          <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">
            Outgoing Emails
          </span>
          <div className="text-xl font-bold text-white mt-1">{totalCount}</div>
          <span className="text-[10px] text-slate-500">Total individual messages</span>
        </Card>

        <Card className="p-3.5 bg-slate-900 border-slate-800">
          <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">
            Approved
          </span>
          <div className="text-xl font-bold text-emerald-400 mt-1">{approvedCount}</div>
          <span className="text-[10px] text-emerald-500/80 font-medium">Ready for dispatch</span>
        </Card>

        <Card className="p-3.5 bg-slate-900 border-slate-800">
          <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">
            Needs Review
          </span>
          <div className={`text-xl font-bold mt-1 ${unapprovedCount > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
            {unapprovedCount}
          </div>
          <span className="text-[10px] text-slate-500">Pending verification</span>
        </Card>

        <Card className="p-3.5 bg-slate-900 border-slate-800">
          <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">
            Attachments
          </span>
          <div className="text-xl font-bold text-amber-300 mt-1">{totalAttachments}</div>
          <span className="text-[10px] text-slate-500">TDS & brochures linked</span>
        </Card>

        <Card className="p-3.5 bg-slate-900 border-slate-800">
          <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">
            Schedule
          </span>
          <div className="text-xs font-semibold text-slate-200 mt-1 truncate">
            {campaign.scheduled_at ? new Date(campaign.scheduled_at).toLocaleDateString() : 'Immediate'}
          </div>
          <span className="text-[10px] text-slate-500">Standard queue</span>
        </Card>
      </div>

      {/* Bulk Action Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/60 p-3 px-4 rounded-xl border border-slate-800">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-slate-300">
            {selectedRecipientIds.size} of {recipients.length} emails selected
          </span>
          <button onClick={toggleSelectAll} className="text-xs text-amber-400 hover:underline">
            {selectedRecipientIds.size === recipients.length ? 'Deselect all' : 'Select all'}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {selectedRecipientIds.size > 0 && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleBulkApprove}
                className="h-8 text-xs border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/20"
              >
                <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-400" />
                Approve Selected ({selectedRecipientIds.size})
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsSignatureModalOpen(true)}
                className="h-8 text-xs border-amber-500/40 text-amber-300 hover:bg-amber-500/20"
              >
                <FileSignature className="w-3.5 h-3.5 mr-1 text-amber-400" />
                Change Signature
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAttachFilesModalOpen(true)}
                className="h-8 text-xs border-amber-500/40 text-amber-300 hover:bg-amber-500/20"
              >
                <Paperclip className="w-3.5 h-3.5 mr-1 text-amber-400" />
                Attach Files
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleBulkRemove}
                className="h-8 text-xs border-rose-500/40 text-rose-300 hover:bg-rose-500/20"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1 text-rose-400" />
                Remove Selected
              </Button>
            </>
          )}

          <Button
            size="sm"
            onClick={() => setIsConfirmSendOpen(true)}
            className="h-8 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow px-3"
          >
            <Send className="w-3.5 h-3.5 mr-1" />
            Send Approved ({approvedCount})
          </Button>
        </div>
      </div>

      {/* Main Campaign Email Table */}
      <Card className="bg-slate-900 border-slate-800 shadow-xl overflow-hidden">
        {recipients.length === 0 ? (
          <div className="py-20 text-center text-slate-400 space-y-3">
            <FileText className="w-10 h-10 text-slate-600 mx-auto" />
            <p className="text-base font-semibold text-slate-200">No emails currently in this campaign</p>
            <p className="text-xs text-slate-400">All emails were removed or this campaign is empty.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/80 text-slate-400 uppercase tracking-wider text-[11px] font-semibold">
                  <th className="py-3 px-4 w-10">
                    <input
                      type="checkbox"
                      checked={selectedRecipientIds.size > 0 && selectedRecipientIds.size === recipients.length}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                    />
                  </th>
                  <th className="py-3 px-4">Company</th>
                  <th className="py-3 px-4">Recipient</th>
                  <th className="py-3 px-4">Subject</th>
                  <th className="py-3 px-4">Attachments</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 text-slate-300">
                {recipients.map((rec, idx) => {
                  const isSelected = selectedRecipientIds.has(rec.id);
                  const isApproved = rec.tokens?.approval_status === 'approved' || rec.tokens?.user_approved;
                  const companyName = rec.tokens?.company_name || 'Target Account';
                  const contactName = rec.tokens?.contact_name || '';
                  const atts = rec.tokens?.attachments || [];
                  const attsCount = Array.isArray(atts) ? atts.length : 0;
                  const emailSubject = rec.tokens?.custom_subject || campaign?.subject || '(No subject)';

                  return (
                    <tr
                      key={rec.id}
                      className={`hover:bg-slate-800/50 transition-colors ${
                        isSelected ? 'bg-amber-500/5' : ''
                      }`}
                    >
                      <td className="py-3.5 px-4">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectOne(rec.id)}
                          className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                        />
                      </td>

                      <td className="py-3.5 px-4 max-w-xs font-semibold text-white">
                        <div className="flex items-center gap-2">
                          <Building className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span className="truncate">{companyName}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="space-y-0.5">
                          <div className="font-medium text-slate-200 flex items-center gap-1.5">
                            <User className="w-3 h-3 text-slate-400" />
                            <span>{contactName || 'Primary Contact'}</span>
                          </div>
                          <span className="text-[11px] text-slate-400 block truncate">{rec.email}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 max-w-sm">
                        <span className="font-medium text-slate-200 block truncate">
                          {emailSubject}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {attsCount > 0 ? (
                          <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 text-[11px] font-medium flex items-center gap-1 w-fit">
                            <Paperclip className="w-3 h-3" />
                            {attsCount} {attsCount === 1 ? 'file' : 'files'}
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-500">—</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {isApproved ? (
                          <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-semibold flex items-center gap-1 w-fit">
                            <CheckCircle2 className="w-3 h-3" />
                            Approved
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-semibold flex items-center gap-1 w-fit">
                            <Clock className="w-3 h-3" />
                            Needs Review
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openPreviewAt(idx)}
                            className="h-7 text-xs border-amber-500/40 text-amber-300 hover:bg-amber-500/20 font-medium"
                          >
                            <Eye className="w-3 h-3 mr-1" />
                            View Email
                          </Button>

                          <button
                            onClick={() => handleRemoveRecipient(rec.id)}
                            className="p-1 rounded text-slate-500 hover:text-rose-400 transition-colors"
                            title="Remove from campaign"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* FULL REALISTIC EMAIL PREVIEW & EDITOR MODAL */}
      {previewIndex !== null && currentPreviewRecipient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-4xl bg-slate-900 border-slate-700 text-slate-100 shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 px-6 border-b border-slate-800 bg-slate-950/80">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold text-white">
                      {currentPreviewRecipient.tokens?.company_name || 'Target Account'}
                    </h3>
                    <span className="text-xs text-slate-400">
                      (Email {previewIndex + 1} of {recipients.length})
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Exact outgoing message preview formatted for Gmail, Apple Mail, and Outlook
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={previewIndex <= 0}
                  onClick={() => openPreviewAt(previewIndex - 1)}
                  className="h-8 w-8 p-0 border-slate-700 text-slate-300 hover:bg-slate-800"
                  title="Previous Email"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={previewIndex >= recipients.length - 1}
                  onClick={() => openPreviewAt(previewIndex + 1)}
                  className="h-8 w-8 p-0 border-slate-700 text-slate-300 hover:bg-slate-800"
                  title="Next Email"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
                <button
                  onClick={() => setPreviewIndex(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ml-2"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Mode Switcher: Realistic Preview vs Edit Mode */}
            <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/40 p-2.5 px-6">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditingInPreview(false)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    !isEditingInPreview
                      ? 'bg-amber-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5 inline mr-1.5" />
                  Realistic Outgoing Preview
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingInPreview(true)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    isEditingInPreview
                      ? 'bg-amber-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <Edit3 className="w-3.5 h-3.5 inline mr-1.5" />
                  Edit Email Content
                </button>
              </div>

              <div className="flex items-center gap-2">
                {previewApproval === 'approved' ? (
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Approved
                  </span>
                ) : (
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" /> Needs Review
                  </span>
                )}
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {/* Email Envelope Header */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-2.5 text-xs">
                <div className="flex items-center gap-3">
                  <span className="w-16 font-semibold text-slate-400">From:</span>
                  <span className="text-amber-300 font-medium">
                    {senderName} &lt;{senderEmail}&gt;
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <span className="w-16 font-semibold text-slate-400">To:</span>
                  {isEditingInPreview ? (
                    <Input
                      value={previewTo}
                      onChange={(e) => setPreviewTo(e.target.value)}
                      className="h-7 text-xs bg-slate-900 border-slate-700 text-white flex-1"
                    />
                  ) : (
                    <span className="text-slate-200 font-medium">
                      {currentPreviewRecipient.tokens?.contact_name
                        ? `${currentPreviewRecipient.tokens?.contact_name} <${previewTo}>`
                        : previewTo}
                    </span>
                  )}
                </div>

                {(previewCc || isEditingInPreview) && (
                  <div className="flex items-center gap-3">
                    <span className="w-16 font-semibold text-slate-400">CC:</span>
                    {isEditingInPreview ? (
                      <Input
                        value={previewCc}
                        onChange={(e) => setPreviewCc(e.target.value)}
                        placeholder="Comma-separated emails..."
                        className="h-7 text-xs bg-slate-900 border-slate-700 text-white flex-1"
                      />
                    ) : (
                      <span className="text-slate-300">{previewCc || 'None'}</span>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <span className="w-16 font-semibold text-slate-400">Subject:</span>
                  {isEditingInPreview ? (
                    <Input
                      value={previewSubject}
                      onChange={(e) => setPreviewSubject(e.target.value)}
                      className="h-7 text-xs bg-slate-900 border-slate-700 text-white font-medium flex-1"
                    />
                  ) : (
                    <span className="text-white font-semibold">{previewSubject}</span>
                  )}
                </div>

                {/* Attachments Pills */}
                {previewAttachments.length > 0 && (
                  <div className="flex items-center gap-3 pt-1 border-t border-slate-800/80">
                    <span className="w-16 font-semibold text-slate-400 flex items-center gap-1">
                      <Paperclip className="w-3 h-3 text-amber-400" /> Files:
                    </span>
                    <div className="flex flex-wrap gap-1.5 flex-1">
                      {previewAttachments.map((att, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] font-medium flex items-center gap-1.5"
                        >
                          <FileText className="w-3 h-3 text-amber-400" />
                          <span>{att.name || att.fileName}</span>
                          {att.fileSize && <span className="text-[10px] text-slate-500">({att.fileSize})</span>}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Realistic Email Content or Rich Editor */}
              {!isEditingInPreview ? (
                /* REALISTIC B2B EMAIL RENDERING CONTAINER (Arial / Helvetica, 14px, #1e293b on clean white paper) */
                <div className="rounded-xl border border-slate-300 bg-white text-slate-900 p-8 shadow-inner font-sans min-h-[320px]">
                  {/* Clean Body Text with Professional Paragraph Spacing */}
                  <div
                    style={{
                      fontFamily: 'Arial, Helvetica, sans-serif',
                      fontSize: '14px',
                      lineHeight: '1.6',
                      color: '#0f172a',
                    }}
                    className="space-y-4 whitespace-pre-wrap"
                  >
                    {previewBody}
                  </div>

                  {/* Rendered Signature Area */}
                  {previewSigHtml ? (
                    <div
                      className="mt-6 pt-4 border-t border-slate-200 text-xs"
                      dangerouslySetInnerHTML={{ __html: previewSigHtml }}
                    />
                  ) : (
                    <div className="mt-6 text-xs text-slate-400 italic">
                      [No signature attached to this message]
                    </div>
                  )}
                </div>
              ) : (
                /* INLINE EDITING INTERFACE */
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300">
                      Email Body (Professional Typography):
                    </label>
                    <Textarea
                      value={previewBody}
                      onChange={(e) => setPreviewBody(e.target.value)}
                      rows={12}
                      style={{ fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '14px', lineHeight: '1.6' }}
                      className="w-full bg-slate-900 border-slate-700 text-slate-100 p-4 focus:border-amber-500 resize-y"
                    />
                  </div>

                  {/* Signature Selector */}
                  <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800 space-y-2">
                    <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <FileSignature className="w-3.5 h-3.5 text-amber-400" />
                      Rendered Signature:
                    </span>
                    {previewSigHtml ? (
                      <div
                        className="p-3 rounded bg-slate-900 border border-slate-800 text-xs text-slate-300"
                        dangerouslySetInnerHTML={{ __html: previewSigHtml }}
                      />
                    ) : (
                      <span className="text-xs text-slate-500 italic">No signature assigned</span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer Controls */}
            <div className="p-4 px-6 border-t border-slate-800 bg-slate-950/80 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRemoveRecipient(currentPreviewRecipient.id)}
                  className="h-8 text-xs border-rose-500/40 text-rose-300 hover:bg-rose-500/20"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" />
                  Remove from Campaign
                </Button>

                {previewApproval === 'approved' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSaveRecipientChanges(false, false)}
                    className="h-8 text-xs border-amber-500/40 text-amber-300 hover:bg-amber-500/20"
                  >
                    Remove Approval
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => setPreviewIndex(null)}
                  className="border-slate-700 text-slate-300 hover:bg-slate-800 text-xs h-8"
                >
                  Close
                </Button>

                {isEditingInPreview && (
                  <Button
                    variant="secondary"
                    disabled={savingRecipient}
                    onClick={() => handleSaveRecipientChanges(null, false)}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs h-8"
                  >
                    Save Draft
                  </Button>
                )}

                <Button
                  onClick={() => handleSaveRecipientChanges(true, false)}
                  disabled={savingRecipient}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs h-8 shadow"
                >
                  <Check className="w-3.5 h-3.5 mr-1" />
                  Approve Email
                </Button>

                {previewIndex < recipients.length - 1 && (
                  <Button
                    onClick={() => handleSaveRecipientChanges(true, true)}
                    disabled={savingRecipient}
                    className="bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs h-8 shadow"
                  >
                    Approve & Next
                    <ChevronRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* FINAL SAFETY SENDING CONFIRMATION DIALOG */}
      {isConfirmSendOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-lg bg-slate-900 border-amber-500/40 text-slate-100 shadow-2xl p-6 space-y-5">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 shrink-0">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  Confirm Campaign Dispatch
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  You’re about to send <strong>{approvedCount}</strong> personalized emails to <strong>{approvedCount}</strong> selected recipients.
                </p>
              </div>
            </div>

            {/* Safety Verification Checklist */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5 text-xs">
              <span className="font-semibold text-slate-300 block uppercase tracking-wider text-[10px]">
                Pre-Flight Dispatch Checklist:
              </span>

              <div className="flex items-center justify-between">
                <span className="text-slate-400">Approved Emails:</span>
                <span className="font-semibold text-emerald-400">
                  {approvedCount} of {totalCount} verified
                </span>
              </div>

              {unapprovedCount > 0 && (
                <div className="flex items-start gap-2 p-2.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                  <span>
                    Warning: <strong>{unapprovedCount}</strong> email(s) are still unapproved. Only approved messages will be sent.
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-slate-400">Sender Account:</span>
                <span className="font-medium text-slate-200">{senderEmail}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-400">Total File Attachments:</span>
                <span className="font-medium text-amber-300">{totalAttachments} files</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-400">Duplicate Protection:</span>
                <span className="text-emerald-400 font-medium">Active (1 email per recipient)</span>
              </div>
            </div>

            {/* Dialog Footer Actions */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setIsConfirmSendOpen(false)}
                className="border-slate-700 text-slate-300 hover:bg-slate-800 text-xs"
              >
                Cancel / Keep Reviewing
              </Button>

              <Button
                disabled={sending || approvedCount === 0}
                onClick={handleLaunchCampaign}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-lg shadow-emerald-600/20 px-5"
              >
                {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Send className="w-3.5 h-3.5 mr-1.5" />}
                Confirm & Send {approvedCount} Emails
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Signature & Attachment Bulk Modals */}
      <CustomSignatureModal
        isOpen={isSignatureModalOpen}
        onClose={() => setIsSignatureModalOpen(false)}
        totalDraftsCount={recipients.length}
        selectedDraftsCount={selectedRecipientIds.size}
        selectedDraftIds={Array.from(selectedRecipientIds)}
        onSignatureApplied={() => fetchCampaignData()}
      />

      <AttachFilesModal
        isOpen={isAttachFilesModalOpen}
        onClose={() => setIsAttachFilesModalOpen(false)}
        totalDraftsCount={recipients.length}
        selectedDraftsCount={selectedRecipientIds.size}
        selectedDraftIds={Array.from(selectedRecipientIds)}
        onAttachmentsApplied={() => fetchCampaignData()}
      />
    </div>
  );
}
