import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { usePageTitle } from '../hooks/usePageTitle';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2, RotateCcw, Download, Upload } from 'lucide-react';
import { ProfileEditor } from '../components/ProfileEditor';
import { useLocalUser } from '../contexts/LocalUserContext';
import {
  listTrashedActivities,
  restoreWorkoutDay,
  hardDeleteWorkoutDay,
  exportWorkoutJournalJson,
  importWorkoutJournalJson,
  exportSqlJsDump,
} from '../lib/db';
import { isTauri } from '../lib/db/utils';
import { useMutationError } from '../hooks/useMutationError';
import { useConfirm } from '../hooks/useConfirm';
import { QueryState } from '../components/QueryState';
import { MutationAlert } from '../components/MutationAlert';
import { ConfirmDialog } from '../components/ConfirmDialog';

type SettingsTab = 'profile' | 'data' | 'trash';

const TABS: SettingsTab[] = ['profile', 'data', 'trash'];
const TAB_STORAGE = 'youpeak.settings.tab';

function tabFromHash(hash: string): SettingsTab | null {
  const id = hash.replace('#', '');
  return TABS.includes(id as SettingsTab) ? (id as SettingsTab) : null;
}

function readInitialTab(): SettingsTab {
  const fromHash = tabFromHash(window.location.hash);
  if (fromHash) return fromHash;
  try {
    const stored = sessionStorage.getItem(TAB_STORAGE);
    if (stored && TABS.includes(stored as SettingsTab)) return stored as SettingsTab;
  } catch {
    /* private mode */
  }
  return 'profile';
}

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
  usePageTitle(t('settings'));
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useLocalUser();
  const queryClient = useQueryClient();
  const { mutationError: trashMutationError, clearError, onMutationError: onTrashMutationError } = useMutationError();
  const { confirm, confirmState, handleConfirm, handleCancel } = useConfirm();
  const [exportError, setExportError] = useState<string | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [tab, setTab] = useState<SettingsTab>(readInitialTab);
  const importInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const next = tabFromHash(location.hash);
    if (next) setTab(next);
  }, [location.hash]);

  function selectTab(next: SettingsTab) {
    setTab(next);
    try {
      sessionStorage.setItem(TAB_STORAGE, next);
    } catch {
      /* private mode */
    }
    navigate({ hash: next }, { replace: true });
  }

  function onTabKey(event: KeyboardEvent) {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const index = TABS.indexOf(tab);
    const delta = event.key === 'ArrowRight' ? 1 : -1;
    const next = TABS[(index + delta + TABS.length) % TABS.length];
    selectTab(next);
    document.getElementById(`settings-tab-${next}`)?.focus();
  }

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

  async function handleImportFile(file: File) {
    setExportError(null);
    setImportMessage(null);
    setExporting(true);
    try {
      const raw: unknown = JSON.parse(await file.text());
      const result = await importWorkoutJournalJson(user.id, raw);
      setImportMessage(t('importResult', { imported: result.imported, skipped: result.skipped }));
      queryClient.invalidateQueries({ queryKey: ['workout-days'] });
      queryClient.invalidateQueries({ queryKey: ['workout-days-stats'] });
      queryClient.invalidateQueries({ queryKey: ['user-daily-training-stats'] });
      queryClient.invalidateQueries({ queryKey: ['trashed-activities'] });
    } catch {
      setExportError(t('importFailed'));
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
        <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-semibold text-[var(--color-ink)] tracking-tight text-balance">
          {t('settings')}
        </h1>
        <p className="text-sm text-[var(--color-muted)] mt-1 max-w-md">
          {t('localAppHint')}
        </p>
      </div>

      <div className="sticky top-14 z-20 -mx-4 px-4 sm:-mx-8 sm:px-8 py-2 bg-[var(--color-paper)]/95 backdrop-blur-sm">
        <div
          role="tablist"
          aria-label={t('settings')}
          onKeyDown={onTabKey}
          className="flex w-full gap-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-1 sm:w-fit"
        >
          {(
            [
              ['profile', t('profileTitle'), 0],
              ['data', t('settingsData'), 0],
              ['trash', t('trashTitle'), trashLoading ? 0 : trashed.length],
            ] as const
          ).map(([id, label, count]) => {
            const selected = tab === id;
            return (
              <button
                key={id}
                id={`settings-tab-${id}`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={`settings-panel-${id}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => selectTab(id)}
                className={`yp-press inline-flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-medium sm:flex-none sm:px-4 ${
                  selected
                    ? 'bg-[var(--color-accent)] text-[var(--color-on-accent)]'
                    : 'text-[var(--color-muted)] hover:bg-[var(--color-hover)] hover:text-[var(--color-ink)]'
                }`}
              >
                {label}
                {count > 0 ? (
                  <span className={`tabular-nums text-xs ${selected ? 'opacity-80' : 'text-[var(--color-accent)]'}`}>
                    {count}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      <section
        id="settings-panel-profile"
        role="tabpanel"
        aria-labelledby="settings-tab-profile"
        hidden={tab !== 'profile'}
        className="yp-card p-5 sm:p-6"
      >
        <p className="mb-5 max-w-md text-sm text-[var(--color-muted)]">{t('profileHint')}</p>
        <ProfileEditor />
      </section>

      <section
        id="settings-panel-data"
        role="tabpanel"
        aria-labelledby="settings-tab-data"
        hidden={tab !== 'data'}
        className="yp-card p-5 sm:p-6"
      >
        <h2 className="font-medium text-[var(--color-ink)]">{t('dataExportTitle')}</h2>
        <p className="mb-2 max-w-md text-sm text-[var(--color-muted)]">{t('dataExportHint')}</p>
        <MutationAlert message={exportError} onDismiss={() => setExportError(null)} />
        {importMessage ? <p className="mb-2 text-sm text-[var(--color-ink)]">{importMessage}</p> : null}
        <div className="divide-y divide-[var(--color-border)]">
          <button
            type="button"
            onClick={() => void handleExportJson()}
            disabled={exporting}
            className="yp-press flex w-full items-center gap-3 py-3 text-left disabled:opacity-50"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-hover)] text-[var(--color-ink)]">
              <Download size={16} aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-[var(--color-ink)]">{t('exportJournalJson')}</span>
              <span className="block text-xs text-[var(--color-muted)]">{t('exportJournalHint')}</span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => importInputRef.current?.click()}
            disabled={exporting}
            className="yp-press flex w-full items-center gap-3 py-3 text-left disabled:opacity-50"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-hover)] text-[var(--color-ink)]">
              <Upload size={16} aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-[var(--color-ink)]">{t('importJournalJson')}</span>
              <span className="block text-xs text-[var(--color-muted)]">{t('importJournalHint')}</span>
            </span>
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) void handleImportFile(file);
            }}
          />
          {!isTauri() && (
            <button
              type="button"
              onClick={() => void handleExportSqlite()}
              disabled={exporting}
              className="yp-press flex w-full items-center gap-3 py-3 text-left disabled:opacity-50"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-hover)] text-[var(--color-ink)]">
                <Download size={16} aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-[var(--color-ink)]">{t('exportSqliteDump')}</span>
                <span className="block text-xs text-[var(--color-muted)]">{t('exportSqliteHint')}</span>
              </span>
            </button>
          )}
        </div>
      </section>

      <section
        id="settings-panel-trash"
        role="tabpanel"
        aria-labelledby="settings-tab-trash"
        hidden={tab !== 'trash'}
        className="yp-card p-5 sm:p-6"
      >
        <MutationAlert message={trashMutationError} onDismiss={clearError} />
        <QueryState
          isLoading={trashLoading}
          isError={trashIsError}
          error={trashError}
          refetch={() => void refetchTrash()}
          isEmpty={!trashLoading && !trashIsError && trashed.length === 0}
          empty={<p className="text-sm text-[var(--color-muted)]">{t('trashEmpty')}</p>}
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
                      className="yp-press inline-flex items-center justify-center gap-1.5 px-4 py-2 min-h-[44px] w-full sm:w-auto rounded-xl border border-[var(--color-border)] text-sm font-medium hover:bg-[var(--color-hover)] disabled:opacity-50 touch-manipulation"
                    >
                      <RotateCcw size={16} aria-hidden />
                      {t('restoreActivity')}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDeleteForever(row.id)}
                      disabled={isRestoring || isDeleting}
                      className="yp-press inline-flex items-center gap-1.5 px-4 py-2 min-h-[44px] rounded-xl text-sm font-medium text-[var(--color-error)] hover:bg-[var(--color-error-bg)] disabled:opacity-50 touch-manipulation"
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
