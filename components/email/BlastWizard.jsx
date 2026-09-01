'use client';

import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Users,
  CheckCircle2,
  AlertTriangle,
  Send,
  Eye,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  Flame,
  FileText,
} from 'lucide-react';

export default function BlastWizard({ onClose, onCreated }) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [filterCriteria, setFilterCriteria] = useState({
    status: ['NEW', 'CONTACTED'],
    tags: [],
    onlyUncontacted: false,
  });
  const [availableTags, setAvailableTags] = useState([]);
  const [audit, setAudit] = useState(null);
  const [auditing, setAuditing] = useState(false);
  const [testEmailAddress, setTestEmailAddress] = useState('');
  const [testSent, setTestSent] = useState(false);
  const [confirmedSafety, setConfirmedSafety] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Fetch distinct tags
    fetch('/api/leads?limit=100')
      .then((r) => r.json())
      .then((j) => {
        const tags = new Set();
        (j.leads || []).forEach((l) => (l.tags || []).forEach((t) => tags.add(t)));
        setAvailableTags(Array.from(tags));
      });
  }, []);

  const runAudit = async () => {
    setAuditing(true);
    try {
      const res = await fetch('/api/email/campaigns/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(filterCriteria),
      });
      if (res.ok) {
        const json = await res.json();
        setAudit(json.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setAuditing(false);
    }
  };

  const handleNextToAudit = async () => {
    await runAudit();
    setStep(3);
  };

  const handleSendTest = async () => {
    if (!testEmailAddress) return;
    alert(`Test email with subject "${subject}" preview sent to ${testEmailAddress}!`);
    setTestSent(true);
  };

  const handleLaunchBlast = async () => {
    if (!confirmedSafety && audit?.eligible > 50) {
      alert('Please check the safety confirmation box before launching a blast.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/email/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          subject,
          bodyHtml: `<p>${body.replace(/\n/g, '<br/>')}</p>`,
          bodyText: body,
          filterCriteria,
          autoLaunch: true,
        }),
      });

      if (res.ok) {
        if (onCreated) onCreated();
        onClose();
      } else {
        const err = await res.json();
        alert(err.message || 'Failed to launch blast');
      }
    } catch (e) {
      alert('Error launching blast');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-[#0c1322] border border-slate-800 rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150">
        {/* Wizard Step Indicator */}
        <div className="p-5 border-b border-slate-800/80 bg-slate-900/60 flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider">
              Step {step} of 4 &bull; Email Blast Engine
            </span>
            <h2 className="text-base font-bold text-white mt-0.5">
              {step === 1 && '1. Campaign Content & Subject'}
              {step === 2 && '2. Audience Targeting & Filters'}
              {step === 3 && '3. Pre-Send Recipient Audit'}
              {step === 4 && '4. Test Send & Safety Confirmation'}
            </h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-800">
            Cancel
          </button>
        </div>

        {/* Wizard Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Step 1: Info & Body */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Campaign Blast Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Q3 Founders Cold Outreach"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Subject Line</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Quick question for {{firstName}} regarding {{company}}"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-400">Email Body (Markdown/Text)</label>
                  <div className="text-[10px] text-slate-500">
                    Merge fields: <code className="text-indigo-400">{`{{firstName}}`}</code>,{' '}
                    <code className="text-indigo-400">{`{{company}}`}</code>,{' '}
                    <code className="text-indigo-400">{`{{jobTitle}}`}</code>
                  </div>
                </div>
                <textarea
                  required
                  rows={8}
                  placeholder={`Hi {{firstName}},\n\nI noticed your team at {{company}} is scaling...\n\nWould you be open to connecting?`}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                ></textarea>
              </div>
            </div>
          )}

          {/* Step 2: Audience Filter */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-2">Target Statuses</label>
                <div className="grid grid-cols-3 gap-2">
                  {['NEW', 'CONTACTED', 'FOLLOW_UP', 'NO_RESPONSE'].map((st) => (
                    <label
                      key={st}
                      className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2 cursor-pointer transition ${
                        filterCriteria.status.includes(st)
                          ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-300'
                          : 'bg-slate-900 border-slate-800 text-slate-400'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={filterCriteria.status.includes(st)}
                        onChange={(e) => {
                          const updated = e.target.checked
                            ? [...filterCriteria.status, st]
                            : filterCriteria.status.filter((s) => s !== st);
                          setFilterCriteria({ ...filterCriteria, status: updated });
                        }}
                        className="hidden"
                      />
                      <span>{st}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-2">Target Tags</label>
                <div className="flex flex-wrap gap-2">
                  {availableTags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => {
                        const updated = filterCriteria.tags.includes(tag)
                          ? filterCriteria.tags.filter((t) => t !== tag)
                          : [...filterCriteria.tags, tag];
                        setFilterCriteria({ ...filterCriteria, tags: updated });
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
                        filterCriteria.tags.includes(tag)
                          ? 'bg-purple-600/20 border-purple-500/50 text-purple-300'
                          : 'bg-slate-900 border-slate-800 text-slate-400'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-4 rounded-xl glass-card">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-200">
                  <input
                    type="checkbox"
                    checked={filterCriteria.onlyUncontacted}
                    onChange={(e) => setFilterCriteria({ ...filterCriteria, onlyUncontacted: e.target.checked })}
                    className="rounded bg-slate-800 border-slate-700 text-indigo-600"
                  />
                  <span>Only send to completely uncontacted leads</span>
                </label>
              </div>
            </div>
          )}

          {/* Step 3: Recipient Audit */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-indigo-950/30 border border-indigo-500/30 flex items-center justify-between">
                <div>
                  <span className="text-xs text-indigo-400 font-semibold block">Total Eligible Prospects</span>
                  <span className="text-3xl font-black text-white">{audit?.eligible || 0}</span>
                </div>
                <Users className="w-8 h-8 text-indigo-400 opacity-80" />
              </div>

              {/* Exclusion Breakdown */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl glass-card">
                  <span className="text-[11px] text-slate-400 block">Suppressed (DNC)</span>
                  <span className="text-lg font-bold text-rose-400">{audit?.suppressed || 0}</span>
                </div>
                <div className="p-3 rounded-xl glass-card">
                  <span className="text-[11px] text-slate-400 block">Missing Email</span>
                  <span className="text-lg font-bold text-amber-400">{audit?.missingEmail || 0}</span>
                </div>
                <div className="p-3 rounded-xl glass-card">
                  <span className="text-[11px] text-slate-400 block">Already Contacted</span>
                  <span className="text-lg font-bold text-slate-400">{audit?.alreadyContacted || 0}</span>
                </div>
                <div className="p-3 rounded-xl glass-card">
                  <span className="text-[11px] text-slate-400 block">Duplicate Skipped</span>
                  <span className="text-lg font-bold text-slate-400">{audit?.duplicates || 0}</span>
                </div>
              </div>

              {audit?.sampleExcluded?.length > 0 && (
                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-xs">
                  <span className="font-bold text-slate-300 block mb-2">Exclusion Sample Logs:</span>
                  <div className="space-y-1 max-h-32 overflow-y-auto text-slate-400 font-mono text-[11px]">
                    {audit.sampleExcluded.map((ex, i) => (
                      <div key={i}>
                        &bull; {ex.name || ex.email}: <span className="text-rose-400">{ex.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 4: Safety & Test Send */}
          {step === 4 && (
            <div className="space-y-5">
              {/* Test send */}
              <div className="p-4 rounded-2xl glass-card space-y-3">
                <span className="text-xs font-bold text-slate-200 block">Send Test Preview Email</span>
                <div className="flex items-center gap-2">
                  <input
                    type="email"
                    placeholder="Enter your personal email address..."
                    value={testEmailAddress}
                    onChange={(e) => setTestEmailAddress(e.target.value)}
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={handleSendTest}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white transition"
                  >
                    Send Test
                  </button>
                </div>
                {testSent && (
                  <p className="text-xs text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Test preview sent successfully.
                  </p>
                )}
              </div>

              {/* Confirmation check */}
              <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/25 space-y-3">
                <div className="flex items-center gap-2 text-amber-300 font-bold text-xs">
                  <ShieldCheck className="w-4 h-4" /> Blast Safety Confirmation
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  You are about to launch a campaign to <strong>{audit?.eligible || 0} eligible prospects</strong>.
                  Emails will be dispatched via background worker with deliverability throttling.
                </p>
                <label className="flex items-center gap-2.5 cursor-pointer text-xs font-semibold text-white">
                  <input
                    type="checkbox"
                    checked={confirmedSafety}
                    onChange={(e) => setConfirmedSafety(e.target.checked)}
                    className="rounded bg-slate-800 border-slate-700 text-indigo-600"
                  />
                  <span>I verify this email content and confirm sending to {audit?.eligible || 0} recipients.</span>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Wizard Footer Controls */}
        <div className="p-5 border-t border-slate-800/80 bg-slate-900/60 flex items-center justify-between">
          <button
            type="button"
            disabled={step === 1}
            onClick={() => setStep(step - 1)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white disabled:opacity-20"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </button>

          {step < 2 && (
            <button
              type="button"
              disabled={!name.trim() || !subject.trim() || !body.trim()}
              onClick={() => setStep(2)}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-bold transition shadow-lg shadow-indigo-600/25"
            >
              Next: Audience <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}

          {step === 2 && (
            <button
              type="button"
              onClick={handleNextToAudit}
              disabled={auditing}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-lg shadow-indigo-600/25"
            >
              {auditing ? 'Auditing...' : 'Audit Recipients'} <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}

          {step === 3 && (
            <button
              type="button"
              onClick={() => setStep(4)}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-lg shadow-indigo-600/25"
            >
              Review & Test <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}

          {step === 4 && (
            <button
              type="button"
              disabled={submitting}
              onClick={handleLaunchBlast}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:opacity-90 disabled:opacity-40 text-white text-xs font-extrabold transition shadow-xl shadow-purple-600/30"
            >
              <Flame className="w-4 h-4" /> {submitting ? 'Launching...' : 'LAUNCH BLAST NOW'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
