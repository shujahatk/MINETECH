import * as React from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg text-[13px] font-medium ring-offset-background transition-colors duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow-subtle hover:bg-primary/90 active:bg-primary/85',
        destructive: 'bg-destructive text-destructive-foreground shadow-subtle hover:bg-destructive/90',
        outline: 'border border-border bg-card text-foreground shadow-subtle hover:bg-muted/70',
        secondary: 'border border-border/60 bg-secondary text-secondary-foreground hover:bg-muted',
        ghost: 'text-muted-foreground hover:bg-muted hover:text-foreground',
        link: 'h-auto p-0 font-medium text-primary underline-offset-4 hover:underline',
        cyan: 'bg-primary text-primary-foreground shadow-subtle hover:bg-primary/90',
      },
      size: {
        default: 'h-9 px-3.5',
        sm: 'h-8 px-3',
        lg: 'h-10 px-4',
        icon: 'h-8 w-8 p-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

const Button = React.forwardRef(({ className, variant, size, ...props }, ref) => {
  return (
    <button
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props}
    />
  );
});
Button.displayName = 'Button';

export { Button, buttonVariants };
