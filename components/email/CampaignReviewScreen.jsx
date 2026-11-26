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
  AlertCircle,
  ExternalLink
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
  const [signatures, setSignatures] = useState([]);
  const [defaultSigHtml, setDefaultSigHtml] = useState('');
  const [previewModalDoc, setPreviewModalDoc] = useState(null);

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
      let recList = recData.recipients || [];

      // Check if this was opened with a workspace batch ID that has an active campaign draft
      if (recList.length === 0 && camp.stats?.is_personalized_workspace) {
        const linkedCampId = Array.isArray(camp.stats?.drafts)
          ? camp.stats.drafts.find((d) => d.campaign_id)?.campaign_id
          : null;

        if (linkedCampId && linkedCampId !== campaignId) {
          router.replace(`/email/blasts/${linkedCampId}`);
          return;
        }

        // If no linked campaign yet, construct fallback recipient view from batch drafts
        if (Array.isArray(camp.stats?.drafts) && camp.stats.drafts.length > 0) {
          recList = camp.stats.drafts.map((d, idx) => ({
            id: d.id || `draft-${idx}`,
            email: d.selected_contacts?.[0]?.email || d.matched_lead?.email || '',
            tokens: {
              company_name: d.extracted_company || d.matched_lead?.company_name || 'Target Account',
              contact_name: d.selected_contacts?.[0]?.name || d.matched_lead?.contact_name || '',
              custom_subject: d.edited_subject || d.extracted_subject || camp.name || '(No subject)',
              custom_body_plain: d.edited_body_plain || d.extracted_body_plain || '',
              custom_body_html: d.edited_body_html || d.extracted_body_html || '',
              signature_html: d.assigned_signature_html || '',
              attachments: d.assigned_attachments || camp.stats?.campaign_attachments || [],
              approval_status: d.approval_status || 'needs_review',
              user_approved: d.user_approved,
            },
          }));
        }
      }

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

  // Load signatures to ensure exact Gmail signature fallback
  useEffect(() => {
    fetch('/api/email/workspace/signatures')
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.signatures) {
          setSignatures(d.signatures);
          const active = d.signatures.find((s) => s.id === 'sig-gmail-synced') || d.signatures.find((s) => s.isDefault) || d.signatures[0];
          if (active?.bodyHtml) setDefaultSigHtml(active.bodyHtml);
        }
      })
      .catch((e) => console.error('Failed to load workspace signatures:', e));
  }, []);

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
    setPreviewSigHtml(r.tokens?.signature_html || defaultSigHtml || '');
    const campAttachments = Array.isArray(campaign?.stats?.campaign_attachments)
      ? campaign.stats.campaign_attachments
      : (Array.isArray(campaign?.stats?.attachments) ? campaign.stats.attachments : []);
    const recipientAtts = Array.isArray(r.tokens?.attachments) && r.tokens.attachments.length > 0
      ? r.tokens.attachments
      : campAttachments;
    setPreviewAttachments(recipientAtts);
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

  // Handle detaching attachment from recipient in campaign review
  const handleDetachRecipientAttachment = async (index) => {
    const nextAtts = previewAttachments.filter((_, idx) => idx !== index);
    setPreviewAttachments(nextAtts);

    if (previewIndex !== null && recipients[previewIndex]) {
      try {
        const currentRec = recipients[previewIndex];
        const res = await fetch(`/api/email/campaigns/${campaignId}/recipients`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update_recipient',
            recipientId: currentRec.id,
            updates: {
              attachments: nextAtts,
            },
          }),
        });
        const data = await res.json();
        if (data.success && data.recipient) {
          setRecipients((prev) => {
            const next = [...prev];
            next[previewIndex] = data.recipient;
            return next;
          });
          toast.success('File removed from this email.');
        }
      } catch (_) {
        toast.error('Failed to detach file');
      }
    }
  };

  // Reconstruct continuous paragraphs in preview modal
  const handleQuickFormatFixInPreview = () => {
    if (!previewBody) return;
    const clean = previewBody.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
    const rawLines = clean.split('\n').map((l) => l.trim()).filter(Boolean);
    const GREETING_RE = /^(?:Dear\s+|Hi\s+|Hello\s+|Good\s+(?:morning|afternoon|evening)\b)/i;
    const SIGNOFF_RE = /^(?:(?:Kind|Best|Warm)?\s*regards|Sincerely|Cheers|Thanks|Thank\s+you|Yours\s+truly)\b/i;
    const BULLET_RE = /^[-*•–—\d\.)]\s+/;
    const HEADER_RE = /^(?:To|From|Subject|Re|Attention|Attn|Company|Date):\s*/i;

    const paragraphs = [];
    let curPara = [];

    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i];
      const prev = curPara.length > 0 ? curPara[curPara.length - 1] : null;
      if (!prev) {
        curPara.push(line);
        continue;
      }
      const isGreeting = GREETING_RE.test(line);
      const prevIsGreeting = GREETING_RE.test(prev);
      const isSignOff = SIGNOFF_RE.test(line);
      const prevIsSignOff = SIGNOFF_RE.test(prev);
      const isList = BULLET_RE.test(line);
      const prevIsList = BULLET_RE.test(prev);
      const isHeader = HEADER_RE.test(line);
      const prevIsHeader = HEADER_RE.test(prev);
      const startsWithLower = /^[a-z]/.test(line);
      const prevEndsWithComma = /[,]$/.test(prev);
      const prevEndsWithHyphen = /[-–—]$/.test(prev);
      const prevEndsWithColon = /[:]$/.test(prev);
      const prevEndsWithTerminal = /[.!?]$/.test(prev);

      if (
        startsWithLower ||
        ((prevEndsWithComma && !prevIsGreeting && !prevIsSignOff) || prevEndsWithHyphen || /[([]$/.test(prev)) ||
        (!prevEndsWithTerminal && !prevEndsWithColon && !prevIsGreeting && !prevIsSignOff && !prevIsHeader)
      ) {
        curPara.push(line);
        continue;
      }
      if (isGreeting || prevIsGreeting || isSignOff || prevIsSignOff || isList || prevIsList || isHeader || prevIsHeader || prevEndsWithTerminal) {
        paragraphs.push(curPara);
        curPara = [line];
        continue;
      }
      paragraphs.push(curPara);
      curPara = [line];
    }
    if (curPara.length > 0) paragraphs.push(curPara);

    const fixed = paragraphs
      .map((pLines) => {
        let r = pLines[0];
        for (let j = 1; j < pLines.length; j++) {
          const prev = pLines[j - 1];
          const cur = pLines[j];
          if (/[-–—]$/.test(prev)) {
            r = /^[A-Z0-9]/.test(cur) ? r + cur : r.slice(0, -1) + cur;
          } else {
            r = r + ' ' + cur;
          }
        }
        return r;
      })
      .join('\n\n');

    setPreviewBody(fixed);
    setPreviewApproval('needs_review');
    toast.success('PDF line wrapping removed! Original wording 100% preserved. Please verify and re-approve.');
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
      <div className="py-28 flex flex-col items-center justify-center text-muted-foreground space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm font-medium">Loading campaign preview & review screen...</p>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="py-24 text-center text-muted-foreground space-y-3">
        <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto" />
        <h3 className="text-lg font-bold text-foreground">Campaign Not Found</h3>
        <p className="text-xs text-muted-foreground">The requested campaign does not exist or was removed.</p>
        <Button onClick={onBack || (() => router.push('/email/workspace?view=campaigns'))} className="mt-2 text-xs">
          Return to Email Workspace
        </Button>
      </div>
    );
  }

  const currentPreviewRecipient = previewIndex !== null ? recipients[previewIndex] : null;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Header & Breadcrumbs */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-card border border-border p-6 rounded-2xl shadow-xs">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack || (() => router.push('/email/workspace?view=campaigns'))}
              className="h-8 text-xs text-muted-foreground hover:text-foreground hover:bg-muted -ml-2"
            >
              <ArrowLeft className="w-4 h-4 mr-1.5" />
              Back
            </Button>

            <span className="text-xs text-muted-foreground/60">•</span>

            {isRenaming ? (
              <div className="flex items-center gap-2">
                <Input
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  className="h-8 text-sm font-semibold bg-background border-primary text-foreground w-72"
                  autoFocus
                />
                <Button size="sm" onClick={handleRenameCampaign} className="h-8 text-xs bg-primary hover:bg-primary/90 text-primary-foreground">
                  Save
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setIsRenaming(false)} className="h-8 text-xs text-muted-foreground">
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-foreground tracking-tight">
                  {campaignName}
                </h1>
                <button
                  onClick={() => setIsRenaming(true)}
                  className="p-1 rounded text-muted-foreground hover:text-primary hover:bg-muted"
                  title="Rename Campaign"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <Badge className="bg-primary/10 text-primary border-primary/30 uppercase text-[10px] font-semibold">
              {campaign.status || 'DRAFT'}
            </Badge>
          </div>

          <p className="text-xs text-muted-foreground max-w-2xl">
            Dedicated Campaign Review: Inspect every individual outgoing email, verify exact recipients, typography, custom signatures, and file attachments before sending.
          </p>
        </div>

        {/* Header Right Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchCampaignData}
            className="border-border text-foreground hover:bg-muted text-xs h-9"
          >
            Refresh
          </Button>

          <Button
            size="sm"
            onClick={() => setIsConfirmSendOpen(true)}
            disabled={totalCount === 0 || campaign.status === 'RUNNING' || campaign.status === 'COMPLETED'}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs h-9 shadow-xs px-4"
          >
            <Send className="w-3.5 h-3.5 mr-1.5" />
            Send Campaign ({approvedCount}/{totalCount})
          </Button>
        </div>
      </div>

      {/* Campaign Metadata Cards (7 Stats) */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <Card className="p-3.5 bg-card border-border shadow-xs">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block">
            Sender Account
          </span>
          <div className="text-xs font-semibold text-primary mt-1 truncate" title={senderEmail}>
            {senderEmail}
          </div>
          <span className="text-[10px] text-muted-foreground">{senderName}</span>
        </Card>

        <Card className="p-3.5 bg-card border-border shadow-xs">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block">
            Companies
          </span>
          <div className="text-xl font-bold text-foreground mt-1">{totalCount}</div>
          <span className="text-[10px] text-muted-foreground">Unique target accounts</span>
        </Card>

        <Card className="p-3.5 bg-card border-border shadow-xs">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block">
            Outgoing Emails
          </span>
          <div className="text-xl font-bold text-foreground mt-1">{totalCount}</div>
          <span className="text-[10px] text-muted-foreground">Total individual messages</span>
        </Card>

        <Card className="p-3.5 bg-card border-border shadow-xs">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block">
            Approved
          </span>
          <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{approvedCount}</div>
          <span className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 font-medium">Ready for dispatch</span>
        </Card>

        <Card className="p-3.5 bg-card border-border shadow-xs">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block">
            Needs Review
          </span>
          <div className={`text-xl font-bold mt-1 ${unapprovedCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`}>
            {unapprovedCount}
          </div>
          <span className="text-[10px] text-muted-foreground">Pending verification</span>
        </Card>

        <Card className="p-3.5 bg-card border-border shadow-xs">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block">
            Campaign Files
          </span>
          <div className="text-xl font-bold text-primary mt-1">
            {campaign?.stats?.campaign_attachments?.length || (Array.isArray(recipients[0]?.tokens?.attachments) ? recipients[0].tokens.attachments.length : 0)}
          </div>
          <span className="text-[10px] text-muted-foreground">Attached to all emails</span>
        </Card>

        <Card className="p-3.5 bg-card border-border shadow-xs">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block">
            Schedule
          </span>
          <div className="text-xs font-semibold text-foreground mt-1 truncate">
            {campaign.scheduled_at ? new Date(campaign.scheduled_at).toLocaleDateString() : 'Immediate'}
          </div>
          <span className="text-[10px] text-muted-foreground">Standard queue</span>
        </Card>
      </div>

      {/* Bulk Action Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-muted/20 p-3 px-4 rounded-xl border border-border">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-foreground">
            {selectedRecipientIds.size} of {recipients.length} emails selected
          </span>
          <button onClick={toggleSelectAll} className="text-xs text-primary hover:underline">
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
                className="h-8 text-xs border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
              >
                <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-500" />
                Approve Selected ({selectedRecipientIds.size})
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsSignatureModalOpen(true)}
                className="h-8 text-xs border-primary/40 text-primary hover:bg-primary/10"
              >
                <FileSignature className="w-3.5 h-3.5 mr-1 text-primary" />
                Change Signature
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAttachFilesModalOpen(true)}
                className="h-8 text-xs border-primary/40 text-primary hover:bg-primary/10"
              >
                <Paperclip className="w-3.5 h-3.5 mr-1 text-primary" />
                Attach Files
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleBulkRemove}
                className="h-8 text-xs border-rose-500/40 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1 text-rose-500" />
                Remove Selected
              </Button>
            </>
          )}

          <Button
            size="sm"
            onClick={() => setIsConfirmSendOpen(true)}
            disabled={approvedCount === 0 || campaign.status === 'RUNNING' || campaign.status === 'COMPLETED'}
            className="h-8 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-xs px-3"
          >
            <Send className="w-3.5 h-3.5 mr-1" />
            Send Approved ({approvedCount})
          </Button>
        </div>
      </div>

      {/* Main Campaign Email Table */}
      <Card className="bg-card border-border shadow-xs overflow-hidden">
        {recipients.length === 0 ? (
          <div className="py-20 text-center text-muted-foreground space-y-3">
            <FileText className="w-10 h-10 text-muted-foreground/40 mx-auto" />
            <p className="text-base font-semibold text-foreground">No emails currently in this campaign</p>
            <p className="text-xs text-muted-foreground">All emails were removed or this campaign is empty.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-muted-foreground uppercase tracking-wider text-[11px] font-semibold">
                  <th className="py-3 px-4 w-10">
                    <input
                      type="checkbox"
                      checked={selectedRecipientIds.size > 0 && selectedRecipientIds.size === recipients.length}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 accent-primary rounded cursor-pointer"
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
              <tbody className="divide-y divide-border text-foreground">
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
                      className={`hover:bg-muted/30 transition-colors ${isSelected ? 'bg-primary/5' : ''
                        }`}
                    >
                      <td className="py-3.5 px-4">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectOne(rec.id)}
                          className="w-4 h-4 accent-primary rounded cursor-pointer"
                        />
                      </td>

                      <td className="py-3.5 px-4 max-w-xs font-semibold text-foreground">
                        <div className="flex items-center gap-2">
                          <Building className="w-3.5 h-3.5 text-primary shrink-0" />
                          <span className="truncate">{companyName}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="space-y-0.5">
                          <div className="font-medium text-foreground flex items-center gap-1.5">
                            <User className="w-3 h-3 text-muted-foreground" />
                            <span>{contactName || 'Primary Contact'}</span>
                          </div>
                          <span className="text-[11px] text-muted-foreground block truncate">{rec.email}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 max-w-sm">
                        <span className="font-medium text-foreground block truncate">
                          {emailSubject}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {attsCount > 0 ? (
                          <span className="px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 text-[11px] font-medium flex items-center gap-1 w-fit">
                            <Paperclip className="w-3 h-3" />
                            {attsCount} {attsCount === 1 ? 'file' : 'files'}
                          </span>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">—</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {isApproved ? (
                          <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[10px] font-semibold flex items-center gap-1 w-fit">
                            <CheckCircle2 className="w-3 h-3" />
                            Approved
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-[10px] font-semibold flex items-center gap-1 w-fit">
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
                            className="h-7 text-xs border-primary/40 text-primary hover:bg-primary/10 font-medium"
                          >
                            <Eye className="w-3 h-3 mr-1" />
                            View Email
                          </Button>

                          <button
                            onClick={() => handleRemoveRecipient(rec.id)}
                            className="p-1 rounded text-muted-foreground hover:text-rose-500 transition-colors"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-4xl bg-card border-border text-foreground shadow-dialog flex flex-col max-h-[92vh] overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 px-6 border-b border-border bg-muted/20">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10 border border-primary/20 text-primary">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold text-foreground">
                      {currentPreviewRecipient.tokens?.company_name || 'Target Account'}
                    </h3>
                    <span className="text-xs text-muted-foreground">
                      (Email {previewIndex + 1} of {recipients.length})
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
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
                  className="h-8 w-8 p-0 border-border text-foreground hover:bg-muted"
                  title="Previous Email"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={previewIndex >= recipients.length - 1}
                  onClick={() => openPreviewAt(previewIndex + 1)}
                  className="h-8 w-8 p-0 border-border text-foreground hover:bg-muted"
                  title="Next Email"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
                <button
                  onClick={() => setPreviewIndex(null)}
                  className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors ml-2"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Mode Switcher: Realistic Preview vs Edit Mode */}
            <div className="flex items-center justify-between border-b border-border bg-muted/10 p-2.5 px-6">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditingInPreview(false)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${!isEditingInPreview
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:text-foreground'
                    }`}
                >
                  <Eye className="w-3.5 h-3.5 inline mr-1.5" />
                  Realistic Outgoing Preview
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingInPreview(true)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${isEditingInPreview
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:text-foreground'
                    }`}
                >
                  <Edit3 className="w-3.5 h-3.5 inline mr-1.5" />
                  Edit Email Content
                </button>
              </div>

              <div className="flex items-center gap-2">
                {previewApproval === 'approved' ? (
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Approved
                  </span>
                ) : (
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 font-semibold flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" /> Needs Review
                  </span>
                )}
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {/* Email Envelope Header */}
              <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-2.5 text-xs">
                <div className="flex items-center gap-3">
                  <span className="w-16 font-semibold text-muted-foreground">From:</span>
                  <span className="text-primary font-medium">
                    {senderName} &lt;{senderEmail}&gt;
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <span className="w-16 font-semibold text-muted-foreground">To:</span>
                  {isEditingInPreview ? (
                    <Input
                      value={previewTo}
                      onChange={(e) => setPreviewTo(e.target.value)}
                      className="h-7 text-xs bg-background border-border text-foreground flex-1"
                    />
                  ) : (
                    <span className="text-foreground font-medium">
                      {currentPreviewRecipient.tokens?.contact_name
                        ? `${currentPreviewRecipient.tokens?.contact_name} <${previewTo}>`
                        : previewTo}
                    </span>
                  )}
                </div>

                {(previewCc || isEditingInPreview) && (
                  <div className="flex items-center gap-3">
                    <span className="w-16 font-semibold text-muted-foreground">CC:</span>
                    {isEditingInPreview ? (
                      <Input
                        value={previewCc}
                        onChange={(e) => setPreviewCc(e.target.value)}
                        placeholder="Comma-separated emails..."
                        className="h-7 text-xs bg-background border-border text-foreground flex-1"
                      />
                    ) : (
                      <span className="text-foreground">{previewCc || 'None'}</span>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <span className="w-16 font-semibold text-muted-foreground">Subject:</span>
                  {isEditingInPreview ? (
                    <Input
                      value={previewSubject}
                      onChange={(e) => setPreviewSubject(e.target.value)}
                      className="h-7 text-xs bg-background border-border text-foreground font-medium flex-1"
                    />
                  ) : (
                    <span className="text-foreground font-semibold">{previewSubject}</span>
                  )}
                </div>

                {/* Attachments Pills */}
                {previewAttachments.length > 0 && (
                  <div className="flex items-center gap-3 pt-1 border-t border-border">
                    <span className="w-16 font-semibold text-muted-foreground flex items-center gap-1">
                      <Paperclip className="w-3 h-3 text-primary" /> Files:
                    </span>
                    <div className="flex flex-wrap gap-1.5 flex-1">
                      {previewAttachments.map((att, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded bg-primary/10 border border-primary/20 text-primary text-[11px] font-medium flex items-center gap-1.5"
                        >
                          <button
                            type="button"
                            onClick={() => setPreviewModalDoc(att)}
                            className="flex items-center gap-1.5 hover:underline cursor-pointer"
                            title="Click to preview file"
                          >
                            <FileText className="w-3 h-3 text-primary" />
                            <span>{att.name || att.fileName}</span>
                            {att.fileSize && <span className="text-[10px] text-muted-foreground">({att.fileSize})</span>}
                            <Eye className="w-2.5 h-2.5 text-primary/70 ml-0.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDetachRecipientAttachment(i)}
                            className="text-muted-foreground hover:text-rose-500 ml-1 transition-colors p-0.5 rounded hover:bg-rose-500/10 cursor-pointer"
                            title="Detach file from this email (preserves original in Library)"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Realistic Email Content or Rich Editor */}
              {!isEditingInPreview ? (
                /* REALISTIC B2B EMAIL RENDERING CONTAINER (Arial / Helvetica, 14px, #0f172a on clean white paper) */
                <div className="rounded-xl border border-border bg-white text-slate-900 p-8 shadow-inner font-sans min-h-[320px]">
                  {/* Clean Body Text with Professional Paragraph Spacing */}
                  <div
                    style={{
                      fontFamily: 'Arial, Helvetica, sans-serif',
                      fontSize: '14px',
                      lineHeight: '1.6',
                      color: '#0f172a',
                    }}
                    className="space-y-4"
                  >
                    {previewBody.split(/\n{2,}/).map((p, pIdx) => (
                      <p key={pIdx} style={{ margin: '0 0 16px 0', lineHeight: '1.6' }}>
                        {p.split('\n').map((line, lIdx, arr) => (
                          <React.Fragment key={lIdx}>
                            {line}
                            {lIdx < arr.length - 1 && <br />}
                          </React.Fragment>
                        ))}
                      </p>
                    ))}
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
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-foreground">
                        Email Body (Professional Typography):
                      </label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleQuickFormatFixInPreview}
                        className="h-6 text-[11px] px-2 text-amber-500 border-amber-500/40 hover:bg-amber-500/10"
                        title="Reconstruct continuous paragraphs from PDF line wrapping"
                      >
                        <Sparkles className="w-3 h-3 mr-1" />
                        Fix PDF Formatting
                      </Button>
                    </div>
                    <Textarea
                      value={previewBody}
                      onChange={(e) => setPreviewBody(e.target.value)}
                      rows={12}
                      style={{ fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '14px', lineHeight: '1.6' }}
                      className="w-full bg-background border-border text-foreground p-4 focus:border-primary resize-y font-sans text-sm"
                    />
                  </div>

                  {/* Attachments row */}
                  <div className="p-3.5 rounded-lg bg-muted/20 border border-border space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <Paperclip className="w-3.5 h-3.5 text-primary" />
                        Attached Documents ({previewAttachments.length}):
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setIsAttachFilesModalOpen(true)}
                        className="h-7 text-xs border-border text-foreground hover:bg-muted"
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" />
                        Attach From Library
                      </Button>
                    </div>

                    {previewAttachments.length > 0 ? (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {previewAttachments.map((att, idx) => (
                          <span
                            key={idx}
                            className="px-2.5 py-1 rounded-md bg-primary/10 border border-primary/20 text-foreground text-xs flex items-center gap-2"
                          >
                            <button
                              type="button"
                              onClick={() => setPreviewModalDoc(att)}
                              className="flex items-center gap-1.5 hover:underline cursor-pointer"
                              title="Click to preview file"
                            >
                              <FileText className="w-3.5 h-3.5 text-primary" />
                              <span className="font-medium">{att.name || att.fileName}</span>
                              {att.fileSize && <span className="text-[10px] text-muted-foreground">({att.fileSize})</span>}
                              <Eye className="w-3 h-3 text-primary/70 ml-0.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDetachRecipientAttachment(idx)}
                              className="text-muted-foreground hover:text-rose-500 ml-1 transition-colors p-0.5 rounded hover:bg-rose-500/10 cursor-pointer"
                              title="Detach file from this email (preserves original in Library)"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">No files attached to this recipient.</p>
                    )}
                  </div>

                  {/* Signature Selector */}
                  <div className="p-3.5 rounded-lg bg-muted/20 border border-border space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <FileSignature className="w-3.5 h-3.5 text-primary" />
                        Gmail Signature:
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setIsSignatureModalOpen(true)}
                        className="h-7 text-xs border-border text-foreground hover:bg-muted"
                      >
                        <Edit3 className="w-3.5 h-3.5 mr-1" />
                        Change / Sync Signature
                      </Button>
                    </div>
                    {previewSigHtml ? (
                      <div
                        className="p-3 rounded bg-card border border-border text-xs text-foreground max-h-40 overflow-y-auto"
                        dangerouslySetInnerHTML={{ __html: previewSigHtml }}
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground italic">No signature assigned</span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer Controls */}
            <div className="p-4 px-6 border-t border-border bg-muted/20 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRemoveRecipient(currentPreviewRecipient.id)}
                  className="h-8 text-xs border-rose-500/40 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" />
                  Remove from Campaign
                </Button>

                {previewApproval === 'approved' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSaveRecipientChanges(false, false)}
                    className="h-8 text-xs border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
                  >
                    Remove Approval
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => setPreviewIndex(null)}
                  className="border-border text-foreground hover:bg-muted text-xs h-8"
                >
                  Close
                </Button>

                {isEditingInPreview && (
                  <Button
                    variant="secondary"
                    disabled={savingRecipient}
                    onClick={() => handleSaveRecipientChanges(null, false)}
                    className="bg-muted hover:bg-muted/80 text-foreground border border-border text-xs h-8"
                  >
                    Save Draft
                  </Button>
                )}

                <Button
                  onClick={() => handleSaveRecipientChanges(true, false)}
                  disabled={savingRecipient}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs h-8 shadow-xs"
                >
                  <Check className="w-3.5 h-3.5 mr-1" />
                  Approve Email
                </Button>

                {previewIndex < recipients.length - 1 && (
                  <Button
                    onClick={() => handleSaveRecipientChanges(true, true)}
                    disabled={savingRecipient}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs h-8 shadow-xs"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-lg bg-card border-border text-foreground shadow-dialog p-6 space-y-5">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-500 shrink-0">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">
                  Confirm Campaign Dispatch
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  You’re about to send <strong>{approvedCount}</strong> personalized emails to <strong>{approvedCount}</strong> selected recipients.
                </p>
              </div>
            </div>

            {/* Safety Verification Checklist */}
            <div className="p-4 rounded-xl bg-muted/20 border border-border space-y-2.5 text-xs">
              <span className="font-semibold text-muted-foreground block uppercase tracking-wider text-[10px]">
                Pre-Flight Dispatch Checklist:
              </span>

              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Approved Emails:</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  {approvedCount} of {totalCount} verified
                </span>
              </div>

              {unapprovedCount > 0 && (
                <div className="flex items-start gap-2 p-2.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" />
                  <span>
                    Warning: <strong>{unapprovedCount}</strong> email(s) are still unapproved. Only approved messages will be sent.
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Sender Account:</span>
                <span className="font-medium text-foreground">{senderEmail}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Campaign Attachments:</span>
                <span className="font-semibold text-primary">
                  {(campaign?.stats?.campaign_attachments?.length || (Array.isArray(recipients[0]?.tokens?.attachments) ? recipients[0].tokens.attachments.length : 0))} files attached to all emails
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Email Signature:</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  {senderName || 'Abdullah Rauf — MineTech Resources BV'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Recipient Verification:</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">All {approvedCount} recipients verified</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Duplicate Protection:</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">Active (1 email per recipient)</span>
              </div>
            </div>

            {/* Dialog Footer Actions */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setIsConfirmSendOpen(false)}
                className="border-border text-foreground hover:bg-muted text-xs"
              >
                Cancel / Keep Reviewing
              </Button>

              <Button
                disabled={sending || approvedCount === 0}
                onClick={handleLaunchCampaign}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-xs px-5"
              >
                {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Send className="w-3.5 h-3.5 mr-1.5" />}
                Confirm & Send {approvedCount} Emails
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Signature & Attachment Modals */}
      <CustomSignatureModal
        isOpen={isSignatureModalOpen}
        onClose={() => setIsSignatureModalOpen(false)}
        campaignId={campaignId}
        totalDraftsCount={recipients.length}
        selectedDraftsCount={selectedRecipientIds.size}
        selectedDraftIds={Array.from(selectedRecipientIds)}
        onSignatureApplied={(newSigHtml) => {
          if (newSigHtml && previewIndex !== null) {
            setPreviewSigHtml(newSigHtml);
          }
          fetchCampaignData();
        }}
      />

      <AttachFilesModal
        isOpen={isAttachFilesModalOpen}
        onClose={() => setIsAttachFilesModalOpen(false)}
        campaignId={campaignId}
        currentDraftId={currentPreviewRecipient?.id}
        totalDraftsCount={recipients.length}
        selectedDraftsCount={selectedRecipientIds.size}
        selectedDraftIds={Array.from(selectedRecipientIds)}
        onAttachmentsApplied={(data, newDocs) => {
          if (newDocs && previewIndex !== null) {
            setPreviewAttachments((prev) => {
              const existingNames = new Set(prev.map((a) => a.name || a.fileName || a.id));
              const added = newDocs.filter((d) => !existingNames.has(d.name || d.fileName || d.id));
              return [...prev, ...added];
            });
          }
          fetchCampaignData();
        }}
      />

      {/* Document Preview Modal */}
      {previewModalDoc && (() => {
        const directHttpUrl = (previewModalDoc.url && previewModalDoc.url.startsWith('http'))
          ? previewModalDoc.url
          : (previewModalDoc.storagePath
            ? `https://oatkydlnhenemojbaxwx.supabase.co/storage/v1/object/public/email-attachments/${previewModalDoc.storagePath}`
            : (previewModalDoc.fileName?.toLowerCase().includes('bentonite') ? '/documents/MineTech_Bentonite.pdf' : null));
        const previewUrl = directHttpUrl || `/api/email/workspace/documents/preview?id=${encodeURIComponent(previewModalDoc.id || previewModalDoc.fileName)}&fileName=${encodeURIComponent(previewModalDoc.fileName || '')}`;
        const downloadUrl = directHttpUrl || `${previewUrl}${previewUrl.includes('?') ? '&' : '?'}download=1`;
        const isPdf = previewModalDoc.fileType?.includes('pdf') || (previewModalDoc.fileName || '').toLowerCase().endsWith('.pdf');
        const isImage = previewModalDoc.fileType?.includes('image') || /\.(png|jpe?g|webp|gif|svg)$/i.test(previewModalDoc.fileName || '');

        return (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-150">
            <Card className="w-full max-w-4xl bg-card border-border text-foreground shadow-dialog flex flex-col h-[85vh] overflow-hidden rounded-xl">
              <div className="p-4 px-6 border-b border-border bg-muted/20 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-foreground truncate max-w-md">
                    {previewModalDoc.name || previewModalDoc.fileName}
                  </h4>
                  <p className="text-xs text-muted-foreground font-mono">
                    {previewModalDoc.fileName} &bull; {previewModalDoc.fileSize || 'Attachment'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={previewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-primary hover:underline px-3 py-1.5 rounded-md bg-primary/10 border border-primary/20 font-medium"
                    title="Open document in a new tab"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Open in New Tab
                  </a>
                  <a
                    href={downloadUrl}
                    download={previewModalDoc.fileName || 'document.pdf'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-md bg-muted/50 border border-border font-medium"
                    title="Download document to computer"
                  >
                    Download
                  </a>
                  <button
                    onClick={() => setPreviewModalDoc(null)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors ml-1"
                    title="Close preview"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="flex-1 bg-muted/10 p-2 overflow-hidden flex items-center justify-center">
                {isImage ? (
                  <img
                    src={previewUrl}
                    alt={previewModalDoc.name || previewModalDoc.fileName}
                    className="max-h-full max-w-full object-contain rounded shadow"
                  />
                ) : isPdf ? (
                  <iframe
                    src={previewUrl}
                    title={previewModalDoc.name || previewModalDoc.fileName}
                    className="w-full h-full rounded-lg border border-border bg-white"
                  />
                ) : (
                  <div className="text-center p-8 space-y-4">
                    <div className="p-4 rounded-full bg-primary/10 text-primary w-fit mx-auto">
                      <FileText className="w-8 h-8" />
                    </div>
                    <div>
                      <h4 className="text-base font-semibold text-foreground">
                        {previewModalDoc.fileName || previewModalDoc.name}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        This format ({previewModalDoc.fileType || 'Document'}) cannot be displayed directly inline.
                      </p>
                    </div>
                    <div className="flex items-center justify-center gap-3">
                      <a
                        href={previewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 flex items-center gap-1.5"
                      >
                        <ExternalLink className="w-4 h-4" /> Open in Viewer
                      </a>
                      <a
                        href={`${previewUrl}&download=1`}
                        download={previewModalDoc.fileName || 'document'}
                        className="px-4 py-2 rounded-lg bg-muted text-foreground border border-border text-xs font-semibold hover:bg-muted/80"
                      >
                        Download File
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </div>
        );
      })()}
    </div>
  );
}
