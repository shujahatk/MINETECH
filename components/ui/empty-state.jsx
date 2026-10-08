import { Inbox } from 'lucide-react';

export function EmptyState({ icon: Icon = Inbox, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center px-5 py-10 text-center">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-muted/50 text-muted-foreground">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </div>
      <h3 className="text-[13px] font-semibold text-foreground">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">{description}</p>}
      {action && <div className="mt-3.5">{action}</div>}
    </div>
  );
}
