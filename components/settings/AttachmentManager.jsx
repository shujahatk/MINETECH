'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Paperclip,
  Upload,
  FileText,
  Search,
  Filter,
  Eye,
  Edit2,
  Trash2,
  Check,
  X,
  Loader2,
  AlertTriangle,
  RefreshCw,
  FolderOpen,
  FileCheck,
  FileSpreadsheet,
  FileImage,
  FileCode,
  Info,
  Clock,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export default function AttachmentManager() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all' | 'pdf' | 'office' | 'images' | 'in_use'
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Rename state
  const [editingDoc, setEditingDoc] = useState(null);
  const [newName, setNewName] = useState('');
  const [renaming, setRenaming] = useState(false);

  // Delete state
  const [docToDelete, setDocToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Preview state
  const [previewDoc, setPreviewDoc] = useState(null);

  // Restore defaults state
  const [restoringDefaults, setRestoringDefaults] = useState(false);

  const fileInputRef = useRef(null);

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/email/workspace/documents');
      const data = await res.json();
      if (data.success && Array.isArray(data.documents)) {
        setDocuments(data.documents);
      } else {
        toast.error(data.message || 'Failed to load documents');
      }
    } catch (err) {
      console.error('Error fetching documents:', err);
      toast.error('Network error loading document library');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  // Handle local file upload
  const handleUploadFile = async (file) => {
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
        throw new Error(data.message || 'Upload failed');
      }

      toast.success(`Successfully uploaded "${file.name}" to library!`);
      if (data.documents) {
        setDocuments(data.documents);
      } else {
        fetchDocuments();
      }
    } catch (err) {
      toast.error(err.message || 'Failed to upload document');
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
      handleUploadFile(files[0]);
    }
  };

  // Rename document
  const handleStartRename = (doc) => {
    setEditingDoc(doc);
    setNewName(doc.name || doc.fileName || '');
  };

  const handleSaveRename = async () => {
    if (!editingDoc || !newName.trim()) return;
    setRenaming(true);
    try {
      const res = await fetch('/api/email/workspace/documents', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingDoc.id,
          name: newName.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to rename');
      }

      toast.success('Document renamed successfully');
      setEditingDoc(null);
      if (data.documents) {
        setDocuments(data.documents);
      } else {
        fetchDocuments();
      }
    } catch (err) {
      toast.error(err.message || 'Failed to rename document');
    } finally {
      setRenaming(false);
    }
  };

  // Delete document
  const handleConfirmDelete = async () => {
    if (!docToDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/email/workspace/documents?id=${docToDelete.id}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to delete');
      }

      toast.success(`Removed "${docToDelete.name}" from document library`);
      setDocToDelete(null);
      if (data.documents) {
        setDocuments(data.documents);
      } else {
        fetchDocuments();
      }
    } catch (err) {
      toast.error(err.message || 'Failed to delete document');
    } finally {
      setDeleting(false);
    }
  };

  // Restore Default Documents
  const handleRestoreDefaults = async () => {
    if (!confirm('Restore preconfigured MineTech company brochures and technical data sheets?')) return;
    setRestoringDefaults(true);
    try {
      const res = await fetch('/api/email/workspace/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restore_defaults' }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || 'Default collateral restored!');
        fetchDocuments();
      } else {
        toast.error(data.message || 'Failed to restore default collateral');
      }
    } catch (err) {
      toast.error('Error restoring default documents: ' + err.message);
    } finally {
      setRestoringDefaults(false);
    }
  };

  // Helper for file type icons
  const getFileIcon = (doc) => {
    const type = (doc.fileType || '').toLowerCase();
    const name = (doc.fileName || doc.name || '').toLowerCase();
    if (type.includes('pdf') || name.endsWith('.pdf')) {
      return <FileText className="w-5 h-5 text-rose-500" />;
    }
    if (type.includes('word') || name.endsWith('.doc') || name.endsWith('.docx')) {
      return <FileText className="w-5 h-5 text-blue-500" />;
    }
    if (type.includes('sheet') || type.includes('excel') || name.endsWith('.xls') || name.endsWith('.xlsx') || name.endsWith('.csv')) {
      return <FileSpreadsheet className="w-5 h-5 text-emerald-500" />;
    }
    if (type.includes('image') || name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.jpeg')) {
      return <FileImage className="w-5 h-5 text-purple-500" />;
    }
    return <FileCode className="w-5 h-5 text-slate-400" />;
  };

  // Filtered documents
  const filteredDocuments = documents.filter((doc) => {
    // Search query match
    const q = searchQuery.toLowerCase().trim();
    if (q) {
      const name = (doc.name || '').toLowerCase();
      const fileName = (doc.fileName || '').toLowerCase();
      const cat = (doc.category || '').toLowerCase();
      const desc = (doc.description || '').toLowerCase();
      if (!name.includes(q) && !fileName.includes(q) && !cat.includes(q) && !desc.includes(q)) {
        return false;
      }
    }

    // Type filter
    if (filterType === 'all') return true;
    const type = (doc.fileType || '').toLowerCase();
    const name = (doc.fileName || doc.name || '').toLowerCase();

    if (filterType === 'pdf') {
      return type.includes('pdf') || name.endsWith('.pdf');
    }
    if (filterType === 'office') {
      return type.includes('word') || type.includes('sheet') || type.includes('excel') ||
             name.endsWith('.doc') || name.endsWith('.docx') || name.endsWith('.xls') || name.endsWith('.xlsx');
    }
    if (filterType === 'images') {
      return type.includes('image') || name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.webp');
    }
    if (filterType === 'in_use') {
      return (doc.usage?.activeDraftsCount || 0) > 0;
    }
    return true;
  });

  const totalInUseCount = documents.filter((d) => (d.usage?.activeDraftsCount || 0) > 0).length;

  return (
    <div className="space-y-6">
      {/* Top Banner / Actions Bar */}
      <div className="p-5 rounded-xl border border-border bg-card shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <FolderOpen className="w-5 h-5 text-primary" />
              Central Attachment Manager
            </h2>
            <Badge variant="outline" className="text-xs bg-muted/40 font-mono">
              {documents.length} Files in Library
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Centrally manage corporate brochures, technical data sheets, and certificates. Track which emails currently attach each file.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRestoreDefaults}
            disabled={restoringDefaults}
            className="text-xs border-border text-foreground hover:bg-muted/40 h-8 gap-1.5"
            title="Restore default preconfigured MineTech documents if previously removed"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${restoringDefaults ? 'animate-spin' : ''}`} />
            {restoringDefaults ? 'Restoring...' : 'Restore Defaults'}
          </Button>

          <Button
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="text-xs h-8 gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {uploading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Upload className="w-3.5 h-3.5" />
            )}
            {uploading ? 'Uploading...' : 'Upload Document'}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.doc,.xlsx,.xls,.png,.jpg,.jpeg,.webp"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.[0]) handleUploadFile(e.target.files[0]);
            }}
          />
        </div>
      </div>

      {/* Drag & Drop Upload Strip */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`p-4 rounded-xl border-2 border-dashed transition-all cursor-pointer text-center ${
          isDragging
            ? 'border-primary bg-primary/10 scale-[1.005]'
            : 'border-border/80 bg-muted/20 hover:bg-muted/40 hover:border-primary/60'
        }`}
      >
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 text-xs text-muted-foreground">
          <div className="p-2.5 rounded-lg bg-card border border-border text-primary shadow-xs">
            <Upload className="w-4 h-4" />
          </div>
          <div className="text-left">
            <span className="font-semibold text-foreground block">
              Drag & drop document files here or click to browse
            </span>
            <span className="text-[11px] text-muted-foreground">
              Supports PDF, Word, Excel, and Images (up to 25 MB max per file). Stored permanently in Supabase.
            </span>
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by title, filename, or category..."
            className="pl-9 h-9 text-xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-lg font-medium border transition-colors whitespace-nowrap ${
              filterType === 'all'
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-card text-muted-foreground border-border hover:bg-muted/40'
            }`}
          >
            All Files ({documents.length})
          </button>
          <button
            onClick={() => setFilterType('pdf')}
            className={`px-3 py-1.5 rounded-lg font-medium border transition-colors whitespace-nowrap ${
              filterType === 'pdf'
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-card text-muted-foreground border-border hover:bg-muted/40'
            }`}
          >
            PDFs
          </button>
          <button
            onClick={() => setFilterType('office')}
            className={`px-3 py-1.5 rounded-lg font-medium border transition-colors whitespace-nowrap ${
              filterType === 'office'
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-card text-muted-foreground border-border hover:bg-muted/40'
            }`}
          >
            Word / Office
          </button>
          <button
            onClick={() => setFilterType('images')}
            className={`px-3 py-1.5 rounded-lg font-medium border transition-colors whitespace-nowrap ${
              filterType === 'images'
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-card text-muted-foreground border-border hover:bg-muted/40'
            }`}
          >
            Images
          </button>
          <button
            onClick={() => setFilterType('in_use')}
            className={`px-3 py-1.5 rounded-lg font-medium border transition-colors whitespace-nowrap ${
              filterType === 'in_use'
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'bg-card text-muted-foreground border-border hover:bg-muted/40'
            }`}
          >
            In Active Use ({totalInUseCount})
          </button>
        </div>
      </div>

      {/* Documents Grid / Table */}
      {loading ? (
        <div className="p-12 text-center border border-border rounded-xl bg-card">
          <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">Loading document library...</p>
        </div>
      ) : filteredDocuments.length === 0 ? (
        <div className="p-12 text-center border border-dashed border-border rounded-xl bg-card">
          <FolderOpen className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
          <p className="text-sm font-semibold text-foreground">No documents found</p>
          <p className="text-xs text-muted-foreground mt-1">
            {searchQuery
              ? `No documents match "${searchQuery}".`
              : 'Your library has no documents in this view. Upload your first document above.'}
          </p>
          {searchQuery && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSearchQuery('')}
              className="mt-3 text-xs"
            >
              Clear Search
            </Button>
          )}
        </div>
      ) : (
        <div className="border border-border rounded-xl bg-card overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-muted-foreground uppercase tracking-wider text-[11px] font-semibold">
                  <th className="py-3 px-4">Document</th>
                  <th className="py-3 px-4">Type & Origin</th>
                  <th className="py-3 px-4">Size</th>
                  <th className="py-3 px-4">Workspace Usage</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredDocuments.map((doc) => {
                  const usageCount = doc.usage?.activeDraftsCount || 0;
                  const companies = doc.usage?.companies || [];
                  const isSeed = !doc.isCustom;

                  return (
                    <tr key={doc.id} className="hover:bg-muted/30 transition-colors">
                      {/* Document Details */}
                      <td className="py-3.5 px-4 max-w-md">
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-lg bg-muted/60 border border-border mt-0.5 shrink-0">
                            {getFileIcon(doc)}
                          </div>
                          <div className="min-w-0 space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-foreground text-sm truncate">
                                {doc.name || doc.fileName}
                              </span>
                            </div>
                            <p className="text-[11px] text-muted-foreground truncate font-mono">
                              {doc.fileName}
                            </p>
                            {doc.description && (
                              <p className="text-[11px] text-muted-foreground line-clamp-1">
                                {doc.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Type & Origin */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="space-y-1">
                          <div>
                            {isSeed ? (
                              <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/30 text-[10px] font-semibold">
                                Default Asset
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[10px] font-semibold">
                                Custom Upload
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-muted-foreground block">
                            {doc.category || 'General Collateral'}
                          </span>
                        </div>
                      </td>

                      {/* Size */}
                      <td className="py-3.5 px-4 whitespace-nowrap font-mono text-muted-foreground">
                        {doc.fileSize || '1.0 MB'}
                      </td>

                      {/* Active Workspace Usage */}
                      <td className="py-3.5 px-4 max-w-xs">
                        {usageCount > 0 ? (
                          <div className="space-y-1">
                            <span
                              className="px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[11px] font-semibold flex items-center gap-1.5 w-fit"
                              title={`Attached to ${usageCount} drafts in active workspace: ${companies.join(', ')}`}
                            >
                              <Paperclip className="w-3 h-3" />
                              Attached to {usageCount} draft{usageCount > 1 ? 's' : ''}
                            </span>
                            {companies.length > 0 && (
                              <p className="text-[10px] text-muted-foreground truncate max-w-[200px]" title={companies.join(', ')}>
                                {companies.slice(0, 3).join(', ')}{companies.length > 3 ? ` +${companies.length - 3} more` : ''}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] text-muted-foreground italic flex items-center gap-1">
                            <Info className="w-3 h-3 text-muted-foreground/60" /> Not attached
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Preview Button */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setPreviewDoc(doc)}
                            className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted"
                            title="Preview document"
                          >
                            <Eye className="w-3.5 h-3.5 mr-1" />
                            Preview
                          </Button>

                          {/* Rename Button */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleStartRename(doc)}
                            className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted"
                            title="Rename document"
                          >
                            <Edit2 className="w-3.5 h-3.5 mr-1" />
                            Rename
                          </Button>

                          {/* Delete Button */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDocToDelete(doc)}
                            className="h-8 px-2.5 text-xs text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10"
                            title="Delete document permanently"
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-1" />
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Rename Dialog Modal */}
      {editingDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <Card className="w-full max-w-md bg-card border-border shadow-dialog p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-primary" />
                Rename Document
              </h3>
              <button
                onClick={() => setEditingDoc(null)}
                className="text-muted-foreground hover:text-foreground p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground block">
                Display Title:
              </label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Enter new display name..."
                className="text-xs"
                autoFocus
              />
              <p className="text-[11px] text-muted-foreground font-mono">
                Original file: {editingDoc.fileName}
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditingDoc(null)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSaveRename}
                disabled={renaming || !newName.trim()}
                className="text-xs bg-primary text-primary-foreground"
              >
                {renaming ? 'Saving...' : 'Save Title'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {docToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <Card className="w-full max-w-lg bg-card border-border shadow-dialog p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-500 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-foreground">
                  Permanently Delete Document?
                </h3>
                <p className="text-xs text-muted-foreground">
                  Are you sure you want to remove <strong className="text-foreground">&quot;{docToDelete.name}&quot;</strong> ({docToDelete.fileName})?
                </p>
              </div>
            </div>

            {/* In-Use Warning Banner */}
            {(docToDelete.usage?.activeDraftsCount || 0) > 0 ? (
              <div className="p-3.5 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 text-xs space-y-1.5">
                <div className="flex items-center gap-1.5 font-semibold">
                  <ShieldAlert className="w-4 h-4 text-amber-500" />
                  Active Attachment Warning:
                </div>
                <p className="leading-relaxed">
                  This document is currently attached to <strong>{docToDelete.usage.activeDraftsCount} email draft(s)</strong> in your active workspace (e.g., {docToDelete.usage.companies?.slice(0, 3).join(', ')}).
                </p>
                <p className="text-[11px] text-amber-600 dark:text-amber-400">
                  Deleting it will remove it from the document library and safely detach it from active drafts, but will not corrupt historical sent emails.
                </p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg border border-border">
                This document is not currently attached to any active drafts. It will be permanently removed from Supabase Storage and your library.
              </p>
            )}

            {!docToDelete.isCustom && (
              <p className="text-[11px] text-blue-600 dark:text-blue-400 bg-blue-500/10 p-2.5 rounded border border-blue-500/20">
                Note: This is a preconfigured default document. Once deleted, it will not reappear automatically upon restart or page refresh.
              </p>
            )}

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
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
                disabled={deleting}
                className="text-xs bg-rose-600 hover:bg-rose-500 text-white font-medium gap-1.5"
              >
                {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                {deleting ? 'Deleting...' : 'Delete Permanently'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Document Preview Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <Card className="w-full max-w-4xl bg-card border-border text-foreground shadow-dialog flex flex-col h-[85vh] overflow-hidden rounded-xl">
            {/* Preview Header */}
            <div className="p-4 px-6 border-b border-border bg-muted/20 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-card border border-border">
                  {getFileIcon(previewDoc)}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    {previewDoc.name || previewDoc.fileName}
                  </h3>
                  <p className="text-xs text-muted-foreground font-mono">
                    {previewDoc.fileName} &bull; {previewDoc.fileSize}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {previewDoc.url && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(previewDoc.url, '_blank')}
                    className="h-8 text-xs gap-1 text-muted-foreground hover:text-foreground"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Open in New Tab
                  </Button>
                )}
                <button
                  onClick={() => setPreviewDoc(null)}
                  className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Preview Body */}
            <div className="flex-1 bg-muted/20 p-4 overflow-hidden flex items-center justify-center">
              {previewDoc.dataBase64 ? (
                previewDoc.fileType?.includes('image') ? (
                  <img
                    src={`data:${previewDoc.fileType || 'image/png'};base64,${previewDoc.dataBase64}`}
                    alt={previewDoc.name}
                    className="max-h-full max-w-full object-contain rounded-lg shadow-md"
                  />
                ) : (
                  <iframe
                    src={`data:application/pdf;base64,${previewDoc.dataBase64}#toolbar=0`}
                    title={previewDoc.name}
                    className="w-full h-full rounded-lg border border-border bg-white shadow-xs"
                  />
                )
              ) : previewDoc.url ? (
                previewDoc.fileType?.includes('image') ? (
                  <img
                    src={previewDoc.url}
                    alt={previewDoc.name}
                    className="max-h-full max-w-full object-contain rounded-lg shadow-md"
                  />
                ) : (
                  <iframe
                    src={previewDoc.url}
                    title={previewDoc.name}
                    className="w-full h-full rounded-lg border border-border bg-white shadow-xs"
                  />
                )
              ) : (
                <div className="text-center p-8 text-muted-foreground space-y-2">
                  <FileText className="w-12 h-12 mx-auto text-muted-foreground/40" />
                  <p className="text-sm font-semibold">Binary preview not stored locally</p>
                  <p className="text-xs">
                    This document reference ({previewDoc.fileName}) is stored in Supabase storage and will be attached to outgoing emails.
                  </p>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
