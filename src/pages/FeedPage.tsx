import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { WorkoutDayIcon } from '../components/WorkoutIconPicker';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { WorkoutDay, WorkoutDayWithExercises, ExerciseSet } from '../types';

interface FeedDay extends WorkoutDay {
  author_display_name: string | null;
}

function formatSets(sets: ExerciseSet[]): string {
  return sets
    .sort((a, b) => a.set_number - b.set_number)
    .map((s) => {
      const r = s.reps ?? '—';
      const w = s.weight != null ? `${s.weight} kg` : '—';
      const n = s.notes ? ` (${s.notes})` : '';
      return `${r}×${w}${n}`;
    })
    .join(', ');
}

export function FeedPage() {
  const { t } = useTranslation();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: days = [], isLoading } = useQuery({
    queryKey: ['public-feed'],
    queryFn: async () => {
      const { data: workoutData, error: workoutError } = await supabase
        .from('workout_days')
        .select('*')
        .eq('is_public', true)
        .is('deleted_at', null)
        .order('date', { ascending: false })
        .limit(30);
      if (workoutError) throw workoutError;
      const daysList = (workoutData ?? []) as WorkoutDay[];

      const userIds = [...new Set(daysList.map((d) => d.user_id))];
      if (userIds.length === 0) return daysList.map((d) => ({ ...d, author_display_name: null }));

      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, display_name')
        .in('id', userIds);
      if (profilesError) throw profilesError;

      const profileMap = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));

      return daysList.map((d) => ({
        ...d,
        author_display_name: profileMap.get(d.user_id) ?? null,
      })) as FeedDay[];
    },
  });

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

  const authorLabel = (day: FeedDay) =>
    day.author_display_name || day.user_id.slice(0, 8) + '…';
  const byPrefix = t('by');

  return (
    <FeedContent
      days={days}
      isLoading={isLoading}
      formatDate={formatDate}
      authorLabel={authorLabel}
      byPrefix={byPrefix}
      expandedId={expandedId}
      onToggleExpand={setExpandedId}
    />
  );
}

function FeedContent({
  days,
  isLoading,
  formatDate,
  authorLabel,
  byPrefix,
  expandedId,
  onToggleExpand,
}: {
  days: FeedDay[];
  isLoading: boolean;
  formatDate: (d: string) => string;
  authorLabel: (day: FeedDay) => string;
  byPrefix: string;
  expandedId: string | null;
  onToggleExpand: (id: string | null) => void;
}) {
  const { t } = useTranslation();

  return (
    <div>
      <h1 className="font-serif text-xl sm:text-2xl font-semibold text-[var(--color-ink)] tracking-tight mb-6 sm:mb-8">
        {t('publicFeed')}
      </h1>

      {isLoading ? (
        <p className="text-[var(--color-muted)]">{t('loading')}</p>
      ) : days.length === 0 ? (
        <div className="text-center py-12 sm:py-16 px-4 border border-dashed border-[var(--color-border)] rounded-2xl">
          <p className="text-[var(--color-muted)]">{t('noPublicWorkouts')}</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {days.map((day) => (
            <FeedCard
              key={day.id}
              day={day}
              formatDate={formatDate}
              authorLabel={authorLabel}
              byPrefix={byPrefix}
              isExpanded={expandedId === day.id}
              onToggle={() => onToggleExpand(expandedId === day.id ? null : day.id)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function FeedCard({
  day,
  formatDate,
  authorLabel,
  byPrefix,
  isExpanded,
  onToggle,
}: {
  day: FeedDay;
  formatDate: (d: string) => string;
  authorLabel: (day: FeedDay) => string;
  byPrefix: string;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();

  const { data: workoutDetails, isLoading: detailsLoading } = useQuery({
    queryKey: ['public-feed-details', day.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workout_days')
        .select(`
          *,
          workout_exercises (
            id, name, order_index, goals, notes,
            exercise_sets (id, set_number, reps, weight, notes)
          )
        `)
        .eq('id', day.id)
        .single();
      if (error) throw error;
      return data as unknown as WorkoutDayWithExercises;
    },
    enabled: isExpanded,
  });

  const exercises = (workoutDetails?.workout_exercises ?? []).sort(
    (a, b) => a.order_index - b.order_index
  );

  return (
    <li className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full p-4 text-left hover:bg-[var(--color-hover)]/50 transition-colors min-h-[44px] touch-manipulation"
      >
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-[var(--color-hover)] flex items-center justify-center">
            <WorkoutDayIcon iconKey={day.icon} size={20} className="text-[var(--color-ink)]/70" fallbackToFirst />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0.5 sm:gap-2 mb-1">
              <p className="font-medium text-[var(--color-ink)] truncate">
                {day.title || formatDate(day.date)}
              </p>
              <span className="text-xs text-[var(--color-muted)] min-w-0 sm:max-w-[45%] truncate">
                {byPrefix} {authorLabel(day)}
              </span>
            </div>
            <p className="text-sm text-[var(--color-muted)]">{formatDate(day.date)}</p>
          </div>
          <span className="flex-shrink-0 text-[var(--color-muted)]">
            {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </span>
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-[var(--color-border)] px-4 pb-4 pt-2">
          {day.notes && (
            <p className="text-sm text-[var(--color-muted)] mb-3">{day.notes}</p>
          )}
          {detailsLoading ? (
            <p className="text-sm text-[var(--color-muted)]">{t('loading')}</p>
          ) : exercises.length === 0 ? (
            <p className="text-sm text-[var(--color-muted)]">{t('noExercises')}</p>
          ) : (
            <ul className="space-y-2">
              {exercises.map((ex) => {
                const rawSets = 'exercise_sets' in ex ? ex.exercise_sets : ex.sets;
                const sets = ((rawSets ?? []) as ExerciseSet[]).slice().sort(
                  (a: ExerciseSet, b: ExerciseSet) => a.set_number - b.set_number
                );
                const setsStr = formatSets(sets);
                return (
                  <li
                    key={ex.id}
                    className="text-sm py-1.5 border-b border-[var(--color-border)] last:border-0 last:pb-0"
                  >
                    <p className="font-medium text-[var(--color-ink)]">{ex.name}</p>
                    <p className="text-xs text-[var(--color-muted)] mt-0.5 truncate">
                      {setsStr || '—'}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}
