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
      : 'bg-[var(--color-accent)] text-[var(--color-on-accent)] hover:opacity-90';

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" aria-hidden="true" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
        className="dr-enter relative w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl bg-[var(--color-surface)] p-6 shadow-[var(--shadow-card)]"
      >
        <h2 id="confirm-dialog-title" className="font-serif text-lg font-semibold text-[var(--color-ink)]">
          {title}
        </h2>
        <p id="confirm-dialog-message" className="mt-2 text-sm text-[var(--color-muted)] leading-relaxed">
          {message}
        </p>
        <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button
            type="button"
            ref={cancelRef}
            onClick={onCancel}
            className="dr-press px-5 py-3 min-h-[48px] rounded-xl border border-[var(--color-border)] text-sm font-medium hover:bg-[var(--color-hover)] touch-manipulation"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`dr-press px-5 py-3 min-h-[48px] rounded-xl text-sm font-semibold touch-manipulation ${confirmClass}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
