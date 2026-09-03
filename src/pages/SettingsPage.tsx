import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2, RotateCcw, Download } from 'lucide-react';
import { useLocalUser } from '../contexts/LocalUserContext';
import {
  listTrashedActivities,
  restoreWorkoutDay,
  hardDeleteWorkoutDay,
  exportWorkoutJournalJson,
  exportSqlJsDump,
} from '../lib/db';
import { isTauri } from '../lib/db/utils';
import { useMutationError } from '../hooks/useMutationError';
import { useConfirm } from '../hooks/useConfirm';
import { QueryState } from '../components/QueryState';
import { MutationAlert } from '../components/MutationAlert';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState } from '../components/EmptyState';

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function SettingsPage() {
  const { t } = useTranslation();
  const { user } = useLocalUser();
  const queryClient = useQueryClient();
  const { mutationError: trashMutationError, clearError, onMutationError: onTrashMutationError } = useMutationError();
  const { confirm, confirmState, handleConfirm, handleCancel } = useConfirm();
  const [exportError, setExportError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const {
    data: trashed = [],
    isLoading: trashLoading,
    isError: trashIsError,
    error: trashError,
    refetch: refetchTrash,
  } = useQuery({
    queryKey: ['trashed-activities', user.id],
    queryFn: () => listTrashedActivities(user.id),
  });

  const restoreMutation = useMutation({
    mutationFn: (workoutDayId: string) => restoreWorkoutDay(workoutDayId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trashed-activities'] });
      queryClient.invalidateQueries({ queryKey: ['workout-days'] });
      queryClient.invalidateQueries({ queryKey: ['workout-days-stats'] });
      queryClient.invalidateQueries({ queryKey: ['user-daily-training-stats'] });
    },
    onError: onTrashMutationError,
  });

  const deleteForeverMutation = useMutation({
    mutationFn: (workoutDayId: string) => hardDeleteWorkoutDay(workoutDayId),
    onSuccess: (_data, workoutDayId) => {
      queryClient.invalidateQueries({ queryKey: ['trashed-activities'] });
      queryClient.invalidateQueries({ queryKey: ['workout-days'] });
      queryClient.invalidateQueries({ queryKey: ['workout-days-stats'] });
      queryClient.invalidateQueries({ queryKey: ['user-daily-training-stats'] });
      queryClient.removeQueries({ queryKey: ['workout', workoutDayId] });
    },
    onError: onTrashMutationError,
  });

  async function handleDeleteForever(rowId: string) {
    const ok = await confirm({
      title: t('confirmRemoveTitle'),
      message: t('confirmDeleteForever'),
      confirmLabel: t('deleteForever'),
      cancelLabel: t('cancel'),
      variant: 'danger',
    });
    if (ok) deleteForeverMutation.mutate(rowId);
  }

  async function handleExportJson() {
    setExportError(null);
    setExporting(true);
    try {
      const payload = await exportWorkoutJournalJson(user.id);
      const stamp = new Date().toISOString().slice(0, 10);
      downloadBlob(
        new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }),
        `youpeak-journal-${stamp}.json`,
      );
    } catch {
      setExportError(t('exportFailed'));
    } finally {
      setExporting(false);
    }
  }

  async function handleExportSqlite() {
    setExportError(null);
    setExporting(true);
    try {
      const bytes = await exportSqlJsDump();
      if (!bytes) {
        setExportError(t('exportFailed'));
        return;
      }
      const stamp = new Date().toISOString().slice(0, 10);
      const copy = new Uint8Array(bytes.byteLength);
      copy.set(bytes);
      downloadBlob(new Blob([copy], { type: 'application/octet-stream' }), `youpeak-${stamp}.sqlite`);
    } catch {
      setExportError(t('exportFailed'));
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-xl sm:text-2xl font-semibold text-[var(--color-ink)] tracking-tight">
          {t('settings')}
        </h1>
        <p className="text-sm text-[var(--color-muted)] mt-1 max-w-md">
          {t('localAppHint')}
        </p>
      </div>

      <section className="p-4 sm:p-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
        <h2 className="font-medium text-[var(--color-ink)] mb-1">{t('dataExportTitle')}</h2>
        <p className="text-sm text-[var(--color-muted)] mb-3 max-w-md">{t('dataExportHint')}</p>
        <MutationAlert message={exportError} onDismiss={() => setExportError(null)} />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void handleExportJson()}
            disabled={exporting}
            className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[44px] rounded-lg border border-[var(--color-border)] text-sm font-medium hover:bg-[var(--color-hover)] disabled:opacity-50 touch-manipulation"
          >
            <Download size={16} aria-hidden />
            {t('exportJournalJson')}
          </button>
          {!isTauri() && (
            <button
              type="button"
              onClick={() => void handleExportSqlite()}
              disabled={exporting}
              className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[44px] rounded-lg border border-[var(--color-border)] text-sm font-medium hover:bg-[var(--color-hover)] disabled:opacity-50 touch-manipulation"
            >
              <Download size={16} aria-hidden />
              {t('exportSqliteDump')}
            </button>
          )}
        </div>
      </section>

      <section className="p-4 sm:p-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
        <h2 className="font-medium text-[var(--color-ink)] mb-3">{t('trashTitle')}</h2>
        <MutationAlert message={trashMutationError} onDismiss={clearError} />
        <QueryState
          isLoading={trashLoading}
          isError={trashIsError}
          error={trashError}
          refetch={() => void refetchTrash()}
          isEmpty={!trashLoading && !trashIsError && trashed.length === 0}
          empty={<EmptyState title={t('trashEmpty')} />}
        >
          <ul className="space-y-3">
            {trashed.map((row) => {
              const isRestoring =
                restoreMutation.isPending && restoreMutation.variables === row.id;
              const isDeleting =
                deleteForeverMutation.isPending && deleteForeverMutation.variables === row.id;

              return (
                <li
                  key={row.id}
                  className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between py-3 border-b border-[var(--color-border)] last:border-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-[var(--color-ink)] truncate">
                      {row.title || row.date}
                    </p>
                    <p className="text-xs text-[var(--color-muted)]">{row.date}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <Link
                      to={`/activity/${row.id}`}
                      className="text-sm text-[var(--color-ink)] underline px-2 py-2 min-h-[44px] flex items-center"
                    >
                      {t('edit')}
                    </Link>
                    <button
                      type="button"
                      onClick={() => restoreMutation.mutate(row.id)}
                      disabled={isRestoring || isDeleting}
                      className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[44px] rounded-lg border border-[var(--color-border)] text-sm font-medium hover:bg-[var(--color-hover)] disabled:opacity-50 touch-manipulation"
                    >
                      <RotateCcw size={16} aria-hidden />
                      {t('restoreActivity')}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDeleteForever(row.id)}
                      disabled={isRestoring || isDeleting}
                      className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[44px] rounded-lg text-sm font-medium text-[var(--color-error)] hover:bg-[var(--color-error-bg)] disabled:opacity-50 touch-manipulation"
                    >
                      <Trash2 size={16} aria-hidden />
                      {t('deleteForever')}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </QueryState>
      </section>

      {confirmState && (
        <ConfirmDialog
          open={confirmState.open}
          title={confirmState.title}
          message={confirmState.message}
          confirmLabel={confirmState.confirmLabel}
          cancelLabel={confirmState.cancelLabel}
          variant={confirmState.variant}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}
    </div>
  );
}
