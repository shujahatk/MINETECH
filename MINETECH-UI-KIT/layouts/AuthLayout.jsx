'use client';

import React from 'react';
import { ThemeToggle } from '../themes/ThemeToggle';
import { ShieldCheck } from 'lucide-react';
import { cn } from '../utils/cn';

export function AuthLayout({
  brandName = 'MineTech',
  brandSuffix = 'Outbound',
  brandLogoText = 'M',
  tagline = 'Your conversations. One connected workstation.',
  footerNotice = 'Protected Enterprise Workstation',
  children,
  className = '',
}) {
  return (
    <div className={cn('relative min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-4 font-sans select-none', className)}>
      {/* Top Right Theme Toggle */}
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>

      <div className="relative w-full max-w-md space-y-6 mx-auto z-10">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 rounded-2xl bg-card border border-border shadow-subtle mb-1">
            <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center font-bold text-primary-foreground text-base shadow-sm">
              {brandLogoText}
            </div>
          </div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            {brandName} <span className="text-primary">{brandSuffix}</span>
          </h1>
          <p className="text-xs text-muted-foreground font-medium flex items-center justify-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            {tagline}
          </p>
        </div>

        {/* Auth Body Container */}
        <div className="bg-card border border-border rounded-2xl p-7 shadow-card space-y-5 text-foreground">
          {children}

          {/* Security Telemetry Footer */}
          <div className="pt-3 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground font-mono">
            <span>{footerNotice}</span>
            <span className="text-primary flex items-center gap-1 font-medium">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              <span>TLS / 256-Bit</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AuthLayout;
