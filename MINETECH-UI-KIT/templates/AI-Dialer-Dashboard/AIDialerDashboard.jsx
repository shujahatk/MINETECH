'use client';

import React, { useState } from 'react';
import {
  PhoneCall,
  Search,
  Clock,
  User,
  Building,
  Zap,
  RotateCcw,
  Sparkles,
  Phone,
  Flame,
  CheckCircle2,
  Calendar,
} from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader';
import { WorkstationLayout } from '../../layouts/WorkstationLayout';
import { DialerPad } from '../../components/dialer/DialerPad';
import { CallControls } from '../../components/dialer/CallControls';
import { AiInsightCard } from '../../components/ai/AiInsightCard';
import { TemperatureBadge } from '../../components/feedback/TemperatureBadge';
import { StatusBadge } from '../../components/feedback/StatusBadge';
import { Button } from '../../components/buttons/Button';
import { mockDialerQueue, mockTimeline } from '../../utils/mockData';

export function AIDialerDashboard({ className = '' }) {
  const [queue, setQueue] = useState(mockDialerQueue);
  const [activeCallLead, setActiveCallLead] = useState(mockDialerQueue[0]);
  const [timeline, setTimeline] = useState(mockTimeline);
  const [search, setSearch] = useState('');
  const [callState, setCallState] = useState('idle');

  const filteredQueue = queue.filter(
    (item) =>
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.company.toLowerCase().includes(search.toLowerCase())
  );

  const handleCallEnded = ({ duration, phoneNumber }) => {
    // Add new history entry to timeline
    const newEntry = {
      id: `act-${Date.now()}`,
      type: 'CALL',
      title: `Completed Call (${duration}s)`,
      time: 'Just now',
      detail: `Outbound call to ${phoneNumber} with ${activeCallLead.name}.`,
      author: 'AI Agent Workstation',
      status: 'Completed',
    };
    setTimeline([newEntry, ...timeline]);
  };

  const handleSaveDisposition = ({ disposition, notes }) => {
    const newEntry = {
      id: `disp-${Date.now()}`,
      type: 'STAGE_CHANGE',
      title: `Disposition: ${disposition}`,
      time: 'Just now',
      detail: notes || 'Call logged with disposition.',
      author: 'Agent',
      status: disposition,
    };
    setTimeline([newEntry, ...timeline]);

    // Move to next lead in queue
    const nextIdx = (queue.findIndex((q) => q.id === activeCallLead.id) + 1) % queue.length;
    setActiveCallLead(queue[nextIdx]);
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <PageHeader
        icon={PhoneCall}
        title="AI Voice & Dialer Workstation"
        description="Priority predictive outbound queue with real-time MINE-TECH AI conversation intelligence."
        meta="Queue: 3 Pending Calls"
        actions={
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-md font-medium">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              SIP Trunk Connected
            </span>
          </div>
        }
      />

      <WorkstationLayout
        leftPane={
          <div className="flex flex-col h-full">
            {/* Queue Header & Search */}
            <div className="p-3 border-b border-border bg-card space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Priority Queue
                </span>
                <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                  {filteredQueue.length} Active
                </span>
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filter queue..."
                  className="h-7 w-full rounded-md border border-border bg-muted/40 pl-8 pr-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            {/* Queue Items List */}
            <div className="flex-1 overflow-y-auto divide-y divide-border/60">
              {filteredQueue.map((lead) => {
                const isSelected = activeCallLead?.id === lead.id;
                return (
                  <button
                    key={lead.id}
                    type="button"
                    onClick={() => setActiveCallLead(lead)}
                    className={`w-full p-3 text-left transition-colors cursor-pointer ${
                      isSelected ? 'row-selected' : 'hover:bg-muted/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold text-xs text-foreground truncate">
                        {lead.name}
                      </span>
                      <TemperatureBadge temperature={lead.temperature} score={lead.score} showScore />
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                      {lead.company} · {lead.title}
                    </p>
                    <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                      <span>{lead.phone}</span>
                      <span className="text-foreground/80">{lead.localTime}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        }
        centerPane={
          <div className="space-y-3">
            {/* Active Prospect Spotlight */}
            <div className="panel p-4 bg-card border-border flex items-center justify-between gap-4">
              <div>
                <span className="field-label text-[10px]">Active Contact Target</span>
                <h3 className="text-base font-bold text-foreground tracking-tight">
                  {activeCallLead.name}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {activeCallLead.title} at <strong className="text-foreground">{activeCallLead.company}</strong>
                </p>
              </div>
              <div className="text-right">
                <span className="field-label text-[10px]">Local Timezone</span>
                <span className="text-xs font-mono font-semibold text-foreground block">
                  {activeCallLead.timeZone}
                </span>
                <span className="text-[11px] text-primary font-medium block">
                  Local Time: {activeCallLead.localTime}
                </span>
              </div>
            </div>

            {/* AI Objection & Talking Points */}
            <AiInsightCard
              title="Live Call Intelligence & Strategy"
              fitScore={activeCallLead.score}
              priority={activeCallLead.temperature}
              summary={`Key focus for ${activeCallLead.company}: They are currently qualifying new suppliers for industrial scale delivery.`}
              reasons={[
                'Emphasize high purity specifications (98.5% assay guarantee).',
                'Mention ready stock availability at nearby distribution hubs.',
                'Offer sample batch with guaranteed 48-hour dispatch.',
              ]}
              recommendedAction="Pitch immediate 5-ton trial shipment with waived testing fee"
            />

            {/* Dialer & Call Controls Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <DialerPad
                initialNumber={activeCallLead.phone}
                contactName={activeCallLead.name}
                contactCompany={activeCallLead.company}
                onCallStateChange={setCallState}
                onCallEnded={handleCallEnded}
              />
              <CallControls onSaveDisposition={handleSaveDisposition} />
            </div>
          </div>
        }
        rightPane={
          <div className="flex flex-col h-full">
            <div className="p-3 border-b border-border bg-card flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
                Touchpoint History
              </span>
              <span className="text-[10px] text-muted-foreground">{timeline.length} events</span>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {timeline.map((act) => (
                <div key={act.id} className="relative pl-5 pb-3 border-l-2 border-border last:pb-0">
                  <div className="absolute -left-[5px] top-0.5 h-2 w-2 rounded-full bg-primary" />
                  <div className="space-y-0.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-foreground">{act.title}</span>
                      <span className="text-[10px] text-muted-foreground">{act.time}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-snug">{act.detail}</p>
                    <div className="pt-1 flex items-center justify-between text-[10px]">
                      <span className="text-muted-foreground/80">{act.author}</span>
                      {act.status && (
                        <span className="text-primary font-medium">{act.status}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        }
      />
    </div>
  );
}

export default AIDialerDashboard;
