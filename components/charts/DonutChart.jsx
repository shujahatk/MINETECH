'use client';
import React, { useEffect, useMemo, useRef, useState } from 'react';

/**
 * Lightweight SVG donut (no chart library).
 *
 *  data:       [{ key, label, value, color }]  — `color` is any CSS colour, e.g. 'hsl(var(--chart-1))'
 *  centerLabel / centerValue: shown in the hole (defaults to the total)
 *  onSegmentClick(item): optional; makes segments and legend rows interactive
 *
 * Draw-in animation is a CSS transition on stroke-dasharray (see .chart-arc in globals.css), so data
 * changes animate smoothly with zero JS per frame. Reduced-motion users get the final state instantly
 * through the global prefers-reduced-motion rule.
 */
export default function DonutChart({
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
  const [hover, setHover] = useState(null); // { index, x, y }
  const wrapRef = useRef(null);

  // Start collapsed, then expand on the next frame so the transition has something to animate from.
  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const items = useMemo(() => data.filter((d) => Number(d.value) > 0), [data]);
  const total = useMemo(() => items.reduce((sum, d) => sum + Number(d.value), 0), [items]);

  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const gap = items.length > 1 ? 2.5 : 0; // visual gap between segments, in px of arc length

  const segments = useMemo(() => {
    let cumulative = 0;
    return items.map((d) => {
      const fraction = Number(d.value) / total;
      const length = Math.max(fraction * circumference - gap, 0.5);
      const offset = -cumulative * circumference;
      cumulative += fraction;
      return { ...d, fraction, length, offset };
    });
  }, [items, total, circumference, gap]);

  const interactive = typeof onSegmentClick === 'function';
  const hovered = hover ? segments[hover.index] : null;

  const trackPointer = (event, index) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    setHover({ index, x: event.clientX - rect.left, y: event.clientY - rect.top });
  };

  return (
    <div className={`flex flex-col items-center gap-5 sm:flex-row sm:items-center ${className}`}>
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
                key={seg.key}
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

        {hovered && !hover.legend && (
          <div
            role="tooltip"
            className="pointer-events-none absolute z-10 whitespace-nowrap rounded-lg border border-border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-popover anim-scale-in"
            style={{
              left: Math.min(Math.max(hover.x + 12, 0), size - 8),
              top: Math.max(hover.y - 44, -8),
            }}
          >
            <div className="flex items-center gap-1.5 font-medium">
              <span className="h-2 w-2 rounded-full" style={{ background: hovered.color }} aria-hidden="true" />
              {hovered.label}
            </div>
            <div className="mt-0.5 tabular-nums text-muted-foreground">
              <span className="font-semibold text-foreground">{formatValue(Number(hovered.value))}</span>
              {' · '}
              {(hovered.fraction * 100).toFixed(hovered.fraction < 0.1 ? 1 : 0)}%
            </div>
          </div>
        )}
      </div>

      {legend && (
        <ul className="w-full min-w-0 flex-1 space-y-0.5" aria-label={`${ariaLabel} legend`}>
          {(data.length ? data : []).map((d) => {
            const value = Number(d.value) || 0;
            const index = segments.findIndex((s) => s.key === d.key);
            const pct = total > 0 ? (value / total) * 100 : 0;
            const active = hover?.index === index && index !== -1;
            const Row = interactive ? 'button' : 'div';
            return (
              <li key={d.key}>
                <Row
                  {...(interactive ? { type: 'button', onClick: () => onSegmentClick(d) } : {})}
                  onMouseEnter={() => index !== -1 && setHover({ index, x: size / 2, y: size / 2, legend: true })}
                  onMouseLeave={() => setHover(null)}
                  className={`flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-xs transition-colors ${
                    active ? 'bg-muted/70' : interactive ? 'hover:bg-muted/50' : ''
                  } ${value === 0 ? 'opacity-55' : ''}`}
                >
                  <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: d.color }} aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate font-medium text-foreground/90">{d.label}</span>
                  <span className="font-semibold tabular-nums text-foreground">{formatValue(value)}</span>
                  <span className="w-9 text-right tabular-nums text-muted-foreground">{pct >= 10 || pct === 0 ? Math.round(pct) : pct.toFixed(1)}%</span>
                </Row>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
