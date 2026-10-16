import { Link } from 'react-router-dom';
import { usePageTitle } from '../hooks/usePageTitle';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, ChevronRight, Trash2, Clock } from 'lucide-react';
import { WorkoutDayIcon } from '../components/WorkoutIconPicker';
import { APP_VERSION } from '../lib/appVersion';
import { getLifetimeTrainingTotals, listWorkoutDays, softDeleteWorkoutDay, todayIso } from '../lib/db';
import { useLocalUser } from '../contexts/LocalUserContext';
import { useMutationError } from '../hooks/useMutationError';
import { useWorkoutMutations } from '../hooks/useWorkoutMutations';
import { useConfirm } from '../hooks/useConfirm';
import { QueryState } from '../components/QueryState';
import { MutationAlert } from '../components/MutationAlert';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState } from '../components/EmptyState';
import { MarkWidget } from '../components/MarkWidget';
import { activityStreak } from '../lib/statsHelpers';
import { appLocale } from '../lib/locale';
import type { WorkoutDay } from '../types';

function StartSessionButton({
  pending,
  label,
  className,
  onClick,
}: {
  pending: boolean;
  label: string;
  className?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className={`yp-press flex items-center justify-center gap-2 px-5 py-3 min-h-[48px] rounded-xl bg-[var(--color-accent)] text-[var(--color-on-accent)] text-sm font-semibold touch-manipulation disabled:opacity-50 ${className ?? ''}`}
    >
      <Plus size={18} />
      {label}
    </button>
  );
}

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
  const queryClient = useQueryClient();
  const { mutationError, clearError, onMutationError } = useMutationError();
  const { confirm, confirmState, handleConfirm, handleCancel } = useConfirm();
  const { createMutation } = useWorkoutMutations({
    workout: null,
    userId: user.id,
    workoutId: undefined,
    defaultExerciseName: t('addExercise'),
    onError: onMutationError,
  });

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

  const startSession = () => {
    clearError();
    createMutation.mutate();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-semibold text-[var(--color-ink)] tracking-tight text-balance">
            {t('myJournal')}
          </h1>
          <p className="text-sm text-[var(--color-muted)] mt-1">{t('tagline')}</p>
        </div>
        {(isLoading || isError || days.length > 0) && (
          <StartSessionButton
            pending={createMutation.isPending}
            label={t('newWorkout')}
            className="w-full sm:w-auto"
            onClick={startSession}
          />
        )}
      </div>

      <MutationAlert message={mutationError} onDismiss={clearError} />

      <QueryState
        isLoading={isLoading}
        isError={isError}
        error={error}
        refetch={() => void refetch()}
        isEmpty={!isLoading && !isError && days.length === 0}
        empty={
          <EmptyState
            title={t('noWorkouts')}
            description={t('noWorkoutsHint')}
            action={
              <StartSessionButton
                pending={createMutation.isPending}
                label={t('newWorkout')}
                className="w-full sm:w-auto"
                onClick={startSession}
              />
            }
          />
        }
      >
        <div className="space-y-6">
          <MarkWidget
            sessions={lifetime?.sessions ?? days.length}
            completedSets={lifetime?.completedSets ?? 0}
            streakDays={activityStreak(dateKeys, todayKey)}
            dateKeys={dateKeys}
            todayKey={todayKey}
          />

        {/* Live session pill */}
        {openSession && (
          <Link
            to={`/activity/${openSession.id}`}
            className="yp-press yp-live yp-aurora flex items-center justify-between gap-3 rounded-xl px-5 py-4 min-h-[64px] touch-manipulation"
          >
            <div className="min-w-0">
              <p className="yp-label !text-[var(--aurora-text)] opacity-80">{t('sessionLive')}</p>
              <p className="font-medium truncate">{openSession.title || formatDateHeader(openSession.date)}</p>
            </div>
            <span className="text-sm font-semibold shrink-0">{t('continueSession')}</span>
          </Link>
        )}

        {/* Activity list */}
        <div className="space-y-6">
          {grouped.map(({ date, activities }) => (
            <section key={date}>
              <h2 className="sticky top-14 z-10 yp-label bg-[var(--color-paper)]/95 backdrop-blur-sm py-2 -mx-4 px-4 sm:-mx-8 sm:px-8 mb-2">
                {formatDateHeader(date)}
              </h2>
              <ul className="space-y-3">
                {activities.map((day, index) => {
                  const live = Boolean(day.started_at && !day.ended_at);
                  const duration = day.started_at && day.ended_at
                    ? formatDuration(day.started_at, day.ended_at, t)
                    : null;
                  const isDeleting =
                    deleteWorkoutMutation.isPending && deleteWorkoutMutation.variables === day.id;

                  return (
                    <li
                      key={day.id}
                      className={`yp-stagger yp-press flex items-stretch yp-card overflow-hidden min-h-[64px] ${
                        live ? 'ring-2 ring-[var(--color-accent)]' : ''
                      }`}
                      style={{ ['--i' as string]: Math.min(index, 5) }}
                    >
                      <Link
                        to={`/activity/${day.id}`}
                        className="flex flex-1 items-center justify-between gap-3 p-4 min-w-0 touch-manipulation"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-[var(--color-accent-soft)] flex items-center justify-center">
                            <WorkoutDayIcon iconKey={day.icon} size={20} className="text-[var(--color-ink)]/80" fallbackToFirst />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-[var(--color-ink)] truncate">
                              {day.title || formatDateHeader(day.date)}
                            </p>
                            <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-[var(--color-muted)] min-w-0">
                              <span className="truncate">{t(`activityTypes.${day.activity_type ?? 'strength'}`)}</span>
                              {live && (
                                <span className="text-[var(--color-accent)] font-semibold uppercase tracking-wide shrink-0">
                                  {t('openSession')}
                                </span>
                              )}
                              {day.started_at && !live && (
                                <span className="inline-flex items-center gap-1 shrink-0 tabular-nums">
                                  <Clock size={12} />
                                  {formatClock(day.started_at, locale)}
                                  {duration ? ` · ${duration}` : ''}
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                        <ChevronRight size={20} className="text-[var(--color-muted)] flex-shrink-0" aria-hidden />
                      </Link>
                      <button
                        type="button"
                        onClick={() => void handleDelete(day.id)}
                        disabled={isDeleting}
                        className="flex-shrink-0 flex items-center justify-center px-3 border-l border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-error)] hover:bg-[var(--color-error-bg)] touch-manipulation min-w-[48px] disabled:opacity-50"
                        aria-label={t('removeLog')}
                        title={t('removeLog')}
                      >
                        <Trash2 size={18} aria-hidden />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
        </div>
      </QueryState>

      <p className="text-center text-xs text-[var(--color-muted)] tabular-nums">
        {t('appVersion', { version: APP_VERSION })}
      </p>

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
