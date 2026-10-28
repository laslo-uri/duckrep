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
      className="dr-enter flex items-center gap-2 text-sm text-[var(--color-error)] rounded-xl border border-[var(--color-error)]/30 bg-[var(--color-error-bg)] px-4 py-3"
      role="alert"
    >
      <p className="flex-1">{toQueryErrorMessage(message, t)}</p>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          className="dr-press shrink-0 p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-[var(--color-error)]/10 touch-manipulation"
          aria-label={t('dismiss')}
        >
          <X size={16} aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
