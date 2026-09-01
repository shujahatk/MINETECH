'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Mail,
  Send,
  Inbox,
  PhoneCall,
  MessageSquare,
  Clock,
  Sparkles,
  ArrowUpRight,
  Flame,
  CheckCircle2,
  AlertCircle,
  Play,
  Pause,
  ExternalLink,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import LeadDrawer from '@/components/leads/LeadDrawer';

export default function PersonalDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedLeadId, setSelectedLeadId] = useState(null);

  const fetchDashboard = async () => {
    try {
      const res = await fetch('/api/dashboard/stats');
      if (res.ok) {
        const json = await res.json();
        setData(json.data);
      }
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(fetchDashboard, 15000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm text-slate-400 font-mono">Loading sales command center...</span>
        </div>
      </div>
    );
  }

  const today = data?.today || {};
  const activeCampaigns = data?.activeCampaigns || [];
  const priorityLeads = data?.priorityLeads || [];
  const recentActivities = data?.recentActivities || [];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            Sales Command Center <Flame className="w-6 h-6 text-amber-500 animate-bounce" />
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Personal outbound metrics, active email blasts, and prioritized leads for today.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Link
            href="/email/blasts"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold shadow-lg shadow-indigo-500/25 transition"
          >
            <Sparkles className="w-4 h-4" /> Launch Blast
          </Link>
          <Link
            href="/leads"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition"
          >
            Manage Leads <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Today's Activity Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <div className="glass-panel p-4 rounded-2xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Emails Sent</span>
            <Send className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-white">{today.emailsSent || 0}</span>
            <span className="text-[10px] text-slate-500 block mt-0.5">today</span>
          </div>
        </div>

        <div className="glass-panel p-4 rounded-2xl border-indigo-500/30 bg-indigo-950/20 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs text-indigo-300 font-semibold">Replies Received</span>
            <Inbox className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-indigo-300">{today.repliesReceived || 0}</span>
            <span className="text-[10px] text-indigo-400/70 block mt-0.5">prospect replies</span>
          </div>
        </div>

        <div className="glass-panel p-4 rounded-2xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Calls Placed</span>
            <PhoneCall className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-white">{today.callsMade || 0}</span>
            <span className="text-[10px] text-emerald-400 block mt-0.5">{today.callsConnected || 0} connected</span>
          </div>
        </div>

        <div className="glass-panel p-4 rounded-2xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">SMS Sent</span>
            <MessageSquare className="w-4 h-4 text-sky-400" />
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-white">{today.smsSent || 0}</span>
            <span className="text-[10px] text-slate-500 block mt-0.5">messages</span>
          </div>
        </div>

        <div className="glass-panel p-4 rounded-2xl border-amber-500/20 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs text-amber-300 font-semibold">Follow-ups Due</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-amber-300">{today.followUpsDue || 0}</span>
            <span className="text-[10px] text-amber-400/70 block mt-0.5">scheduled today</span>
          </div>
        </div>

        <div className="glass-panel p-4 rounded-2xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Total Pipeline</span>
            <TrendingUp className="w-4 h-4 text-purple-400" />
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-white">{today.totalLeads || 0}</span>
            <span className="text-[10px] text-slate-500 block mt-0.5">leads in CRM</span>
          </div>
        </div>
      </div>

      {/* Main Split: Priority Leads & Active Blasts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Priority Leads */}
        <div className="lg:col-span-2 space-y-6">
          {/* Priority Leads Table */}
          <div className="glass-panel rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Flame className="w-4 h-4 text-amber-400" /> Priority Leads & Unanswered Replies
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">Leads needing your immediate outreach or reply</p>
              </div>
              <Link href="/leads" className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1">
                View All <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {priorityLeads.length === 0 ? (
              <div className="p-8 text-center rounded-xl bg-slate-900/30 border border-dashed border-slate-800">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-80" />
                <p className="text-sm font-semibold text-slate-300">All caught up!</p>
                <p className="text-xs text-slate-500 mt-1">No unanswered replies or pending follow-ups right now.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {priorityLeads.map((lead) => (
                  <div
                    key={lead._id}
                    onClick={() => setSelectedLeadId(lead._id)}
                    className="p-3.5 rounded-xl glass-card flex items-center justify-between gap-3 cursor-pointer transition group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-slate-300 shrink-0">
                        {lead.firstName ? lead.firstName[0] : 'L'}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-slate-100 truncate group-hover:text-indigo-300 transition">
                            {lead.fullName || lead.email}
                          </span>
                          {lead.hasUnansweredReply && (
                            <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              NEW REPLY
                            </span>
                          )}
                          <span className={`px-2 py-0.5 text-[10px] rounded-full uppercase badge-${lead.status?.toLowerCase()}`}>
                            {lead.status}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 flex items-center gap-3 mt-0.5">
                          {lead.company && <span>{lead.company}</span>}
                          {lead.email && <span className="truncate">{lead.email}</span>}
                          {lead.lastReplySnippet && (
                            <span className="text-amber-400/90 italic truncate max-w-xs">
                              "{lead.lastReplySnippet}"
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedLeadId(lead._id);
                        }}
                        className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                        title="Open Lead"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Active Email Blast Campaigns */}
          <div className="glass-panel rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-400" /> Active Email Blasts
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">Current campaign progress and dispatch status</p>
              </div>
              <Link href="/email/blasts" className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1">
                Manage Blasts <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {activeCampaigns.length === 0 ? (
              <div className="p-6 text-center rounded-xl bg-slate-900/30 border border-slate-800/80">
                <p className="text-xs text-slate-400">No active blasts running at this moment.</p>
                <Link
                  href="/email/blasts"
                  className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-semibold mt-2"
                >
                  Create new email blast &rarr;
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {activeCampaigns.map((camp) => {
                  const sent = camp.stats?.sent || 0;
                  const total = camp.stats?.totalRecipients || 1;
                  const percent = Math.min(100, Math.round((sent / total) * 100));

                  return (
                    <div key={camp._id} className="p-4 rounded-xl glass-card space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-bold text-sm text-slate-100">{camp.name}</span>
                          <span className="text-xs text-slate-400 block mt-0.5">Subject: {camp.subject}</span>
                        </div>
                        <span
                          className={`px-2.5 py-0.5 text-xs font-semibold rounded-full uppercase ${
                            camp.status === 'running'
                              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 animate-pulse'
                              : 'bg-slate-700 text-slate-300'
                          }`}
                        >
                          {camp.status}
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div>
                        <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                          <span>
                            Progress: {sent} / {total} sent
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
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right 1 Col: Recent Unified Activity Stream */}
        <div className="glass-panel rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-400" /> Recent Activity
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">Unified communication log</p>
            </div>
          </div>

          <div className="space-y-3.5 relative before:absolute before:left-3.5 before:top-2 before:bottom-2 before:w-px before:bg-slate-800">
            {recentActivities.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-6">No recent activity logged yet.</p>
            ) : (
              recentActivities.map((act) => {
                const getIcon = () => {
                  if (act.action.includes('EMAIL')) return <Mail className="w-3.5 h-3.5 text-indigo-400" />;
                  if (act.action.includes('CALL')) return <PhoneCall className="w-3.5 h-3.5 text-emerald-400" />;
                  if (act.action.includes('SMS')) return <MessageSquare className="w-3.5 h-3.5 text-sky-400" />;
                  return <CheckCircle2 className="w-3.5 h-3.5 text-slate-400" />;
                };

                return (
                  <div key={act._id} className="relative flex items-start gap-3 pl-1">
                    <div className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 z-10">
                      {getIcon()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-slate-200 font-medium leading-snug">{act.summary}</p>
                      <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5">
                        <span>{new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        {act.leadId && (
                          <span
                            onClick={() => setSelectedLeadId(act.leadId._id || act.leadId)}
                            className="text-indigo-400 hover:underline cursor-pointer truncate max-w-[120px]"
                          >
                            {act.leadId.fullName || act.leadId.email || 'Lead'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Lead Detail Drawer */}
      {selectedLeadId && (
        <LeadDrawer leadId={selectedLeadId} onClose={() => setSelectedLeadId(null)} onUpdated={fetchDashboard} />
      )}
    </div>
  );
}
