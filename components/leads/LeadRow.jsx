'use client';
import React, { memo } from 'react';
import { ChevronRight } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import StatusBadge from '@/components/ui/StatusBadge';
import TemperatureBadge from '@/components/leads/TemperatureBadge';
import { dayDiff, formatShortDate, initials, statusLabel, timeAgo } from '@/lib/leads/format';

const MUTED_DASH = <span className="text-muted-foreground/50">—</span>;

function NextAction({ lead, today }) {
  const diff = dayDiff(lead.nextActionDate, today);
  const text = lead.nextAction;

  if (!text && diff === null) return MUTED_DASH;

  let tone = 'text-muted-foreground';
  let when = diff === null ? '' : formatShortDate(lead.nextActionDate);
  if (diff !== null && diff < 0) {
    tone = 'text-rose-600 dark:text-rose-400 font-medium';
    when = `Overdue · ${when}`;
  } else if (diff === 0) {
    tone = 'text-amber-700 dark:text-amber-400 font-medium';
    when = 'Today';
  }

  return (
    <div className="min-w-0 leading-tight">
      {text && <div className="truncate text-xs text-foreground">{text}</div>}
      {when && <div className={`truncate text-[11px] ${tone}`}>{when}</div>}
    </div>
  );
}

function LeadRowImpl({ lead, selected, isActive = false, today, onToggle, onOpen }) {
  const id = lead.id;

  // Row states: open-in-drawer (strongest) > checked > hover. Both get a 2px leading accent so the
  // state is readable without relying on colour tint alone.
  const stateClass = isActive
    ? 'bg-primary/10'
    : selected
      ? 'bg-primary/5'
      : 'hover:bg-muted/50';
  const accent = isActive || selected ? 'shadow-[inset_2px_0_0_hsl(var(--primary))]' : '';

  return (
    <tr
      tabIndex={0}
      onClick={() => onOpen(lead)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && e.target === e.currentTarget) onOpen(lead);
      }}
      data-selected={selected ? 'true' : undefined}
      aria-selected={isActive || selected || undefined}
      className={`group cursor-pointer outline-none transition-colors duration-100 focus-visible:bg-muted/60 focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-primary/50 ${stateClass}`}
    >
      <td
        className={`w-10 border-b border-border/60 px-3 py-2 text-center ${accent}`}
        onClick={(e) => e.stopPropagation()}
      >
        <Checkbox
          checked={selected}
          onCheckedChange={() => onToggle(id)}
          aria-label={`Select ${lead.name}`}
        />
      </td>

      <td className="min-w-[200px] max-w-[260px] border-b border-border/60 px-3 py-2">
        <div className="flex items-center gap-2.5">
          <div
            aria-hidden="true"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-muted/60 text-[10px] font-semibold text-muted-foreground"
          >
            {initials(lead.name)}
          </div>
          <div className="min-w-0 leading-tight">
            <div className="truncate text-[13px] font-medium text-foreground">{lead.name}</div>
            {lead.jobTitle && <div className="truncate text-[11px] text-muted-foreground">{lead.jobTitle}</div>}
          </div>
        </div>
      </td>

      <td className="max-w-[200px] border-b border-border/60 px-3 py-2">
        <div className="truncate text-[13px] text-foreground">{lead.company || MUTED_DASH}</div>
      </td>

      <td className="hidden max-w-[220px] border-b border-border/60 px-3 py-2 md:table-cell">
        <div className="truncate text-xs text-muted-foreground">{lead.email || '—'}</div>
      </td>

      <td className="whitespace-nowrap border-b border-border/60 px-3 py-2">
        <StatusBadge status={lead.status} label={statusLabel(lead.status)} size="sm" />
        {lead.isDnc && (
          <span className="ml-1.5 rounded border border-rose-500/25 bg-rose-500/10 px-1 py-px text-[10px] font-semibold uppercase text-rose-700 dark:text-rose-400">
            DNC
          </span>
        )}
      </td>

      <td className="whitespace-nowrap border-b border-border/60 px-3 py-2">
        <TemperatureBadge temperature={lead.temperature} score={lead.score} showScore />
      </td>

      <td className="hidden max-w-[150px] border-b border-border/60 px-3 py-2 xl:table-cell">
        {lead.ownerName ? (
          <div className="flex min-w-0 items-center gap-1.5">
            <span
              aria-hidden="true"
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[9px] font-semibold text-primary"
            >
              {initials(lead.ownerName)}
            </span>
            <span className="truncate text-xs text-foreground">{lead.ownerName}</span>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground/60">Unassigned</span>
        )}
      </td>

      <td className="hidden whitespace-nowrap border-b border-border/60 px-3 py-2 lg:table-cell">
        {lead.lastContactedAt ? (
          <span className="text-xs text-foreground" title={new Date(lead.lastContactedAt).toLocaleString()}>
            {timeAgo(lead.lastContactedAt)}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground/60">Never</span>
        )}
      </td>

      <td className="hidden max-w-[190px] border-b border-border/60 px-3 py-2 lg:table-cell">
        <NextAction lead={lead} today={today} />
      </td>

      <td className="w-8 border-b border-border/60 pr-3 text-right">
        <ChevronRight
          aria-hidden="true"
          className={`h-4 w-4 transition-all duration-100 group-hover:translate-x-0.5 group-hover:text-foreground ${
            isActive ? 'text-primary' : 'text-muted-foreground/30'
          }`}
        />
      </td>
    </tr>
  );
}

const LeadRow = memo(LeadRowImpl);
export default LeadRow;
