'use client';
import React from 'react';

/**
 * Ranked horizontal bars: label + value on one line, a thin animated meter below.
 *   items: [{ key, label, value, color?, hint? }]
 *   max:   scale ceiling (defaults to the largest value, so the top row always fills the track)
 * Used for pipeline stages, the email funnel and campaign comparison.
 */
export default function BarList({
  items = [],
  max,
  formatValue = (v) => v.toLocaleString(),
  showPercentOfMax = false,
  onItemClick,
  emptyMessage = 'No data yet',
  className = '',
}) {
  const ceiling = Math.max(max ?? 0, ...items.map((i) => Number(i.value) || 0), 1);

  if (!items.length) {
    return <p className={`py-6 text-center text-xs text-muted-foreground ${className}`}>{emptyMessage}</p>;
  }

  return (
    <ul className={`space-y-1 ${className}`}>
      {items.map((item, index) => {
        const value = Number(item.value) || 0;
        const width = Math.max(value > 0 ? 3 : 0, (value / ceiling) * 100);
        const Row = onItemClick ? 'button' : 'div';
        return (
          <li key={item.key}>
            <Row
              {...(onItemClick ? { type: 'button', onClick: () => onItemClick(item) } : {})}
              className={`block w-full rounded-lg px-2 py-1.5 text-left ${
                onItemClick ? 'transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40' : ''
              }`}
            >
              <div className="flex items-baseline justify-between gap-3 text-xs">
                <span className="min-w-0 truncate font-medium text-foreground/90">
                  {item.label}
                  {item.hint && <span className="ml-1.5 font-normal text-muted-foreground">{item.hint}</span>}
                </span>
                <span className="shrink-0 tabular-nums">
                  <span className="font-semibold text-foreground">{formatValue(value)}</span>
                  {showPercentOfMax && (
                    <span className="ml-1.5 text-muted-foreground">{Math.round((value / ceiling) * 100)}%</span>
                  )}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-chart-track" aria-hidden="true">
                <div
                  className="chart-bar h-full rounded-full"
                  style={{
                    width: `${width}%`,
                    background: item.color || 'hsl(var(--chart-1))',
                    animationDelay: `${index * 40}ms`,
                    transition: 'width 500ms var(--motion-ease)',
                  }}
                />
              </div>
            </Row>
          </li>
        );
      })}
    </ul>
  );
}
