'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
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
  Plus
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

export default function UnifiedEmailWorkspace() {
  const router = useRouter();
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
  const [rawTextInput, setRawTextInput] = useState('');
  const [uploadTab, setUploadTab] = useState('file'); // file | text
  const fileInputRef = useRef(null);

  // Load active workspace on mount
  const fetchWorkspace = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/email/workspace');
      const data = await res.json();
      if (data.success) {
        setActiveBatch(data.batch);
        setDrafts(data.drafts || []);
        setMetrics(data.metrics || {});
        // Default select all drafts that are ready
        const readyIds = new Set(
          (data.drafts || [])
            .filter((d) => d.approval_status === 'approved' && d.match_status === 'matched')
            .map((d) => d.id)
        );
        setSelectedDraftIds(readyIds);
      }
    } catch (err) {
      console.error('Failed to load workspace:', err);
      toast.error('Failed to load email workspace');
    } finally {
      setLoading(false);
    }
  };

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

  // Selection toggle
  const toggleSelectAll = () => {
    if (selectedDraftIds.size === filteredDrafts.length) {
      setSelectedDraftIds(new Set());
    } else {
      setSelectedDraftIds(new Set(filteredDrafts.map((d) => d.id)));
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
          d.match_status === 'matched' &&
          Array.isArray(d.selected_contacts) &&
          d.selected_contacts.length > 0;
        if (!isReady) return false;
      } else if (statusTab === 'needs_review') {
        if (d.approval_status !== 'needs_review' && d.match_status !== 'needs_review') return false;
      } else if (statusTab === 'unmatched') {
        if (d.match_status !== 'unmatched') return false;
      } else if (statusTab === 'approved') {
        if (d.approval_status !== 'approved') return false;
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
                Signature Settings
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAttachFilesModalOpen(true)}
                className="border-border text-foreground hover:bg-muted/40 text-xs h-9"
              >
                <Paperclip className="w-3.5 h-3.5 mr-1.5 text-primary" />
                Attach Files
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
            onClick={() => setIsUploadOpen(true)}
            className="bg-muted text-foreground border border-border hover:bg-muted/70 text-xs h-9"
          >
            <Upload className="w-3.5 h-3.5 mr-1.5 text-primary" />
            Upload PDF / Document
          </Button>

          {(createdCampaignId || activeBatch?.id) && (
            <Button
              size="sm"
              onClick={() => router.push(`/email/blasts/${createdCampaignId || activeBatch?.id}`)}
              className="bg-card hover:bg-muted/40 text-primary border border-primary/40 font-semibold text-xs h-9"
            >
              <Eye className="w-3.5 h-3.5 mr-1.5 text-primary" />
              View Campaign
            </Button>
          )}

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
              className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                uploadTab === 'file'
                  ? 'bg-primary text-primary-foreground font-semibold'
                  : 'bg-muted/40 text-muted-foreground hover:text-foreground'
              }`}
            >
              File Upload (PDF, Word, TXT)
            </button>
            <button
              type="button"
              onClick={() => setUploadTab('text')}
              className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                uploadTab === 'text'
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

      {/* Summary KPI Cards Grid (6 cards) — Semantic CRM Colors */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card
          onClick={() => setStatusTab('all')}
          className={`p-4 bg-card border cursor-pointer transition-all ${
            statusTab === 'all'
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
          className={`p-4 bg-card border cursor-pointer transition-all ${
            statusTab === 'needs_review'
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
          className={`p-4 bg-card border cursor-pointer transition-all ${
            statusTab === 'unmatched'
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
          className={`p-4 bg-card border cursor-pointer transition-all ${
            statusTab === 'approved'
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
          className={`p-4 bg-card border cursor-pointer transition-all ${
            statusTab === 'ready'
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

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/20 p-2.5 rounded-xl border border-border">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setStatusTab('all')}
            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
              statusTab === 'all'
                ? 'bg-primary text-primary-foreground font-semibold'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
            }`}
          >
            All Emails ({drafts.length})
          </button>
          <button
            onClick={() => setStatusTab('ready')}
            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
              statusTab === 'ready'
                ? 'bg-primary text-primary-foreground font-semibold'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
            }`}
          >
            Ready to Send ({metrics.ready || 0})
          </button>
          <button
            onClick={() => setStatusTab('needs_review')}
            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
              statusTab === 'needs_review'
                ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30 font-semibold'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
            }`}
          >
            Needs Review ({metrics.needs_review || 0})
          </button>
          <button
            onClick={() => setStatusTab('unmatched')}
            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
              statusTab === 'unmatched'
                ? 'bg-rose-500/20 text-rose-500 border border-rose-500/30 font-semibold'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
            }`}
          >
            Unmatched ({metrics.unmatched || 0})
          </button>
          <button
            onClick={() => setStatusTab('approved')}
            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
              statusTab === 'approved'
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
              className="text-xs text-primary hover:underline"
            >
              {selectedDraftIds.size === filteredDrafts.length ? 'Deselect all' : 'Select all'}
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
              onClick={() => setIsAttachFilesModalOpen(true)}
              className="h-8 text-xs border-border hover:bg-muted/40 text-foreground"
            >
              <Paperclip className="w-3.5 h-3.5 mr-1 text-primary" />
              Attach Files
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
                      checked={selectedDraftIds.size > 0 && selectedDraftIds.size === filteredDrafts.length}
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
                      className={`hover:bg-muted/30 transition-colors ${
                        isSelected ? 'bg-primary/5' : ''
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
                            {draft.edited_subject || draft.extracted_subject || '(No subject line)'}
                          </p>
                          <p className="text-[11px] text-muted-foreground line-clamp-1">
                            {draft.edited_body_plain || draft.extracted_body_plain}
                          </p>
                        </div>
                      </td>

                      {/* Attachments & Signature */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="space-y-1">
                          {attachmentsCount > 0 ? (
                            <span
                              className="px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 text-[11px] font-medium flex items-center gap-1 w-fit cursor-default"
                              title={draft.assigned_attachments?.map((a) => a.name || a.fileName).join(', ')}
                            >
                              <Paperclip className="w-3 h-3" />
                              {attachmentsCount} {attachmentsCount === 1 ? 'file' : 'files'}
                            </span>
                          ) : (
                            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                              <Paperclip className="w-3 h-3 text-muted-foreground/60" /> No files
                            </span>
                          )}

                          <span
                            className="px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border text-[10px] flex items-center gap-1 w-fit cursor-default"
                            title={draft.assigned_signature_id?.startsWith('sig-custom') ? 'Custom Signature' : 'Official Gmail Signature'}
                          >
                            <FileSignature className="w-3 h-3 text-primary" />
                            {draft.assigned_signature_id?.startsWith('sig-custom') ? 'Custom Sig' : 'Gmail Sig'}
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
            fetchWorkspace();
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
          fetchWorkspace();
        }}
      />

      {/* Standalone Rematch Modal */}
      {rematchDraft && (
        <RematchCompanyModal
          isOpen={true}
          onClose={() => setRematchDraft(null)}
          draft={rematchDraft}
          onMatched={() => {
            fetchWorkspace();
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
          fetchWorkspace();
        }}
      />

      {/* Attach Files Modal */}
      <AttachFilesModal
        isOpen={isAttachFilesModalOpen}
        onClose={() => setIsAttachFilesModalOpen(false)}
        totalDraftsCount={drafts.length}
        selectedDraftsCount={selectedDraftIds.size}
        selectedDraftIds={Array.from(selectedDraftIds)}
        onAttachmentsApplied={(updatedDrafts) => {
          setDrafts(updatedDrafts);
          fetchWorkspace();
        }}
      />
    </div>
  );
}
