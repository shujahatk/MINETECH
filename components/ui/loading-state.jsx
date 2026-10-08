import { Skeleton } from '@/components/ui/skeleton';

/**
 * Skeleton placeholder used instead of blocking spinners.
 *  - `cards`  -> a row of KPI-card skeletons
 *  - default  -> list-row skeletons (avatar + two lines + trailing chip)
 */
export function LoadingState({ rows = 4, label = 'Loading content', cards = false }) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={label}
      className={cards ? 'grid grid-cols-2 gap-3 xl:grid-cols-4' : 'divide-y divide-border/60'}
    >
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, i) =>
        cards ? (
          <div key={i} className="panel space-y-3">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-7 w-16" />
            <Skeleton className="h-3 w-32" />
          </div>
        ) : (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <Skeleton className="h-3 w-2/5" />
              <Skeleton className="h-2.5 w-3/5 opacity-70" />
            </div>
            <Skeleton className="h-5 w-14 shrink-0" />
          </div>
        )
      )}
    </div>
  );
}

/** Inline block of text-line skeletons for panels (e.g. "Loading stage leads"). */
export function LinesSkeleton({ lines = 3, className = '' }) {
  return (
    <div role="status" aria-busy="true" className={`space-y-2 ${className}`}>
      <span className="sr-only">Loading</span>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className="h-3" style={{ width: `${92 - i * 14}%` }} />
      ))}
    </div>
  );
}

/** Table-row skeletons for tables rendered with <table class="data-table">. */
export function TableRowsSkeleton({ rows = 5, cols = 4 }) {
  return Array.from({ length: rows }, (_, r) => (
    <tr key={r} aria-hidden="true">
      {Array.from({ length: cols }, (_, c) => (
        <td key={c}>
          <Skeleton className="h-3" style={{ width: `${55 + ((r + c) % 3) * 15}%` }} />
        </td>
      ))}
    </tr>
  ));
}
