import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, Pencil } from 'lucide-react';
import type { WorkoutExercise, ExerciseSet } from '../../types';
import { SetRow } from './SetRow';

function circuitAccentFromGroupId(gid: string | null): string | undefined {
  if (!gid) return undefined;
  let h = 0;
  for (let i = 0; i < gid.length; i++) h = (h * 31 + gid.charCodeAt(i)) % 360;
  return `3px solid hsl(${h} 50% 42%)`;
}

export function ExerciseCard({
  exercise,
  bodyWeightKg,
  isDropSet,
  circuitGroupIds,
  onUpdateCircuit,
  circuitPending,
  onDelete,
  onToggleSet,
  onAddSet,
  onUpdateName,
  onUpdateSet,
  isAddingSet,
}: {
  exercise: WorkoutExercise & { exercise_sets?: ExerciseSet[]; sets?: ExerciseSet[] };
  bodyWeightKg: number | null;
  isDropSet: boolean;
  circuitGroupIds: string[];
  onUpdateCircuit: (circuit_group_id: string | null) => void;
  circuitPending: boolean;
  onDelete: () => void;
  onToggleSet: (setId: string, completed: boolean) => void;
  onAddSet: () => void;
  onUpdateName: (name: string) => void;
  onUpdateSet: (setId: string, reps: number | null, weight: number | null) => void;
  isAddingSet: boolean;
}) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(exercise.name);

  const startEditing = () => {
    setName(exercise.name);
    setEditing(true);
  };
  const sets = (exercise.exercise_sets ?? exercise.sets ?? []).sort(
    (a, b) => a.set_number - b.set_number,
  );

  const saveName = () => {
    const trimmed = name.trim();
    if (trimmed && trimmed !== exercise.name) onUpdateName(trimmed);
    setEditing(false);
  };

  const accent = circuitAccentFromGroupId(exercise.circuit_group_id ?? null);

  return (
    <div
      className="p-4 sm:p-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]"
      style={accent ? { borderLeft: accent } : undefined}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        {editing ? (
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => e.key === 'Enter' && saveName()}
            className="flex-1 font-medium text-[var(--color-ink)] bg-transparent border-b border-[var(--color-border)] focus:outline-none focus:border-[var(--color-ink)] py-0.5"
            autoFocus
          />
        ) : (
          <button
            type="button"
            onClick={startEditing}
            className="font-medium text-[var(--color-ink)] hover:opacity-80 flex items-center gap-2 text-left"
          >
            {exercise.name}
            <Pencil size={14} className="text-[var(--color-muted)]" aria-hidden />
          </button>
        )}
        <button
          type="button"
          onClick={onDelete}
          aria-label={t('delete')}
          className="p-2.5 min-w-[44px] min-h-[44px] rounded-lg text-[var(--color-muted)] hover:text-[var(--color-error)] hover:bg-[var(--color-error-bg)] transition-colors touch-manipulation flex items-center justify-center"
        >
          <Trash2 size={16} />
        </button>
      </div>
      <label className="flex flex-wrap items-center gap-2 text-xs text-[var(--color-muted)] mb-3">
        <span className="shrink-0">{t('circuitLabel')}</span>
        <select
          value={exercise.circuit_group_id ?? ''}
          onChange={(e) => {
            const v = e.target.value;
            if (v === '') onUpdateCircuit(null);
            else if (v === '__new__') onUpdateCircuit(crypto.randomUUID());
            else onUpdateCircuit(v);
          }}
          disabled={circuitPending}
          className="text-xs rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink)] px-2 py-1.5 max-w-[min(100%,14rem)]"
        >
          <option value="">{t('circuitNone')}</option>
          {circuitGroupIds.map((g, i) => (
            <option key={g} value={g}>
              {t('circuitGroupN', { n: i + 1 })}
            </option>
          ))}
          <option value="__new__">{t('circuitNew')}</option>
        </select>
      </label>
      {exercise.goals && <p className="text-sm text-[var(--color-muted)] mb-3">{exercise.goals}</p>}
      <div className="space-y-2">
        {sets.map((s) => (
          <SetRow
            key={s.id}
            set={s}
            bodyWeightKg={bodyWeightKg}
            isDropSet={isDropSet}
            onToggle={() => onToggleSet(s.id, !s.completed)}
            onUpdate={(reps, weight) => onUpdateSet(s.id, reps, weight)}
          />
        ))}
        <button
          type="button"
          onClick={onAddSet}
          disabled={isAddingSet}
          className="flex items-center gap-2 py-3 min-h-[44px] text-sm text-[var(--color-muted)] hover:text-[var(--color-ink)] disabled:opacity-50 touch-manipulation"
        >
          <Plus size={16} />
          {t('addSet')}
        </button>
      </div>
    </div>
  );
}
