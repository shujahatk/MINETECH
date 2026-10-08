'use client';
import * as Dialog from '@radix-ui/react-dialog';
import { useRef } from 'react';
import { cn } from '@/lib/utils';

// Adapts existing form bodies without changing their submit or data contracts.
export function ModalFrame({ children, title, onClose, className, drawer = false, dismissible = true }) {
  const opener = useRef(typeof document !== 'undefined' ? document.activeElement : null);
  return <Dialog.Root open onOpenChange={(open) => { if (!open && dismissible) onClose?.(); }}>
    <Dialog.Portal>
      <Dialog.Overlay className="modal-overlay scrim fixed inset-0 z-50" />
      <Dialog.Content aria-describedby={undefined}
        onCloseAutoFocus={(event) => { event.preventDefault(); opener.current?.focus?.(); }}
        onPointerDownOutside={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => { if (!dismissible) event.preventDefault(); }}
        className={cn(drawer ? 'drawer-surface fixed inset-y-0 right-0 z-50 w-full max-w-[640px] overflow-y-auto border-l border-border bg-card shadow-drawer outline-none' : 'modal-surface max-w-4xl', className)}>
        <Dialog.Title className="sr-only">{title}</Dialog.Title>
        {children}
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
