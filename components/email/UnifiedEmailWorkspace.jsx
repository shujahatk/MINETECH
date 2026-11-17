'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import PersonalizedEmailEditorModal from './PersonalizedEmailEditorModal';
import CreatePersonalizedCampaignModal from './CreatePersonalizedCampaignModal';
import RematchCompanyModal from './RematchCompanyModal';

export default function UnifiedEmailWorkspace() {
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [activeBatch, setActiveBatch] = useState(null);
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

  const handleBulkAttachBrochure = async () => {
    const targetIds = Array.from(selectedDraftIds);
    if (targetIds.length === 0) return;

    try {
      const brochureDoc = {
        id: 'doc-brochure-minetech',
        name: 'MineTech Corporate Brochure & Company Profile',
        fileName: 'MineTech_Corporate_Brochure_2026.pdf',
        fileSize: '2.4 MB',
      };

      const res = await fetch('/api/email/workspace', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'bulk_attachments',
          draftIds: targetIds,
          attachments: [brochureDoc],
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(`Attached MineTech brochure to ${targetIds.length} emails!`);
        setDrafts(data.drafts);
      }
    } catch (err) {
      toast.error('Bulk attachment failed');
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
      {/* Top Banner & Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/30 p-6 rounded-2xl border border-slate-800 shadow-xl">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              Personalized Email Workspace
            </h1>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-medium">
              MineTech AI
            </span>
          </div>
          <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
            Upload single multi-email PDF/Word documents. Claude extracts each email verbatim, matches against your CRM companies and contacts, attaches product brochures, and dispatches bulk campaigns where <strong>every company receives its own tailored email</strong>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {drafts.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearWorkspace}
              className="border-slate-700 text-slate-400 hover:text-rose-400 hover:bg-slate-800 text-xs h-9"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              Reset Workspace
            </Button>
          )}

          <Button
            size="sm"
            onClick={() => setIsUploadOpen(true)}
            className="bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 text-xs h-9"
          >
            <Upload className="w-3.5 h-3.5 mr-1.5 text-amber-400" />
            Upload PDF / Document
          </Button>

          <Button
            size="sm"
            disabled={selectedDraftIds.size === 0}
            onClick={() => setIsCampaignModalOpen(true)}
            className="bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs h-9 shadow-lg shadow-amber-600/20"
          >
            <Send className="w-3.5 h-3.5 mr-1.5" />
            Create & Send Campaign ({selectedDraftIds.size})
          </Button>
        </div>
      </div>

      {/* Upload Drawer / Modal */}
      {isUploadOpen && (
        <Card className="p-6 bg-slate-900 border-amber-500/30 shadow-2xl animate-in slide-in-from-top-4 duration-300 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Upload className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-semibold text-white">Import Personalized Emails</h3>
            </div>
            <button
              onClick={() => setIsUploadOpen(false)}
              className="text-slate-400 hover:text-white p-1 rounded"
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
                  ? 'bg-amber-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              File Upload (PDF, Word, TXT)
            </button>
            <button
              type="button"
              onClick={() => setUploadTab('text')}
              className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                uploadTab === 'text'
                  ? 'bg-amber-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              Paste Email Text Directly
            </button>
          </div>

          {uploadTab === 'file' ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-700 hover:border-amber-500/80 rounded-xl p-8 text-center cursor-pointer transition-all bg-slate-950/40 hover:bg-slate-950/70 group"
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
                  <Loader2 className="w-8 h-8 animate-spin text-amber-400 mb-2" />
                  <p className="text-sm font-semibold text-slate-200">
                    Extracting emails & matching against CRM companies...
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Verbatim extraction with Claude Sonnet 5.5
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center">
                  <div className="p-3 rounded-full bg-slate-800 group-hover:bg-amber-500/10 text-slate-400 group-hover:text-amber-400 transition-colors mb-3">
                    <FileText className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-semibold text-slate-200">
                    Click to browse or drag & drop your PDF / Word document here
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
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
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-200 font-mono focus:border-amber-500 focus:outline-none"
              />
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsUploadOpen(false)}
                  className="border-slate-700 text-slate-300 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  disabled={uploading || !rawTextInput.trim()}
                  onClick={handleTextSubmit}
                  className="bg-amber-600 hover:bg-amber-500 text-white font-medium text-xs"
                >
                  {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
                  Extract & Match Emails
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Summary KPI Cards Grid (6 cards) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card
          onClick={() => setStatusTab('all')}
          className={`p-4 bg-slate-900 border cursor-pointer transition-all ${
            statusTab === 'all'
              ? 'border-amber-500 shadow-md bg-amber-500/5'
              : 'border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Total Extracted
            </span>
            <FileText className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-white mt-2">{metrics.total || 0}</div>
          <p className="text-[10px] text-slate-500 mt-1">Emails in workspace</p>
        </Card>

        <Card
          onClick={() => setStatusTab('all')}
          className="p-4 bg-slate-900 border border-slate-800 hover:border-slate-700 cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">
              CRM Matched
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 mt-2">{metrics.matched || 0}</div>
          <p className="text-[10px] text-slate-500 mt-1">Linked to company</p>
        </Card>

        <Card
          onClick={() => setStatusTab('needs_review')}
          className={`p-4 bg-slate-900 border cursor-pointer transition-all ${
            statusTab === 'needs_review'
              ? 'border-amber-500 shadow-md bg-amber-500/5'
              : 'border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider">
              Needs Review
            </span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-400 mt-2">{metrics.needs_review || 0}</div>
          <p className="text-[10px] text-slate-500 mt-1">Fuzzy or unverified</p>
        </Card>

        <Card
          onClick={() => setStatusTab('unmatched')}
          className={`p-4 bg-slate-900 border cursor-pointer transition-all ${
            statusTab === 'unmatched'
              ? 'border-rose-500 shadow-md bg-rose-500/5'
              : 'border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-rose-400 uppercase tracking-wider">
              Unmatched
            </span>
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-bold text-rose-400 mt-2">{metrics.unmatched || 0}</div>
          <p className="text-[10px] text-slate-500 mt-1">Manual link required</p>
        </Card>

        <Card
          onClick={() => setStatusTab('approved')}
          className={`p-4 bg-slate-900 border cursor-pointer transition-all ${
            statusTab === 'approved'
              ? 'border-emerald-500 shadow-md bg-emerald-500/5'
              : 'border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">
              Approved
            </span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 mt-2">{metrics.approved || 0}</div>
          <p className="text-[10px] text-slate-500 mt-1">Ready for dispatch</p>
        </Card>

        <Card
          onClick={() => setStatusTab('ready')}
          className={`p-4 bg-slate-900 border cursor-pointer transition-all ${
            statusTab === 'ready'
              ? 'border-amber-500 shadow-md bg-amber-500/10'
              : 'border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-amber-300 uppercase tracking-wider">
              Campaign Ready
            </span>
            <Send className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-300 mt-2">{metrics.ready || 0}</div>
          <p className="text-[10px] text-slate-500 mt-1">Approved & contact set</p>
        </Card>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setStatusTab('all')}
            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
              statusTab === 'all'
                ? 'bg-amber-600 text-white font-semibold'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            All Emails ({drafts.length})
          </button>
          <button
            onClick={() => setStatusTab('ready')}
            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
              statusTab === 'ready'
                ? 'bg-amber-600 text-white font-semibold'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            Ready to Send ({metrics.ready || 0})
          </button>
          <button
            onClick={() => setStatusTab('needs_review')}
            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
              statusTab === 'needs_review'
                ? 'bg-amber-600 text-white font-semibold'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            Needs Review ({metrics.needs_review || 0})
          </button>
          <button
            onClick={() => setStatusTab('unmatched')}
            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
              statusTab === 'unmatched'
                ? 'bg-amber-600 text-white font-semibold'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            Unmatched ({metrics.unmatched || 0})
          </button>
          <button
            onClick={() => setStatusTab('approved')}
            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
              statusTab === 'approved'
                ? 'bg-amber-600 text-white font-semibold'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            Approved ({metrics.approved || 0})
          </button>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search company, contact, subject..."
            className="pl-8 h-8 text-xs bg-slate-950 border-slate-700 text-white focus:border-amber-500"
          />
        </div>
      </div>

      {/* Bulk Action Bar (when rows are selected) */}
      {selectedDraftIds.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-amber-500/10 border border-amber-500/30 p-3 px-4 rounded-xl animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-amber-200">
              {selectedDraftIds.size} of {filteredDrafts.length} emails selected
            </span>
            <button
              onClick={toggleSelectAll}
              className="text-xs text-amber-400 hover:underline"
            >
              {selectedDraftIds.size === filteredDrafts.length ? 'Deselect all' : 'Select all'}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleBulkApprove}
              className="h-8 text-xs border-amber-500/40 text-amber-300 hover:bg-amber-500/20"
            >
              <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-400" />
              Bulk Approve Selected
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleBulkAttachBrochure}
              className="h-8 text-xs border-amber-500/40 text-amber-300 hover:bg-amber-500/20"
            >
              <Paperclip className="w-3.5 h-3.5 mr-1 text-amber-400" />
              Attach MineTech Brochure
            </Button>

            <Button
              size="sm"
              onClick={() => setIsCampaignModalOpen(true)}
              className="h-8 text-xs bg-amber-600 hover:bg-amber-500 text-white font-semibold shadow"
            >
              <Send className="w-3.5 h-3.5 mr-1" />
              Launch Campaign ({selectedDraftIds.size})
            </Button>
          </div>
        </div>
      )}

      {/* Main Outreach Table */}
      <Card className="bg-slate-900 border-slate-800 shadow-xl overflow-hidden">
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-amber-500 mb-2" />
            <p className="text-sm font-medium">Loading email workspace...</p>
          </div>
        ) : filteredDrafts.length === 0 ? (
          <div className="py-20 text-center text-slate-400 space-y-3">
            <FileText className="w-10 h-10 text-slate-600 mx-auto" />
            <div>
              <p className="text-base font-semibold text-slate-200">No emails match the current view</p>
              <p className="text-xs text-slate-400 mt-1">
                {drafts.length === 0
                  ? 'Upload a PDF or Word document with personalized emails to start.'
                  : 'Try clearing your search query or switching tabs.'}
              </p>
            </div>
            {drafts.length === 0 && (
              <Button
                onClick={() => setIsUploadOpen(true)}
                className="bg-amber-600 hover:bg-amber-500 text-white text-xs mt-2"
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
                <tr className="border-b border-slate-800 bg-slate-950/80 text-slate-400 uppercase tracking-wider text-[11px] font-semibold">
                  <th className="py-3 px-4 w-10">
                    <input
                      type="checkbox"
                      checked={selectedDraftIds.size > 0 && selectedDraftIds.size === filteredDrafts.length}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                    />
                  </th>
                  <th className="py-3 px-4">Company & CRM Match</th>
                  <th className="py-3 px-4">Target Contact(s)</th>
                  <th className="py-3 px-4">Email Preview</th>
                  <th className="py-3 px-4">Docs</th>
                  <th className="py-3 px-4">Match Status</th>
                  <th className="py-3 px-4">Approval</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 text-slate-300">
                {filteredDrafts.map((draft, idx) => {
                  const isSelected = selectedDraftIds.has(draft.id);
                  const matchedLead = draft.matched_lead;
                  const allContacts = draft.all_company_contacts || [];
                  const selectedContacts = draft.selected_contacts || [];
                  const primaryContact = selectedContacts.find((c) => c.is_primary) || selectedContacts[0] || allContacts[0];
                  const attachmentsCount = Array.isArray(draft.assigned_attachments) ? draft.assigned_attachments.length : 0;

                  return (
                    <tr
                      key={draft.id}
                      className={`hover:bg-slate-800/50 transition-colors ${
                        isSelected ? 'bg-amber-500/5' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3.5 px-4">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectOne(draft.id)}
                          className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                        />
                      </td>

                      {/* Company & CRM Match */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-white">
                              {draft.extracted_company || matchedLead?.company_name || 'Unspecified Company'}
                            </span>
                          </div>

                          {matchedLead ? (
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                              <Building className="w-3 h-3 text-emerald-400" />
                              <span className="text-emerald-300/90 font-medium">
                                CRM: {matchedLead.company_name}
                              </span>
                              {matchedLead.country && <span>({matchedLead.country})</span>}
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-[11px] text-rose-400">
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
                            <div className="flex items-center gap-1.5 font-medium text-slate-200">
                              <User className="w-3 h-3 text-amber-400" />
                              <span>{primaryContact.name || 'Unnamed'}</span>
                              {selectedContacts.length > 1 && (
                                <span className="text-[10px] px-1 rounded bg-slate-700 text-slate-300">
                                  +{selectedContacts.length - 1} CC
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-400">{primaryContact.email}</p>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-500 italic">No contact set</span>
                        )}
                      </td>

                      {/* Email Preview */}
                      <td className="py-3.5 px-4 max-w-md">
                        <div className="space-y-1">
                          <p className="font-medium text-slate-200 truncate">
                            {draft.edited_subject || draft.extracted_subject || '(No subject line)'}
                          </p>
                          <p className="text-[11px] text-slate-400 line-clamp-1">
                            {draft.edited_body_plain || draft.extracted_body_plain}
                          </p>
                        </div>
                      </td>

                      {/* Attachments */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {attachmentsCount > 0 ? (
                          <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 text-[11px] font-medium flex items-center gap-1 w-fit">
                            <Paperclip className="w-3 h-3" />
                            {attachmentsCount} {attachmentsCount === 1 ? 'doc' : 'docs'}
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-500">—</span>
                        )}
                      </td>

                      {/* Match Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {draft.match_status === 'matched' ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-semibold">
                            Matched
                          </span>
                        ) : draft.match_status === 'needs_review' ? (
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-semibold">
                            Needs Review
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-semibold">
                            Unmatched
                          </span>
                        )}
                      </td>

                      {/* Approval Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {draft.approval_status === 'approved' ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-semibold flex items-center gap-1 w-fit">
                            <CheckCircle2 className="w-3 h-3" />
                            Approved
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-semibold flex items-center gap-1 w-fit">
                            <Clock className="w-3 h-3" />
                            Pending Review
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
                            className="h-7 text-xs border-slate-700 text-slate-200 hover:bg-slate-800 hover:text-white"
                          >
                            <Edit3 className="w-3 h-3 mr-1" />
                            Review & Edit
                          </Button>

                          {!matchedLead && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setRematchDraft(draft)}
                              className="h-7 text-xs text-amber-400 hover:bg-amber-500/10"
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

      {/* Campaign Creation / 1-Click Send Modal */}
      <CreatePersonalizedCampaignModal
        isOpen={isCampaignModalOpen}
        onClose={() => setIsCampaignModalOpen(false)}
        selectedDrafts={selectedDraftsList}
        batchId={activeBatch?.id}
        onCampaignCreated={() => {
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
    </div>
  );
}
