import { cn } from '@/lib/utils';

/**
 * Shared page header used by every screen.
 *  - icon:  lucide icon component rendered in a small neutral tile
 *  - meta:  short muted text next to the title (e.g. a count or "Live")
 *  - actions: right-aligned buttons
 */
export function PageHeader({ icon: Icon, title, description, meta, actions, className }) {
  return (
    <header className={cn('page-header', className)}>
      <div className="flex min-w-0 items-center gap-3">
        {Icon && (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground shadow-subtle">
            <Icon className="h-4 w-4" aria-hidden="true" />
          </div>
        )}
        <div className="min-w-0">
          <h1 className="page-heading flex items-baseline gap-2">
            <span className="truncate">{title}</span>
            {meta && <span className="text-xs font-normal tabular-nums text-muted-foreground">{meta}</span>}
          </h1>
          {description && <p className="page-description">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
