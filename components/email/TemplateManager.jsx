'use client';

import React, { useState, useEffect } from 'react';
import { FileText, Plus, Edit2, Trash2, Eye, Sparkles } from 'lucide-react';

export default function TemplateManager() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState('cold-outreach');

  const fetchTemplates = async () => {
    try {
      const res = await fetch('/api/email/templates');
      if (res.ok) {
        const j = await res.json();
        setTemplates(j.data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/email/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          subject,
          bodyHtml: `<p>${body.replace(/\n/g, '<br/>')}</p>`,
          category,
        }),
      });
      if (res.ok) {
        setIsModalOpen(false);
        setName('');
        setSubject('');
        setBody('');
        fetchTemplates();
      }
    } catch (err) {
      alert('Error saving template');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this template?')) return;
    try {
      await fetch(`/api/email/templates/${id}`, { method: 'DELETE' });
      fetchTemplates();
    } catch (e) {}
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <FileText className="w-6 h-6 text-emerald-400" /> Email Outreach Templates
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Reusable sales templates supporting dynamic merge tags and AI refinement.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/25 transition"
        >
          <Plus className="w-4 h-4" /> New Template
        </button>
      </div>

      {isModalOpen && (
        <form onSubmit={handleSave} className="p-6 rounded-2xl glass-panel border border-slate-800 space-y-4">
          <h3 className="font-bold text-sm text-white">Create Outreach Template</h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Template Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Cold Intro #1"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
              >
                <option value="cold-outreach">Cold Outreach</option>
                <option value="follow-up">Follow-Up</option>
                <option value="booking">Call Booking</option>
                <option value="re-engagement">Re-engagement</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-400 block mb-1">Subject Line</label>
            <input
              type="text"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Question regarding {{company}}"
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-400 block mb-1">Email Body</label>
            <textarea
              required
              rows={6}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={`Hi {{firstName}},\n\nSaw what you are building at {{company}}...`}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3.5 text-xs text-white focus:outline-none focus:border-indigo-500"
            ></textarea>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold"
            >
              Save Template
            </button>
          </div>
        </form>
      )}

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map((t) => (
          <div key={t._id} className="p-5 rounded-2xl glass-panel border border-slate-800 flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-full bg-indigo-500/20 text-indigo-300">
                  {t.category}
                </span>
                <button onClick={() => handleDelete(t._id)} className="text-slate-500 hover:text-rose-400">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <h3 className="font-bold text-sm text-white">{t.name}</h3>
              <p className="text-xs text-slate-400 mt-1 truncate">Subject: &ldquo;{t.subject}&rdquo;</p>
              <div
                className="mt-3 text-xs text-slate-400 line-clamp-3 prose prose-invert prose-xs"
                dangerouslySetInnerHTML={{ __html: t.bodyHtml }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
