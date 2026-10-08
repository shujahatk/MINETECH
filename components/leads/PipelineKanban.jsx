'use client';

import React, { useState } from 'react';
import {
  Mail,
  Phone,
  Clock,
  ChevronRight,
  Building,
  ArrowRight,
  UserCheck,
  Beaker,
  PackageCheck,
  AlertCircle,
  Archive,
  Calendar,
  Layers,
  MapPin,
  Flame,
  Star,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import StatusBadge from '@/components/ui/StatusBadge';

export const MINE_TECH_STAGES = [
  { id: 'NEW', title: '1. New Lead', color: 'border-t-primary/70', badgeClass: 'bg-primary/10 text-primary border-primary/20' },
  { id: 'CONTACTED', title: '2. Contacted', color: 'border-t-muted-foreground/60', badgeClass: 'bg-muted text-muted-foreground border-border' },
  { id: 'ENGAGED', title: '3. Engaged', color: 'border-t-primary/80', badgeClass: 'bg-primary/15 text-primary border-primary/25' },
  { id: 'TECHNICAL_EVALUATION', title: '4. Technical Evaluation', color: 'border-t-primary', badgeClass: 'bg-primary/20 text-primary border-primary/30' },
  { id: 'COMMERCIAL_DISCUSSION', title: '5. Commercial Discussion', color: 'border-t-amber-500', badgeClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20' },
  { id: 'TRIAL_ORDER', title: '6. Trial Order', color: 'border-t-primary', badgeClass: 'bg-primary/25 text-primary border-primary/35' },
  { id: 'APPROVED_SUPPLIER', title: '7. Approved Supplier', color: 'border-t-primary/90', badgeClass: 'bg-primary/20 text-primary border-primary/30' },
  { id: 'RECURRING_CUSTOMER', title: '8. Recurring Customer', color: 'border-t-primary', badgeClass: 'bg-primary/30 text-primary border-primary/40' },
];

export const DEAL_STATUS_OPTIONS = [
  { id: 'ACTIVE', title: 'Active (In Pipeline)' },
  { id: 'ON_HOLD', title: 'On Hold (Deal on Pause)' },
  { id: 'LOST', title: 'Lost (Closed Unconverted)' },
  { id: 'WON_RECURRING', title: 'Won / Recurring (Commercial Account)' },
];

export default function PipelineKanban({ leads = [], onSelectLead, onUpdateStage }) {
  const [updatingId, setUpdatingId] = useState(null);
  const [dragOverStage, setDragOverStage] = useState(null);

  const handleStageChange = async (leadId, newStage, e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    setUpdatingId(leadId);
    try {
      await fetch(`/api/leads/${leadId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStage }),
      });
      if (onUpdateStage) onUpdateStage(leadId, newStage);
    } catch (err) {
      console.error('Failed to update stage:', err);
    } finally {
      setUpdatingId(null);
    }
  };

  const getNextActionBadge = (nextDate, nextAction) => {
    if (!nextDate && !nextAction) {
      return (
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground/80 font-medium">
          <Clock className="h-3 w-3 text-muted-foreground/60" />
          <span>No next action set</span>
        </div>
      );
    }

    if (!nextDate) {
      return (
        <div className="flex items-center gap-1 text-[10px] text-foreground font-medium truncate">
          <Clock className="h-3 w-3 text-primary" />
          <span className="truncate">{nextAction}</span>
        </div>
      );
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const actionDate = new Date(nextDate);
    actionDate.setHours(0, 0, 0, 0);

    const diffDays = Math.round((actionDate - today) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return (
        <div className="flex items-center gap-1 text-[10px] text-rose-700 dark:text-rose-400 bg-rose-500/10 border border-rose-500/20 px-1.5 py-0.5 rounded-md font-semibold truncate">
          <AlertTriangle className="h-3 w-3 shrink-0" />
          <span className="truncate">Overdue: {nextAction || 'Action'} ({actionDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })})</span>
        </div>
      );
    }

    if (diffDays === 0) {
      return (
        <div className="flex items-center gap-1 text-[10px] text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-md font-semibold truncate">
          <Clock className="h-3 w-3 shrink-0" />
          <span className="truncate">Due Today: {nextAction || 'Action'}</span>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/40 border border-border px-1.5 py-0.5 rounded-md font-medium truncate">
        <Calendar className="h-3 w-3 text-primary shrink-0" />
        <span className="truncate">{nextAction || 'Action'}: {actionDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
      </div>
    );
  };

  return (
    <div className="flex gap-3 overflow-x-auto pb-3 pt-1">
      {MINE_TECH_STAGES.map((stage) => {
        const stageLeads = leads.filter((l) => l.status === stage.id);
        const isTargeted = dragOverStage === stage.id;

        return (
          <div
            key={stage.id}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOverStage(stage.id);
            }}
            onDragLeave={() => setDragOverStage(null)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOverStage(null);
              const droppedId = e.dataTransfer.getData('text/plain');
              if (droppedId) {
                handleStageChange(droppedId, stage.id, e);
              }
            }}
            className={`min-w-[280px] max-w-[320px] flex-1 bg-muted/30 border border-border border-t-2 ${stage.color} rounded-xl p-2.5 flex flex-col justify-between space-y-2.5 transition-colors ${
              isTargeted ? 'ring-2 ring-primary bg-primary/5 border-primary/40' : ''
            }`}
          >
            {/* Stage Column Header */}
            <div className="flex items-center justify-between border-b border-border pb-2">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-xs text-foreground tracking-tight">{stage.title}</span>
                <span className={`px-1.5 py-0.5 text-[10px] font-semibold rounded-md border tabular-nums ${stage.badgeClass}`}>
                  {stageLeads.length}
                </span>
              </div>
            </div>

            {/* Lead Cards List */}
            <div className="space-y-2 min-h-[380px] max-h-[calc(100vh-18rem)] overflow-y-auto pr-1">
              {stageLeads.length === 0 ? (
                <div className="p-8 text-center text-[11px] text-muted-foreground border border-dashed border-border rounded-xl bg-card">
                  No active opportunities
                </div>
              ) : (
                stageLeads.map((lead) => {
                  const leadId = lead._id || lead.id;
                  const cf = lead.custom_fields || lead.customFields || {};
                  const product = lead.productCategory || cf.product_category || 'Kaolin';
                  const grade = lead.productGrade || cf.product_grade;
                  const app = lead.application || cf.application || 'Ceramics';
                  const country = lead.country || cf.country;
                  const sample = lead.sampleStatus || cf.sample_status;
                  const trial = lead.trialStatus || cf.trial_status;
                  const nextAction = lead.nextAction || cf.next_action;
                  const nextDate = lead.nextActionDate || cf.next_action_date || lead.nextFollowUpAt;
                  const priority = lead.priority || cf.priority || 'WARM';

                  return (
                    <div
                      key={leadId}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', leadId);
                      }}
                      onClick={() => onSelectLead(leadId)}
                      className="p-3 rounded-lg bg-card border border-border hover:border-muted-foreground/40 hover:shadow-card cursor-grab active:cursor-grabbing transition-colors space-y-2 group shadow-subtle text-foreground"
                    >
                      {/* Top: Company Name + Priority Badge */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <span className="text-xs font-semibold text-foreground block truncate group-hover:text-primary transition-colors">
                            {lead.company || lead.fullName || lead.name || 'MineTech Prospect'}
                          </span>
                          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5 truncate">
                            {country && (
                              <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                                <MapPin className="h-2.5 w-2.5 text-primary shrink-0" />
                                {country}
                              </span>
                            )}
                            {lead.fullName && lead.company && (
                              <span className="truncate text-[10px]">
                                • {lead.fullName} {lead.jobTitle ? `(${lead.jobTitle})` : ''}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Priority / Temperature indicator */}
                        {priority === 'HOT' && (
                          <span className="px-1.5 py-0.5 text-[9px] font-semibold rounded-md bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20 shrink-0 flex items-center gap-0.5">
                            <Flame className="h-2.5 w-2.5" /> Hot
                          </span>
                        )}
                        {priority === 'STRATEGIC' && (
                          <span className="px-1.5 py-0.5 text-[9px] font-semibold rounded-md bg-primary/10 text-primary border border-primary/20 shrink-0 flex items-center gap-0.5">
                            <Star className="h-2.5 w-2.5" /> Strategic
                          </span>
                        )}
                      </div>

                      {/* Product & Application classification pills */}
                      <div className="flex flex-wrap gap-1 items-center">
                        <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20 text-[10px] font-semibold truncate max-w-[170px]">
                          {product}{grade ? ` — ${grade}` : ''}
                        </span>
                        {app && (
                          <span className="px-2 py-0.5 rounded-md bg-muted text-muted-foreground border border-border text-[10px] font-medium truncate max-w-[110px]">
                            {app}
                          </span>
                        )}
                      </div>

                      {/* Sub-status badges */}
                      {/* Technical Evaluation Sub-Status */}
                      {(stage.id === 'TECHNICAL_EVALUATION' || (sample && sample !== 'Sample Not Required' && sample !== 'Requirements Not Yet Received')) && (
                        <div className="flex items-center gap-1 text-[10px] bg-primary/10 border border-primary/20 text-primary px-2 py-0.5 rounded-lg w-fit max-w-full truncate">
                          <Beaker className="h-3 w-3 shrink-0" />
                          <span className="font-semibold">Sample:</span>
                          <span className="truncate">{sample || 'Requested'}</span>
                        </div>
                      )}

                      {/* Trial Order Sub-Status */}
                      {(stage.id === 'TRIAL_ORDER' || (trial && trial !== 'Trial Discussed')) && (
                        <div className="flex items-center gap-1 text-[10px] bg-primary/10 border border-primary/20 text-primary px-2 py-0.5 rounded-lg w-fit max-w-full truncate">
                          <PackageCheck className="h-3 w-3 shrink-0" />
                          <span className="font-semibold">Trial:</span>
                          <span className="truncate">{trial || 'Confirmed'}</span>
                        </div>
                      )}

                      {/* Next Action & Date bar */}
                      <div className="pt-0.5">
                        {getNextActionBadge(nextDate, nextAction)}
                      </div>

                      {/* Bottom Footer: Quick Move Selector */}
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-2 border-t border-border">
                        <span className="text-[10px] text-muted-foreground">Move:</span>
                        <select
                          value={lead.status}
                          onChange={(e) => handleStageChange(leadId, e.target.value, e)}
                          onClick={(e) => e.stopPropagation()}
                          disabled={updatingId === leadId}
                          className="bg-muted/40 border border-border text-foreground text-[10px] rounded-lg px-2 py-0.5 focus:outline-none focus:border-primary cursor-pointer font-medium max-w-[160px] truncate"
                        >
                          <optgroup label="Main Pipeline Stages">
                            {MINE_TECH_STAGES.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.title}
                              </option>
                            ))}
                          </optgroup>
                          <optgroup label="Deal Statuses (Off-Pipeline)">
                            {DEAL_STATUS_OPTIONS.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.title}
                              </option>
                            ))}
                          </optgroup>
                        </select>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

