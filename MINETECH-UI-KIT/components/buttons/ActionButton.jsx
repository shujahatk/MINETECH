import React from 'react';
import { cn } from '../../utils/cn';

export function ActionButton({
  icon: Icon,
  label,
  onClick,
  active = false,
  variant = 'default',
  size = 'md',
  className = '',
  disabled = false,
  ...props
}) {
  const sizeStyles = {
    sm: 'h-7 px-2 text-xs gap-1',
    md: 'h-8 px-2.5 text-xs gap-1.5',
    lg: 'h-9 px-3.5 text-sm gap-2',
  }[size];

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex items-center justify-center font-medium rounded-lg border transition-all duration-150 cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50 disabled:cursor-not-allowed',
        sizeStyles,
        active
          ? 'bg-primary text-primary-foreground border-primary shadow-subtle'
          : 'bg-card border-border text-foreground hover:bg-muted/70 hover:border-muted-foreground/30',
        className
      )}
      {...props}
    >
      {Icon && <Icon className="h-3.5 w-3.5 shrink-0" />}
      {label && <span>{label}</span>}
    </button>
  );
}

export default ActionButton;
