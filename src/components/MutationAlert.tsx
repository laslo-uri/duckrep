import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { toQueryErrorMessage } from '../lib/authErrors';

export function MutationAlert({
  message,
  onDismiss,
}: {
  message: string | null;
  onDismiss?: () => void;
}) {
  const { t } = useTranslation();
  if (!message) return null;
  return (
    <div
      className="dr-enter flex items-center gap-2 rounded-lg border border-[var(--color-error)]/30 bg-[var(--color-error-bg)] px-3 py-1.5 text-[13px] text-[var(--color-error)]"
      role="alert"
    >
      <p className="flex-1">{toQueryErrorMessage(message, t)}</p>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          className="dr-btn dr-btn-ghost dr-icon-btn shrink-0 !text-[var(--color-error)]"
          aria-label={t('dismiss')}
        >
          <X size={14} aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
