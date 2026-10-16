'use client';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '../../utils/cn';

/**
 * Lightweight SVG Donut Chart (Zero chart libraries, zero bundle bloat).
 *
 *  data: [{ key, label, value, color }] — `color` is any CSS color, e.g. 'hsl(var(--chart-1))'
 *  centerLabel / centerValue: shown in the hole (defaults to the total)
 *  onSegmentClick(item): optional; makes segments and legend rows interactive
 *  legend: boolean (renders rich interactive legend)
 */
export function DonutChart({
  data = [],
  size = 176,
  thickness = 18,
  centerLabel = 'Total',
  centerValue,
  formatValue = (v) => v.toLocaleString(),
  onSegmentClick,
  ariaLabel = 'Distribution chart',
  className = '',
  legend = true,
  emptyMessage = 'No data yet',
}) {
  const [ready, setReady] = useState(false);
  const [hover, setHover] = useState(null);
  const wrapRef = useRef(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const items = useMemo(() => data.filter((d) => Number(d.value) > 0), [data]);
  const total = useMemo(() => items.reduce((sum, d) => sum + Number(d.value), 0), [items]);

  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const gap = items.length > 1 ? 2.5 : 0;

  const segments = useMemo(() => {
    let cumulative = 0;
    return items.map((d) => {
      const fraction = total > 0 ? Number(d.value) / total : 0;
      const length = Math.max(fraction * circumference - gap, 0.5);
      const offset = -cumulative * circumference;
      cumulative += fraction;
      return { ...d, fraction, length, offset };
    });
  }, [items, total, circumference, gap]);

  const interactive = typeof onSegmentClick === 'function';

  const trackPointer = (event, index) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    setHover({ index, x: event.clientX - rect.left, y: event.clientY - rect.top });
  };

  return (
    <div className={cn('flex flex-col items-center gap-5 sm:flex-row sm:items-center', className)}>
      <div ref={wrapRef} className="relative shrink-0" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          role="img"
          aria-label={`${ariaLabel}: ${items.map((d) => `${d.label} ${formatValue(Number(d.value))}`).join(', ') || emptyMessage}`}
          className="-rotate-90"
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="hsl(var(--chart-track))"
            strokeWidth={thickness}
          />
          {segments.map((seg, index) => {
            const isActive = hover?.index === index;
            const dimmed = hover && !isActive;
            return (
              <circle
                key={seg.key || index}
                className="chart-arc"
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={seg.color}
                strokeWidth={isActive ? thickness + 3 : thickness}
                strokeDasharray={ready ? `${seg.length} ${circumference - seg.length}` : `0 ${circumference}`}
                strokeDashoffset={seg.offset}
                opacity={dimmed ? 0.35 : 1}
                style={{ cursor: interactive ? 'pointer' : 'default' }}
                onMouseEnter={(e) => trackPointer(e, index)}
                onMouseMove={(e) => trackPointer(e, index)}
                onMouseLeave={() => setHover(null)}
                onClick={interactive ? () => onSegmentClick(seg) : undefined}
              />
            );
          })}
        </svg>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          {total > 0 ? (
            <>
              <span className="text-2xl font-semibold leading-none tracking-tight text-foreground tabular-nums">
                {centerValue ?? formatValue(total)}
              </span>
              <span className="mt-1 max-w-[7rem] truncate text-[11px] font-medium text-muted-foreground">{centerLabel}</span>
            </>
          ) : (
            <span className="max-w-[7rem] text-xs text-muted-foreground">{emptyMessage}</span>
          )}
        </div>
      </div>

      {legend && (
        <ul className="w-full flex-1 space-y-1.5 text-xs">
          {items.map((item, index) => {
            const isActive = hover?.index === index;
            const percentage = total > 0 ? Math.round((Number(item.value) / total) * 100) : 0;
            return (
              <li key={item.key || index}>
                <button
                  type="button"
                  onClick={interactive ? () => onSegmentClick(item) : undefined}
                  onMouseEnter={(e) => trackPointer(e, index)}
                  onMouseLeave={() => setHover(null)}
                  className={cn(
                    'flex w-full items-center justify-between gap-2 rounded-md px-2 py-1 text-left transition-colors',
                    isActive ? 'bg-muted/70' : 'hover:bg-muted/40',
                    interactive ? 'cursor-pointer' : 'cursor-default'
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: item.color }}
                      aria-hidden="true"
                    />
                    <span className="truncate font-medium text-foreground">{item.label}</span>
                  </div>
                  <div className="flex items-center gap-2 tabular-nums">
                    <span className="text-muted-foreground text-[11px]">{percentage}%</span>
                    <span className="font-semibold text-foreground">{formatValue(Number(item.value))}</span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default DonutChart;
