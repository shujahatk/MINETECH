'use client';
import { ModalFrame } from '@/components/ui/modal-frame';

import React, { useState } from 'react';
import { X, UploadCloud, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { invalidateLeadsCache } from '@/components/leads/useLeads';

export default function LeadImportModal({ onClose, onImported, onSuccess }) {
  const [file, setFile] = useState(null);
  const [tags, setTags] = useState('Outbound List, High-Value');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const [analyzeAfterImport, setAnalyzeAfterImport] = useState(false);
  const [analyzingBatch, setAnalyzingBatch] = useState(false);
  const [analyzeMsg, setAnalyzeMsg] = useState('');

  const triggerRefresh = () => {
    try {
      invalidateLeadsCache();
    } catch (_) {}
    if (typeof onImported === 'function') onImported();
    if (typeof onSuccess === 'function') onSuccess();
  };

  const handleModalClose = () => {
    if (result && (result.imported > 0 || result.totalRows > 0)) {
      triggerRefresh();
    }
    onClose();
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a CSV file to upload.');
      return;
    }

    setLoading(true);
    setError('');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('tags', tags);

    try {
      const res = await fetch('/api/leads/import', {
        method: 'POST',
        body: formData,
      });

      const json = await res.json();
      if (res.ok) {
        setResult(json.data);
        triggerRefresh();

        // If auto-analyze is checked, trigger bulk analysis in background
        if (analyzeAfterImport && json.data?.imported > 0) {
          handleBulkAnalyzePostImport();
        }
      } else {
        setError(json.message || 'Failed to import leads.');
      }
    } catch (err) {
      setError('Network error during file upload.');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkAnalyzePostImport = async () => {
    setAnalyzingBatch(true);
    setAnalyzeMsg('Analyzing imported leads with Claude...');
    try {
      const res = await fetch('/api/leads/analyze-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priorityFilter: 'A', force: false }),
      });
      if (res.ok) {
        const data = await res.json();
        setAnalyzeMsg(`Analyzed ${data.data?.analyzed || 0} leads with Claude (${data.data?.skipped || 0} cached)`);
        if (onImported) onImported();
      }
    } catch (e) {
      console.error(e);
      setAnalyzeMsg('Analysis started in background.');
    } finally {
      setAnalyzingBatch(false);
    }
  };

  return (
    <ModalFrame title="Import leads" onClose={handleModalClose}>
      <div className="bg-card border border-border rounded-xl w-full max-w-lg overflow-hidden shadow-dialog animate-in zoom-in-95 duration-150 text-foreground">
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between bg-muted/30">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <UploadCloud className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
                Import Leads
                <span className="px-2 py-0.2 rounded bg-muted border border-border text-[10px] text-muted-foreground font-mono">
                  CSV
                </span>
              </h3>
              <p className="text-[11px] text-muted-foreground font-medium">Upload prospect contacts to enrich your outbound pipeline.</p>
            </div>
          </div>
          <button onClick={handleModalClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {!result ? (
          <form onSubmit={handleUpload} className="p-5 space-y-4 bg-card">
            {error && (
              <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Information Banner */}
            <div className="p-3 rounded-xl bg-muted/30 border border-border text-xs text-muted-foreground flex items-start gap-2.5">
              <CheckCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <div className="text-[11px] leading-relaxed">
                <strong className="text-foreground">Reliable Import:</strong> Leads are imported cleanly first without blocking on AI. AI Intelligence studies can be run on-demand or queued.
              </div>
            </div>

            {/* File dropzone */}
            <div className="border-2 border-dashed border-border hover:border-primary/60 rounded-xl p-6 text-center transition cursor-pointer relative bg-muted/20 group">
              <input
                type="file"
                accept=".csv"
                onChange={(e) => setFile(e.target.files[0])}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
              <UploadCloud className="h-8 w-8 text-primary mx-auto mb-2 opacity-80 group-hover:scale-105 transition" />
              <p className="text-xs font-semibold text-foreground">
                {file ? file.name : 'Click or drag & drop a CSV prospect file'}
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">
                Auto-maps Name, Email, Phone, Title, Company, Industry, City, Country
              </p>
            </div>

            {/* Tags assign */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">Assign Outbound Tags</label>
              <Input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="e.g. Enterprise Tier-1, Q3 Outbound"
                className="w-full bg-muted/20 border-border text-xs text-foreground placeholder:text-muted-foreground h-9 rounded-xl"
              />
            </div>

            {/* Optional Claude Analysis Checkbox */}
            <label className="flex items-center gap-2 p-2.5 rounded-xl border border-border bg-muted/20 cursor-pointer hover:bg-muted/40 transition-colors">
              <input
                type="checkbox"
                checked={analyzeAfterImport}
                onChange={(e) => setAnalyzeAfterImport(e.target.checked)}
                className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5"
              />
              <span className="text-xs text-foreground font-medium">
                Analyze imported Priority A leads with Claude after import
              </span>
            </label>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onClose}
                disabled={loading}
                className="border-border text-foreground h-9 hover:bg-muted"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={loading || !file}
                className="h-9 gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Importing Leads...</span>
                  </>
                ) : (
                  <>
                    <UploadCloud className="h-3.5 w-3.5" />
                    <span>Upload & Import Leads</span>
                  </>
                )}
              </Button>
            </div>
          </form>
        ) : (
          <div className="p-6 text-center space-y-4 bg-card">
            <div className="h-12 w-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mx-auto">
              <CheckCircle className="h-6 w-6" />
            </div>
            <h4 className="font-semibold text-base text-foreground">Import Complete!</h4>
            <p className="text-xs text-muted-foreground">
              Prospects have been successfully added to your leads pipeline.
            </p>
            <div className="grid grid-cols-3 gap-3 p-4 rounded-xl bg-muted/30 border border-border text-center">
              <div>
                <span className="text-xl font-semibold text-primary font-mono">{result.imported}</span>
                <span className="text-[10px] text-muted-foreground block">Imported</span>
              </div>
              <div>
                <span className="text-xl font-semibold text-amber-600 font-mono">{result.duplicates}</span>
                <span className="text-[10px] text-muted-foreground block">Duplicates</span>
              </div>
              <div>
                <span className="text-xl font-semibold text-foreground font-mono">{result.totalRows}</span>
                <span className="text-[10px] text-muted-foreground block">Total Rows</span>
              </div>
            </div>

            {analyzeMsg && (
              <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 text-primary text-xs font-semibold">
                {analyzeMsg}
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center gap-2">
              <Button
                variant="outline"
                onClick={handleBulkAnalyzePostImport}
                disabled={analyzingBatch}
                className="w-full h-9 border-primary/40 text-primary hover:bg-primary/10"
              >
                {analyzingBatch ? 'Analyzing...' : 'Analyze Imported with Claude'}
              </Button>
              <Button
                onClick={handleModalClose}
                className="w-full h-9"
              >
                Done & View Leads
              </Button>
            </div>
          </div>
        )}
      </div>
    </ModalFrame>
  );
}
