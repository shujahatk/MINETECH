'use client';

export default function SegmentedControl({
  options = [],
  value,
  onChange,
  className = '',
}) {
  return (
    <div className={`inline-flex items-center gap-0.5 rounded-lg border border-border bg-muted/50 p-0.5 ${className}`}>
      {options.map((opt) => {
        const isSelected = typeof opt === 'object' ? opt.value === value : opt === value;
        const label = typeof opt === 'object' ? opt.label : opt;
        const optVal = typeof opt === 'object' ? opt.value : opt;

        return (
          <button
            key={optVal}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onChange && onChange(optVal)}
            className={`h-6 rounded-md px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 ${
              isSelected
                ? 'bg-card text-foreground shadow-subtle ring-1 ring-border'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
