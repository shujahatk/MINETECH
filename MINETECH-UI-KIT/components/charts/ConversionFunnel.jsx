'use client';
import React from 'react';
import { cn } from '../../utils/cn';

export function ConversionFunnel({ stages = [], className = '' }) {
  if (!stages.length) return null;

  const topValue = stages[0]?.value || 1;

  return (
    <div className={cn('space-y-3', className)}>
      {stages.map((stage, idx) => {
        const percentOfTop = Math.round((stage.value / topValue) * 100);
        const prevStage = idx > 0 ? stages[idx - 1] : null;
        const conversionFromPrev = prevStage && prevStage.value > 0
          ? Math.round((stage.value / prevStage.value) * 100)
          : null;

        return (
          <div key={stage.label || idx} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-foreground">{stage.label}</span>
              <div className="flex items-center gap-2 tabular-nums">
                {conversionFromPrev !== null && (
                  <span className="text-[11px] text-muted-foreground">
                    ({conversionFromPrev}% of prev)
                  </span>
                )}
                <span className="font-semibold text-foreground">{stage.value.toLocaleString()}</span>
              </div>
            </div>

            <div className="relative h-6 w-full overflow-hidden rounded-md bg-muted/40 p-0.5">
              <div
                className="h-full rounded transition-all duration-700 ease-out flex items-center px-2"
                style={{
                  width: `${Math.max(percentOfTop, 4)}%`,
                  backgroundColor: stage.color || 'hsl(var(--primary))',
                  opacity: 0.85 + idx * 0.02,
                }}
              >
                <span className="text-[10px] font-semibold text-white truncate drop-shadow-sm">
                  {percentOfTop}%
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default ConversionFunnel;
