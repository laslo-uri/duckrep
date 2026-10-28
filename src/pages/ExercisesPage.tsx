import { useMemo, useRef, useState } from 'react';
import { usePageTitle } from '../hooks/usePageTitle';
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
import { PageBody, PageHeader } from '../components/Layout';

const ROW_HEIGHT = 44;

export function ExercisesPage() {
  const { t, i18n } = useTranslation();
  usePageTitle(t('exercises'));
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
    <>
      <PageHeader
        title={t('exercises')}
        meta={
          mode === 'library' && !isLoading && !isError && exercises.length > 0
            ? t('libraryCount', { count: filtered.length })
            : undefined
        }
        actions={
      <div className="flex rounded-md border border-[var(--color-border)] p-0.5">
        <button
          type="button"
          aria-pressed={mode === 'library'}
          onClick={() => setMode('library')}
          className={`dr-btn dr-btn-ghost h-6 border-0 px-2 text-[12px] max-md:h-9 ${
            mode === 'library' ? '!bg-[var(--color-active)] !text-[var(--color-ink)]' : ''
          }`}
        >
          {t('libraryExercises')}
        </button>
        <button
          type="button"
          aria-pressed={mode === 'browse'}
          onClick={() => setMode('browse')}
          className={`dr-btn dr-btn-ghost h-6 border-0 px-2 text-[12px] max-md:h-9 ${
            mode === 'browse' ? '!bg-[var(--color-active)] !text-[var(--color-ink)]' : ''
          }`}
        >
          {t('browseExercises')}
        </button>
      </div>
        }
      />
    <PageBody className="space-y-3">
      {mode === 'browse' ? <ExerciseBrowse /> : null}

      {mode === 'library' ? <QueryState
        isLoading={isLoading}
        isError={isError}
        error={error}
        refetch={() => void refetch()}
        isEmpty={!isLoading && !isError && exercises.length === 0}
        empty={<EmptyState title={t('noExercisesLibrary')} />}
      >
        <div className="sticky top-[var(--dr-header-h)] z-20 -mx-3 px-3 md:-mx-4 md:px-4 lg:-mx-6 lg:px-6 py-2 bg-[var(--color-paper)]/95 backdrop-blur-sm">
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={t('searchExercises')}
            aria-label={t('searchExercises')}
            className="dr-input w-full md:max-w-sm"
          />
          <div className="mt-2 flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
          <div ref={listRef} className="mt-2 h-[calc(100dvh-16rem)] md:h-[calc(100dvh-10rem)] overflow-y-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
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
                  className="absolute left-0 top-0 w-full"
                  style={{
                    height: `${item.size}px`,
                    transform: `translateY(${item.start}px)`,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedId(active ? null : ex.id)}
                    aria-pressed={active}
                    className={`w-full h-full text-left px-3 border-b border-[var(--color-border)] flex items-center gap-3 touch-manipulation hover:bg-[var(--color-hover)] ${
                      active ? 'bg-[var(--color-accent-soft)] hover:bg-[var(--color-accent-soft)]' : ''
                    }`}
                  >
                    {safeImage ? (
                      <img
                        src={safeImage}
                        alt=""
                        className="w-7 h-7 rounded-md object-cover bg-[var(--color-hover)] flex-shrink-0"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-7 h-7 rounded-md bg-[var(--color-hover)] flex-shrink-0" aria-hidden />
                    )}
                    <span className="min-w-0 flex-1 flex items-baseline gap-2">
                      <span className="font-medium text-[var(--color-ink)] truncate">{primary}</span>
                      {alt ? <span className="hidden sm:inline text-[12px] text-[var(--color-faint)] truncate">{alt}</span> : null}
                    </span>
                    <span className="dr-chip h-5 shrink-0 px-1.5 text-[11px]">{t(`muscleGroups.${group}`)}</span>
                  </button>
                </div>
              );
            })}
            </div>
          </div>
        )}
      </QueryState> : null}
    </PageBody>
    </>
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
      className="dr-chip dr-chip-tap shrink-0"
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
    <article className="mt-2 dr-card p-3 flex gap-3">
      {safeImage ? (
        <img src={safeImage} alt="" className="w-16 h-16 rounded-md object-cover bg-[var(--color-hover)] shrink-0" />
      ) : (
        <div className="w-16 h-16 rounded-md bg-[var(--color-hover)] shrink-0" aria-hidden />
      )}
      <div className="min-w-0">
        <h2 className="font-medium text-[var(--color-ink)]">{primary}</h2>
        {alt ? <p className="text-sm text-[var(--color-muted)]">{alt}</p> : null}
        <p className="text-[11px] uppercase tracking-wider text-[var(--color-muted)] mt-1">
          {t(`muscleGroups.${group}`)}
        </p>
        {exercise.description ? (
          <p className="text-[12px] text-[var(--color-muted)] mt-1.5 leading-relaxed">{exercise.description}</p>
        ) : null}
      </div>
    </article>
  );
}
