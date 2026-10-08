'use client';
import { ModalFrame } from '@/components/ui/modal-frame';

export default function GlassModal({
  isOpen,
  onClose,
  title,
  children,
  onConfirm,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmVariant = 'primary', // 'primary' | 'danger'
  loading = false,
  maxWidth = 'max-w-lg',
}) {
  if (!isOpen) return null;

  return (
    <ModalFrame title={title || "Confirm action"} onClose={onClose} dismissible={!loading}>
      <div className={`bg-card border border-border rounded-xl p-5 ${maxWidth} w-full shadow-sm  space-y-4`}>
        {title && (
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
              {title}
            </h3>
            <button
              aria-label="Close dialog"
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground text-sm font-bold p-1 transition-colors"
            >
              ✕
            </button>
          </div>
        )}

        <div className="text-xs text-foreground leading-relaxed space-y-3">
          {children}
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-xl text-xs font-medium text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            {cancelText}
          </button>
          {onConfirm && (
            <button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className={`px-4 py-2 rounded-xl text-xs font-bold text-foreground shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                confirmVariant === 'danger'
                  ? 'bg-rose-500 hover:bg-rose-400 shadow-rose-500/20'
                  : 'bg-primary   '
              }`}
            >
              {loading && <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              <span>{confirmText}</span>
            </button>
          )}
        </div>
      </div>
    </ModalFrame>
  );
}
