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

const ROW_HEIGHT = 64;

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
        className="dr-enter relative w-full sm:max-w-lg max-h-[85dvh] rounded-t-2xl sm:rounded-2xl bg-[var(--color-paper)] shadow-[var(--shadow-card)] flex flex-col"
      >
        <div className="flex items-center justify-between gap-3 p-4 border-b border-[var(--color-border)]">
          <h2 id="library-picker-title" className="font-serif text-lg font-semibold text-[var(--color-ink)]">
            {t('addFromLibrary')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="dr-press p-2.5 rounded-lg hover:bg-[var(--color-hover)] text-[var(--color-muted)] touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label={t('cancel')}
          >
            <X size={22} />
          </button>
        </div>
        <div className="p-3 border-b border-[var(--color-border)] space-y-3">
          <input
            ref={searchRef}
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={t('searchExercises')}
            aria-label={t('searchExercises')}
            className="w-full px-4 py-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
          />
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            <button
              type="button"
              onClick={() => setMuscleGroup('')}
              aria-pressed={muscleGroup === ''}
              className={`shrink-0 px-3 py-2 min-h-[44px] rounded-lg text-xs font-medium border transition-colors touch-manipulation ${
                muscleGroup === ''
                  ? 'bg-[var(--color-accent)] text-[var(--color-on-accent)] border-transparent'
                  : 'border-[var(--color-border)] text-[var(--color-muted)] hover:bg-[var(--color-hover)]'
              }`}
            >
              {t('filterAllMuscleGroups')}
            </button>
            {MUSCLE_GROUPS.map((group) => (
              <button
                key={group}
                type="button"
                onClick={() => setMuscleGroup(group)}
                aria-pressed={muscleGroup === group}
                className={`shrink-0 px-3 py-2 min-h-[44px] rounded-lg text-xs font-medium border transition-colors touch-manipulation ${
                  muscleGroup === group
                    ? 'bg-[var(--color-accent)] text-[var(--color-on-accent)] border-transparent'
                    : 'border-[var(--color-border)] text-[var(--color-muted)] hover:bg-[var(--color-hover)]'
                }`}
              >
                {t(`muscleGroups.${group}`)}
              </button>
            ))}
          </div>
        </div>
        <div ref={listRef} className="overflow-y-auto flex-1 p-3 pb-6">
          <QueryState
            isLoading={isLoading}
            isError={isError}
            error={error}
            refetch={() => void refetch()}
          >
          {filtered.length === 0 ? (
            <p className="text-sm text-[var(--color-muted)] px-1">{t('noExercisesLibrary')}</p>
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
                      className="w-full h-full text-left px-3 py-2 rounded-xl border border-transparent hover:border-[var(--color-border)] hover:bg-[var(--color-hover)] transition-colors touch-manipulation flex items-center gap-3"
                    >
                      {safeImage ? (
                        <img
                          src={safeImage}
                          alt=""
                          className="w-10 h-10 rounded-xl object-cover bg-[var(--color-hover)] flex-shrink-0"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-[var(--color-hover)] flex-shrink-0" aria-hidden />
                      )}
                      <span className="flex-1 min-w-0">
                        <span className="block font-medium text-[var(--color-ink)] truncate">{primary}</span>
                        {alt ? (
                          <span className="block text-xs text-[var(--color-muted)] truncate mt-0.5">{alt}</span>
                        ) : (
                          <span className="block text-xs text-[var(--color-muted)] truncate mt-0.5">
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
