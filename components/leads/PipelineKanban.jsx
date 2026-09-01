'use client';

import React, { useState } from 'react';
import { Mail, Phone, Clock, ChevronRight, Building, ArrowRight, UserCheck, Flame } from 'lucide-react';

const KANBAN_STAGES = [
  { id: 'NEW', title: 'New Leads', color: 'border-t-blue-500', badge: 'bg-blue-500/10 text-blue-400' },
  { id: 'CONTACTED', title: 'Contacted', color: 'border-t-indigo-500', badge: 'bg-indigo-500/10 text-indigo-400' },
  { id: 'ENGAGED', title: 'Engaged', color: 'border-t-cyan-500', badge: 'bg-cyan-500/10 text-cyan-400' },
  { id: 'INTERESTED', title: 'Interested', color: 'border-t-emerald-500', badge: 'bg-emerald-500/10 text-emerald-400' },
  { id: 'QUALIFIED', title: 'Qualified', color: 'border-t-amber-500', badge: 'bg-amber-500/10 text-amber-400' },
  { id: 'CUSTOMER', title: 'Won / Customer', color: 'border-t-green-500', badge: 'bg-green-500/10 text-green-400' },
  { id: 'FOLLOW_UP', title: 'Follow Up', color: 'border-t-purple-500', badge: 'bg-purple-500/10 text-purple-400' },
];

export default function PipelineKanban({ leads = [], onSelectLead, onUpdateStage }) {
  const [updatingId, setUpdatingId] = useState(null);

  const handleStageChange = async (leadId, newStage, e) => {
    e.stopPropagation();
    setUpdatingId(leadId);
    try {
      await fetch(`/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStage }),
      });
      if (onUpdateStage) onUpdateStage(leadId, newStage);
    } catch (err) {
      console.error(err);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 pt-2">
      {KANBAN_STAGES.map((stage) => {
        const stageLeads = leads.filter((l) => l.status === stage.id);

        return (
          <div
            key={stage.id}
            className={`min-w-[280px] max-w-[320px] flex-1 glass-panel rounded-2xl border-t-4 ${stage.color} p-4 flex flex-col justify-between space-y-3 bg-[#0a0f1d]/90`}
          >
            {/* Stage Column Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs text-white">{stage.title}</span>
                <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${stage.badge}`}>
                  {stageLeads.length}
                </span>
              </div>
            </div>

            {/* Lead Cards List */}
            <div className="space-y-2.5 min-h-[350px] max-h-[600px] overflow-y-auto pr-1">
              {stageLeads.length === 0 ? (
                <div className="p-8 text-center text-[11px] text-slate-600 border border-dashed border-slate-800/80 rounded-xl">
                  No prospects in {stage.title}
                </div>
              ) : (
                stageLeads.map((lead) => (
                  <div
                    key={lead._id}
                    onClick={() => onSelectLead(lead._id)}
                    className="p-3.5 rounded-xl glass-card border border-slate-800/80 hover:border-indigo-500/50 cursor-pointer transition shadow-sm hover:shadow-md space-y-2.5 group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-white block truncate group-hover:text-indigo-300 transition">
                          {lead.fullName || lead.firstName || lead.email}
                        </span>
                        {lead.company && (
                          <span className="text-[11px] text-slate-400 block truncate mt-0.5 flex items-center gap-1">
                            <Building className="w-3 h-3 text-slate-500 shrink-0" />
                            {lead.company}
                          </span>
                        )}
                      </div>

                      {lead.hasUnansweredReply && (
                        <span className="px-1.5 py-0.5 text-[9px] font-bold rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shrink-0 animate-pulse">
                          Reply
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-800/50">
                      <span className="truncate font-mono">{lead.email}</span>
                      <select
                        value={lead.status}
                        onChange={(e) => handleStageChange(lead._id, e.target.value, e)}
                        onClick={(e) => e.stopPropagation()}
                        disabled={updatingId === lead._id}
                        className="bg-slate-900 border border-slate-700 text-slate-300 text-[10px] rounded px-1.5 py-0.5 focus:outline-none focus:border-indigo-500"
                      >
                        {KANBAN_STAGES.map((s) => (
                          <option key={s.id} value={s.id}>
                            &rarr; {s.title}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
