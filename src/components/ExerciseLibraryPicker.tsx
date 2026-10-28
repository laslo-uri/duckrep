import { useState, useMemo, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import { X } from 'lucide-react';
import { listExercises } from '../lib/db';
import { QueryState } from './QueryState';
import { useDialogA11y } from '../hooks/useDialogA11y';
import {
  MUSCLE_GROUPS,
  exerciseDisplayNames,
  isSafeHttpsImageUrl,
  resolveExerciseLocale,
} from '../utils/exerciseDisplay';
import type { ExerciseDefinition } from '../types';

const ROW_HEIGHT = 44;

export function ExerciseLibraryPicker({
  open,
  onClose,
  userId,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  userId: string;
  onPick: (def: ExerciseDefinition) => void;
}) {
  const { t, i18n } = useTranslation();
  const [filter, setFilter] = useState('');
  const [muscleGroup, setMuscleGroup] = useState<string>('');
  const exerciseLocale = resolveExerciseLocale(i18n.resolvedLanguage ?? i18n.language);

  const dialogRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useDialogA11y({
    open,
    onClose,
    containerRef: dialogRef,
    initialFocusRef: searchRef,
  });

  useEffect(() => {
    if (!open) {
      setFilter('');
      setMuscleGroup('');
    }
  }, [open]);

  const { data: exercises = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['exercises', userId],
    queryFn: () => listExercises(userId),
    enabled: open && !!userId,
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

  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/50" aria-hidden="true" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="library-picker-title"
        className="dr-enter relative w-full sm:max-w-lg max-h-[85dvh] rounded-t-xl sm:rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-pop)] flex flex-col"
      >
        <div className="flex h-11 items-center justify-between gap-3 px-3 border-b border-[var(--color-border)] max-md:h-12">
          <h2 id="library-picker-title" className="text-[13px] font-semibold text-[var(--color-ink)]">
            {t('addFromLibrary')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="dr-btn dr-btn-ghost dr-icon-btn"
            aria-label={t('cancel')}
          >
            <X size={15} />
          </button>
        </div>
        <div className="p-2 border-b border-[var(--color-border)] space-y-2">
          <input
            ref={searchRef}
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={t('searchExercises')}
            aria-label={t('searchExercises')}
            className="dr-input w-full"
          />
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none]">
            <button
              type="button"
              onClick={() => setMuscleGroup('')}
              aria-pressed={muscleGroup === ''}
              className="dr-chip dr-chip-tap shrink-0"
            >
              {t('filterAllMuscleGroups')}
            </button>
            {MUSCLE_GROUPS.map((group) => (
              <button
                key={group}
                type="button"
                onClick={() => setMuscleGroup(group)}
                aria-pressed={muscleGroup === group}
                className="dr-chip dr-chip-tap shrink-0"
              >
                {t(`muscleGroups.${group}`)}
              </button>
            ))}
          </div>
        </div>
        <div ref={listRef} className="overflow-y-auto flex-1 p-1 pb-4">
          <QueryState
            isLoading={isLoading}
            isError={isError}
            error={error}
            refetch={() => void refetch()}
          >
          {filtered.length === 0 ? (
            <p className="text-[12px] text-[var(--color-muted)] px-2 py-2">{t('noExercisesLibrary')}</p>
          ) : (
            <ul
              className="relative w-full"
              style={{ height: `${virtualizer.getTotalSize()}px` }}
            >
              {virtualizer.getVirtualItems().map((item) => {
                const ex = filtered[item.index];
                const { primary, alt } = exerciseDisplayNames(ex, exerciseLocale);
                const safeImage = isSafeHttpsImageUrl(ex.image_url) ? ex.image_url!.trim() : null;
                const group = ex.muscle_group || 'other';
                return (
                  <li
                    key={ex.id}
                    className="absolute left-0 top-0 w-full"
                    style={{
                      height: `${item.size}px`,
                      transform: `translateY(${item.start}px)`,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        onPick(ex);
                        onClose();
                        setFilter('');
                        setMuscleGroup('');
                      }}
                      className="w-full h-full text-left px-2 rounded-md hover:bg-[var(--color-hover)] transition-colors touch-manipulation flex items-center gap-2.5"
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
                      <span className="flex-1 min-w-0">
                        <span className="block font-medium text-[var(--color-ink)] truncate">{primary}</span>
                        {alt ? (
                          <span className="block text-[11px] text-[var(--color-faint)] truncate">{alt}</span>
                        ) : (
                          <span className="block text-[11px] text-[var(--color-faint)] truncate">
                            {t(`muscleGroups.${group}`)}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          </QueryState>
        </div>
      </div>
    </div>
  );
}
