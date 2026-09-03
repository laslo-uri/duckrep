import { useTranslation } from 'react-i18next';
import { toQueryErrorMessage } from '../lib/authErrors';

type QueryStateProps = {
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch?: () => void;
  isEmpty?: boolean;
  empty?: React.ReactNode;
  children: React.ReactNode;
};

export function QueryState({
  isLoading,
  isError,
  error,
  refetch,
  isEmpty = false,
  empty,
  children,
}: QueryStateProps) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <p
        className="text-[var(--color-muted)] flex items-center"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <span className="loading-spinner" aria-hidden="true" />
        {t('loading')}
      </p>
    );
  }

  if (isError) {
    return (
      <div className="rounded-xl border border-[var(--color-error)]/30 bg-[var(--color-error-bg)] p-4" role="alert">
        <p className="text-sm text-[var(--color-error)]">{toQueryErrorMessage(error?.message, t)}</p>
        {refetch && (
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-3 text-sm font-medium text-[var(--color-ink)] underline touch-manipulation min-h-[44px]"
          >
            {t('retry')}
          </button>
        )}
      </div>
    );
  }

  if (isEmpty && empty) {
    return <>{empty}</>;
  }

  return <>{children}</>;
}
