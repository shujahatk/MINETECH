'use client';
import React from 'react';
import { cn } from '../../utils/cn';

export function SegmentedControl({
  options = [],
  value,
  onChange,
  className = '',
}) {
  return (
    <div className={cn('inline-flex items-center gap-0.5 rounded-lg border border-border bg-muted/50 p-0.5', className)}>
      {options.map((opt) => {
        const isSelected = typeof opt === 'object' ? opt.value === value : opt === value;
        const label = typeof opt === 'object' ? opt.label : opt;
        const optVal = typeof opt === 'object' ? opt.value : opt;
        const Icon = typeof opt === 'object' ? opt.icon : null;

        return (
          <button
            key={optVal}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onChange && onChange(optVal)}
            className={cn(
              'flex items-center gap-1.5 h-6 rounded-md px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 cursor-pointer',
              isSelected
                ? 'bg-card text-foreground shadow-subtle ring-1 ring-border font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {Icon && <Icon className="h-3 w-3" />}
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}

export default SegmentedControl;
