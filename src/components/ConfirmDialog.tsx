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
      ? '!bg-[var(--color-error)] !text-white border-transparent hover:opacity-90'
      : 'dr-btn-primary';

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" aria-hidden="true" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
        className="dr-enter relative w-full sm:max-w-sm rounded-t-xl sm:rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[var(--shadow-pop)]"
      >
        <h2 id="confirm-dialog-title" className="text-[15px] font-semibold text-[var(--color-ink)]">
          {title}
        </h2>
        <p id="confirm-dialog-message" className="mt-1 text-[13px] text-[var(--color-muted)] leading-relaxed">
          {message}
        </p>
        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            ref={cancelRef}
            onClick={onCancel}
            className="dr-btn"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`dr-btn ${confirmClass}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
