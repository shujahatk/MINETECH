'use client';

import React, { useState, useEffect } from 'react';
import { Layers, Plus, Clock, FileText, CheckCircle2, ChevronRight } from 'lucide-react';

export default function SequenceManager() {
  const [sequences, setSequences] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState('');
  const [steps, setSteps] = useState([
    { stepNumber: 1, templateId: '', delayDays: 0, delayHours: 0 },
    { stepNumber: 2, templateId: '', delayDays: 3, delayHours: 0 },
    { stepNumber: 3, templateId: '', delayDays: 7, delayHours: 0 },
  ]);

  const fetchData = async () => {
    try {
      const [seqRes, tmplRes] = await Promise.all([
        fetch('/api/email/sequences'),
        fetch('/api/email/templates'),
      ]);
      if (seqRes.ok) {
        const j = await seqRes.json();
        setSequences(j.data || []);
      }
      if (tmplRes.ok) {
        const j = await tmplRes.json();
        setTemplates(j.data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateSequence = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    const validSteps = steps.filter((s) => s.templateId);
    if (validSteps.length === 0) {
      alert('Please select a template for at least one sequence step.');
      return;
    }

    try {
      const res = await fetch('/api/email/sequences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          steps: validSteps,
        }),
      });
      if (res.ok) {
        setIsCreating(false);
        setName('');
        fetchData();
      }
    } catch (err) {
      alert('Error creating sequence');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Layers className="w-6 h-6 text-cyan-400" /> Automated Follow-Up Sequences
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Drip sequences that automatically pause the moment a prospect replies.
          </p>
        </div>

        <button
          onClick={() => setIsCreating(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/25 transition"
        >
          <Plus className="w-4 h-4" /> Create Sequence
        </button>
      </div>

      {isCreating && (
        <form onSubmit={handleCreateSequence} className="p-6 rounded-2xl glass-panel border border-slate-800 space-y-4">
          <h3 className="font-bold text-sm text-white">Create New Follow-Up Sequence</h3>
          <div>
            <label className="text-xs font-semibold text-slate-400 block mb-1">Sequence Name</label>
            <input
              type="text"
              required
              placeholder="e.g. 3-Step Cold Founder Sequence"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="space-y-3 pt-2">
            <span className="text-xs font-bold text-slate-300 block">Sequence Steps & Schedule</span>
            {steps.map((step, idx) => (
              <div key={idx} className="p-3.5 rounded-xl glass-card flex flex-wrap items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 font-bold text-xs flex items-center justify-center">
                  {idx + 1}
                </span>

                <div className="flex-1 min-w-[200px]">
                  <select
                    value={step.templateId}
                    onChange={(e) => {
                      const updated = [...steps];
                      updated[idx].templateId = e.target.value;
                      setSteps(updated);
                    }}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white"
                  >
                    <option value="">Select Email Template...</option>
                    {templates.map((t) => (
                      <option key={t._id} value={t._id}>
                        {t.name} ({t.subject})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span>Send after:</span>
                  <input
                    type="number"
                    min="0"
                    value={step.delayDays}
                    onChange={(e) => {
                      const updated = [...steps];
                      updated[idx].delayDays = parseInt(e.target.value, 10) || 0;
                      setSteps(updated);
                    }}
                    className="w-16 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-center text-xs text-white"
                  />
                  <span>days</span>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold"
            >
              Save Sequence
            </button>
          </div>
        </form>
      )}

      {/* List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sequences.map((seq) => (
          <div key={seq._id} className="p-5 rounded-2xl glass-panel border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm text-white">{seq.name}</span>
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/20 text-emerald-300">
                ACTIVE
              </span>
            </div>

            <div className="space-y-2">
              {(seq.steps || []).map((st, i) => (
                <div key={i} className="flex items-center gap-2.5 text-xs text-slate-300">
                  <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span className="text-slate-400 font-mono">Day {st.delayDays}:</span>
                  <span className="font-medium truncate">{st.templateId?.name || 'Template'}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
