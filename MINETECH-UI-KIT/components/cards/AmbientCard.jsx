import React from 'react';
import { cn } from '../../utils/cn';

export function AmbientCard({ children, className = '', glow = 'primary', ...props }) {
  const glowColors = {
    primary: 'from-primary/10 via-transparent to-transparent',
    success: 'from-success/10 via-transparent to-transparent',
    warning: 'from-warning/10 via-transparent to-transparent',
  }[glow] || 'from-primary/10 via-transparent to-transparent';

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-card',
        className
      )}
      {...props}
    >
      <div
        className={cn(
          'pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-gradient-to-br blur-3xl opacity-60',
          glowColors
        )}
        aria-hidden="true"
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

export default AmbientCard;
