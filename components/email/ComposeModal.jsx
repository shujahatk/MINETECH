'use client';

import React, { useState, useEffect } from 'react';
import { X, Send, Sparkles, FileText, AlertCircle } from 'lucide-react';

export default function ComposeModal({ lead = null, onClose, onSent }) {
  const [leadsList, setLeadsList] = useState([]);
  const [selectedLeadId, setSelectedLeadId] = useState(lead?._id || '');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);

  useEffect(() => {
    // If no lead supplied, fetch first few leads for select
    if (!lead) {
      fetch('/api/leads?limit=50')
        .then((r) => r.json())
        .then((j) => setLeadsList(j.leads || []));
    }
    // Fetch templates
    fetch('/api/email/templates')
      .then((r) => r.json())
      .then((j) => setTemplates(j.data || []));
  }, [lead]);

  const handleTemplateSelect = (templateId) => {
    setSelectedTemplateId(templateId);
    const tmpl = templates.find((t) => t._id === templateId);
    if (tmpl) {
      setSubject(tmpl.subject);
      setBody(tmpl.bodyHtml.replace(/<[^>]*>?/gm, ''));
    }
  };

  const handleInsertTag = (tag) => {
    setBody((prev) => `${prev} {{${tag}}}`);
  };

  const handleGenerateAI = async () => {
    setIsGeneratingAI(true);
    try {
      const activeLead = lead || leadsList.find((l) => l._id === selectedLeadId);
      const res = await fetch('/api/email/ai-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'Cold introduction offering sales outbound system',
          tone: 'Professional',
          goal: 'Schedule a call',
          leadContext: {
            name: activeLead?.fullName || activeLead?.firstName,
            company: activeLead?.company,
          },
        }),
      });

      if (res.ok) {
        const json = await res.json();
        setSubject(json.data.subject);
        setBody(json.data.bodyHtml.replace(/<[^>]*>?/gm, ''));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!selectedLeadId) {
      setError('Please select a recipient lead.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: selectedLeadId,
          subject,
          bodyHtml: `<p>${body.replace(/\n/g, '<br/>')}</p>`,
          bodyText: body,
        }),
      });

      const json = await res.json();
      if (res.ok) {
        if (onSent) onSent();
        onClose();
      } else {
        setError(json.message || 'Failed to send email.');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#0f172a] border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Send className="w-5 h-5 text-indigo-400" />
            <h3 className="font-bold text-base text-white">Compose Outbound Email</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSend} className="p-6 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Recipient */}
          <div>
            <label className="text-xs font-semibold text-slate-400 block mb-1">Recipient</label>
            {lead ? (
              <div className="p-2.5 rounded-xl bg-slate-800 text-xs text-white flex items-center justify-between">
                <span>
                  <strong>{lead.fullName || lead.firstName}</strong> ({lead.email})
                </span>
                <span className="text-[10px] text-slate-400">{lead.company}</span>
              </div>
            ) : (
              <select
                value={selectedLeadId}
                onChange={(e) => setSelectedLeadId(e.target.value)}
                required
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="">Select a Lead...</option>
                {leadsList.map((l) => (
                  <option key={l._id} value={l._id}>
                    {l.fullName || l.email} — {l.company || 'No Company'} ({l.email})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Quick template loader & AI draft */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-slate-900/60 border border-slate-800">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-400" />
              <select
                value={selectedTemplateId}
                onChange={(e) => handleTemplateSelect(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-xs text-slate-300 rounded-lg px-2.5 py-1 focus:outline-none"
              >
                <option value="">Load Template...</option>
                {templates.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleGenerateAI}
              disabled={isGeneratingAI}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 text-xs font-semibold hover:bg-indigo-600/30 transition"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {isGeneratingAI ? 'Writing...' : 'AI Assist'}
            </button>
          </div>

          {/* Subject */}
          <div>
            <label className="text-xs font-semibold text-slate-400 block mb-1">Subject Line</label>
            <input
              type="text"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Quick question for {{firstName}}"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Body */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-400">Email Message</label>
              <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                <span>Insert merge tag:</span>
                <button
                  type="button"
                  onClick={() => handleInsertTag('firstName')}
                  className="px-1.5 py-0.5 rounded bg-slate-800 text-indigo-400 hover:text-indigo-300"
                >
                  {`{{firstName}}`}
                </button>
                <button
                  type="button"
                  onClick={() => handleInsertTag('company')}
                  className="px-1.5 py-0.5 rounded bg-slate-800 text-indigo-400 hover:text-indigo-300"
                >
                  {`{{company}}`}
                </button>
              </div>
            </div>
            <textarea
              required
              rows={8}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your email here with {{firstName}}, {{company}}, etc..."
              className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3.5 text-xs text-white focus:outline-none focus:border-indigo-500"
            ></textarea>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-bold transition shadow-lg shadow-indigo-600/25"
            >
              <Send className="w-4 h-4" /> {loading ? 'Sending...' : 'Send Email Now'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
