'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Paperclip,
  Upload,
  FileText,
  Check,
  X,
  Loader2,
  Sparkles,
  Trash2,
  FolderOpen,
  Edit2,
  Eye,
  AlertTriangle,
  FileCheck,
  Info
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
  onAttachmentsApplied,
  campaignId = null,
}) {
  const [activeTab, setActiveTab] = useState('attach'); // 'attach' | 'library'
  const [documents, setDocuments] = useState([]);
  const [selectedDocs, setSelectedDocs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [attachMode, setAttachMode] = useState('append'); // 'append' | 'replace'
  const [attachmentScope, setAttachmentScope] = useState(currentDraftId ? 'individual' : 'campaign'); // 'individual' | 'campaign'

  // Renaming state
  const [editingDocId, setEditingDocId] = useState(null);
  const [editingDocName, setEditingDocName] = useState('');

  // Deleting confirmation state
  const [docToDelete, setDocToDelete] = useState(null);
  const [deletingDoc, setDeletingDoc] = useState(false);

  // Preview state
  const [previewDoc, setPreviewDoc] = useState(null);

  const fileInputRef = useRef(null);

  const fetchDocuments = async () => {
    try {
      const res = await fetch('/api/email/workspace/documents');
      const data = await res.json();
      if (data.success && data.documents) {
        setDocuments(data.documents);
      }
    } catch (e) {
      console.error('Failed to load documents:', e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchDocuments();
      if (currentDraftId) {
        setAttachmentScope('individual');
      } else {
        setAttachmentScope('campaign');
      }
    }
  }, [isOpen, currentDraftId]);

  if (!isOpen) return null;

  // Toggle selection of document from library
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

  // Upload local file from computer
  const handleLocalFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      toast.error('File size exceeds the 25 MB limit.');
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

      toast.success(`Uploaded and attached "${file.name}"!`);
      const newDoc = data.document;
      setDocuments((prev) => [newDoc, ...prev]);
      setSelectedDocs((prev) => {
        if (!prev.some((d) => d.id === newDoc.id)) {
          return [newDoc, ...prev];
        }
        return prev;
      });
    } catch (err) {
      toast.error(err.message || 'Failed to upload attachment');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Rename document
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
  const handleApplyAttachments = async () => {
    if (selectedDocs.length === 0) {
      toast.error('Please select or upload at least one file to attach.');
      return;
    }

    setLoading(true);
    try {
      const isAll = attachmentScope === 'campaign';
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
            ? `Attached ${selectedDocs.length} file(s) to recipient!`
            : `Attached ${selectedDocs.length} file(s) to all campaign recipients!`
        );

        onAttachmentsApplied?.(data, selectedDocs);
        onClose();
        return;
      }

      const targetDraftIds = isAll
        ? undefined
        : (isIndividual ? [currentDraftId] : (selectedDraftIds && selectedDraftIds.length > 0 ? selectedDraftIds : undefined));

      const res = await fetch('/api/email/workspace', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'bulk_attachments',
          applyToAll: isAll || (!currentDraftId && (!selectedDraftIds || selectedDraftIds.length === 0)),
          draftIds: isAll ? 'all' : targetDraftIds,
          attachments: selectedDocs,
          mode: attachMode,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to apply attachments');
      }

      toast.success(
        isIndividual
          ? `Attached ${selectedDocs.length} file(s) to this email!`
          : `Attached ${selectedDocs.length} file(s) to all ${totalDraftsCount || data.drafts?.length || 24} emails in workspace!`
      );

      onAttachmentsApplied?.(data.drafts, selectedDocs);
      onClose();
    } catch (err) {
      toast.error(err.message || 'Error applying attachments');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <Card className="w-full max-w-3xl bg-card border-border text-foreground shadow-dialog flex flex-col max-h-[90vh] overflow-hidden rounded-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 px-6 border-b border-border bg-muted/20">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-primary/10 border border-primary/20 text-primary">
              <Paperclip className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">
                Document Library & Attachment Manager
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Attach technical data sheets, brochures, and commercial terms to individual emails or entire campaign
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
        <div className="flex items-center gap-1 px-6 pt-3 border-b border-border bg-muted/10 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('attach')}
            className={`px-3 py-1.5 font-medium border-b-2 transition-colors ${
              activeTab === 'attach'
                ? 'border-primary text-primary font-semibold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Attach Files ({selectedDocs.length} selected)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('library')}
            className={`px-3 py-1.5 font-medium border-b-2 transition-colors ${
              activeTab === 'library'
                ? 'border-primary text-primary font-semibold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Manage Library ({documents.length} files)
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {activeTab === 'attach' ? (
            <>
              {/* Attachment Scope Selector */}
              <div className="p-3.5 rounded-xl border border-border bg-muted/20 space-y-2">
                <span className="text-xs font-semibold text-foreground block">
                  Attachment Scope:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <label
                    onClick={() => setAttachmentScope('individual')}
                    className={`p-2.5 rounded-lg border cursor-pointer flex items-start gap-2.5 transition-all ${
                      attachmentScope === 'individual'
                        ? 'border-primary/60 bg-primary/10 text-foreground font-medium'
                        : 'border-border bg-card text-muted-foreground hover:border-border/80'
                    }`}
                  >
                    <input
                      type="radio"
                      name="scope"
                      checked={attachmentScope === 'individual'}
                      onChange={() => setAttachmentScope('individual')}
                      className="mt-0.5 accent-primary"
                    />
                    <div>
                      <span className="font-semibold text-foreground block">Individual Email</span>
                      <p className="text-[11px] text-muted-foreground">Attach selected files only to this draft.</p>
                    </div>
                  </label>

                  <label
                    onClick={() => setAttachmentScope('campaign')}
                    className={`p-2.5 rounded-lg border cursor-pointer flex items-start gap-2.5 transition-all ${
                      attachmentScope === 'campaign'
                        ? 'border-primary/60 bg-primary/10 text-foreground font-medium'
                        : 'border-border bg-card text-muted-foreground hover:border-border/80'
                    }`}
                  >
                    <input
                      type="radio"
                      name="scope"
                      checked={attachmentScope === 'campaign'}
                      onChange={() => setAttachmentScope('campaign')}
                      className="mt-0.5 accent-primary"
                    />
                    <div>
                      <span className="font-semibold text-foreground block">Entire Campaign</span>
                      <p className="text-[11px] text-muted-foreground">Apply selected files across all campaign emails.</p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Upload Box */}
              <div>
                <span className="text-xs font-semibold text-foreground block mb-2">
                  Upload File from Device:
                </span>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border border-dashed border-border hover:border-primary/70 rounded-xl p-4 text-center cursor-pointer transition-all bg-muted/20 hover:bg-muted/40 flex items-center justify-center gap-3"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.docx,.doc,.xlsx,.xls,.png,.jpg,.jpeg"
                    className="hidden"
                    onChange={handleLocalFileUpload}
                    disabled={uploading}
                  />
                  {uploading ? (
                    <div className="flex items-center gap-2 text-xs text-primary">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Uploading file and saving to library...</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
                      <div className="p-2 rounded-lg bg-card border border-border text-primary">
                        <Upload className="w-4 h-4" />
                      </div>
                      <div className="text-left">
                        <p className="font-semibold text-foreground">Click to browse file from your device</p>
                        <p className="text-[11px] text-muted-foreground">PDF, DOCX, Excel, Images up to 25 MB</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Currently Selected Files */}
              {selectedDocs.length > 0 && (
                <div className="p-3.5 rounded-xl border border-primary/30 bg-primary/5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-primary uppercase tracking-wider">
                      Selected Attachments ({selectedDocs.length}):
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedDocs([])}
                      className="text-[10px] text-muted-foreground hover:text-foreground"
                    >
                      Clear Selection
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedDocs.map((doc, idx) => (
                      <div
                        key={idx}
                        className="px-2.5 py-1 rounded-md bg-card border border-border text-foreground text-xs flex items-center gap-2 shadow-xs"
                      >
                        <FileText className="w-3.5 h-3.5 text-primary" />
                        <span className="font-medium">{doc.name || doc.fileName}</span>
                        {doc.fileSize && <span className="text-[10px] text-muted-foreground">({doc.fileSize})</span>}
                        <button
                          type="button"
                          onClick={() => toggleDocSelection(doc)}
                          className="text-muted-foreground hover:text-rose-400 ml-1"
                          title="Remove attachment from selection"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Document Library Selection Catalog */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-foreground block">
                  Select from Saved Document Library:
                </span>
                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                  {documents.map((doc) => {
                    const isSelected = selectedDocs.some((d) => d.id === doc.id || (d.fileName && d.fileName === doc.fileName));
                    return (
                      <div
                        key={doc.id}
                        onClick={() => toggleDocSelection(doc)}
                        className={`p-2.5 rounded-lg border text-xs cursor-pointer flex items-center justify-between transition-all ${
                          isSelected
                            ? 'border-primary/60 bg-primary/10 text-foreground font-medium'
                            : 'border-border bg-card hover:bg-muted/40 text-muted-foreground'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <FileText className="w-4 h-4 text-primary shrink-0" />
                          <div>
                            <span className="font-semibold text-foreground">{doc.name}</span>
                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                              <span className="px-1.5 py-0.2 rounded bg-muted/60 text-muted-foreground">{doc.category}</span>
                              {doc.fileSize && <span>{doc.fileSize}</span>}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPreviewDoc(doc);
                            }}
                            className="p-1 rounded text-muted-foreground hover:text-foreground"
                            title="Preview file"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          <div
                            className={`w-4 h-4 rounded border flex items-center justify-center ${
                              isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-border'
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Attachment Mode Options */}
              <div className="p-3 rounded-lg bg-muted/20 border border-border flex items-center justify-between text-xs">
                <span className="text-muted-foreground font-medium">Attachment Mode:</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setAttachMode('append')}
                    className={`px-2.5 py-1 rounded text-xs transition-colors ${
                      attachMode === 'append'
                        ? 'bg-primary text-primary-foreground font-semibold'
                        : 'bg-muted/50 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Add to Existing
                  </button>
                  <button
                    type="button"
                    onClick={() => setAttachMode('replace')}
                    className={`px-2.5 py-1 rounded text-xs transition-colors ${
                      attachMode === 'replace'
                        ? 'bg-primary text-primary-foreground font-semibold'
                        : 'bg-muted/50 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Replace Existing
                  </button>
                </div>
              </div>
            </>
          ) : (
            /* Tab 2: Manage Document Library */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-foreground">Saved Library Documents</h4>
                  <p className="text-xs text-muted-foreground">
                    Upload, rename, preview, or remove files in the shared repository.
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs h-8"
                >
                  <Upload className="w-3.5 h-3.5 mr-1.5" />
                  Upload New Document
                </Button>
              </div>

              <div className="space-y-2">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="p-3 rounded-lg border border-border bg-card flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <FileText className="w-4 h-4 text-primary shrink-0" />
                      {editingDocId === doc.id ? (
                        <div className="flex items-center gap-2 flex-1">
                          <Input
                            value={editingDocName}
                            onChange={(e) => setEditingDocName(e.target.value)}
                            className="h-7 text-xs bg-background border-border"
                          />
                          <Button
                            size="sm"
                            onClick={(e) => handleSaveRename(doc.id, e)}
                            className="h-7 text-xs px-2.5"
                          >
                            Save
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingDocId(null)}
                            className="h-7 text-xs px-2"
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <div className="min-w-0">
                          <span className="font-semibold text-foreground truncate block">{doc.name}</span>
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                            <span className="px-1.5 py-0.2 rounded bg-muted/60">{doc.category}</span>
                            <span>{doc.fileSize}</span>
                            <span>•</span>
                            <span className="truncate">{doc.fileName}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setPreviewDoc(doc)}
                        className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground"
                        title="Preview document"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => handleStartRename(doc, e)}
                        className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground"
                        title="Rename document"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDocToDelete(doc)}
                        className="h-7 text-xs px-2 text-rose-500 hover:text-rose-400 hover:bg-rose-500/10"
                        title="Delete from document library"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 px-6 border-t border-border bg-muted/20 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">
            {selectedDocs.length} file(s) selected
          </span>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={onClose}
              className="border-border text-foreground hover:bg-muted/40 text-xs"
            >
              Cancel
            </Button>

            {activeTab === 'attach' && (
              <Button
                disabled={loading || selectedDocs.length === 0}
                onClick={handleApplyAttachments}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs shadow-xs"
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Paperclip className="w-3.5 h-3.5 mr-1.5" />}
                {attachmentScope === 'individual'
                  ? `Attach to This Email (${selectedDocs.length})`
                  : `Attach to All Emails (${selectedDocs.length})`}
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Delete Confirmation Dialog */}
      {docToDelete && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in">
          <Card className="w-full max-w-md bg-card border-border text-foreground p-5 rounded-xl shadow-dialog space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-500 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-foreground">Delete from Document Library?</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Are you sure you want to delete <strong className="text-foreground">&ldquo;{docToDelete.name}&rdquo;</strong> from the MineTech document library?
                </p>
                <p className="text-[11px] text-muted-foreground mt-2">
                  This document will be removed from future campaign selections. Previously sent emails will not be affected.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDocToDelete(null)}
                className="text-xs border-border"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={deletingDoc}
                onClick={handleConfirmDelete}
                className="bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold"
              >
                {deletingDoc ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Trash2 className="w-3.5 h-3.5 mr-1" />}
                Delete Document
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Document Preview Dialog */}
      {previewDoc && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in">
          <Card className="w-full max-w-xl bg-card border-border text-foreground rounded-xl shadow-dialog overflow-hidden flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between p-4 border-b border-border bg-muted/20">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                <span className="font-semibold text-xs text-foreground truncate">{previewDoc.name}</span>
              </div>
              <button
                onClick={() => setPreviewDoc(null)}
                className="text-muted-foreground hover:text-foreground p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto">
              <div className="p-3.5 rounded-lg bg-muted/20 border border-border text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Category:</span>
                  <span className="font-medium text-foreground">{previewDoc.category}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">File Size:</span>
                  <span className="font-medium text-foreground">{previewDoc.fileSize}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">File Format:</span>
                  <span className="font-medium text-foreground">{previewDoc.fileType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">File Name:</span>
                  <span className="font-medium text-foreground">{previewDoc.fileName}</span>
                </div>
              </div>

              {previewDoc.description && (
                <div className="text-xs space-y-1">
                  <span className="font-semibold text-foreground">Overview & Content:</span>
                  <p className="text-muted-foreground leading-relaxed">{previewDoc.description}</p>
                </div>
              )}

              {previewDoc.dataBase64 && previewDoc.fileType === 'application/pdf' ? (
                <div className="border border-border rounded-lg overflow-hidden h-64 bg-slate-100 flex items-center justify-center">
                  <iframe
                    src={`data:application/pdf;base64,${previewDoc.dataBase64}`}
                    title={previewDoc.name}
                    className="w-full h-full"
                  />
                </div>
              ) : (
                <div className="p-6 border border-dashed border-border rounded-lg text-center text-xs text-muted-foreground">
                  <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                  <p>Document ready for attachment ({previewDoc.fileSize})</p>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-border bg-muted/20 flex justify-end">
              <Button
                size="sm"
                onClick={() => setPreviewDoc(null)}
                className="text-xs"
              >
                Close Preview
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
