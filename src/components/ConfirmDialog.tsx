import { useRef } from 'react';
import { useDialogA11y } from '../hooks/useDialogA11y';

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  variant?: 'default' | 'danger';
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  variant = 'default',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useDialogA11y({
    open,
    onClose: onCancel,
    containerRef: dialogRef,
    initialFocusRef: cancelRef,
  });

  if (!open) return null;

  const confirmClass =
    variant === 'danger'
      ? 'bg-[var(--color-error)] text-white hover:opacity-90'
      : 'bg-[var(--color-ink)] text-[var(--color-paper)] hover:opacity-90';

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" aria-hidden="true" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
        className="relative w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-paper)] p-6 shadow-lg"
      >
        <h2 id="confirm-dialog-title" className="font-serif text-lg font-semibold text-[var(--color-ink)]">
          {title}
        </h2>
        <p id="confirm-dialog-message" className="mt-2 text-sm text-[var(--color-muted)]">
          {message}
        </p>
        <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button
            type="button"
            ref={cancelRef}
            onClick={onCancel}
            className="px-4 py-3 min-h-[44px] rounded-lg border border-[var(--color-border)] text-sm font-medium hover:bg-[var(--color-hover)] touch-manipulation"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-4 py-3 min-h-[44px] rounded-lg text-sm font-medium touch-manipulation ${confirmClass}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
