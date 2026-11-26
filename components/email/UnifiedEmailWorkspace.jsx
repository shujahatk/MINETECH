'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Upload,
  FileText,
  Building,
  User,
  Mail,
  Paperclip,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  Search,
  Filter,
  Check,
  X,
  ChevronDown,
  Layers,
  Send,
  Loader2,
  Trash2,
  RefreshCw,
  ExternalLink,
  Edit3,
  FileCheck,
  ShieldCheck,
  ArrowRight,
  Info,
  FileSignature,
  Eye,
  Plus,
  FolderOpen,
  Radio
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import PersonalizedEmailEditorModal from './PersonalizedEmailEditorModal';
import CreatePersonalizedCampaignModal from './CreatePersonalizedCampaignModal';
import RematchCompanyModal from './RematchCompanyModal';
import CustomSignatureModal from './CustomSignatureModal';
import AttachFilesModal from './AttachFilesModal';
import CampaignHubView from './CampaignHubView';

export default function UnifiedEmailWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [workspaceView, setWorkspaceView] = useState(() => {
    return searchParams?.get('view') === 'campaigns' ? 'campaigns' : 'studio';
  });

  useEffect(() => {
    const v = searchParams?.get('view');
    if (v === 'campaigns') {
      setWorkspaceView('campaigns');
    } else if (v === 'studio') {
      setWorkspaceView('studio');
    }
  }, [searchParams]);

  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [activeBatch, setActiveBatch] = useState(null);
  const [createdCampaignId, setCreatedCampaignId] = useState(null);
  const [drafts, setDrafts] = useState([]);
  const [metrics, setMetrics] = useState({
    total: 0,
    matched: 0,
    needs_review: 0,
    unmatched: 0,
    approved: 0,
    ready: 0,
  });

  // Filtering & Selection
  const [statusTab, setStatusTab] = useState('all'); // all | ready | needs_review | unmatched | approved
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDraftIds, setSelectedDraftIds] = useState(new Set());

  // Modals
  const [editingDraftIndex, setEditingDraftIndex] = useState(null);
  const [rematchDraft, setRematchDraft] = useState(null);
  const [isCampaignModalOpen, setIsCampaignModalOpen] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  const [isAttachFilesModalOpen, setIsAttachFilesModalOpen] = useState(false);
  const [activeAttachScope, setActiveAttachScope] = useState('all');
  const [activeDraftIdForAttach, setActiveDraftIdForAttach] = useState(null);

  // Campaign-Level Attachments & Signature State
  const [campaignAttachments, setCampaignAttachments] = useState([]);
  const [configuredSignature, setConfiguredSignature] = useState(null);
  const [uploadingCampaignFile, setUploadingCampaignFile] = useState(false);
  const [deletingAttachmentId, setDeletingAttachmentId] = useState(null);
  const [previewAttachmentDoc, setPreviewAttachmentDoc] = useState(null);
  const campaignFileInputRef = useRef(null);

  // Formatting fix modal state
  const [isBulkFixModalOpen, setIsBulkFixModalOpen] = useState(false);
  const [bulkFixTargetIds, setBulkFixTargetIds] = useState([]); // array or 'all'
  const [bulkFixSample, setBulkFixSample] = useState(null);
  const [includeManuallyEdited, setIncludeManuallyEdited] = useState(false);
  const [bulkFixLoading, setBulkFixLoading] = useState(false);

  const [rawTextInput, setRawTextInput] = useState('');
  const [uploadTab, setUploadTab] = useState('file'); // file | text
  const fileInputRef = useRef(null);

  // Load active workspace on mount
  const fetchWorkspace = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch('/api/email/workspace');
      const data = await res.json();
      if (data.success) {
        setActiveBatch(data.batch);
        setDrafts(data.drafts || []);
        const existingCampId = (data.drafts || []).find((d) => d.campaign_id)?.campaign_id;
        if (existingCampId) {
          setCreatedCampaignId((prev) => prev || existingCampId);
        }
        setMetrics(data.metrics || {});
        setCampaignAttachments(data.campaignAttachments || data.batch?.campaignAttachments || []);
        setConfiguredSignature(data.configuredSignature || null);
        // Default select all drafts that are ready if user has not made custom selection
        const readyIds = new Set(
          (data.drafts || [])
            .filter((d) => d.approval_status === 'approved' && Boolean(d.user_approved) && d.match_status === 'matched')
            .map((d) => d.id)
        );
        setSelectedDraftIds((prev) => (prev && prev.size > 0 ? prev : readyIds));
      }
    } catch (err) {
      console.error('Failed to load workspace:', err);
      toast.error('Failed to load email workspace');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Handle Campaign-Level File Upload (upload once -> automatically attached to all drafts)
  const handleCampaignFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    if (activeBatch?.id) {
      formData.append('batchId', activeBatch.id);
    }

    setUploadingCampaignFile(true);
    try {
      const res = await fetch('/api/email/workspace/campaign-attachments', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to upload campaign file');
      }

      toast.success(data.message || `"${file.name}" automatically attached to all emails!`);
      setCampaignAttachments(data.attachments || []);
      if (data.drafts) {
        setDrafts(data.drafts);
      } else {
        fetchWorkspace(true);
      }
    } catch (err) {
      toast.error(err.message || 'Error uploading campaign file');
    } finally {
      setUploadingCampaignFile(false);
      if (campaignFileInputRef.current) campaignFileInputRef.current.value = '';
    }
  };

  // Handle Campaign-Level File Removal (removes file and detaches from all drafts)
  const handleDeleteCampaignAttachment = async (attachmentId, fileName) => {
    if (!confirm(`Remove "${fileName}" from this campaign? It will be automatically detached from all emails.`)) {
      return;
    }

    setDeletingAttachmentId(attachmentId);
    try {
      const batchParam = activeBatch?.id ? `&batchId=${activeBatch.id}` : '';
      const res = await fetch(`/api/email/workspace/campaign-attachments?id=${encodeURIComponent(attachmentId)}${batchParam}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to remove file');
      }

      toast.success(data.message || 'File removed from campaign and detached from all emails.');
      setCampaignAttachments(data.attachments || []);
      if (data.drafts) {
        setDrafts(data.drafts);
      } else {
        fetchWorkspace(true);
      }
    } catch (err) {
      toast.error(err.message || 'Error removing campaign file');
    } finally {
      setDeletingAttachmentId(null);
    }
  };

  // Handle Detaching attachment from a single draft (1-click direct removal)
  const handleDetachFromDraft = async (draftId, attachmentId = null) => {
    try {
      const targetDraft = drafts.find((d) => d.id === draftId);
      const remainingAtts = attachmentId
        ? (targetDraft?.assigned_attachments || []).filter((a) => a.id !== attachmentId && a.fileName !== attachmentId && a.name !== attachmentId)
        : [];

      // Optimistic update
      setDrafts((prev) =>
        prev.map((d) => (d.id === draftId ? { ...d, assigned_attachments: remainingAtts } : d))
      );

      const res = await fetch('/api/email/workspace', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'bulk_attachments',
          draftIds: [draftId],
          mode: 'replace',
          attachments: remainingAtts,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to remove attachment');
      }
      toast.success(attachmentId ? 'Attachment removed from email.' : 'All attachments removed from this email.');
      if (data.drafts) setDrafts(data.drafts);
    } catch (err) {
      toast.error(err.message || 'Error removing attachment');
      fetchWorkspace(true);
    }
  };

  // Handle Bulk Detaching attachments from all selected drafts
  const handleBulkDetachSelected = async () => {
    if (selectedDraftIds.size === 0) return;
    const count = selectedDraftIds.size;
    if (!confirm(`Remove all attached files from the ${count} selected email(s)?`)) return;

    try {
      const res = await fetch('/api/email/workspace', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'bulk_attachments',
          draftIds: Array.from(selectedDraftIds),
          mode: 'replace',
          attachments: [],
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to remove attachments');
      }
      toast.success(`Attachments removed from ${count} selected email(s).`);
      if (data.drafts) setDrafts(data.drafts);
      fetchWorkspace(true);
    } catch (err) {
      toast.error(err.message || 'Error removing attachments');
    }
  };

  // Handle removing all campaign attachments workspace-wide
  const handleRemoveAllCampaignAttachments = async () => {
    if (!confirm('Remove all campaign attachments? All files will be detached from all emails in this workspace.')) {
      return;
    }

    try {
      const batchParam = activeBatch?.id ? `&batchId=${activeBatch.id}` : '';
      const res = await fetch(`/api/email/workspace/campaign-attachments?id=all${batchParam}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to remove all files');
      }
      toast.success('All campaign files removed and detached from all emails.');
      setCampaignAttachments([]);
      if (data.drafts) setDrafts(data.drafts);
      fetchWorkspace(true);
    } catch (err) {
      toast.error(err.message || 'Error removing campaign files');
    }
  };

  // Aggregate campaign attachments and any draft attachments so all active files are visible & removable
  const allUniqueCampaignAttachments = useMemo(() => {
    const map = new Map();
    (campaignAttachments || []).forEach((a) => {
      const k = a.id || a.fileName || a.name;
      if (k) map.set(k, a);
    });
    (drafts || []).forEach((d) => {
      (d.assigned_attachments || []).forEach((a) => {
        const k = a.id || a.fileName || a.name;
        if (k && !map.has(k)) map.set(k, a);
      });
    });
    return Array.from(map.values());
  }, [campaignAttachments, drafts]);

  useEffect(() => {
    fetchWorkspace();
  }, []);

  // Handle Document Upload (PDF, DOCX, TXT)
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setUploading(true);
    try {
      toast.info(`Extracting personalized emails and matching against CRM...`, { duration: 5000 });
      const res = await fetch('/api/email/workspace/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Upload processing failed');
      }

      toast.success(data.message || `Extracted ${data.drafts.length} personalized emails!`);
      setDrafts(data.drafts || []);
      setIsUploadOpen(false);
      fetchWorkspace();
    } catch (err) {
      toast.error(err.message || 'Failed to process document');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Handle Raw Text Ingestion
  const handleTextSubmit = async () => {
    if (!rawTextInput.trim()) {
      toast.error('Please paste or write email text to import.');
      return;
    }

    setUploading(true);
    try {
      toast.info('Extracting personalized emails from text...', { duration: 4000 });
      const res = await fetch('/api/email/workspace/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText: rawTextInput }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Text processing failed');
      }

      toast.success(data.message || `Extracted ${data.drafts.length} personalized emails!`);
      setDrafts(data.drafts || []);
      setRawTextInput('');
      setIsUploadOpen(false);
      fetchWorkspace();
    } catch (err) {
      toast.error(err.message || 'Failed to extract emails from text');
    } finally {
      setUploading(false);
    }
  };

  // Clear workspace
  const handleClearWorkspace = async () => {
    if (!confirm('Are you sure you want to clear this workspace? All current draft emails will be reset.')) return;
    try {
      const res = await fetch('/api/email/workspace', { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        toast.success('Workspace cleared.');
        setDrafts([]);
        setActiveBatch(null);
        setSelectedDraftIds(new Set());
        setMetrics({ total: 0, matched: 0, needs_review: 0, unmatched: 0, approved: 0, ready: 0 });
      }
    } catch (err) {
      toast.error('Failed to clear workspace');
    }
  };

  // Bulk Operations
  const handleBulkApprove = async () => {
    const targetIds = Array.from(selectedDraftIds);
    if (targetIds.length === 0) return;

    try {
      const res = await fetch('/api/email/workspace', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'bulk_approve',
          draftIds: targetIds,
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(`Approved ${targetIds.length} emails!`);
        setDrafts(data.drafts);
        setMetrics(data.metrics);
      }
    } catch (err) {
      toast.error('Bulk approval failed');
    }
  };

  // Direct 1-Click Single Email Approval
  const handleDirectApprove = async (draftId, e) => {
    e?.stopPropagation();
    try {
      const res = await fetch('/api/email/workspace', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve_draft',
          draftId,
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success('Email approved!');
        setDrafts(data.drafts);
        setMetrics(data.metrics);
      }
    } catch (err) {
      toast.error('Failed to approve email');
    }
  };

  const handleDirectUnapprove = async (draftId, e) => {
    e?.stopPropagation();
    try {
      const res = await fetch('/api/email/workspace', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'unapprove_draft',
          draftId,
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.info('Approval removed. Marked as Needs Review.');
        setDrafts(data.drafts);
        setMetrics(data.metrics);
      }
    } catch (err) {
      toast.error('Failed to reset approval status');
    }
  };

  // Compute number of drafts with line-wrap formatting issues
  const formattingIssuesCount = useMemo(() => {
    if (metrics?.formattingIssuesCount !== undefined) {
      return metrics.formattingIssuesCount;
    }
    return drafts.filter((d) => d.has_formatting_issues).length;
  }, [metrics, drafts]);

  // Open Bulk Formatting Fix Modal
  const handleOpenBulkFix = async (targetIds = 'all') => {
    if (Array.isArray(targetIds) && targetIds.length === 0) {
      toast.info('Please select one or more emails first to fix formatting.');
      return;
    }

    setBulkFixTargetIds(targetIds);
    setIncludeManuallyEdited(false);

    // Pick first affected draft to preview in modal
    let sampleDraft = null;
    if (targetIds === 'all') {
      sampleDraft = drafts.find((d) => d.has_formatting_issues) || drafts[0];
    } else if (Array.isArray(targetIds) && targetIds.length > 0) {
      sampleDraft = drafts.find((d) => targetIds.includes(d.id) && d.has_formatting_issues) || drafts.find((d) => targetIds.includes(d.id));
    }

    if (sampleDraft) {
      try {
        const res = await fetch('/api/email/workspace', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'preview_formatting_fix',
            draftId: sampleDraft.id,
          }),
        });
        const data = await res.json();
        if (data.success) {
          setBulkFixSample(data);
          setIsBulkFixModalOpen(true);
          return;
        }
      } catch (_) { }
    }

    setBulkFixSample(null);
    setIsBulkFixModalOpen(true);
  };

  // Apply Bulk Formatting Fix
  const handleApplyBulkFix = async () => {
    setBulkFixLoading(true);
    try {
      const res = await fetch('/api/email/workspace', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'apply_formatting_fix',
          draftIds: bulkFixTargetIds === 'all' ? 'all' : bulkFixTargetIds,
          includeManuallyEdited,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to apply formatting fix');
      }

      toast.success(data.message || 'Formatting updated successfully! Original wording 100% preserved.');
      setDrafts(data.drafts || []);
      setMetrics(data.metrics || {});
      setIsBulkFixModalOpen(false);
    } catch (err) {
      toast.error(err.message || 'Failed to apply formatting fix');
    } finally {
      setBulkFixLoading(false);
    }
  };

  // Selection toggle
  const toggleSelectAll = () => {
    const visibleIds = filteredDrafts.map((d) => d.id);
    const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedDraftIds.has(id));

    if (allVisibleSelected) {
      setSelectedDraftIds((prev) => {
        const next = new Set(prev);
        visibleIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedDraftIds((prev) => {
        const next = new Set(prev);
        visibleIds.forEach((id) => next.add(id));
        return next;
      });
    }
  };

  const toggleSelectOne = (id) => {
    setSelectedDraftIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Filtered drafts list
  const filteredDrafts = useMemo(() => {
    return drafts.filter((d) => {
      // Status tab filter
      if (statusTab === 'ready') {
        const isReady =
          d.approval_status === 'approved' &&
          Boolean(d.user_approved) &&
          Boolean(d.matched_lead?.id) &&
          d.match_status === 'matched' &&
          Array.isArray(d.selected_contacts) &&
          d.selected_contacts.length > 0 &&
          d.selected_contacts.some((c) => c.email && c.email.trim());
        if (!isReady) return false;
      } else if (statusTab === 'needs_review') {
        const needsReview =
          (!d.user_approved || d.approval_status !== 'approved') &&
          Boolean(d.matched_lead?.id) &&
          d.match_status !== 'unmatched';
        if (!needsReview) return false;
      } else if (statusTab === 'unmatched') {
        if (Boolean(d.matched_lead?.id) && d.match_status !== 'unmatched') return false;
      } else if (statusTab === 'approved') {
        if (d.approval_status !== 'approved' || !d.user_approved || !d.matched_lead?.id) return false;
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const comp = (d.extracted_company || d.matched_lead?.company_name || '').toLowerCase();
        const contact = (d.extracted_contact || d.matched_lead?.contact_name || '').toLowerCase();
        const subject = (d.edited_subject || d.extracted_subject || '').toLowerCase();
        const body = (d.edited_body_plain || d.extracted_body_plain || '').toLowerCase();
        if (!comp.includes(q) && !contact.includes(q) && !subject.includes(q) && !body.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [drafts, statusTab, searchQuery]);

  const selectedDraftsList = useMemo(() => {
    return drafts.filter((d) => selectedDraftIds.has(d.id));
  }, [drafts, selectedDraftIds]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Segmented Workspace Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-border/80">
        <div className="inline-flex items-center gap-1.5 p-1 rounded-xl bg-muted/40 border border-border">
          <button
            type="button"
            onClick={() => {
              setWorkspaceView('studio');
              router.replace('/email/workspace');
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              workspaceView === 'studio'
                ? 'bg-card text-foreground shadow-xs border border-border/80'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span>Email Studio</span>
            {drafts.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-primary/20 text-primary font-mono">
                {drafts.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setWorkspaceView('campaigns');
              router.replace('/email/workspace?view=campaigns');
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              workspaceView === 'campaigns'
                ? 'bg-card text-foreground shadow-xs border border-border/80'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Radio className="w-3.5 h-3.5 text-primary" />
            <span>Campaign Hub & History</span>
          </button>
        </div>
      </div>

      {workspaceView === 'campaigns' ? (
        <CampaignHubView
          onOpenStudio={() => {
            setWorkspaceView('studio');
            router.replace('/email/workspace');
          }}
          onOpenCreateModal={() => {
            setWorkspaceView('studio');
            setIsUploadOpen(true);
            router.replace('/email/workspace');
          }}
        />
      ) : (
        <>
          {/* Top Banner & Header — Native MineTech Design System */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-card p-6 rounded-2xl border border-border shadow-card">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 border border-primary/20 text-primary">
              <Sparkles className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold text-foreground tracking-tight">
              Personalized Email Workspace
            </h1>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/25 font-medium">
              MineTech AI
            </span>
          </div>
          <p className="text-xs text-muted-foreground max-w-2xl leading-relaxed">
            Upload multi-email PDF/Word documents. MineTech AI extracts each email verbatim, matches against your CRM companies and contacts, attaches product brochures, and stages structured bulk campaigns where <strong>every company receives its own tailored email</strong>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {drafts.length > 0 && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsSignatureModalOpen(true)}
                className="border-border text-foreground hover:bg-muted/40 text-xs h-9"
              >
                <FileSignature className="w-3.5 h-3.5 mr-1.5 text-primary" />
                Configure Signature
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleClearWorkspace}
                className="border-border text-muted-foreground hover:text-rose-400 hover:bg-muted/40 text-xs h-9"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                Reset Workspace
              </Button>
            </>
          )}

          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setActiveAttachScope(selectedDraftIds.size > 0 ? 'selected' : 'all');
              setActiveDraftIdForAttach(null);
              setIsAttachFilesModalOpen(true);
            }}
            className="border-border text-foreground hover:bg-muted/40 text-xs h-9"
          >
            <Paperclip className="w-3.5 h-3.5 mr-1.5 text-primary" />
            Attachment Library
          </Button>

          <Button
            size="sm"
            onClick={() => setIsUploadOpen(true)}
            className="bg-muted text-foreground border border-border hover:bg-muted/70 text-xs h-9"
          >
            <Upload className="w-3.5 h-3.5 mr-1.5 text-primary" />
            Upload PDF / Document
          </Button>

          {(() => {
            const activeCampaignId = createdCampaignId || drafts.find((d) => d.campaign_id)?.campaign_id;
            if (!activeCampaignId) return null;
            return (
              <Button
                size="sm"
                onClick={() => router.push(`/email/blasts/${activeCampaignId}`)}
                className="bg-card hover:bg-muted/40 text-primary border border-primary/40 font-semibold text-xs h-9"
              >
                <Eye className="w-3.5 h-3.5 mr-1.5 text-primary" />
                View Campaign
              </Button>
            );
          })()}

          <Button
            size="sm"
            disabled={selectedDraftIds.size === 0}
            onClick={() => setIsCampaignModalOpen(true)}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs h-9 shadow-xs"
          >
            <Layers className="w-3.5 h-3.5 mr-1.5" />
            Create Campaign ({selectedDraftIds.size})
          </Button>
        </div>
      </div>

      {/* Upload Drawer / Modal */}
      {isUploadOpen && (
        <Card className="p-6 bg-card border-border shadow-dialog animate-in slide-in-from-top-4 duration-300 space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <Upload className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Import Personalized Emails</h3>
            </div>
            <button
              onClick={() => setIsUploadOpen(false)}
              className="text-muted-foreground hover:text-foreground p-1 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setUploadTab('file')}
              className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${uploadTab === 'file'
                ? 'bg-primary text-primary-foreground font-semibold'
                : 'bg-muted/40 text-muted-foreground hover:text-foreground'
                }`}
            >
              File Upload (PDF, Word, TXT)
            </button>
            <button
              type="button"
              onClick={() => setUploadTab('text')}
              className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${uploadTab === 'text'
                ? 'bg-primary text-primary-foreground font-semibold'
                : 'bg-muted/40 text-muted-foreground hover:text-foreground'
                }`}
            >
              Paste Email Text Directly
            </button>
          </div>

          {uploadTab === 'file' ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-border hover:border-primary/80 rounded-xl p-8 text-center cursor-pointer transition-all bg-muted/20 hover:bg-muted/40 group"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.doc,.txt"
                className="hidden"
                onChange={handleFileUpload}
                disabled={uploading}
              />
              {uploading ? (
                <div className="flex flex-col items-center justify-center py-4">
                  <Loader2 className="w-8 h-8 animate-spin text-primary mb-2" />
                  <p className="text-sm font-semibold text-foreground">
                    Extracting emails & matching against CRM companies...
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Verbatim extraction with MineTech AI
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center">
                  <div className="p-3 rounded-full bg-muted/60 group-hover:bg-primary/10 text-muted-foreground group-hover:text-primary transition-colors mb-3">
                    <FileText className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">
                    Click to browse or drag & drop your PDF / Word document here
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Supports documents with 10, 36, or 100+ personalized emails in a single file
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <textarea
                value={rawTextInput}
                onChange={(e) => setRawTextInput(e.target.value)}
                placeholder="Paste your multi-email document text here...&#10;&#10;Company: Floreser Peru&#10;Subject: Sourcing High-Grade Kaolin&#10;Body: Dear Team, ...&#10;&#10;---&#10;&#10;Company: Esdel Phartec&#10;Subject: Industrial Bleaching Clay Partnership&#10;Body: Hi David, ..."
                rows={8}
                className="w-full bg-background border border-border rounded-lg p-3 text-xs text-foreground focus:outline-none"
              />
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsUploadOpen(false)}
                  className="border-border text-foreground text-xs"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  disabled={uploading || !rawTextInput.trim()}
                  onClick={handleTextSubmit}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-xs"
                >
                  {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
                  Extract & Match Emails
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* PDF Line-Wrapping Artifacts Alert Banner */}
      {formattingIssuesCount > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-amber-500/10 border border-amber-500/30 p-3.5 px-4 rounded-xl text-xs text-amber-500 animate-in fade-in duration-200">
          <div className="flex items-start sm:items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5 sm:mt-0" />
            <div>
              <span className="font-semibold text-foreground">
                PDF Line-Wrapping Detected in {formattingIssuesCount} Email{formattingIssuesCount > 1 ? 's' : ''}:
              </span>{' '}
              <span>
                Sentences were broken across lines due to PDF layout. Reconstruct natural paragraphs while strictly preserving 100% of all words, numbers, and technical specifications.
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              onClick={() => handleOpenBulkFix('all')}
              className="h-8 text-xs bg-amber-500 hover:bg-amber-600 text-white font-medium flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Fix Formatting for All ({formattingIssuesCount})
            </Button>
          </div>
        </div>
      )}

      {/* Summary KPI Cards Grid (6 cards) — Semantic CRM Colors */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card
          onClick={() => setStatusTab('all')}
          className={`p-4 bg-card border cursor-pointer transition-all ${statusTab === 'all'
            ? 'border-primary/50 shadow-xs bg-primary/5'
            : 'border-border hover:border-border/80'
            }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Total Extracted
            </span>
            <FileText className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="text-2xl font-bold text-foreground mt-2">{metrics.total || 0}</div>
          <p className="text-[10px] text-muted-foreground mt-1">Emails in workspace</p>
        </Card>

        {/* CRM Matched: Strict Green */}
        <Card
          onClick={() => setStatusTab('all')}
          className="p-4 bg-card border border-border hover:border-border/80 cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
              CRM Matched
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-2">{metrics.matched || 0}</div>
          <p className="text-[10px] text-muted-foreground mt-1">Linked to company</p>
        </Card>

        {/* Needs Review: Strict Yellow/Amber */}
        <Card
          onClick={() => setStatusTab('needs_review')}
          className={`p-4 bg-card border cursor-pointer transition-all ${statusTab === 'needs_review'
            ? 'border-amber-500 shadow-xs bg-amber-500/10'
            : 'border-border hover:border-border/80'
            }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
              Needs Review
            </span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-2">{metrics.needs_review || 0}</div>
          <p className="text-[10px] text-muted-foreground mt-1">Pending verification</p>
        </Card>

        {/* Unmatched: Strict Red */}
        <Card
          onClick={() => setStatusTab('unmatched')}
          className={`p-4 bg-card border cursor-pointer transition-all ${statusTab === 'unmatched'
            ? 'border-rose-500 shadow-xs bg-rose-500/10'
            : 'border-border hover:border-border/80'
            }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wider">
              Unmatched
            </span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-2">{metrics.unmatched || 0}</div>
          <p className="text-[10px] text-muted-foreground mt-1">Manual link required</p>
        </Card>

        <Card
          onClick={() => setStatusTab('approved')}
          className={`p-4 bg-card border cursor-pointer transition-all ${statusTab === 'approved'
            ? 'border-emerald-500/60 shadow-xs bg-emerald-500/5'
            : 'border-border hover:border-border/80'
            }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Approved
            </span>
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-foreground mt-2">{metrics.approved || 0}</div>
          <p className="text-[10px] text-muted-foreground mt-1">Approved by user</p>
        </Card>

        <Card
          onClick={() => setStatusTab('ready')}
          className={`p-4 bg-card border cursor-pointer transition-all ${statusTab === 'ready'
            ? 'border-primary shadow-xs bg-primary/10'
            : 'border-border hover:border-border/80'
            }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-primary uppercase tracking-wider">
              Campaign Ready
            </span>
            <Send className="w-4 h-4 text-primary" />
          </div>
          <div className="text-2xl font-bold text-primary mt-2">{metrics.ready || 0}</div>
          <p className="text-[10px] text-muted-foreground mt-1">Approved & contact set</p>
        </Card>
      </div>

      {/* Campaign Preparation: Campaign-Level Attachments & Automatic Signature */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Card 1: Campaign Attachments */}
        <Card className="p-4 bg-card border-border shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20">
                  <Paperclip className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-foreground flex items-center gap-2">
                    Campaign Attachments
                    <Badge
                      variant="outline"
                      className={`text-[10px] h-5 font-semibold ${allUniqueCampaignAttachments.length > 0
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                        : 'bg-muted text-muted-foreground'
                        }`}
                    >
                      {allUniqueCampaignAttachments.length > 0
                        ? `${allUniqueCampaignAttachments.length} file${allUniqueCampaignAttachments.length > 1 ? 's' : ''} attached`
                        : '0 files'}
                    </Badge>
                  </h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Attach brochures or collateral to all or selected campaign recipients.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                {allUniqueCampaignAttachments.length > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleRemoveAllCampaignAttachments}
                    className="h-8 text-xs border-rose-500/40 text-rose-500 hover:bg-rose-500/10 gap-1"
                    title="Remove all files from all emails in this campaign"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Remove All</span>
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setActiveAttachScope(selectedDraftIds.size > 0 ? 'selected' : 'all');
                    setActiveDraftIdForAttach(null);
                    setIsAttachFilesModalOpen(true);
                  }}
                  className="h-8 text-xs border-primary/30 text-primary hover:bg-primary/10 gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Files</span>
                </Button>
              </div>
            </div>

            {/* Uploaded Campaign Files List */}
            <div className="mt-3 space-y-2">
              {allUniqueCampaignAttachments.length === 0 ? (
                <div
                  onClick={() => {
                    setActiveAttachScope(selectedDraftIds.size > 0 ? 'selected' : 'all');
                    setActiveDraftIdForAttach(null);
                    setIsAttachFilesModalOpen(true);
                  }}
                  className="border border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:bg-muted/20 transition-colors"
                >
                  <Paperclip className="w-5 h-5 text-muted-foreground/60 mx-auto mb-1" />
                  <p className="text-xs font-medium text-foreground">No campaign files attached yet</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Click <strong className="text-primary hover:underline">Add Files</strong> to upload or select collateral from library
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                  {allUniqueCampaignAttachments.map((att) => {
                    const isDeleting = deletingAttachmentId === att.id;
                    const fileName = att.fileName || att.name;
                    const isPdf = (att.fileType || '').includes('pdf') || fileName.toLowerCase().endsWith('.pdf');
                    return (
                      <div
                        key={att.id || fileName}
                        className="flex items-center justify-between p-2 rounded-lg bg-muted/20 border border-border hover:bg-muted/40 transition-colors text-xs"
                      >
                        <div className="flex items-center gap-2 truncate max-w-[280px]">
                          <FileText className={`w-4 h-4 shrink-0 ${isPdf ? 'text-rose-500' : 'text-primary'}`} />
                          <span className="font-medium text-foreground truncate" title={fileName}>
                            {fileName}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                            ({att.fileSize || '1.0 MB'})
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => setPreviewAttachmentDoc(att)}
                            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                            title="Preview file"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={isDeleting}
                            onClick={() => handleDeleteCampaignAttachment(att.id, fileName)}
                            className="p-1 rounded text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                            title="Remove file from campaign (detaches from all emails)"
                          >
                            {isDeleting ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-500" />
                            ) : (
                              <X className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="mt-3 pt-2 border-t border-border/60 flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
              Attached to {drafts.length} recipient emails
            </span>
            <span>Supported: PDF, Word, Excel, Images (Max 25 MB)</span>
          </div>
        </Card>

        {/* Card 2: Campaign Automatic Signature */}
        <Card className="p-4 bg-card border-border shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                  <FileSignature className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-foreground flex items-center gap-2">
                    Campaign Email Signature
                    <Badge variant="outline" className="text-[10px] h-5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 font-semibold gap-1">
                      <Check className="w-2.5 h-2.5" />
                      Auto-applied to all {drafts.length} emails
                    </Badge>
                  </h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Official MineTech signature automatically appended upon dispatch.
                  </p>
                </div>
              </div>

              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsSignatureModalOpen(true)}
                className="h-8 text-xs border-border hover:bg-muted/40 gap-1.5"
              >
                <Edit3 className="w-3.5 h-3.5 text-primary" />
                <span>Configure Signature</span>
              </Button>
            </div>

            {/* Signature Preview Card */}
            <div className="mt-3 p-3 rounded-lg bg-muted/10 border border-border text-xs max-h-44 overflow-y-auto">
              <div className="text-[11px] text-muted-foreground mb-1.5 flex items-center justify-between">
                <span>
                  Sender: <strong className="text-foreground">{configuredSignature?.senderName || 'Abdullah Rauf'}</strong> ({configuredSignature?.senderTitle || 'Head of Sales'})
                </span>
                <span className="text-[10px] font-mono">{configuredSignature?.senderEmail || 'rauf@mine-tech.be'}</span>
              </div>
              <div
                className="p-2.5 rounded bg-background border border-border/80 text-[11px] leading-relaxed select-text"
                dangerouslySetInnerHTML={{
                  __html: configuredSignature?.bodyHtml || `<p>Regards,<br/><strong>Abdullah Rauf</strong><br/>Minetech Resources BV</p>`,
                }}
              />
            </div>
          </div>

          <div className="mt-3 pt-2 border-t border-border/60 flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-emerald-500" />
              Verified Gmail HTML layout
            </span>
            <span>No duplicate sign-offs or manual copying required</span>
          </div>
        </Card>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/20 p-2.5 rounded-xl border border-border">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setStatusTab('all')}
            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${statusTab === 'all'
              ? 'bg-primary text-primary-foreground font-semibold'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
              }`}
          >
            All Emails ({drafts.length})
          </button>
          <button
            onClick={() => setStatusTab('ready')}
            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${statusTab === 'ready'
              ? 'bg-primary text-primary-foreground font-semibold'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
              }`}
          >
            Ready to Send ({metrics.ready || 0})
          </button>
          <button
            onClick={() => setStatusTab('needs_review')}
            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${statusTab === 'needs_review'
              ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30 font-semibold'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
              }`}
          >
            Needs Review ({metrics.needs_review || 0})
          </button>
          <button
            onClick={() => setStatusTab('unmatched')}
            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${statusTab === 'unmatched'
              ? 'bg-rose-500/20 text-rose-500 border border-rose-500/30 font-semibold'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
              }`}
          >
            Unmatched ({metrics.unmatched || 0})
          </button>
          <button
            onClick={() => setStatusTab('approved')}
            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${statusTab === 'approved'
              ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 font-semibold'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
              }`}
          >
            Approved ({metrics.approved || 0})
          </button>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search company, contact, subject..."
            className="pl-8 h-8 text-xs bg-background border-border text-foreground"
          />
        </div>
      </div>

      {/* Bulk Action Bar (when rows are selected) */}
      {selectedDraftIds.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-primary/10 border border-primary/30 p-3 px-4 rounded-xl animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-foreground">
              {selectedDraftIds.size} of {filteredDrafts.length} emails selected
            </span>
            <button
              onClick={toggleSelectAll}
              className="text-xs text-primary hover:underline font-medium"
            >
              {filteredDrafts.length > 0 && filteredDrafts.every((d) => selectedDraftIds.has(d.id))
                ? 'Deselect all'
                : 'Select all'}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleBulkApprove}
              className="h-8 text-xs border-border hover:bg-muted/40 text-foreground"
            >
              <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-500" />
              Bulk Approve Selected
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setActiveAttachScope('selected');
                setActiveDraftIdForAttach(null);
                setIsAttachFilesModalOpen(true);
              }}
              className="h-8 text-xs border-border hover:bg-muted/40 text-foreground"
            >
              <Paperclip className="w-3.5 h-3.5 mr-1 text-primary" />
              Attach to Selected ({selectedDraftIds.size})
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleBulkDetachSelected}
              className="h-8 text-xs border-rose-500/40 text-rose-500 hover:bg-rose-500/10"
              title="Remove all attachments from selected emails"
            >
              <X className="w-3.5 h-3.5 mr-1" />
              Remove Files ({selectedDraftIds.size})
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsSignatureModalOpen(true)}
              className="h-8 text-xs border-border hover:bg-muted/40 text-foreground"
            >
              <FileSignature className="w-3.5 h-3.5 mr-1 text-primary" />
              Change Signature
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => handleOpenBulkFix(Array.from(selectedDraftIds))}
              className="h-8 text-xs border-amber-500/40 text-amber-500 hover:bg-amber-500/10"
              title="Remove PDF layout line breaks and reconstruct continuous paragraphs"
            >
              <Sparkles className="w-3.5 h-3.5 mr-1 text-amber-500" />
              Fix Formatting (Selected)
            </Button>

            <Button
              size="sm"
              onClick={() => setIsCampaignModalOpen(true)}
              className="h-8 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-xs"
            >
              <Layers className="w-3.5 h-3.5 mr-1" />
              Create Campaign Draft ({selectedDraftIds.size})
            </Button>
          </div>
        </div>
      )}

      {/* Main Outreach Table */}
      <Card className="bg-card border-border shadow-card overflow-hidden">
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center text-muted-foreground">
            <Loader2 className="w-8 h-8 animate-spin text-primary mb-2" />
            <p className="text-sm font-medium">Loading email workspace...</p>
          </div>
        ) : filteredDrafts.length === 0 ? (
          <div className="py-20 text-center text-muted-foreground space-y-3">
            <FileText className="w-10 h-10 text-muted-foreground/60 mx-auto" />
            <div>
              <p className="text-base font-semibold text-foreground">No emails match the current view</p>
              <p className="text-xs text-muted-foreground mt-1">
                {drafts.length === 0
                  ? 'Upload a PDF or Word document with personalized emails to start.'
                  : 'Try clearing your search query or switching tabs.'}
              </p>
            </div>
            {drafts.length === 0 && (
              <Button
                onClick={() => setIsUploadOpen(true)}
                className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs mt-2"
              >
                <Upload className="w-3.5 h-3.5 mr-1.5" />
                Upload Emails Document
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-muted-foreground uppercase tracking-wider text-[11px] font-semibold">
                  <th className="py-3 px-4 w-10">
                    <input
                      type="checkbox"
                      checked={filteredDrafts.length > 0 && filteredDrafts.every((d) => selectedDraftIds.has(d.id))}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 accent-primary rounded cursor-pointer"
                    />
                  </th>
                  <th className="py-3 px-4">Company & CRM Match</th>
                  <th className="py-3 px-4">Target Contact(s)</th>
                  <th className="py-3 px-4">Email Preview</th>
                  <th className="py-3 px-4">Files & Signature</th>
                  <th className="py-3 px-4">Match Status</th>
                  <th className="py-3 px-4">Approval</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-foreground">
                {filteredDrafts.map((draft) => {
                  const isSelected = selectedDraftIds.has(draft.id);
                  const matchedLead = draft.matched_lead;
                  const allContacts = draft.all_company_contacts || [];
                  const selectedContacts = draft.selected_contacts || [];
                  const primaryContact = selectedContacts.find((c) => c.is_primary) || selectedContacts[0] || allContacts[0];
                  const attachmentsCount = Array.isArray(draft.assigned_attachments) ? draft.assigned_attachments.length : 0;

                  return (
                    <tr
                      key={draft.id}
                      className={`hover:bg-muted/30 transition-colors ${isSelected ? 'bg-primary/5' : ''
                        }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3.5 px-4">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectOne(draft.id)}
                          className="w-4 h-4 accent-primary rounded cursor-pointer"
                        />
                      </td>

                      {/* Company & CRM Match */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-foreground">
                              {draft.extracted_company || matchedLead?.company_name || 'Unspecified Company'}
                            </span>
                          </div>

                          {matchedLead ? (
                            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                              <Building className="w-3 h-3 text-emerald-500" />
                              <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                                CRM: {matchedLead.company_name}
                              </span>
                              {matchedLead.country && <span>({matchedLead.country})</span>}
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-[11px] text-rose-500">
                              <AlertTriangle className="w-3 h-3" />
                              <span>Not matched to CRM</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Target Contact */}
                      <td className="py-3.5 px-4 max-w-xs">
                        {primaryContact ? (
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5 font-medium text-foreground">
                              <User className="w-3 h-3 text-primary" />
                              <span>{primaryContact.name || 'Unnamed'}</span>
                              {selectedContacts.length > 1 && (
                                <span className="text-[10px] px-1 rounded bg-muted text-muted-foreground">
                                  +{selectedContacts.length - 1} CC
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-muted-foreground">{primaryContact.email}</p>
                          </div>
                        ) : (
                          <span className="text-[11px] text-muted-foreground italic">No contact set</span>
                        )}
                      </td>

                      {/* Email Preview */}
                      <td className="py-3.5 px-4 max-w-md">
                        <div className="space-y-1">
                          <p className="font-medium text-foreground truncate">
                            {draft.edited_subject || draft.extracted_subject || draft.subject || '(No subject line)'}
                          </p>
                          <p className="text-[11px] text-muted-foreground line-clamp-1">
                            {draft.edited_body_plain || draft.extracted_body_plain || draft.body_plain}
                          </p>
                        </div>
                      </td>

                      {/* Attachments & Signature */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {attachmentsCount > 0 ? (
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (draft.assigned_attachments?.[0]) {
                                      setPreviewAttachmentDoc(draft.assigned_attachments[0]);
                                    } else {
                                      setActiveDraftIdForAttach(draft.id);
                                      setActiveAttachScope('individual');
                                      setIsAttachFilesModalOpen(true);
                                    }
                                  }}
                                  className="px-2 py-0.5 rounded bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 text-[10px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                                  title={(draft.assigned_attachments || []).map((a) => a.fileName || a.name).join(', ')}
                                >
                                  <Paperclip className="w-2.5 h-2.5 shrink-0" />
                                  <span>{attachmentsCount} File{attachmentsCount > 1 ? 's' : ''}</span>
                                  <Eye className="w-2.5 h-2.5 ml-0.5 text-primary/70" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDetachFromDraft(draft.id);
                                  }}
                                  className="p-1 rounded text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                                  title="Remove files from this email"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveDraftIdForAttach(draft.id);
                                  setActiveAttachScope('individual');
                                  setIsAttachFilesModalOpen(true);
                                }}
                                className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer transition-colors"
                                title="Click to attach files to this email"
                              >
                                <Paperclip className="w-3 h-3 text-muted-foreground/60" /> No files
                              </button>
                            )}
                          </div>

                          <span
                            className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[10px] font-medium flex items-center gap-1 w-fit cursor-default"
                            title="Official MineTech Gmail signature automatically applied"
                          >
                            <FileSignature className="w-3 h-3 text-emerald-500" />
                            Auto Sig: {configuredSignature?.senderName ? configuredSignature.senderName.split(' ')[0] : 'Rauf'}
                          </span>
                        </div>
                      </td>

                      {/* Match Status — Strict Colors (Green, Yellow, Red) */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {draft.match_status === 'matched' ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[10px] font-semibold flex items-center gap-1 w-fit">
                            <CheckCircle2 className="w-3 h-3" />
                            CRM Matched
                          </span>
                        ) : draft.match_status === 'needs_review' ? (
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-[10px] font-semibold flex items-center gap-1 w-fit">
                            <AlertTriangle className="w-3 h-3" />
                            Needs Review
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30 text-[10px] font-semibold flex items-center gap-1 w-fit">
                            <AlertTriangle className="w-3 h-3" />
                            Unmatched
                          </span>
                        )}
                      </td>

                      {/* Approval Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {draft.approval_status === 'approved' ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[10px] font-semibold flex items-center gap-1 w-fit">
                            <CheckCircle2 className="w-3 h-3" />
                            Approved
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-muted/60 text-muted-foreground border border-border text-[10px] font-semibold flex items-center gap-1 w-fit">
                            <Clock className="w-3 h-3" />
                            Needs Review
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {draft.approval_status === 'approved' ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => handleDirectUnapprove(draft.id, e)}
                              className="h-7 text-xs border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-rose-500/10 hover:text-rose-500 hover:border-rose-500/30 transition-colors"
                              title="Click to remove approval"
                            >
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Approved
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              onClick={(e) => handleDirectApprove(draft.id, e)}
                              className="h-7 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-xs"
                              title="Click to approve this personalized email"
                            >
                              <Check className="w-3 h-3 mr-1" />
                              Approve
                            </Button>
                          )}

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const originalIdx = drafts.findIndex((d) => d.id === draft.id);
                              setEditingDraftIndex(originalIdx);
                            }}
                            className="h-7 text-xs border-border text-foreground hover:bg-muted/40"
                          >
                            <Edit3 className="w-3 h-3 mr-1 text-primary" />
                            Review & Edit
                          </Button>

                          {!matchedLead && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setRematchDraft(draft)}
                              className="h-7 text-xs text-primary hover:bg-primary/10"
                            >
                              Link CRM
                            </Button>
                          )}
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
        </>
      )}

      {/* Editor Modal */}
      {editingDraftIndex !== null && drafts[editingDraftIndex] && (
        <PersonalizedEmailEditorModal
          isOpen={true}
          onClose={() => setEditingDraftIndex(null)}
          draft={drafts[editingDraftIndex]}
          allDrafts={drafts}
          currentIndex={editingDraftIndex}
          onNavigate={(nextIdx) => setEditingDraftIndex(nextIdx)}
          onSaveDraft={(updatedDrafts) => {
            setDrafts(updatedDrafts);
            fetchWorkspace(true);
          }}
        />
      )}

      {/* Campaign Creation Modal */}
      <CreatePersonalizedCampaignModal
        isOpen={isCampaignModalOpen}
        onClose={() => setIsCampaignModalOpen(false)}
        selectedDrafts={selectedDraftsList}
        batchId={activeBatch?.id}
        onCampaignCreated={(campId) => {
          setCreatedCampaignId(campId);
          fetchWorkspace(true);
        }}
      />

      {/* Standalone Rematch Modal */}
      {rematchDraft && (
        <RematchCompanyModal
          isOpen={true}
          onClose={() => setRematchDraft(null)}
          draft={rematchDraft}
          onMatched={() => {
            fetchWorkspace(true);
            setRematchDraft(null);
          }}
        />
      )}

      {/* Signature Manager Modal */}
      <CustomSignatureModal
        isOpen={isSignatureModalOpen}
        onClose={() => setIsSignatureModalOpen(false)}
        totalDraftsCount={drafts.length}
        selectedDraftsCount={selectedDraftIds.size}
        selectedDraftIds={Array.from(selectedDraftIds)}
        onSignatureApplied={(updatedDrafts) => {
          setDrafts(updatedDrafts);
          fetchWorkspace(true);
        }}
      />

      {/* Attach Files Modal */}
      <AttachFilesModal
        isOpen={isAttachFilesModalOpen}
        onClose={() => {
          setIsAttachFilesModalOpen(false);
          setActiveDraftIdForAttach(null);
        }}
        totalDraftsCount={drafts.length}
        selectedDraftsCount={selectedDraftIds.size}
        selectedDraftIds={Array.from(selectedDraftIds)}
        currentDraftId={activeDraftIdForAttach}
        initialScope={activeAttachScope}
        onAttachmentsApplied={(updatedDrafts, appliedDocs) => {
          if (updatedDrafts) setDrafts(updatedDrafts);
          if (appliedDocs && activeAttachScope === 'all') setCampaignAttachments(appliedDocs);
          fetchWorkspace(true);
        }}
      />

      {/* Bulk PDF Formatting Fix Confirmation Modal */}
      {isBulkFixModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-background/80 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <Card className="w-full max-w-3xl bg-card border border-border shadow-dialog p-6 space-y-4 max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-start justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-500">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-base font-semibold text-foreground">
                    Fix PDF Line-Wrapping — Paragraph Reconstruction
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Reconstruct continuous sentences from PDF layout wrapping across{' '}
                    {bulkFixTargetIds === 'all'
                      ? `all ${drafts.length} emails`
                      : `${bulkFixTargetIds.length} selected email(s)`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsBulkFixModalOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Verbatim Accuracy Guarantee Banner */}
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-xs text-emerald-600 dark:text-emerald-400 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>
                  <strong>100% Verbatim Accuracy:</strong> No words, technical specifications, or numbers will be rewritten or changed.
                </span>
              </div>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 font-semibold">
                0 words altered
              </span>
            </div>

            {/* Sample Before / After Diff */}
            {bulkFixSample ? (
              <div className="space-y-2 flex-1 overflow-y-auto">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">
                    Sample Preview: {bulkFixSample.companyName || 'Target Company'} ({bulkFixSample.contactName || 'Recipient'})
                  </span>
                  <span className="font-mono text-[11px]">
                    Word count check: {bulkFixSample.origWordCount} words in → {bulkFixSample.fixedWordCount} words out (Match: {bulkFixSample.wordCountMatch ? 'YES' : 'NO'})
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 text-amber-500" /> Current (Artificial Line Breaks):
                    </span>
                    <div
                      style={{ fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '13px', lineHeight: '1.5' }}
                      className="p-3 rounded-lg border border-border bg-muted/20 text-foreground whitespace-pre-wrap max-h-[220px] overflow-y-auto"
                    >
                      {bulkFixSample.before_plain}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Reconstructed Paragraphs:
                    </span>
                    <div
                      style={{ fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '13px', lineHeight: '1.5' }}
                      className="p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 text-foreground whitespace-pre-wrap max-h-[220px] overflow-y-auto"
                    >
                      {bulkFixSample.after_plain}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Safeguards & Confirmation */}
            <div className="p-3 bg-muted/30 border border-border rounded-lg space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="includeManuallyEdited"
                  checked={includeManuallyEdited}
                  onChange={(e) => setIncludeManuallyEdited(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                />
                <label htmlFor="includeManuallyEdited" className="text-foreground font-medium cursor-pointer">
                  Also format emails that have already been manually edited
                </label>
              </div>
              <p className="text-[11px] text-muted-foreground pl-6">
                Leave unchecked to protect any custom edits you previously made. Emails whose text is updated will have approval status reset to <strong>Needs Review</strong> for your final confirmation.
              </p>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsBulkFixModalOpen(false)}
                disabled={bulkFixLoading}
                className="text-xs border-border text-foreground hover:bg-muted"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleApplyBulkFix}
                disabled={bulkFixLoading}
                className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium flex items-center gap-1.5"
              >
                {bulkFixLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                ) : (
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                )}
                Apply Formatting Fix
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Campaign Attachment File Preview Modal */}
      {previewAttachmentDoc && (() => {
        const directHttpUrl = (previewAttachmentDoc.url && previewAttachmentDoc.url.startsWith('http'))
          ? previewAttachmentDoc.url
          : (previewAttachmentDoc.storagePath
            ? `https://oatkydlnhenemojbaxwx.supabase.co/storage/v1/object/public/email-attachments/${previewAttachmentDoc.storagePath}`
            : null);
        const previewUrl = `/api/email/workspace/documents/preview?id=${encodeURIComponent(previewAttachmentDoc.id || previewAttachmentDoc.fileName)}&fileName=${encodeURIComponent(previewAttachmentDoc.fileName || '')}`;
        const downloadUrl = directHttpUrl || `${previewUrl}${previewUrl.includes('?') ? '&' : '?'}download=1`;
        const isPdf = previewAttachmentDoc.fileType?.includes('pdf') || (previewAttachmentDoc.fileName || '').toLowerCase().endsWith('.pdf');
        const isImage = previewAttachmentDoc.fileType?.includes('image') || /\.(png|jpe?g|webp|gif|svg)$/i.test(previewAttachmentDoc.fileName || '');

        return (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-150">
            <Card className="w-full max-w-4xl bg-card border-border text-foreground shadow-dialog flex flex-col h-[85vh] overflow-hidden rounded-xl">
              <div className="flex items-center justify-between p-4 px-6 border-b border-border bg-muted/20">
                <div className="flex items-center gap-2.5">
                  <FileText className="w-4 h-4 text-primary" />
                  <div>
                    <h4 className="text-sm font-semibold text-foreground truncate max-w-md">
                      {previewAttachmentDoc.fileName || previewAttachmentDoc.name}
                    </h4>
                    <p className="text-xs text-muted-foreground font-mono">
                      {previewAttachmentDoc.fileName} {previewAttachmentDoc.fileSize ? `• ${previewAttachmentDoc.fileSize}` : ''}
                    </p>
                  </div>
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
                    download={previewAttachmentDoc.fileName || 'document.pdf'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-md bg-muted/50 border border-border font-medium"
                    title="Download document to computer"
                  >
                    Download
                  </a>
                  <button
                    onClick={() => setPreviewAttachmentDoc(null)}
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
                    alt={previewAttachmentDoc.name || previewAttachmentDoc.fileName}
                    className="max-h-full max-w-full object-contain rounded shadow"
                  />
                ) : isPdf ? (
                  <iframe
                    src={previewUrl}
                    title={previewAttachmentDoc.name || previewAttachmentDoc.fileName}
                    className="w-full h-full rounded-lg border border-border bg-white"
                  />
                ) : (
                  <div className="text-center p-8 space-y-4">
                    <div className="p-4 rounded-full bg-primary/10 text-primary w-fit mx-auto">
                      <FileText className="w-8 h-8" />
                    </div>
                    <div>
                      <h4 className="text-base font-semibold text-foreground">
                        {previewAttachmentDoc.fileName || previewAttachmentDoc.name}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        This format ({previewAttachmentDoc.fileType || 'Document'}) cannot be displayed directly inline.
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
                        download={previewAttachmentDoc.fileName || 'document'}
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
