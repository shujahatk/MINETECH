'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  BarChart3,
  TrendingUp,
  Users,
  ChevronRight,
  ArrowUpRight,
  Filter,
  CheckCircle2,
  AlertCircle,
  Flame,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

const STAGE_CONFIG = {
  NEW: { label: 'New Lead', color: 'from-blue-600 to-blue-500', text: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
  CONTACTED: { label: 'Contacted', color: 'from-indigo-600 to-indigo-500', text: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/30' },
  ENGAGED: { label: 'Engaged', color: 'from-cyan-600 to-cyan-500', text: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/30' },
  INTERESTED: { label: 'Interested', color: 'from-emerald-600 to-emerald-500', text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
  QUALIFIED: { label: 'Qualified', color: 'from-amber-600 to-amber-500', text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
  CUSTOMER: { label: 'Won / Customer', color: 'from-green-600 to-green-500', text: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/30' },
  FOLLOW_UP: { label: 'Follow Up', color: 'from-purple-600 to-purple-500', text: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/30' },
  NO_RESPONSE: { label: 'No Response', color: 'from-slate-600 to-slate-500', text: 'text-slate-400', bg: 'bg-slate-500/10', border: 'border-slate-500/30' },
  NOT_INTERESTED: { label: 'Not Interested', color: 'from-rose-600 to-rose-500', text: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/30' },
  DO_NOT_CONTACT: { label: 'Do Not Contact', color: 'from-red-700 to-red-600', text: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30' },
};

const FUNNEL_FLOW = ['NEW', 'CONTACTED', 'ENGAGED', 'INTERESTED', 'QUALIFIED', 'CUSTOMER'];

export default function AnalyticsView() {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeStage, setActiveStage] = useState(null);
  const [stageLeads, setStageLeads] = useState([]);
  const [loadingLeads, setLoadingLeads] = useState(false);

  useEffect(() => {
    fetch('/api/analytics')
      .then((r) => r.json())
      .then((j) => setData(j.data))
      .finally(() => setLoading(false));
  }, []);

  const handleStageClick = async (stageKey) => {
    if (activeStage === stageKey) {
      setActiveStage(null);
      setStageLeads([]);
      return;
    }

    setActiveStage(stageKey);
    setLoadingLeads(true);
    try {
      const res = await fetch(`/api/leads?status=${stageKey}&limit=10`);
      if (res.ok) {
        const json = await res.json();
        setStageLeads(json.leads || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingLeads(false);
    }
  };

  const navigateToLeads = (stageKey) => {
    router.push(`/leads?status=${stageKey}`);
  };

  if (loading) {
    return <div className="p-12 text-center text-xs text-slate-500">Loading performance analytics...</div>;
  }

  const email = data?.email || {};
  const calls = data?.calls || {};
  const pipeline = data?.pipeline || {};

  const totalLeads = Object.values(pipeline).reduce((a, b) => a + b, 0) || 1;
  const activePipelineLeads = (pipeline.NEW || 0) + (pipeline.CONTACTED || 0) + (pipeline.ENGAGED || 0) + (pipeline.INTERESTED || 0) + (pipeline.QUALIFIED || 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-pink-400" /> Sales Intelligence & Pipeline Analytics
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Deliverability rates, conversion velocity, and interactive pipeline stage distribution.
          </p>
        </div>

        <button
          onClick={() => router.push('/leads')}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/25 transition"
        >
          <Users className="w-4 h-4" /> Open CRM Workspace &rarr;
        </button>
      </div>

      {/* Top Metric Highlights */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-panel p-5 rounded-2xl border border-slate-800">
          <span className="text-xs text-slate-400 font-medium block">Active Outreach Leads</span>
          <span className="text-3xl font-black text-white block mt-2">{activePipelineLeads}</span>
          <span className="text-[10px] text-indigo-400 font-mono block mt-1">Total in active pipeline</span>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-emerald-500/20">
          <span className="text-xs text-emerald-300 font-semibold block">Prospect Reply Rate</span>
          <span className="text-3xl font-black text-emerald-300 block mt-2">{email.replyRate || '0.0%'}</span>
          <span className="text-[10px] text-emerald-400/80 font-mono block mt-1">{email.replied || 0} replies received</span>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-slate-800">
          <span className="text-xs text-slate-400 font-medium block">Email Open Rate</span>
          <span className="text-3xl font-black text-white block mt-2">{email.openRate || '0.0%'}</span>
          <span className="text-[10px] text-slate-400 font-mono block mt-1">{email.opened || 0} opened of {email.sent || 0}</span>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-slate-800">
          <span className="text-xs text-slate-400 font-medium block">Qualified & Customers</span>
          <span className="text-3xl font-black text-purple-300 block mt-2">
            {(pipeline.QUALIFIED || 0) + (pipeline.CUSTOMER || 0)}
          </span>
          <span className="text-[10px] text-purple-400 font-mono block mt-1">High-value pipeline stages</span>
        </div>
      </div>

      {/* FUNCTIONAL PIPELINE STAGE DISTRIBUTION & FUNNEL */}
      <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-4">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-indigo-400" /> Pipeline Stage Distribution & Funnel
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Click any stage card to inspect filtered leads or view full CRM list.
            </p>
          </div>
          <span className="text-xs font-mono text-slate-400 bg-slate-900/80 px-3 py-1.5 rounded-xl border border-slate-800">
            Total Leads in System: <strong className="text-white">{totalLeads}</strong>
          </span>
        </div>

        {/* Visual Conversion Funnel Flow */}
        <div className="space-y-3">
          <span className="text-xs font-bold text-slate-300 block">Conversion Funnel Progression:</span>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
            {FUNNEL_FLOW.map((stageKey, idx) => {
              const conf = STAGE_CONFIG[stageKey] || {};
              const count = pipeline[stageKey] || 0;
              const pctOfTotal = Math.round((count / totalLeads) * 100);
              const isSelected = activeStage === stageKey;

              return (
                <div
                  key={stageKey}
                  onClick={() => handleStageClick(stageKey)}
                  className={`p-4 rounded-2xl cursor-pointer transition-all border ${
                    isSelected
                      ? 'bg-indigo-600/20 border-indigo-500 shadow-lg shadow-indigo-600/20 scale-[1.02]'
                      : 'glass-card border-slate-800/80 hover:border-slate-700 hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`w-2 h-2 rounded-full ${conf.bg} border ${conf.border}`}></span>
                    <span className="text-[10px] font-mono text-slate-400">{pctOfTotal}%</span>
                  </div>

                  <span className="text-2xl font-extrabold text-white block">{count}</span>
                  <span className={`text-xs font-semibold block truncate mt-0.5 ${conf.text}`}>
                    {conf.label}
                  </span>

                  {/* Progress bar */}
                  <div className="w-full bg-slate-800/80 rounded-full h-1.5 mt-3 overflow-hidden">
                    <div
                      className={`h-full bg-gradient-to-r ${conf.color} rounded-full transition-all duration-300`}
                      style={{ width: `${Math.max(8, pctOfTotal)}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* All Pipeline Stages Breakdown Table & Actions */}
        <div className="space-y-3 pt-2">
          <span className="text-xs font-bold text-slate-300 block">All Pipeline Stages Breakdown:</span>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {Object.entries(STAGE_CONFIG).map(([stageKey, conf]) => {
              const count = pipeline[stageKey] || 0;
              const pct = Math.round((count / totalLeads) * 100);
              const isSelected = activeStage === stageKey;

              return (
                <div
                  key={stageKey}
                  onClick={() => handleStageClick(stageKey)}
                  className={`p-3.5 rounded-2xl border transition flex items-center justify-between cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-600/20 border-indigo-500 text-white'
                      : 'bg-slate-900/60 border-slate-800/80 hover:bg-slate-800/40 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${conf.bg} ${conf.text} border ${conf.border}`}>
                      {count}
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-white block truncate">{conf.label}</span>
                      <span className="text-[10px] text-slate-400 font-mono block">{pct}% of total leads</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigateToLeads(stageKey);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold flex items-center gap-1 transition"
                      title="Filter in CRM"
                    >
                      View CRM <ArrowUpRight className="w-3 h-3 text-slate-400" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Interactive Selected Stage Drawer & Lead Preview */}
        {activeStage && (
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-indigo-500/40 space-y-4 animate-in fade-in-50 duration-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-indigo-400" />
                <span className="font-bold text-xs text-white">
                  Prospects currently in stage: <span className="text-indigo-300">{STAGE_CONFIG[activeStage]?.label || activeStage}</span> ({stageLeads.length})
                </span>
              </div>
              <button
                onClick={() => navigateToLeads(activeStage)}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1"
              >
                Open Full List in CRM <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {loadingLeads ? (
              <div className="p-4 text-center text-xs text-slate-500">Loading prospects...</div>
            ) : stageLeads.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-500">No leads currently in this stage.</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                {stageLeads.map((lead) => (
                  <div
                    key={lead._id}
                    onClick={() => router.push(`/leads?leadId=${lead._id}`)}
                    className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-indigo-500/50 cursor-pointer transition space-y-1"
                  >
                    <span className="font-semibold text-xs text-white block truncate">
                      {lead.fullName || lead.firstName || lead.email}
                    </span>
                    <span className="text-[11px] text-slate-400 block truncate">
                      {lead.company || lead.jobTitle || 'No company'}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono block">
                      {lead.email}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
