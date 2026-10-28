import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { usePageTitle } from '../hooks/usePageTitle';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2, RotateCcw, Download, Upload, Sun, Moon } from 'lucide-react';
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
import { useMutationError } from '../hooks/useMutationError';
import { useConfirm } from '../hooks/useConfirm';
import { QueryState } from '../components/QueryState';
import { MutationAlert } from '../components/MutationAlert';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { SecuritySettings } from '../components/SecuritySettings';
import { PageHeader } from '../components/Layout';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { CookieSettingsLink } from '../components/CookieConsent';
import { useTheme } from '../contexts/ThemeContext';
import { APP_VERSION } from '../lib/appVersion';

type SettingsTab = 'profile' | 'security' | 'data' | 'trash';

const TABS: SettingsTab[] = ['profile', 'security', 'data', 'trash'];
const TAB_STORAGE = 'duckrep.settings.tab';

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
  const { theme, toggleTheme } = useTheme();
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
        `duckrep-journal-${stamp}.json`,
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
      downloadBlob(new Blob([copy], { type: 'application/octet-stream' }), `duckrep-${stamp}.sqlite`);
    } catch {
      setExportError(t('exportFailed'));
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <PageHeader title={t('settings')} meta={<span className="hidden sm:inline">{t('localAppHint')}</span>} />
      <div className="sticky top-[var(--dr-header-h)] z-20 border-b border-[var(--color-border)] bg-[var(--color-paper)]/95 px-3 backdrop-blur-sm md:px-4">
        <div
          role="tablist"
          aria-label={t('settings')}
          onKeyDown={onTabKey}
          className="flex h-10 w-full items-center gap-1 overflow-x-auto max-md:h-12 [scrollbar-width:none]"
        >
          {(
            [
              ['profile', t('profileTitle'), 0],
              ['security', t('securityTab'), 0],
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
                className={`dr-btn dr-btn-ghost h-7 shrink-0 px-3 text-[12px] max-md:h-9 ${
                  selected ? '!bg-[var(--color-active)] !text-[var(--color-ink)]' : ''
                }`}
              >
                {label}
                {count > 0 ? (
                  <span className="tabular-nums text-[11px] text-[var(--color-accent)]">
                    {count}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mx-auto w-full max-w-3xl space-y-4 px-3 py-5 md:px-6">
      <section
        id="settings-panel-profile"
        role="tabpanel"
        aria-labelledby="settings-tab-profile"
        hidden={tab !== 'profile'}
        className="space-y-4"
      >
        <div className="dr-card p-3 sm:p-4">
          <h2 className="text-[13px] font-semibold text-[var(--color-ink)]">{t('appearance')}</h2>
          <div className="mt-2 flex items-center gap-2">
            <button type="button" onClick={toggleTheme} className="dr-btn">
              {theme === 'dark' ? <Sun size={14} aria-hidden /> : <Moon size={14} aria-hidden />}
              {theme === 'dark' ? t('lightMode') : t('darkMode')}
            </button>
            <span className="text-[12px] text-[var(--color-muted)]">{t('language')}</span>
            <LanguageSwitcher className="!w-auto border-[var(--color-border)] px-2.5" />
          </div>
        </div>
        <div className="dr-card p-3 sm:p-4">
          <p className="mb-4 max-w-md text-[12px] text-[var(--color-muted)]">{t('profileHint')}</p>
          <ProfileEditor />
        </div>
      </section>

      <section
        id="settings-panel-security"
        role="tabpanel"
        aria-labelledby="settings-tab-security"
        hidden={tab !== 'security'}
        className="dr-card p-3 sm:p-4"
      >
        <SecuritySettings />
      </section>

      <section
        id="settings-panel-data"
        role="tabpanel"
        aria-labelledby="settings-tab-data"
        hidden={tab !== 'data'}
        className="dr-card p-3 sm:p-4"
      >
        <h2 className="text-[13px] font-semibold text-[var(--color-ink)]">{t('dataExportTitle')}</h2>
        <p className="mb-2 max-w-md text-[12px] text-[var(--color-muted)]">{t('dataExportHint')}</p>
        <MutationAlert message={exportError} onDismiss={() => setExportError(null)} />
        {importMessage ? <p className="mb-2 text-[12px] text-[var(--color-ink)]" role="status">{importMessage}</p> : null}
        <div className="-mx-3 divide-y divide-[var(--color-border)] border-t border-[var(--color-border)] sm:-mx-4">
          <button
            type="button"
            onClick={() => void handleExportJson()}
            disabled={exporting}
            className="dr-tap flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-[var(--color-hover)] disabled:opacity-50 sm:px-4"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[var(--color-border)] text-[var(--color-muted)]">
              <Download size={14} aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block text-[13px] font-medium text-[var(--color-ink)]">{t('exportJournalJson')}</span>
              <span className="block text-[12px] text-[var(--color-muted)]">{t('exportJournalHint')}</span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => importInputRef.current?.click()}
            disabled={exporting}
            className="dr-tap flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-[var(--color-hover)] disabled:opacity-50 sm:px-4"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[var(--color-border)] text-[var(--color-muted)]">
              <Upload size={14} aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block text-[13px] font-medium text-[var(--color-ink)]">{t('importJournalJson')}</span>
              <span className="block text-[12px] text-[var(--color-muted)]">{t('importJournalHint')}</span>
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
          <button
            type="button"
            onClick={() => void handleExportSqlite()}
            disabled={exporting}
            className="dr-tap flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-[var(--color-hover)] disabled:opacity-50 sm:px-4"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[var(--color-border)] text-[var(--color-muted)]">
              <Download size={14} aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block text-[13px] font-medium text-[var(--color-ink)]">{t('exportSqliteDump')}</span>
              <span className="block text-[12px] text-[var(--color-muted)]">{t('exportSqliteHint')}</span>
            </span>
          </button>
        </div>
      </section>

      <section
        id="settings-panel-trash"
        role="tabpanel"
        aria-labelledby="settings-tab-trash"
        hidden={tab !== 'trash'}
        className="dr-card p-3 sm:p-4"
      >
        <MutationAlert message={trashMutationError} onDismiss={clearError} />
        <QueryState
          isLoading={trashLoading}
          isError={trashIsError}
          error={trashError}
          refetch={() => void refetchTrash()}
          isEmpty={!trashLoading && !trashIsError && trashed.length === 0}
          empty={<p className="text-[12px] text-[var(--color-muted)]">{t('trashEmpty')}</p>}
        >
          <ul className="-mx-3 -my-3 sm:-mx-4 sm:-my-4">
            {trashed.map((row) => {
              const isRestoring =
                restoreMutation.isPending && restoreMutation.variables === row.id;
              const isDeleting =
                deleteForeverMutation.isPending && deleteForeverMutation.variables === row.id;

              return (
                <li
                  key={row.id}
                  className="dr-row flex-wrap gap-y-1 py-1.5 last:border-b-0 sm:flex-nowrap"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-[var(--color-ink)] truncate">
                      {row.title || row.date}
                    </p>
                    <p className="text-[11px] text-[var(--color-faint)] tabular-nums">{row.date}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Link
                      to={`/activity/${row.id}`}
                      className="dr-btn dr-btn-ghost"
                    >
                      {t('edit')}
                    </Link>
                    <button
                      type="button"
                      onClick={() => restoreMutation.mutate(row.id)}
                      disabled={isRestoring || isDeleting}
                      className="dr-btn"
                    >
                      <RotateCcw size={13} aria-hidden />
                      {t('restoreActivity')}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDeleteForever(row.id)}
                      disabled={isRestoring || isDeleting}
                      className="dr-btn dr-btn-ghost dr-btn-danger"
                    >
                      <Trash2 size={13} aria-hidden />
                      {t('deleteForever')}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </QueryState>
      </section>

      <p className="flex flex-wrap items-center justify-center gap-x-3 text-center text-[11px] text-[var(--color-faint)]">
        <span className="tabular-nums">{t('appVersion', { version: APP_VERSION })}</span>
        <span>
          {t('footer.madeBy')}{' '}
          <a href="https://laslouri.com" target="_blank" rel="noopener noreferrer" className="text-[var(--color-muted)] underline underline-offset-2 hover:text-[var(--color-ink)]">
            laslouri.com
          </a>
        </span>
        <CookieSettingsLink className="dr-tap hover:text-[var(--color-ink)] hover:underline" />
      </p>
      </div>

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
    </>
  );
}
