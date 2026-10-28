import { Link, useOutletContext } from 'react-router-dom';
import { usePageTitle } from '../hooks/usePageTitle';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { WorkoutDayIcon } from '../components/WorkoutIconPicker';
import { APP_VERSION } from '../lib/appVersion';
import {
  getLifetimeTrainingTotals,
  listWorkoutDays,
  listWorkoutSummaries,
  softDeleteWorkoutDay,
  todayIso,
  type WorkoutSummary,
} from '../lib/db';
import { useLocalUser } from '../contexts/LocalUserContext';
import { useMutationError } from '../hooks/useMutationError';
import { useConfirm } from '../hooks/useConfirm';
import { QueryState } from '../components/QueryState';
import { MutationAlert } from '../components/MutationAlert';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState } from '../components/EmptyState';
import { MarkWidget } from '../components/MarkWidget';
import { PageBody, PageHeader } from '../components/Layout';
import { activityStreak } from '../lib/statsHelpers';
import { appLocale } from '../lib/locale';
import type { WorkoutDay } from '../types';

type ShellContext = { startNew: () => void; newPending: boolean };

function formatDuration(
  startedAt: string,
  endedAt: string,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  const ms = new Date(endedAt).getTime() - new Date(startedAt).getTime();
  if (ms <= 0) return '';
  const mins = Math.round(ms / 60_000);
  if (mins < 60) return t('durationMinutes', { n: mins });
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? t('durationHoursMinutes', { h, m }) : t('durationHours', { h });
}

function formatClock(iso: string, locale: string): string {
  return new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
}

export function HomePage() {
  const { t, i18n } = useTranslation();
  usePageTitle(t('myJournal'));
  const locale = appLocale(i18n.language);
  const { user } = useLocalUser();
  const { startNew, newPending } = useOutletContext<ShellContext>();
  const queryClient = useQueryClient();
  const { mutationError, clearError, onMutationError } = useMutationError();
  const { confirm, confirmState, handleConfirm, handleCancel } = useConfirm();

  const deleteWorkoutMutation = useMutation({
    mutationFn: (workoutId: string) => softDeleteWorkoutDay(workoutId),
    onSuccess: (_data, workoutId) => {
      queryClient.invalidateQueries({ queryKey: ['workout-days'] });
      queryClient.invalidateQueries({ queryKey: ['workout-days-stats'] });
      queryClient.invalidateQueries({ queryKey: ['user-daily-training-stats'] });
      queryClient.invalidateQueries({ queryKey: ['trashed-activities'] });
      queryClient.invalidateQueries({ queryKey: ['lifetime-training-totals'] });
      queryClient.removeQueries({ queryKey: ['workout', workoutId] });
    },
    onError: onMutationError,
  });

  const { data: days = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['workout-days', user.id],
    queryFn: () => listWorkoutDays(user.id),
  });

  // Set edits on the activity page patch only that activity's cache, so refetch on every visit.
  const { data: summaries = {} } = useQuery({
    queryKey: ['workout-days', user.id, 'summaries'],
    queryFn: () => listWorkoutSummaries(user.id),
    staleTime: 0,
  });

  const { data: lifetime } = useQuery({
    queryKey: ['lifetime-training-totals', user.id],
    queryFn: () => getLifetimeTrainingTotals(user.id),
  });

  const formatDateHeader = (d: string) => {
    const date = new Date(d + 'T00:00:00');
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diff = today.getTime() - target.getTime();
    if (diff === 0) return t('today');
    if (diff === 86_400_000) return t('yesterday');
    return date.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  };

  const grouped = days.reduce<{ date: string; activities: WorkoutDay[] }[]>((acc, day) => {
    const last = acc[acc.length - 1];
    if (last && last.date === day.date) {
      last.activities.push(day);
    } else {
      acc.push({ date: day.date, activities: [day] });
    }
    return acc;
  }, []);

  const todayKey = todayIso();
  const dateKeys = days.map((day) => day.date);
  const openSession = days.find((day) => day.started_at && !day.ended_at);

  async function handleDelete(dayId: string) {
    const ok = await confirm({
      title: t('confirmRemoveTitle'),
      message: t('confirmRemoveLog'),
      confirmLabel: t('removeLog'),
      cancelLabel: t('cancel'),
      variant: 'danger',
    });
    if (ok) deleteWorkoutMutation.mutate(dayId);
  }

  const newButton = (
    <button
      type="button"
      onClick={() => {
        clearError();
        startNew();
      }}
      disabled={newPending}
      className="dr-btn dr-btn-primary"
    >
      <Plus size={14} aria-hidden />
      <span className="max-[479px]:hidden">{t('newWorkout')}</span>
      <span className="min-[480px]:hidden">{t('newShort')}</span>
    </button>
  );

  return (
    <>
      <PageHeader
        title={t('myJournal')}
        meta={days.length > 0 ? t('activityCount', { count: days.length }) : t('tagline')}
        actions={newButton}
      />

      <PageBody className="space-y-4">
        <MutationAlert message={mutationError} onDismiss={clearError} />

        <QueryState
          isLoading={isLoading}
          isError={isError}
          error={error}
          refetch={() => void refetch()}
          isEmpty={!isLoading && !isError && days.length === 0}
          empty={<EmptyState title={t('noWorkouts')} description={t('noWorkoutsHint')} action={newButton} />}
        >
          <MarkWidget
            sessions={lifetime?.sessions ?? days.length}
            completedSets={lifetime?.completedSets ?? 0}
            streakDays={activityStreak(dateKeys, todayKey)}
            dateKeys={dateKeys}
            todayKey={todayKey}
          />

          {openSession && (
            <Link
              to={`/activity/${openSession.id}`}
              className="flex items-center gap-3 rounded-lg border border-[var(--color-accent)]/40 bg-[var(--color-accent-soft)] px-3 py-2 dr-tap touch-manipulation hover:border-[var(--color-accent)]"
            >
              <span className="dr-live-dot shrink-0" aria-hidden />
              <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-accent)]">
                {t('sessionLive')}
              </span>
              <span className="min-w-0 flex-1 truncate font-medium">
                {openSession.title || formatDateHeader(openSession.date)}
              </span>
              <span className="shrink-0 text-[12px] font-semibold text-[var(--color-ink)]">{t('continueSession')} →</span>
            </Link>
          )}

          <div className="-mx-3 border-t border-[var(--color-border)] md:mx-0 md:rounded-lg md:border md:bg-[var(--color-surface)]">
            <div className="hidden h-8 items-center gap-2 rounded-t-lg border-b border-[var(--color-border)] px-3 text-[11px] font-medium uppercase tracking-wide text-[var(--color-faint)] md:flex">
              <span className="w-4" aria-hidden />
              <span className="flex-1" />
              <span className="hidden w-16 text-right lg:block">{t('statExercises')}</span>
              <span className="w-14 text-right">{t('statSets')}</span>
              <span className="hidden w-20 text-right lg:block">{t('statVolume')}</span>
              <span className="w-32 text-right">{t('sessionTime')}</span>
              <span className="w-7" aria-hidden />
            </div>
            {grouped.map(({ date, activities }) => (
              <section key={date} aria-label={formatDateHeader(date)}>
                <h2 className="dr-group sticky top-[var(--dr-header-h)] z-10 bg-[var(--color-paper)]/95 backdrop-blur-sm md:bg-[var(--color-panel)]/95">
                  <span>{formatDateHeader(date)}</span>
                  <span className="text-[var(--color-faint)] tabular-nums">{activities.length}</span>
                </h2>
                <ul>
                  {activities.map((day) => (
                    <ActivityRow
                      key={day.id}
                      day={day}
                      summary={summaries[day.id]}
                      locale={locale}
                      fallbackTitle={formatDateHeader(day.date)}
                      deleting={deleteWorkoutMutation.isPending && deleteWorkoutMutation.variables === day.id}
                      onDelete={() => void handleDelete(day.id)}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </QueryState>

        <p className="text-center text-[11px] text-[var(--color-faint)] tabular-nums">
          {t('appVersion', { version: APP_VERSION })}
        </p>
      </PageBody>

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

function ActivityRow({
  day,
  summary,
  locale,
  fallbackTitle,
  deleting,
  onDelete,
}: {
  day: WorkoutDay;
  summary: WorkoutSummary | undefined;
  locale: string;
  fallbackTitle: string;
  deleting: boolean;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const live = Boolean(day.started_at && !day.ended_at);
  const duration = day.started_at && day.ended_at ? formatDuration(day.started_at, day.ended_at, t) : null;
  const type = t(`activityTypes.${day.activity_type ?? 'strength'}`);
  const sets = summary ? `${summary.done}/${summary.sets}` : '—';
  const allDone = summary != null && summary.sets > 0 && summary.done === summary.sets;
  const volume = summary && summary.volume > 0 ? t('volumeKg', { n: Math.round(summary.volume).toLocaleString(locale) }) : '—';

  return (
    <li className="group dr-row relative pr-1">
      <Link
        to={`/activity/${day.id}`}
        className="flex min-w-0 flex-1 items-center gap-2 self-stretch py-1.5 touch-manipulation after:absolute after:inset-0 after:content-['']"
      >
        <WorkoutDayIcon
          iconKey={day.icon}
          size={15}
          className={`shrink-0 ${live ? 'text-[var(--color-accent)]' : 'text-[var(--color-muted)]'}`}
          fallbackToFirst
        />
        <span className="flex min-w-0 flex-1 flex-col md:flex-row md:items-center md:gap-2">
          <span className="truncate font-medium text-[var(--color-ink)]">{day.title || fallbackTitle}</span>
          <span className="flex min-w-0 items-center gap-1.5 text-[12px] text-[var(--color-muted)] md:contents">
            <span className="dr-chip h-5 shrink-0 px-1.5 text-[11px] md:ml-1">{type}</span>
            {live && (
              <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-accent)]">
                {t('openSession')}
              </span>
            )}
            <span className="truncate tabular-nums md:hidden">
              {summary ? `${summary.exercises} · ${sets}` : ''}
              {day.started_at && !live ? ` · ${formatClock(day.started_at, locale)}` : ''}
            </span>
          </span>
        </span>
        <span className="hidden w-16 shrink-0 text-right tabular-nums text-[var(--color-muted)] lg:block">
          {summary ? summary.exercises : '—'}
        </span>
        <span
          className={`hidden w-14 shrink-0 text-right tabular-nums md:block ${allDone ? 'text-[var(--color-success)]' : 'text-[var(--color-muted)]'}`}
        >
          {sets}
        </span>
        <span className="hidden w-20 shrink-0 text-right tabular-nums text-[var(--color-muted)] lg:block">{volume}</span>
        <span className="hidden w-32 shrink-0 whitespace-nowrap text-right text-[12px] tabular-nums text-[var(--color-faint)] md:block">
          {day.started_at && !live ? `${formatClock(day.started_at, locale)}${duration ? ` · ${duration}` : ''}` : ''}
        </span>
      </Link>
      <button
        type="button"
        onClick={onDelete}
        disabled={deleting}
        className="dr-btn dr-btn-ghost dr-icon-btn relative z-10 hover:!text-[var(--color-error)] shrink-0 md:opacity-0 md:focus-visible:opacity-100 md:group-hover:opacity-100"
        aria-label={t('removeLog')}
        title={t('removeLog')}
      >
        <Trash2 size={14} aria-hidden />
      </button>
    </li>
  );
}
