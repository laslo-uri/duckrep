import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Circle } from 'lucide-react';
import type { ExerciseSet } from '../../types';
import { parseOptionalFloat, parseOptionalInt } from '../../utils/numbers';

export function SetRow({
  set,
  bodyWeightKg,
  isDropSet,
  onToggle,
  onUpdate,
}: {
  set: ExerciseSet;
  bodyWeightKg: number | null;
  isDropSet: boolean;
  onToggle: () => void;
  onUpdate: (reps: number | null, weight: number | null) => void;
}) {
  const { t } = useTranslation();
  const effectiveWeight = set.weight ?? (isDropSet && bodyWeightKg ? bodyWeightKg : null);
  const [reps, setReps] = useState<string>(String(set.reps ?? ''));
  const [weight, setWeight] = useState<string>(String(set.weight ?? ''));
  const [editing, setEditing] = useState(false);

  const save = () => {
    const r = parseOptionalInt(reps);
    const w = parseOptionalFloat(weight);
    if (r !== set.reps || w !== set.weight) onUpdate(r, w);
    setEditing(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-2 sm:gap-3 py-3 sm:py-2 border-b border-[var(--color-border)] last:border-0">
      <button
        type="button"
        onClick={onToggle}
        aria-label={set.completed ? t('setCompleted') : t('setIncomplete')}
        className="flex-shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center touch-manipulation"
      >
        {set.completed ? (
          <Check size={20} className="text-[var(--color-success)]" />
        ) : (
          <Circle size={20} className="text-[var(--color-muted)]" />
        )}
      </button>
      <span className="text-sm text-[var(--color-muted)] w-8">{t('setNumber', { n: set.set_number })}</span>
      {editing ? (
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 flex-1 min-w-0">
          <input
            type="number"
            value={reps}
            onChange={(e) => setReps(e.target.value)}
            placeholder={t('reps')}
            className="w-14 sm:w-16 px-2 py-2 text-sm rounded border border-[var(--color-border)] bg-[var(--color-surface)] focus:outline-none focus:ring-1 focus:ring-[var(--color-ink)] touch-manipulation"
          />
          <span className="text-[var(--color-muted)]">×</span>
          <span className="flex items-center gap-1">
            <input
              type="number"
              step="0.5"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder={
                isDropSet && bodyWeightKg ? `${t('weight')} (${bodyWeightKg} ${t('bodyKg')})` : t('weight')
              }
              className="w-14 sm:w-16 px-2 py-2 text-sm rounded border border-[var(--color-border)] bg-[var(--color-surface)] focus:outline-none focus:ring-1 focus:ring-[var(--color-ink)] touch-manipulation"
            />
            <span className="text-xs text-[var(--color-muted)] whitespace-nowrap">{t('unitKg')}</span>
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={save}
              className="text-xs text-[var(--color-ink)] font-medium py-2 px-2 min-h-[44px] touch-manipulation"
            >
              {t('save')}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="text-xs text-[var(--color-muted)] py-2 px-2 min-h-[44px] touch-manipulation"
            >
              {t('cancel')}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-left text-[var(--color-ink)] hover:underline py-2 min-h-[36px] touch-manipulation"
        >
          {set.reps ?? '—'} × {effectiveWeight ?? '—'} {t('unitKg')}
          {isDropSet && effectiveWeight === bodyWeightKg && bodyWeightKg ? ` (${t('bodyKg')})` : ''}
        </button>
      )}
      {set.notes && !editing && <span className="text-xs text-[var(--color-muted)]">{set.notes}</span>}
    </div>
  );
}
