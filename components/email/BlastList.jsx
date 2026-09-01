'use client';

import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Play,
  Pause,
  RotateCcw,
  XCircle,
  Clock,
  Send,
  Users,
  Inbox,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import BlastWizard from '@/components/email/BlastWizard';

export default function BlastList() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);

  const fetchCampaigns = async () => {
    try {
      const res = await fetch('/api/email/campaigns');
      if (res.ok) {
        const json = await res.json();
        setCampaigns(json.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
    const interval = setInterval(fetchCampaigns, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleCampaignAction = async (id, action) => {
    setActionLoading(`${id}-${action}`);
    try {
      await fetch(`/api/email/campaigns/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      fetchCampaigns();
    } catch (e) {
      alert(`Error performing ${action}`);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-purple-400" /> Email Blast Campaigns
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Idempotent background email blast dispatcher with deliverability protections.
          </p>
        </div>

        <button
          onClick={() => setIsWizardOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:opacity-95 text-white text-xs font-bold shadow-lg shadow-purple-500/25 transition"
        >
          <Sparkles className="w-4 h-4" /> New Email Blast
        </button>
      </div>

      {/* Campaigns Grid */}
      {loading ? (
        <div className="p-12 text-center text-xs text-slate-500">Loading campaigns...</div>
      ) : campaigns.length === 0 ? (
        <div className="p-12 text-center rounded-2xl glass-panel border border-slate-800 space-y-3">
          <Sparkles className="w-10 h-10 text-purple-400 mx-auto opacity-70" />
          <h3 className="font-bold text-sm text-slate-200">No Email Blasts Created Yet</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Create your first targeted cold outreach campaign with recipient auditing and live deliverability tracking.
          </p>
          <button
            onClick={() => setIsWizardOpen(true)}
            className="mt-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold"
          >
            Create First Blast &rarr;
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {campaigns.map((camp) => {
            const sent = camp.stats?.sent || 0;
            const total = camp.stats?.totalRecipients || 1;
            const percent = Math.min(100, Math.round((sent / total) * 100));

            return (
              <div key={camp._id} className="p-5 rounded-2xl glass-panel border border-slate-800/80 space-y-4">
                {/* Header info */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="text-base font-bold text-white block truncate">{camp.name}</span>
                    <span className="text-xs text-slate-400 block mt-0.5 truncate">
                      Subject: &ldquo;{camp.subject}&rdquo;
                    </span>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 text-xs font-bold rounded-full uppercase shrink-0 ${
                      camp.status === 'running'
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 animate-pulse'
                        : camp.status === 'completed'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : camp.status === 'paused'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {camp.status}
                  </span>
                </div>

                {/* Progress bar */}
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5 font-medium">
                    <span>
                      {sent} of {total} sent
                    </span>
                    <span className="font-mono">{percent}%</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-indigo-500 to-purple-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${percent}%` }}
                    ></div>
                  </div>
                </div>

                {/* Quick stats row */}
                <div className="grid grid-cols-4 gap-2 pt-1 border-t border-slate-800/60 text-center">
                  <div className="p-2 rounded-xl bg-slate-900/60">
                    <span className="text-xs font-bold text-indigo-400 block">{camp.stats?.sent || 0}</span>
                    <span className="text-[10px] text-slate-500 block">Sent</span>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-900/60">
                    <span className="text-xs font-bold text-purple-400">{camp.stats?.opened || 0}</span>
                    <span className="text-[10px] text-slate-500 block">Opens</span>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-900/60">
                    <span className="text-xs font-bold text-emerald-400">{camp.stats?.replied || 0}</span>
                    <span className="text-[10px] text-slate-500 block">Replies</span>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-900/60">
                    <span className="text-xs font-bold text-rose-400">{camp.stats?.failed || 0}</span>
                    <span className="text-[10px] text-slate-500 block">Failed</span>
                  </div>
                </div>

                {/* Controls */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800/60">
                  {camp.status === 'draft' && (
                    <button
                      onClick={() => handleCampaignAction(camp._id, 'launch')}
                      disabled={actionLoading === `${camp._id}-launch`}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition"
                    >
                      <Play className="w-3.5 h-3.5" /> Launch
                    </button>
                  )}

                  {camp.status === 'running' && (
                    <button
                      onClick={() => handleCampaignAction(camp._id, 'pause')}
                      disabled={actionLoading === `${camp._id}-pause`}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600/20 text-amber-300 border border-amber-500/30 text-xs font-semibold hover:bg-amber-600/30 transition"
                    >
                      <Pause className="w-3.5 h-3.5" /> Pause
                    </button>
                  )}

                  {camp.status === 'paused' && (
                    <button
                      onClick={() => handleCampaignAction(camp._id, 'resume')}
                      disabled={actionLoading === `${camp._id}-resume`}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold hover:bg-emerald-600/30 transition"
                    >
                      <Play className="w-3.5 h-3.5" /> Resume
                    </button>
                  )}

                  {camp.stats?.failed > 0 && (
                    <button
                      onClick={() => handleCampaignAction(camp._id, 'retry')}
                      disabled={actionLoading === `${camp._id}-retry`}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 transition"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Retry Failed ({camp.stats.failed})
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Blast Wizard Modal */}
      {isWizardOpen && (
        <BlastWizard
          onClose={() => setIsWizardOpen(false)}
          onCreated={() => {
            setIsWizardOpen(false);
            fetchCampaigns();
          }}
        />
      )}
    </div>
  );
}
