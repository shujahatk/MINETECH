'use client';

import { Toaster as Sonner } from 'sonner';
import { useTheme } from '@/components/theme/ThemeProvider';

// Follows the app theme (previously pinned to "light", which rendered light toasts on the dark UI).
const Toaster = ({ ...props }) => {
  const { resolvedTheme } = useTheme();
  return (
    <Sonner
      theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-popover group-[.toaster]:text-popover-foreground group-[.toaster]:border-border group-[.toaster]:shadow-popover group-[.toaster]:rounded-lg text-[13px] font-sans',
          description: 'group-[.toast]:text-muted-foreground text-[11px]',
          actionButton:
            'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground font-medium text-xs',
          cancelButton:
            'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
          success: 'group-[.toaster]:border-success/30',
          error: 'group-[.toaster]:border-destructive/30',
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
