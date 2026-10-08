'use client';
import React from 'react';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import AnimatedNumber from '@/components/ui/AnimatedNumber';

const TONES = {
  neutral: 'bg-muted/70 text-muted-foreground',
  brand: 'bg-primary/10 text-primary',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  info: 'bg-info/10 text-info',
  danger: 'bg-danger/10 text-danger',
};

/**
 * KPI tile used on Dashboard and Analytics.
 *  - value:    number (counts up on change) or pre-formatted string
 *  - delta:    short chip next to the value. Only pass real comparisons or a neutral qualifier.
 *  - tone:     colours the icon tile only; the value itself always stays foreground for legibility
 *  - href:     makes the whole card a link (adds a hover lift and a corner arrow)
 */
export default function MetricCard({
  title,
  value,
  delta,
  deltaType = 'positive',
  subtext = '',
  footerLabel,
  icon,
  tone = 'neutral',
  href,
  sparklineData,
  className = '',
}) {
  const points = Array.isArray(sparklineData) ? sparklineData.filter(Number.isFinite) : [];
  const min = Math.min(...points);
  const max = Math.max(...points);
  const path = points
    .map((v, i) => `${i ? 'L' : 'M'} ${(i * 60) / Math.max(points.length - 1, 1)} ${14 - ((v - min) / Math.max(max - min, 1)) * 12}`)
    .join(' ');

  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="field-label truncate">{title}</span>
        {icon && (
          <div
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-105 ${TONES[tone] || TONES.neutral}`}
            aria-hidden="true"
          >
            {icon}
          </div>
        )}
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <div className="text-[26px] font-semibold leading-none tracking-tight text-foreground tabular-nums">
          {typeof value === 'number' ? <AnimatedNumber value={value} /> : value}
        </div>
        {delta && (
          <span
            className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-medium leading-none ${
              deltaType === 'negative' ? 'tone-danger' : 'tone-neutral'
            }`}
          >
            {delta}
          </span>
        )}
      </div>
      {(footerLabel || points.length > 1 || subtext) && (
        <div className="mt-2.5 flex items-center justify-between gap-2">
          <span className="truncate text-xs text-muted-foreground">{subtext || footerLabel}</span>
          {points.length > 1 && (
            <svg className="h-4 w-16 shrink-0 text-primary" viewBox="0 0 60 16" aria-label="Metric trend">
              <path d={path} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
          )}
        </div>
      )}
      {href && (
        <ArrowUpRight
          className="absolute bottom-3 right-3 h-3.5 w-3.5 text-muted-foreground/0 transition-colors duration-200 group-hover:text-muted-foreground"
          aria-hidden="true"
        />
      )}
    </>
  );

  const base = `panel group relative flex flex-col justify-between ${className}`;

  if (href) {
    return (
      <Link
        href={href}
        className={`${base} panel-interactive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40`}
      >
        {body}
      </Link>
    );
  }

  return <div className={`${base} transition-colors hover:border-muted-foreground/30`}>{body}</div>;
}
