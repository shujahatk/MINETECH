import React from 'react';
import { cn } from '../../utils/cn';

export const GlowInput = React.forwardRef(
  ({ icon: Icon, rightIcon: RightIcon, onRightIconClick, className = '', error, ...props }, ref) => {
    return (
      <div className="relative w-full">
        {Icon && (
          <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground">
            <Icon className="h-4 w-4" />
          </div>
        )}
        <input
          ref={ref}
          className={cn(
            'w-full rounded-xl border border-border bg-muted/30 py-2.5 text-xs text-foreground placeholder-muted-foreground transition-all duration-150 focus:bg-card focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20',
            Icon ? 'pl-10' : 'pl-3.5',
            RightIcon ? 'pr-10' : 'pr-3.5',
            error && 'border-destructive focus:border-destructive focus:ring-destructive/20',
            className
          )}
          {...props}
        />
        {RightIcon && (
          <button
            type="button"
            onClick={onRightIconClick}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <RightIcon className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  }
);

GlowInput.displayName = 'GlowInput';
export default GlowInput;
