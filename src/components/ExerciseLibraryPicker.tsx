import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { QueryState } from './QueryState';
import { ExerciseList } from './ExerciseList';
import { useDialogA11y } from '../hooks/useDialogA11y';
import { useExerciseCatalog } from '../hooks/useExerciseCatalog';
import type { BodyMuscle, ExerciseType } from '../lib/bodyMap';
import { GYM_ORDER, buildCatalog, catalogRows } from '../lib/exerciseCatalog';
import type { ExerciseDefinition } from '../types';

const NO_MUSCLES: ReadonlySet<BodyMuscle> = new Set();
const STRENGTH: ReadonlySet<ExerciseType> = new Set(['strength']);

/**
 * "From library" inside an activity: opens on your exercises and the essentials, searches all of them,
 * and stays open so several can be added in a row (Done closes).
 */
export function ExerciseLibraryPicker(props: {
  open: boolean;
  onClose: () => void;
  userId: string;
  onPick: (def: ExerciseDefinition) => void;
}) {
  // Mounted only while open, so every opening starts with an empty search.
  return props.open ? <PickerDialog {...props} /> : null;
}

function PickerDialog({
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
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [muscle, setMuscle] = useState<BodyMuscle | null>(null);
  const [added, setAdded] = useState<ReadonlySet<string>>(new Set());
  const catalog = useExerciseCatalog(userId);

  const dialogRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  useDialogA11y({ open, onClose, containerRef: dialogRef, initialFocusRef: searchRef });

  const items = useMemo(
    () =>
      buildCatalog(catalog.entries, {
        search,
        muscles: muscle ? new Set([muscle]) : NO_MUSCLES,
        equipment: '',
        types: STRENGTH,
        all: false,
      }),
    [catalog.entries, search, muscle],
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/50" aria-hidden="true" onClick={onClose} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="library-picker-title"
        className="dr-enter relative flex h-[85dvh] w-full flex-col rounded-t-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-pop)] sm:h-[min(85dvh,720px)] sm:max-w-xl sm:rounded-xl"
      >
        <div className="flex h-11 items-center justify-between gap-3 border-b border-[var(--color-border)] px-3 max-md:h-12">
          <h2 id="library-picker-title" className="text-[13px] font-semibold text-[var(--color-ink)]">
            {t('addFromLibrary')}
          </h2>
          <div className="flex items-center gap-1">
            {added.size > 0 ? (
              <span role="status" className="text-[12px] text-[var(--color-muted)]">
                {t('addedCount', { count: added.size })}
              </span>
            ) : null}
            <button type="button" onClick={onClose} className="dr-btn dr-btn-ghost dr-icon-btn" aria-label={t('close')}>
              <X size={15} />
            </button>
          </div>
        </div>
        <div className="space-y-2 border-b border-[var(--color-border)] p-2">
          <input
            ref={searchRef}
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('searchExercises')}
            aria-label={t('searchExercises')}
            className="dr-input w-full"
          />
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="group" aria-label={t('bodyMap')}>
            <button type="button" onClick={() => setMuscle(null)} aria-pressed={muscle === null} className="dr-chip dr-chip-tap shrink-0">
              {t('filterAllMuscleGroups')}
            </button>
            {GYM_ORDER.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setMuscle(muscle === option ? null : option)}
                aria-pressed={muscle === option}
                className="dr-chip dr-chip-tap shrink-0"
              >
                {t(`muscles.${option}`)}
              </button>
            ))}
          </div>
        </div>
        <QueryState isLoading={catalog.isLoading} isError={catalog.isError} error={catalog.error} refetch={() => void catalog.refetch()}>
          {catalogRows(items).length === 0 ? (
            <p className="px-3 py-4 text-[12px] text-[var(--color-muted)]">{t('noExerciseMatches')}</p>
          ) : (
            <ExerciseList
              items={items}
              mode="picker"
              addedIds={added}
              adding={false}
              onAdd={({ ex }) => {
                onPick(ex);
                setAdded((current) => new Set(current).add(ex.id));
              }}
              className="min-h-0 flex-1"
            />
          )}
        </QueryState>
        <div className="flex justify-end gap-2 border-t border-[var(--color-border)] p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          <button type="button" onClick={onClose} className="dr-btn dr-btn-primary">
            {t('done')}
          </button>
        </div>
      </div>
    </div>
  );
}
