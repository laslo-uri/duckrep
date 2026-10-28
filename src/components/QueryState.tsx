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
        className="flex items-center py-6 text-[13px] text-[var(--color-muted)]"
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
      <div className="rounded-lg border border-[var(--color-error)]/30 bg-[var(--color-error-bg)] p-3" role="alert">
        <p className="text-[13px] text-[var(--color-error)]">{toQueryErrorMessage(error?.message, t)}</p>
        {refetch && (
          <button
            type="button"
            onClick={() => refetch()}
            className="dr-btn dr-btn-primary mt-2"
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
