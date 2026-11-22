'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Paperclip,
  Upload,
  FileText,
  Check,
  X,
  Loader2,
  Trash2,
  FolderOpen,
  Edit2,
  Eye,
  AlertTriangle,
  FileCheck,
  Info,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  ExternalLink,
  ShieldCheck,
  FileSpreadsheet,
  FileImage,
  FileCode,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export default function AttachFilesModal({
  isOpen,
  onClose,
  totalDraftsCount = 0,
  selectedDraftsCount = 0,
  selectedDraftIds = [],
  currentDraftId = null,
  initialScope = null,
  onAttachmentsApplied,
  campaignId = null,
}) {
  const [activeTab, setActiveTab] = useState('attach'); // 'attach' | 'library'
  const [documents, setDocuments] = useState([]);
  const [recentlyUsed, setRecentlyUsed] = useState([]);
  const [selectedDocs, setSelectedDocs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all' | 'pdf' | 'office' | 'images'
  const [attachMode, setAttachMode] = useState('append'); // 'append' | 'replace'

  // Determine initial scope
  const defaultScope = currentDraftId
    ? 'individual'
    : (selectedDraftIds && selectedDraftIds.length > 0 ? 'selected' : 'all');
  const [attachmentScope, setAttachmentScope] = useState(initialScope || defaultScope);

  // Confirmation modal for Attach to All / Bulk
  const [isConfirmAllOpen, setIsConfirmAllOpen] = useState(false);

  // Preview state
  const [previewDoc, setPreviewDoc] = useState(null);

  // Rename & Delete state in library tab
  const [editingDocId, setEditingDocId] = useState(null);
  const [editingDocName, setEditingDocName] = useState('');
  const [docToDelete, setDocToDelete] = useState(null);
  const [deletingDoc, setDeletingDoc] = useState(false);

  const fileInputRef = useRef(null);

  const fetchDocuments = async () => {
    try {
      const res = await fetch('/api/email/workspace/documents');
      const data = await res.json();
      if (data.success && data.documents) {
        setDocuments(data.documents);
        if (Array.isArray(data.recentlyUsed)) {
          setRecentlyUsed(data.recentlyUsed);
        }
      }
    } catch (e) {
      console.error('Failed to load documents:', e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchDocuments();
      if (initialScope) {
        setAttachmentScope(initialScope);
      } else if (currentDraftId) {
        setAttachmentScope('individual');
      } else if (selectedDraftIds && selectedDraftIds.length > 0) {
        setAttachmentScope('selected');
      } else {
        setAttachmentScope('all');
      }
    }
  }, [isOpen, currentDraftId, initialScope, selectedDraftIds]);

  if (!isOpen) return null;

  // Toggle selection of document
  const toggleDocSelection = (doc) => {
    setSelectedDocs((prev) => {
      const exists = prev.some((d) => d.id === doc.id || (d.fileName && d.fileName === doc.fileName));
      if (exists) {
        return prev.filter((d) => d.id !== doc.id && d.fileName !== doc.fileName);
      } else {
        return [...prev, doc];
      }
    });
  };

  // Quick 1-click attach from recently used
  const handleQuickAttachRecent = (doc) => {
    if (!selectedDocs.some((d) => d.id === doc.id)) {
      setSelectedDocs((prev) => [doc, ...prev]);
      toast.success(`Selected "${doc.name}"`);
    } else {
      setSelectedDocs((prev) => prev.filter((d) => d.id !== doc.id));
    }
  };

  // Upload local file from computer
  const handleLocalFileUpload = async (file) => {
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      toast.error('File size exceeds the 25 MB limit.');
      return;
    }

    const ext = (file.name.split('.').pop() || '').toLowerCase();
    const disallowed = ['exe', 'bat', 'cmd', 'sh', 'php', 'js', 'mjs', 'vbs', 'bin', 'msi', 'dll', 'py'];
    if (disallowed.includes(ext)) {
      toast.error(`Files with .${ext} extension are prohibited for security.`);
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('name', file.name.replace(/\.[^/.]+$/, ''));
      formData.append('category', 'Custom Uploads');

      const res = await fetch('/api/email/workspace/documents', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'File upload failed');
      }

      toast.success(`Uploaded and selected "${file.name}"!`);
      const newDoc = data.document;
      setDocuments((prev) => [newDoc, ...prev]);
      setSelectedDocs((prev) => {
        if (!prev.some((d) => d.id === newDoc.id)) {
          return [newDoc, ...prev];
        }
        return prev;
      });
      if (data.recentlyUsed) setRecentlyUsed(data.recentlyUsed);
    } catch (err) {
      toast.error(err.message || 'Failed to upload attachment');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleLocalFileUpload(files[0]);
    }
  };

  // Rename document in library
  const handleStartRename = (doc, e) => {
    e.stopPropagation();
    setEditingDocId(doc.id);
    setEditingDocName(doc.name);
  };

  const handleSaveRename = async (id, e) => {
    e?.stopPropagation();
    if (!editingDocName.trim()) return;

    try {
      const res = await fetch('/api/email/workspace/documents', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name: editingDocName.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message);

      toast.success('Document renamed');
      setDocuments(data.documents || []);
      setSelectedDocs((prev) =>
        prev.map((d) => (d.id === id ? { ...d, name: editingDocName.trim() } : d))
      );
      setEditingDocId(null);
    } catch (err) {
      toast.error(err.message || 'Failed to rename document');
    }
  };

  // Delete document from library
  const handleConfirmDelete = async () => {
    if (!docToDelete) return;
    setDeletingDoc(true);

    try {
      const res = await fetch(`/api/email/workspace/documents?id=${docToDelete.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message);

      toast.success(`Removed "${docToDelete.name}" from document library`);
      setDocuments(data.documents || []);
      setSelectedDocs((prev) => prev.filter((d) => d.id !== docToDelete.id));
      setDocToDelete(null);
    } catch (err) {
      toast.error(err.message || 'Failed to delete document');
    } finally {
      setDeletingDoc(false);
    }
  };

  // Apply attachments to emails
  const executeApplyAttachments = async () => {
    if (selectedDocs.length === 0) {
      toast.error('Please select or upload at least one file to attach.');
      return;
    }

    setLoading(true);
    try {
      const isAll = attachmentScope === 'all';
      const isSelected = attachmentScope === 'selected';
      const isIndividual = attachmentScope === 'individual' && currentDraftId;

      // Handle Campaign Recipients scope if campaignId is provided
      if (campaignId) {
        const targetRecipientIds = isAll
          ? undefined
          : (isIndividual ? [currentDraftId] : (selectedDraftIds && selectedDraftIds.length > 0 ? selectedDraftIds : undefined));

        const res = await fetch(`/api/email/campaigns/${campaignId}/recipients`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'bulk_attachments',
            applyToAll: isAll,
            recipientIds: targetRecipientIds,
            attachments: selectedDocs,
            mode: attachMode,
          }),
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.message || 'Failed to apply attachments to campaign');
        }

        toast.success(
          isIndividual
            ? `Attached ${selectedDocs.length} file(s) to this recipient!`
            : isSelected
            ? `Attached ${selectedDocs.length} file(s) to ${selectedDraftIds.length} selected recipients!`
            : `Attached ${selectedDocs.length} file(s) to all campaign recipients!`
        );

        onAttachmentsApplied?.(data, selectedDocs);
        setIsConfirmAllOpen(false);
        onClose();
        return;
      }

      // Workspace batch attachment application
      const targetDraftIds = isAll
        ? 'all'
        : (isIndividual ? [currentDraftId] : selectedDraftIds);

      const res = await fetch('/api/email/workspace', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'bulk_attachments',
          applyToAll: isAll,
          draftIds: targetDraftIds,
          attachments: selectedDocs,
          mode: attachMode,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to apply attachments');
      }

      const totalTargetCount = isAll
        ? (totalDraftsCount || data.drafts?.length || 24)
        : (isIndividual ? 1 : selectedDraftIds.length);

      toast.success(
        isIndividual
          ? `Attached ${selectedDocs.length} file(s) to this email!`
          : isSelected
          ? `Attached ${selectedDocs.length} file(s) to all ${totalTargetCount} selected emails!`
          : `Attached ${selectedDocs.length} file(s) across all ${totalTargetCount} emails in workspace!`
      );

      onAttachmentsApplied?.(data.drafts, selectedDocs);
      setIsConfirmAllOpen(false);
      onClose();
    } catch (err) {
      toast.error(err.message || 'Error applying attachments');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyClick = () => {
    if (selectedDocs.length === 0) {
      toast.error('Please select or upload at least one file to attach.');
      return;
    }

    // If applying to ALL emails or a large selection, show confirmation dialog first
    if (attachmentScope === 'all') {
      setIsConfirmAllOpen(true);
    } else {
      executeApplyAttachments();
    }
  };

  // Helper for file type icons
  const getFileIcon = (doc) => {
    const type = (doc.fileType || '').toLowerCase();
    const name = (doc.fileName || doc.name || '').toLowerCase();
    if (type.includes('pdf') || name.endsWith('.pdf')) {
      return <FileText className="w-4 h-4 text-rose-500" />;
    }
    if (type.includes('word') || name.endsWith('.doc') || name.endsWith('.docx')) {
      return <FileText className="w-4 h-4 text-blue-500" />;
    }
    if (type.includes('sheet') || type.includes('excel') || name.endsWith('.xls') || name.endsWith('.xlsx')) {
      return <FileSpreadsheet className="w-4 h-4 text-emerald-500" />;
    }
    if (type.includes('image') || name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.jpeg')) {
      return <FileImage className="w-4 h-4 text-purple-500" />;
    }
    return <FileCode className="w-4 h-4 text-slate-400" />;
  };

  // Filtered documents for browser
  const filteredDocs = documents.filter((doc) => {
    const q = searchQuery.toLowerCase().trim();
    if (q) {
      const name = (doc.name || '').toLowerCase();
      const fileName = (doc.fileName || '').toLowerCase();
      const cat = (doc.category || '').toLowerCase();
      if (!name.includes(q) && !fileName.includes(q) && !cat.includes(q)) return false;
    }
    if (filterType === 'all') return true;
    const type = (doc.fileType || '').toLowerCase();
    const name = (doc.fileName || doc.name || '').toLowerCase();
    if (filterType === 'pdf') return type.includes('pdf') || name.endsWith('.pdf');
    if (filterType === 'office') {
      return type.includes('word') || type.includes('sheet') || type.includes('excel') ||
             name.endsWith('.doc') || name.endsWith('.docx') || name.endsWith('.xls') || name.endsWith('.xlsx');
    }
    if (filterType === 'images') {
      return type.includes('image') || name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.jpeg');
    }
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <Card className="w-full max-w-4xl bg-card border-border text-foreground shadow-dialog flex flex-col max-h-[92vh] overflow-hidden rounded-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 px-6 border-b border-border bg-muted/20">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-primary/10 border border-primary/20 text-primary">
              <Paperclip className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-foreground">
                  Document Attachments
                </h3>
                <Badge variant="outline" className="text-[11px] bg-primary/5 text-primary border-primary/20 font-medium">
                  {selectedDocs.length} file{selectedDocs.length === 1 ? '' : 's'} selected
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Attach technical data sheets, brochures, and commercial terms to individual drafts, selected emails, or all {totalDraftsCount || 24} emails in workspace.
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

        {/* View Tabs */}
        <div className="flex items-center justify-between px-6 pt-3 border-b border-border bg-muted/10 text-xs">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('attach')}
              className={`px-3.5 py-2 font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === 'attach'
                  ? 'border-primary text-primary font-semibold'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Paperclip className="w-3.5 h-3.5" />
              Attach Files ({selectedDocs.length} chosen)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('library')}
              className={`px-3.5 py-2 font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === 'library'
                  ? 'border-primary text-primary font-semibold'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <FolderOpen className="w-3.5 h-3.5" />
              Manage Library ({documents.length} files)
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              window.open('/settings?section=attachments', '_blank');
            }}
            className="text-[11px] text-muted-foreground hover:text-primary flex items-center gap-1 pb-1"
            title="Open Central Attachment Manager in Settings"
          >
            <span>Central Manager</span>
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {activeTab === 'attach' ? (
            <>
              {/* Scope Selector: 3 Distinct Operations */}
              <div className="p-3.5 rounded-xl border border-border bg-muted/20 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                    1. Choose Attachment Target (Scope):
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Active Workspace Batch ({totalDraftsCount || 24} emails total)
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                  {/* A. Individual Email */}
                  <label
                    onClick={() => setAttachmentScope('individual')}
                    className={`p-3 rounded-lg border cursor-pointer flex flex-col justify-between transition-all ${
                      attachmentScope === 'individual'
                        ? 'border-primary bg-primary/10 text-foreground shadow-xs font-medium'
                        : 'border-border bg-card text-muted-foreground hover:border-border/80'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <input
                        type="radio"
                        name="scope"
                        checked={attachmentScope === 'individual'}
                        onChange={() => setAttachmentScope('individual')}
                        className="mt-0.5 accent-primary"
                      />
                      <div>
                        <span className="font-semibold text-foreground block">
                          Individual Email
                        </span>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {currentDraftId ? 'Apply only to currently opened draft.' : 'Target 1 specific email draft.'}
                        </p>
                      </div>
                    </div>
                  </label>

                  {/* B. Selected Emails */}
                  <label
                    onClick={() => setAttachmentScope('selected')}
                    className={`p-3 rounded-lg border cursor-pointer flex flex-col justify-between transition-all ${
                      attachmentScope === 'selected'
                        ? 'border-primary bg-primary/10 text-foreground shadow-xs font-medium'
                        : 'border-border bg-card text-muted-foreground hover:border-border/80'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <input
                        type="radio"
                        name="scope"
                        checked={attachmentScope === 'selected'}
                        onChange={() => setAttachmentScope('selected')}
                        className="mt-0.5 accent-primary"
                      />
                      <div>
                        <span className="font-semibold text-foreground block flex items-center gap-1">
                          Selected Emails
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-muted">
                            {selectedDraftIds?.length || 0}
                          </Badge>
                        </span>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Apply to all {selectedDraftIds?.length || 0} checked emails.
                        </p>
                      </div>
                    </div>
                  </label>

                  {/* C. All Emails in Workspace */}
                  <label
                    onClick={() => setAttachmentScope('all')}
                    className={`p-3 rounded-lg border cursor-pointer flex flex-col justify-between transition-all ${
                      attachmentScope === 'all'
                        ? 'border-primary bg-primary/10 text-foreground shadow-xs font-medium'
                        : 'border-border bg-card text-muted-foreground hover:border-border/80'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <input
                        type="radio"
                        name="scope"
                        checked={attachmentScope === 'all'}
                        onChange={() => setAttachmentScope('all')}
                        className="mt-0.5 accent-primary"
                      />
                      <div>
                        <span className="font-semibold text-foreground block flex items-center gap-1">
                          All Emails
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-primary/10 text-primary border-primary/20">
                            {totalDraftsCount || 24}
                          </Badge>
                        </span>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Apply across all {totalDraftsCount || 24} drafts in batch.
                        </p>
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Recently Used Files Quick-Access Bar (Loaded from Persistent Database) */}
              {recentlyUsed.length > 0 && (
                <div className="p-3.5 rounded-xl border border-border bg-muted/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-primary" />
                      Recently Used Files:
                    </span>
                    <span className="text-[10px] text-muted-foreground">Click file pill to quick-select</span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {recentlyUsed.slice(0, 6).map((doc) => {
                      const isSelected = selectedDocs.some((d) => d.id === doc.id);
                      return (
                        <button
                          key={doc.id}
                          type="button"
                          onClick={() => handleQuickAttachRecent(doc)}
                          className={`px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-2 border transition-all ${
                            isSelected
                              ? 'bg-primary text-primary-foreground border-primary font-medium shadow-xs'
                              : 'bg-card text-foreground border-border hover:border-primary/60'
                          }`}
                        >
                          {getFileIcon(doc)}
                          <span className="truncate max-w-[180px]">{doc.name || doc.fileName}</span>
                          <span className={`text-[10px] ${isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                            ({doc.fileSize})
                          </span>
                          {isSelected ? (
                            <Check className="w-3 h-3 ml-0.5" />
                          ) : (
                            <span className="text-[10px] text-primary font-bold">+</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Upload Drag & Drop Box */}
              <div>
                <span className="text-xs font-semibold text-foreground block mb-2">
                  2. Upload New File from Device:
                </span>
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all flex items-center justify-center gap-3 ${
                    isDragging
                      ? 'border-primary bg-primary/10 scale-[1.005]'
                      : 'border-border hover:border-primary/70 bg-muted/20 hover:bg-muted/40'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.docx,.doc,.xlsx,.xls,.png,.jpg,.jpeg,.webp"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.[0]) handleLocalFileUpload(e.target.files[0]);
                    }}
                    disabled={uploading}
                  />
                  {uploading ? (
                    <div className="flex items-center gap-2 text-xs text-primary">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Uploading file and saving permanently to library...</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <div className="p-2 rounded-lg bg-card border border-border text-primary shadow-xs">
                        <Upload className="w-4 h-4" />
                      </div>
                      <div className="text-left">
                        <p className="font-semibold text-foreground">Click to browse file or drag & drop here</p>
                        <p className="text-[11px] text-muted-foreground">PDF, DOCX, Excel, Images up to 25 MB max</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Selected Attachments Tray */}
              {selectedDocs.length > 0 && (
                <div className="p-3.5 rounded-xl border border-primary/30 bg-primary/5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-primary uppercase tracking-wider flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5" />
                      Files to Attach ({selectedDocs.length}):
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedDocs([])}
                      className="text-[11px] text-muted-foreground hover:text-foreground underline cursor-pointer"
                    >
                      Clear Selection
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {selectedDocs.map((doc, idx) => (
                      <div
                        key={idx}
                        className="px-2.5 py-1.5 rounded-lg bg-card border border-border text-foreground text-xs flex items-center gap-2 shadow-xs"
                      >
                        {getFileIcon(doc)}
                        <span className="font-medium truncate max-w-[200px]">{doc.name || doc.fileName}</span>
                        {doc.fileSize && <span className="text-[10px] text-muted-foreground font-mono">({doc.fileSize})</span>}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreviewDoc(doc);
                          }}
                          className="text-muted-foreground hover:text-primary ml-1"
                          title="Preview document"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleDocSelection(doc);
                          }}
                          className="text-muted-foreground hover:text-rose-500 ml-0.5"
                          title="Remove attachment from selection"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Attachment Mode: Append vs Replace */}
                  <div className="pt-2 border-t border-primary/10 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <span className="text-muted-foreground font-medium">Attachment Mode:</span>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="attachMode"
                          value="append"
                          checked={attachMode === 'append'}
                          onChange={() => setAttachMode('append')}
                          className="accent-primary"
                        />
                        <span className="font-medium text-foreground">
                          Append (preserve existing files, prevent duplicates)
                        </span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="attachMode"
                          value="replace"
                          checked={attachMode === 'replace'}
                          onChange={() => setAttachMode('replace')}
                          className="accent-primary"
                        />
                        <span className="text-muted-foreground">
                          Replace (overwrite previous attachments)
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* Document Library Browser */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground block">
                    3. Or Select from Document Library:
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {filteredDocs.length} available files
                  </span>
                </div>

                {/* Filter and Search Bar */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search brochures, TDS, COA by name..."
                      className="pl-8 h-8 text-xs"
                    />
                  </div>

                  <div className="flex items-center gap-1 overflow-x-auto text-xs">
                    {['all', 'pdf', 'office', 'images'].map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setFilterType(t)}
                        className={`px-2.5 py-1 rounded text-[11px] font-medium border capitalize ${
                          filterType === t
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-card text-muted-foreground border-border hover:bg-muted/40'
                        }`}
                      >
                        {t === 'all' ? 'All' : t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Document Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[260px] overflow-y-auto p-1">
                  {filteredDocs.map((doc) => {
                    const isSelected = selectedDocs.some(
                      (d) => d.id === doc.id || (d.fileName && d.fileName === doc.fileName)
                    );
                    const usageCount = doc.usage?.activeDraftsCount || 0;

                    return (
                      <div
                        key={doc.id}
                        onClick={() => toggleDocSelection(doc)}
                        className={`p-3 rounded-xl border text-left cursor-pointer transition-all flex flex-col justify-between ${
                          isSelected
                            ? 'border-primary bg-primary/10 shadow-xs'
                            : 'border-border bg-card hover:border-primary/50 hover:bg-muted/30'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2.5 min-w-0">
                            <div className="p-2 rounded-lg bg-muted/60 border border-border shrink-0 mt-0.5">
                              {getFileIcon(doc)}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-foreground truncate">
                                {doc.name || doc.fileName}
                              </p>
                              <p className="text-[11px] text-muted-foreground truncate font-mono">
                                {doc.fileName}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] text-muted-foreground font-mono">
                                  {doc.fileSize || '1.0 MB'}
                                </span>
                                {usageCount > 0 && (
                                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                                    In {usageCount} draft{usageCount > 1 ? 's' : ''}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPreviewDoc(doc);
                              }}
                              className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted"
                              title="Preview document"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <div
                              className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                                isSelected
                                  ? 'bg-primary border-primary text-primary-foreground'
                                  : 'border-border bg-background'
                              }`}
                            >
                              {isSelected && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            /* Manage Library Tab */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-foreground">
                    Document Library Asset Management
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Rename titles, preview documents, or remove obsolete collateral permanently.
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs h-8 gap-1.5 bg-primary text-primary-foreground"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Upload Document
                </Button>
              </div>

              <div className="border border-border rounded-xl bg-card overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-muted-foreground uppercase text-[11px] font-semibold">
                      <th className="py-2.5 px-3">Document Title</th>
                      <th className="py-2.5 px-3">Origin</th>
                      <th className="py-2.5 px-3">Size</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {documents.map((doc) => (
                      <tr key={doc.id} className="hover:bg-muted/30">
                        <td className="py-3 px-3">
                          {editingDocId === doc.id ? (
                            <div className="flex items-center gap-1.5">
                              <Input
                                value={editingDocName}
                                onChange={(e) => setEditingDocName(e.target.value)}
                                className="h-7 text-xs"
                                autoFocus
                              />
                              <Button
                                size="sm"
                                onClick={(e) => handleSaveRename(doc.id, e)}
                                className="h-7 px-2 text-xs"
                              >
                                Save
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setEditingDocId(null)}
                                className="h-7 px-2 text-xs"
                              >
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              {getFileIcon(doc)}
                              <div>
                                <span className="font-semibold text-foreground block">
                                  {doc.name || doc.fileName}
                                </span>
                                <span className="text-[10px] text-muted-foreground font-mono">
                                  {doc.fileName}
                                </span>
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          {doc.isCustom ? (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold">
                              Custom
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-semibold">
                              Default
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 font-mono text-muted-foreground">
                          {doc.fileSize}
                        </td>
                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setPreviewDoc(doc)}
                              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                            >
                              <Eye className="w-3.5 h-3.5 mr-1" />
                              Preview
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => handleStartRename(doc, e)}
                              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                            >
                              <Edit2 className="w-3.5 h-3.5 mr-1" />
                              Rename
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDocToDelete(doc)}
                              className="h-7 px-2 text-xs text-muted-foreground hover:text-rose-500"
                            >
                              <Trash2 className="w-3.5 h-3.5 mr-1" />
                              Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 px-6 border-t border-border bg-muted/20 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Target:</span>
            {attachmentScope === 'individual' ? (
              <span className="font-semibold text-foreground">1 Individual Email</span>
            ) : attachmentScope === 'selected' ? (
              <span className="font-semibold text-primary">{selectedDraftIds?.length || 0} Selected Emails</span>
            ) : (
              <span className="font-semibold text-foreground">All {totalDraftsCount || 24} Emails in Workspace</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="text-xs"
            >
              Cancel
            </Button>

            <Button
              size="sm"
              onClick={handleApplyClick}
              disabled={loading || selectedDocs.length === 0}
              className="text-xs bg-primary text-primary-foreground hover:bg-primary/90 font-medium px-4 gap-1.5"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Applying Attachments...
                </>
              ) : (
                <>
                  <Paperclip className="w-3.5 h-3.5" />
                  {attachmentScope === 'individual'
                    ? `Attach ${selectedDocs.length} File(s) to This Email`
                    : attachmentScope === 'selected'
                    ? `Attach ${selectedDocs.length} File(s) to ${selectedDraftIds?.length || 0} Selected Emails`
                    : `Attach ${selectedDocs.length} File(s) to All ${totalDraftsCount || 24} Emails`}
                </>
              )}
            </Button>
          </div>
        </div>
      </Card>

      {/* Confirmation Modal for Attach to All / Bulk */}
      {isConfirmAllOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <Card className="w-full max-w-md bg-card border-border shadow-dialog p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-lg bg-primary/10 border border-primary/20 text-primary shrink-0">
                <Paperclip className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-foreground">
                  Confirm Workspace-Wide Attachment
                </h3>
                <p className="text-xs text-muted-foreground">
                  You are about to attach <strong>{selectedDocs.length} document(s)</strong> across all <strong>{totalDraftsCount || 24} email drafts</strong> in this workspace.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-muted/40 border border-border text-xs space-y-1.5">
              <span className="font-semibold text-foreground block">Files to be attached:</span>
              <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                {selectedDocs.map((d, i) => (
                  <li key={i} className="truncate">
                    {d.name || d.fileName} ({d.fileSize})
                  </li>
                ))}
              </ul>
              <p className="text-[11px] text-muted-foreground pt-1 border-t border-border mt-2">
                Mode: <strong>{attachMode === 'append' ? 'Append (deduplicated)' : 'Replace existing'}</strong>.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsConfirmAllOpen(false)}
                className="text-xs"
              >
                Back to Selection
              </Button>
              <Button
                size="sm"
                onClick={executeApplyAttachments}
                disabled={loading}
                className="text-xs bg-primary text-primary-foreground font-medium"
              >
                {loading ? 'Applying...' : `Confirm & Apply to All ${totalDraftsCount || 24} Emails`}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Delete Confirmation in Library Tab */}
      {docToDelete && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <Card className="w-full max-w-md bg-card border-border shadow-dialog p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-rose-500/10 text-rose-500 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Remove &quot;{docToDelete.name}&quot; from Library?
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  This file will be permanently removed from your library. If it is attached to active drafts, it will be detached safely.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDocToDelete(null)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleConfirmDelete}
                disabled={deletingDoc}
                className="text-xs bg-rose-600 hover:bg-rose-500 text-white"
              >
                {deletingDoc ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Document Preview Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <Card className="w-full max-w-3xl bg-card border-border text-foreground shadow-dialog flex flex-col h-[80vh] overflow-hidden rounded-xl">
            <div className="p-4 px-6 border-b border-border bg-muted/20 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                {getFileIcon(previewDoc)}
                <div>
                  <h4 className="text-sm font-semibold text-foreground truncate">
                    {previewDoc.name || previewDoc.fileName}
                  </h4>
                  <p className="text-xs text-muted-foreground font-mono">
                    {previewDoc.fileName} &bull; {previewDoc.fileSize}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPreviewDoc(null)}
                className="p-1 rounded text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 bg-muted/20 p-4 overflow-hidden flex items-center justify-center">
              {previewDoc.dataBase64 ? (
                previewDoc.fileType?.includes('image') ? (
                  <img
                    src={`data:${previewDoc.fileType || 'image/png'};base64,${previewDoc.dataBase64}`}
                    alt={previewDoc.name}
                    className="max-h-full max-w-full object-contain rounded shadow"
                  />
                ) : (
                  <iframe
                    src={`data:application/pdf;base64,${previewDoc.dataBase64}#toolbar=0`}
                    title={previewDoc.name}
                    className="w-full h-full rounded border border-border bg-white"
                  />
                )
              ) : previewDoc.url ? (
                <iframe
                  src={previewDoc.url}
                  title={previewDoc.name}
                  className="w-full h-full rounded border border-border bg-white"
                />
              ) : (
                <div className="text-center p-6 text-muted-foreground space-y-2">
                  <FileText className="w-10 h-10 mx-auto text-muted-foreground/40" />
                  <p className="text-xs">Document preview not stored locally.</p>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
