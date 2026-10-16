'use client';
import React, { useRef } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '../../utils/cn';

/**
 * Universal Modal & Drawer Wrapper
 *  - drawer: boolean (if true, slides out from right as a drawer)
 *  - title: Accessibility title
 *  - onClose: Callback to close
 *  - dismissible: boolean
 */
export function ModalFrame({
  children,
  title,
  onClose,
  className,
  drawer = false,
  dismissible = true,
  showCloseButton = true,
}) {
  const opener = useRef(typeof document !== 'undefined' ? document.activeElement : null);

  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open && dismissible) onClose?.();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay scrim fixed inset-0 z-50 transition-opacity" />
        <Dialog.Content
          aria-describedby={undefined}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            opener.current?.focus?.();
          }}
          onPointerDownOutside={(event) => {
            if (!dismissible) event.preventDefault();
          }}
          onEscapeKeyDown={(event) => {
            if (!dismissible) event.preventDefault();
          }}
          className={cn(
            drawer
              ? 'drawer-surface fixed inset-y-0 right-0 z-50 w-full max-w-[640px] overflow-y-auto border-l border-border bg-card shadow-drawer outline-none'
              : 'modal-surface max-w-4xl rounded-2xl border border-border bg-card shadow-dialog',
            className
          )}
        >
          <Dialog.Title className="sr-only">{title || 'Modal Dialog'}</Dialog.Title>
          {showCloseButton && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close dialog"
              className="absolute right-4 top-4 z-10 rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default ModalFrame;
