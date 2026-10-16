'use client';
import React from 'react';
import { ArrowUpRight } from 'lucide-react';
import { AnimatedNumber } from '../common/AnimatedNumber';
import { cn } from '../../utils/cn';

const TONES = {
  neutral: 'bg-muted/70 text-muted-foreground',
  brand: 'bg-primary/10 text-primary',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  info: 'bg-info/10 text-info',
  danger: 'bg-danger/10 text-danger',
};

/**
 * KPI Metric Card used across Dashboards, CRM, and Analytics.
 *  - title: Label of the KPI
 *  - value: Number (counts up smoothly) or formatted string
 *  - delta: Short chip next to value (+14.2%, 12 new, etc.)
 *  - deltaType: 'positive' | 'negative' | 'neutral'
 *  - tone: 'brand' | 'success' | 'warning' | 'info' | 'danger' | 'neutral'
 *  - sparklineData: Array of numbers [20, 24, 30, 35, 42]
 *  - href: Optional URL (adds link affordance and corner arrow)
 *  - onClick: Optional click handler
 */
export function MetricCard({
  title,
  value,
  delta,
  deltaType = 'positive',
  subtext = '',
  footerLabel,
  icon,
  tone = 'neutral',
  href,
  onClick,
  sparklineData,
  className = '',
}) {
  const points = Array.isArray(sparklineData) ? sparklineData.filter(Number.isFinite) : [];
  const min = points.length ? Math.min(...points) : 0;
  const max = points.length ? Math.max(...points) : 1;
  const path = points
    .map((v, i) => `${i ? 'L' : 'M'} ${(i * 60) / Math.max(points.length - 1, 1)} ${14 - ((v - min) / Math.max(max - min, 1)) * 12}`)
    .join(' ');

  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="field-label truncate">{title}</span>
        {icon && (
          <div
            className={cn(
              'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-105',
              TONES[tone] || TONES.neutral
            )}
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
            className={cn(
              'inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-medium leading-none',
              deltaType === 'negative'
                ? 'tone-danger'
                : deltaType === 'positive'
                ? 'tone-success'
                : 'tone-neutral'
            )}
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
      {(href || onClick) && (
        <ArrowUpRight
          className="absolute bottom-3 right-3 h-3.5 w-3.5 text-muted-foreground/0 transition-colors duration-200 group-hover:text-muted-foreground"
          aria-hidden="true"
        />
      )}
    </>
  );

  const base = cn('panel group relative flex flex-col justify-between text-left', className);

  if (href) {
    return (
      <a
        href={href}
        className={cn(base, 'panel-interactive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 block')}
      >
        {body}
      </a>
    );
  }

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(base, 'panel-interactive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 w-full cursor-pointer')}
      >
        {body}
      </button>
    );
  }

  return <div className={cn(base, 'transition-colors hover:border-muted-foreground/30')}>{body}</div>;
}

export default MetricCard;
