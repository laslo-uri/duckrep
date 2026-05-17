import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, ChevronRight, Pencil, Trash2, Clock } from 'lucide-react';
import { WorkoutDayIcon } from '../components/WorkoutIconPicker';
import { APP_VERSION } from '../lib/appVersion';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { WorkoutDay } from '../types';

function formatDuration(startedAt: string, endedAt: string): string {
  const ms = new Date(endedAt).getTime() - new Date(startedAt).getTime();
  if (ms <= 0) return '';
  const mins = Math.round(ms / 60_000);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function HomePage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const deleteWorkoutMutation = useMutation({
    mutationFn: async (workoutId: string) => {
      const { error } = await supabase
        .from('workout_days')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', workoutId);
      if (error) throw error;
    },
    onSuccess: (_data, workoutId) => {
      queryClient.invalidateQueries({ queryKey: ['workout-days'] });
      queryClient.invalidateQueries({ queryKey: ['workout-days-stats'] });
      queryClient.invalidateQueries({ queryKey: ['user-daily-training-stats'] });
      queryClient.invalidateQueries({ queryKey: ['trashed-activities'] });
      queryClient.removeQueries({ queryKey: ['workout', workoutId] });
    },
  });

  const { data: days = [], isLoading } = useQuery({
    queryKey: ['workout-days', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workout_days')
        .select('*')
        .eq('user_id', user!.id)
        .is('deleted_at', null)
        .order('date', { ascending: false })
        .order('started_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as WorkoutDay[];
    },
    enabled: !!user?.id,
  });

  const formatDateHeader = (d: string) => {
    const date = new Date(d + 'T00:00:00');
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diff = today.getTime() - target.getTime();
    if (diff === 0) return t('today');
    if (diff === 86_400_000) return t('yesterday');
    return date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
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

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8">
        <h1 className="font-serif text-xl sm:text-2xl font-semibold text-[var(--color-ink)] tracking-tight">
          {t('myJournal')}
        </h1>
        <Link
          to="/activity/new"
          className="flex items-center justify-center gap-2 px-4 py-3 sm:py-2.5 min-h-[44px] rounded-lg bg-[var(--color-ink)] text-[var(--color-paper)] text-sm font-medium hover:opacity-90 transition-opacity touch-manipulation w-full sm:w-auto"
        >
          <Plus size={18} />
          {t('newWorkout')}
        </Link>
      </div>

      {isLoading ? (
        <p className="text-[var(--color-muted)]">{t('loading')}</p>
      ) : days.length === 0 ? (
        <div className="text-center py-12 sm:py-16 px-4 border border-dashed border-[var(--color-border)] rounded-2xl">
          <p className="text-[var(--color-muted)] mb-4">{t('noWorkouts')}</p>
          <Link
            to="/activity/new"
            className="inline-flex items-center gap-2 px-5 py-3 min-h-[44px] rounded-lg bg-[var(--color-ink)] text-[var(--color-paper)] text-sm font-medium hover:opacity-90 touch-manipulation"
          >
            <Plus size={18} />
            {t('newWorkout')}
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(({ date, activities }) => (
            <section key={date}>
              <h2 className="sticky top-[57px] sm:top-[65px] z-10 text-xs font-medium uppercase tracking-wider text-[var(--color-muted)] bg-[var(--color-paper)]/95 backdrop-blur-sm py-2 mb-2">
                {formatDateHeader(date)}
              </h2>
              <ul className="space-y-2">
                {activities.map((day) => {
                  const duration = day.started_at && day.ended_at
                    ? formatDuration(day.started_at, day.ended_at)
                    : null;

                  return (
                    <li
                      key={day.id}
                      className="flex items-stretch rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-ink)]/30 hover:shadow-sm transition-all overflow-hidden min-h-[44px]"
                    >
                      <Link
                        to={`/activity/${day.id}`}
                        className="flex flex-1 items-center justify-between gap-3 p-4 min-w-0 touch-manipulation active:bg-[var(--color-active)] group"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-[var(--color-hover)] flex items-center justify-center">
                            <WorkoutDayIcon iconKey={day.icon} size={20} className="text-[var(--color-ink)]/70" fallbackToFirst />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-[var(--color-ink)] truncate flex items-center gap-2 flex-wrap">
                              <span className="truncate">{day.title || formatDateHeader(day.date)}</span>
                              <span className="inline-flex text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted)] px-1.5 py-0.5 rounded-md bg-[var(--color-hover)] shrink-0">
                                {t(`activityTypes.${day.activity_type ?? 'strength'}`)}
                              </span>
                            </p>
                            {duration && (
                              <span className="inline-flex items-center gap-1 text-xs text-[var(--color-muted)] mt-0.5">
                                <Clock size={12} />
                                {duration}
                              </span>
                            )}
                          </div>
                        </div>
                        <ChevronRight size={20} className="text-[var(--color-muted)] group-hover:text-[var(--color-ink)] flex-shrink-0" aria-hidden />
                      </Link>
                      <Link
                        to={`/activity/${day.id}`}
                        className="flex-shrink-0 flex items-center justify-center px-3 sm:px-4 border-l border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-ink)] hover:bg-[var(--color-hover)] transition-colors touch-manipulation min-w-[52px]"
                        aria-label={t('editWorkout')}
                        title={t('editWorkout')}
                      >
                        <Pencil size={20} aria-hidden />
                      </Link>
                      <button
                        type="button"
                        onClick={() => {
                          if (!window.confirm(t('confirmRemoveLog'))) return;
                          deleteWorkoutMutation.mutate(day.id);
                        }}
                        disabled={deleteWorkoutMutation.isPending}
                        className="flex-shrink-0 flex items-center justify-center px-4 border-l border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-error)] hover:bg-[var(--color-error-bg)] transition-colors touch-manipulation min-w-[52px] disabled:opacity-50"
                        aria-label={t('removeLog')}
                        title={t('removeLog')}
                      >
                        <Trash2 size={20} aria-hidden />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      <p className="mt-10 text-center text-xs text-[var(--color-muted)] tabular-nums">
        {t('appVersion', { version: APP_VERSION })}
      </p>
    </div>
  );
}
