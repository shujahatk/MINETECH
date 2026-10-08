'use client';
import React from 'react';

// Hot / Warm / Cold: same chip anatomy as StatusBadge (dot + label) so the two read as one system.
// Hot is the only "loud" tone; Cold is intentionally neutral so a page of leads stays scannable.
const STYLES = {
  HOT: {
    label: 'Hot',
    className: 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-400',
    dot: 'bg-rose-500',
  },
  WARM: {
    label: 'Warm',
    className: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400',
    dot: 'bg-amber-500',
  },
  COLD: {
    label: 'Cold',
    className: 'border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-400',
    dot: 'bg-sky-500',
  },
};

export default function TemperatureBadge({ temperature = 'COLD', score = null, showScore = false, className = '' }) {
  const s = STYLES[temperature] || STYLES.COLD;
  const hasScore = score !== null && score !== undefined && Number.isFinite(Number(score));
  return (
    <span
      title={hasScore ? `${s.label} · score ${Math.round(score)}` : s.label}
      className={`inline-flex h-5 items-center gap-1.5 rounded-md border px-1.5 text-[11px] font-medium leading-none ${s.className} ${className}`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${s.dot}`} aria-hidden="true" />
      <span>{s.label}</span>
      {showScore && hasScore && (
        <span className="border-l border-foreground/15 pl-1.5 tabular-nums opacity-70">{Math.round(score)}</span>
      )}
    </span>
  );
}
