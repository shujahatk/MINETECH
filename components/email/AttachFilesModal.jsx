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
  FileCheck,
  Trash2,
  FolderOpen
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
  onAttachmentsApplied,
}) {
  const [documents, setDocuments] = useState([]);
  const [selectedDocs, setSelectedDocs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [attachMode, setAttachMode] = useState('append'); // 'append' | 'replace'
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      fetch('/api/email/workspace/documents')
        .then((r) => r.json())
        .then((d) => {
          if (d.success && d.documents) {
            setDocuments(d.documents);
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

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

      toast.success(`Attached "${file.name}"!`);
      const newDoc = data.document;
      setDocuments((prev) => [newDoc, ...prev]);
      setSelectedDocs((prev) => [...prev, newDoc]);
    } catch (err) {
      toast.error(err.message || 'Failed to upload attachment');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Apply attachments to emails
  const handleApplyAttachments = async (applyToAll = true) => {
    if (selectedDocs.length === 0) {
      toast.error('Please select or upload at least one file to attach.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/email/workspace', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'bulk_attachments',
          applyToAll,
          draftIds: applyToAll ? undefined : (selectedDraftIds && selectedDraftIds.length > 0 ? selectedDraftIds : undefined),
          attachments: selectedDocs,
          mode: attachMode,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to apply attachments');
      }

      toast.success(
        applyToAll
          ? `Attached ${selectedDocs.length} file(s) to all ${totalDraftsCount} emails!`
          : `Attached ${selectedDocs.length} file(s) to selected emails!`
      );

      onAttachmentsApplied?.(data.drafts);
      onClose();
    } catch (err) {
      toast.error(err.message || 'Error applying attachments');
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
              <Paperclip className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">
                Attach Files & Documents
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Attach technical data sheets, brochures, or custom files to campaign emails
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

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Local File Upload Box */}
          <div>
            <span className="text-xs font-semibold text-slate-300 block mb-2">
              Upload File from Computer:
            </span>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border border-dashed border-slate-700 hover:border-amber-500/80 rounded-xl p-4 text-center cursor-pointer transition-all bg-slate-950/40 hover:bg-slate-950/70 flex items-center justify-center gap-3"
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
                <div className="flex items-center gap-2 text-xs text-amber-300">
                  <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                  <span>Uploading file and generating attachment...</span>
                </div>
              ) : (
                <div className="flex items-center gap-2.5 text-xs text-slate-300">
                  <div className="p-2 rounded-lg bg-slate-800 text-amber-400">
                    <Upload className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-white">Click to browse file from your device</p>
                    <p className="text-[11px] text-slate-400">PDF, DOCX, Excel, Images up to 15 MB</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Currently Selected Files */}
          {selectedDocs.length > 0 && (
            <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 space-y-2">
              <span className="text-[11px] font-semibold text-amber-300 uppercase tracking-wider block">
                Files Selected to Attach ({selectedDocs.length}):
              </span>
              <div className="flex flex-wrap gap-2">
                {selectedDocs.map((doc, idx) => (
                  <div
                    key={idx}
                    className="px-2.5 py-1 rounded-md bg-slate-900 border border-slate-700 text-slate-200 text-xs flex items-center gap-2"
                  >
                    <FileText className="w-3.5 h-3.5 text-amber-400" />
                    <span className="font-medium">{doc.name || doc.fileName}</span>
                    {doc.fileSize && <span className="text-[10px] text-slate-400">({doc.fileSize})</span>}
                    <button
                      type="button"
                      onClick={() => toggleDocSelection(doc)}
                      className="text-slate-400 hover:text-rose-400 ml-1"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* MineTech Document Library Catalog */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-slate-300 block">
              Or Select from MineTech Document Library:
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
                        ? 'border-amber-500/60 bg-amber-500/10 text-white'
                        : 'border-slate-800 bg-slate-950/40 hover:bg-slate-800/40 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <FileText className="w-4 h-4 text-amber-400 shrink-0" />
                      <div>
                        <span className="font-semibold text-slate-200">{doc.name}</span>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                          <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">{doc.category}</span>
                          {doc.fileSize && <span>{doc.fileSize}</span>}
                        </div>
                      </div>
                    </div>

                    <div
                      className={`w-4 h-4 rounded border flex items-center justify-center ${
                        isSelected ? 'border-amber-500 bg-amber-500 text-slate-950' : 'border-slate-600'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Attachment Mode Options */}
          <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-300">Attachment Mode:</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAttachMode('append')}
                className={`px-2.5 py-1 rounded text-xs transition-colors ${
                  attachMode === 'append'
                    ? 'bg-amber-600 text-white font-semibold'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                Add to Existing Attachments
              </button>
              <button
                type="button"
                onClick={() => setAttachMode('replace')}
                className={`px-2.5 py-1 rounded text-xs transition-colors ${
                  attachMode === 'replace'
                    ? 'bg-amber-600 text-white font-semibold'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                Replace All Attachments
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 px-6 border-t border-slate-800 bg-slate-950/80 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-slate-400">
            {selectedDocs.length} file(s) selected
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
                disabled={loading || selectedDocs.length === 0}
                onClick={() => handleApplyAttachments(false)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs"
              >
                Attach to Selected ({selectedDraftsCount})
              </Button>
            )}

            <Button
              disabled={loading || selectedDocs.length === 0}
              onClick={() => handleApplyAttachments(true)}
              className="bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs shadow"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
              Attach to All Emails ({totalDraftsCount})
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
