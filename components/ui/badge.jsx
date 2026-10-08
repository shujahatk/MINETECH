import * as React from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

// One chip shape for the whole app: 20px high, 6px radius, tinted background + hairline border.
const badgeVariants = cva(
  'inline-flex h-5 items-center gap-1 whitespace-nowrap rounded-md border px-1.5 text-[11px] font-medium leading-none transition-colors',
  {
    variants: {
      variant: {
        default: 'border-primary/20 bg-primary/10 text-primary',
        secondary: 'border-border/80 bg-secondary text-secondary-foreground',
        destructive: 'border-danger/25 bg-danger/10 text-danger',
        outline: 'border-border bg-transparent text-foreground',
        success: 'border-success/25 bg-success/10 text-success',
        warning: 'border-warning/30 bg-warning/10 text-warning',
        info: 'border-info/25 bg-info/10 text-info',
        muted: 'border-border/80 bg-muted text-muted-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

function Badge({ className, variant, ...props }) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
