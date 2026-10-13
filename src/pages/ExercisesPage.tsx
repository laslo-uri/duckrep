import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import { listExercises } from '../lib/db';
import { useLocalUser } from '../contexts/LocalUserContext';
import { ExerciseBrowse } from '../components/ExerciseBrowse';
import { QueryState } from '../components/QueryState';
import { EmptyState } from '../components/EmptyState';
import {
  MUSCLE_GROUPS,
  exerciseDisplayNames,
  isSafeHttpsImageUrl,
  resolveExerciseLocale,
} from '../utils/exerciseDisplay';
import type { ExerciseDefinition } from '../types';

const ROW_HEIGHT = 76;

export function ExercisesPage() {
  const { t, i18n } = useTranslation();
  const exerciseLocale = resolveExerciseLocale(i18n.resolvedLanguage ?? i18n.language);
  const { user } = useLocalUser();
  const [mode, setMode] = useState<'library' | 'browse'>('library');
  const [filter, setFilter] = useState('');
  const [muscleGroup, setMuscleGroup] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const { data: exercises = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['exercises', user.id],
    queryFn: () => listExercises(user.id),
  });

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return exercises
      .filter((ex) => {
        if (muscleGroup && (ex.muscle_group || 'other') !== muscleGroup) return false;
        if (!q) return true;
        const { primary, alt } = exerciseDisplayNames(ex, exerciseLocale);
        return primary.toLowerCase().includes(q) || alt.toLowerCase().includes(q);
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'en'));
  }, [exercises, filter, muscleGroup, exerciseLocale]);

  const selected = filtered.find((ex) => ex.id === selectedId) ?? null;

  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-semibold text-[var(--color-ink)] tracking-tight text-balance">
          {t('exercises')}
        </h1>
        {mode === 'library' && !isLoading && !isError && exercises.length > 0 && (
          <p className="text-sm text-[var(--color-muted)] mt-1">
            {t('libraryCount', { count: filtered.length })}
          </p>
        )}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          aria-pressed={mode === 'library'}
          onClick={() => setMode('library')}
          className={`yp-press min-h-[40px] rounded-lg px-3 text-sm font-medium ${
            mode === 'library'
              ? 'bg-[var(--color-accent)] text-[var(--color-on-accent)]'
              : 'border border-[var(--color-border)] text-[var(--color-muted)]'
          }`}
        >
          {t('libraryExercises')}
        </button>
        <button
          type="button"
          aria-pressed={mode === 'browse'}
          onClick={() => setMode('browse')}
          className={`yp-press min-h-[40px] rounded-lg px-3 text-sm font-medium ${
            mode === 'browse'
              ? 'bg-[var(--color-accent)] text-[var(--color-on-accent)]'
              : 'border border-[var(--color-border)] text-[var(--color-muted)]'
          }`}
        >
          {t('browseExercises')}
        </button>
      </div>

      {mode === 'browse' ? <ExerciseBrowse /> : null}

      {mode === 'library' ? <QueryState
        isLoading={isLoading}
        isError={isError}
        error={error}
        refetch={() => void refetch()}
        isEmpty={!isLoading && !isError && exercises.length === 0}
        empty={<EmptyState title={t('noExercisesLibrary')} />}
      >
        <div className="sticky top-14 z-20 -mx-4 px-4 sm:-mx-8 sm:px-8 py-3 bg-[var(--color-paper)]/95 backdrop-blur-sm">
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={t('searchExercises')}
            aria-label={t('searchExercises')}
            className="w-full px-4 py-2.5 min-h-[44px] rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
          />
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <MuscleChip
              label={t('filterAllMuscleGroups')}
              pressed={muscleGroup === ''}
              onClick={() => setMuscleGroup('')}
            />
            {MUSCLE_GROUPS.map((group) => (
              <MuscleChip
                key={group}
                label={t(`muscleGroups.${group}`)}
                pressed={muscleGroup === group}
                onClick={() => setMuscleGroup(group)}
              />
            ))}
          </div>
        </div>

        {selected && <ExerciseDetail exercise={selected} locale={exerciseLocale} />}

        {filtered.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)] py-8 text-center">{t('noExerciseMatches')}</p>
        ) : (
          <div ref={listRef} className="mt-3 h-[min(calc(100dvh-25rem),720px)] md:h-[min(calc(100dvh-18rem),720px)] overflow-y-auto">
            <div className="relative w-full" style={{ height: `${virtualizer.getTotalSize()}px` }}>
            {virtualizer.getVirtualItems().map((item) => {
              const ex = filtered[item.index];
              const { primary, alt } = exerciseDisplayNames(ex, exerciseLocale);
              const safeImage = isSafeHttpsImageUrl(ex.image_url) ? ex.image_url!.trim() : null;
              const group = ex.muscle_group || 'other';
              const active = selectedId === ex.id;
              return (
                <div
                  key={ex.id}
                  className="absolute left-0 top-0 w-full pb-2"
                  style={{
                    height: `${item.size}px`,
                    transform: `translateY(${item.start}px)`,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedId(active ? null : ex.id)}
                    aria-pressed={active}
                    className={`yp-press w-full h-[68px] text-left px-4 rounded-xl bg-[var(--color-surface)] flex items-center gap-3 touch-manipulation shadow-[var(--shadow-card)] ${
                      active ? 'ring-2 ring-[var(--color-accent)]' : ''
                    }`}
                  >
                    {safeImage ? (
                      <img
                        src={safeImage}
                        alt=""
                        className="w-11 h-11 rounded-xl object-cover bg-[var(--color-hover)] flex-shrink-0"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-xl bg-[var(--color-hover)] flex-shrink-0" aria-hidden />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-[var(--color-ink)] truncate">{primary}</span>
                      <span className="block text-xs text-[var(--color-muted)] truncate mt-0.5">
                        {alt || t(`muscleGroups.${group}`)}
                      </span>
                    </span>
                  </button>
                </div>
              );
            })}
            </div>
          </div>
        )}
      </QueryState> : null}
    </div>
  );
}

function MuscleChip({
  label,
  pressed,
  onClick,
}: {
  label: string;
  pressed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      className={`shrink-0 inline-flex items-center px-3 min-h-[40px] rounded-lg text-xs font-medium border transition-colors touch-manipulation ${
        pressed
          ? 'bg-[var(--color-accent)] text-[var(--color-on-accent)] border-transparent'
          : 'border-[var(--color-border)] text-[var(--color-muted)] bg-[var(--color-surface)]'
      }`}
    >
      {label}
    </button>
  );
}

function ExerciseDetail({
  exercise,
  locale,
}: {
  exercise: ExerciseDefinition;
  locale: ReturnType<typeof resolveExerciseLocale>;
}) {
  const { t } = useTranslation();
  const { primary, alt } = exerciseDisplayNames(exercise, locale);
  const safeImage = isSafeHttpsImageUrl(exercise.image_url) ? exercise.image_url!.trim() : null;
  const group = exercise.muscle_group || 'other';

  return (
    <article className="mt-4 yp-card p-5 flex gap-4">
      {safeImage ? (
        <img src={safeImage} alt="" className="w-20 h-20 rounded-xl object-cover bg-[var(--color-hover)] shrink-0" />
      ) : (
        <div className="w-20 h-20 rounded-xl bg-[var(--color-hover)] shrink-0" aria-hidden />
      )}
      <div className="min-w-0">
        <h2 className="font-medium text-[var(--color-ink)]">{primary}</h2>
        {alt ? <p className="text-sm text-[var(--color-muted)]">{alt}</p> : null}
        <p className="text-[11px] uppercase tracking-wider text-[var(--color-muted)] mt-1">
          {t(`muscleGroups.${group}`)}
        </p>
        {exercise.description ? (
          <p className="text-sm text-[var(--color-muted)] mt-2 leading-relaxed">{exercise.description}</p>
        ) : null}
      </div>
    </article>
  );
}
