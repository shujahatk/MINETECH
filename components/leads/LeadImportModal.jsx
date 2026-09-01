'use client';

import React, { useState } from 'react';
import { X, UploadCloud, FileText, CheckCircle, AlertCircle } from 'lucide-react';

export default function LeadImportModal({ onClose, onImported }) {
  const [file, setFile] = useState(null);
  const [tags, setTags] = useState('Outbound List, Q3');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

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
        if (onImported) onImported();
      } else {
        setError(json.message || 'Failed to import leads.');
      }
    } catch (err) {
      setError('Network error during file upload.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#0f172a] border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <UploadCloud className="w-5 h-5 text-indigo-400" />
            <h3 className="font-bold text-base text-white">Import Leads from CSV</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {!result ? (
          <form onSubmit={handleUpload} className="p-6 space-y-5">
            {error && (
              <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* File dropzone */}
            <div className="border-2 border-dashed border-slate-700 hover:border-indigo-500/50 rounded-2xl p-6 text-center transition cursor-pointer relative bg-slate-900/40">
              <input
                type="file"
                accept=".csv"
                onChange={(e) => setFile(e.target.files[0])}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
              <UploadCloud className="w-8 h-8 text-indigo-400 mx-auto mb-2 opacity-80" />
              <p className="text-xs font-semibold text-slate-200">
                {file ? file.name : 'Click or drag & drop a CSV lead file'}
              </p>
              <p className="text-[10px] text-slate-500 mt-1">
                Auto-detects name, email, phone, company, title, website, city, country
              </p>
            </div>

            {/* Tags assign */}
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1.5">Assign Tag(s) to Imported Leads</label>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="Comma separated tags e.g. SaaS Founders, Summer Campaign"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !file}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-bold transition shadow-lg shadow-indigo-600/25"
              >
                {loading ? 'Importing...' : 'Upload & Import'}
              </button>
            </div>
          </form>
        ) : (
          <div className="p-6 text-center space-y-4">
            <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto" />
            <h4 className="font-bold text-lg text-white">Import Complete!</h4>
            <div className="grid grid-cols-3 gap-3 p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-center">
              <div>
                <span className="text-xl font-bold text-emerald-400">{result.imported}</span>
                <span className="text-[10px] text-slate-500 block">Imported</span>
              </div>
              <div>
                <span className="text-xl font-bold text-amber-400">{result.duplicates}</span>
                <span className="text-[10px] text-slate-500 block">Duplicates (Skipped)</span>
              </div>
              <div>
                <span className="text-xl font-bold text-slate-400">{result.totalRows}</span>
                <span className="text-[10px] text-slate-500 block">Total Rows</span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
