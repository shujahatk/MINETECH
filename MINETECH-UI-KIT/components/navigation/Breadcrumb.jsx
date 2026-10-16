import React from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '../../utils/cn';

export function Breadcrumb({ items = [], className = '' }) {
  return (
    <nav aria-label="Breadcrumbs" className={cn('flex items-center gap-1.5 text-xs font-medium', className)}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <React.Fragment key={item.label || index}>
            {index > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground/60 shrink-0" />}
            {item.href && !isLast ? (
              <a
                href={item.href}
                className="text-muted-foreground hover:text-foreground transition-colors truncate"
              >
                {item.label}
              </a>
            ) : (
              <span className={cn('truncate', isLast ? 'text-foreground font-semibold' : 'text-muted-foreground')}>
                {item.label}
              </span>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}

export default Breadcrumb;
