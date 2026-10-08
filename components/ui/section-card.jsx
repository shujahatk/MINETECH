import { cn } from '@/lib/utils';

/**
 * The one container used for every dashboard / analytics / settings block, so headers line up.
 *   <SectionCard title="Pipeline" description="..." icon={Icon} action={<Link/>}>...</SectionCard>
 * `flush` removes body padding (for tables and lists that bring their own row padding).
 */
export function SectionCard({ title, description, icon: Icon, action, children, flush = false, className, bodyClassName, id }) {
  return (
    <section id={id} className={cn('rounded-xl border border-border bg-card text-card-foreground shadow-card', className)}>
      {(title || action) && (
        <header className="flex items-start justify-between gap-3 border-b border-border/70 px-4 py-3">
          <div className="flex min-w-0 items-start gap-2.5">
            {Icon && (
              <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted/70 text-muted-foreground" aria-hidden="true">
                <Icon className="h-3.5 w-3.5" />
              </div>
            )}
            <div className="min-w-0">
              <h2 className="section-heading truncate">{title}</h2>
              {description && <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{description}</p>}
            </div>
          </div>
          {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
        </header>
      )}
      <div className={cn(flush ? '' : 'p-4', bodyClassName)}>{children}</div>
    </section>
  );
}
