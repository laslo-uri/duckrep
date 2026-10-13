import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, Pencil } from 'lucide-react';
import type { WorkoutExercise, ExerciseSet } from '../../types';
import { SelectMenu } from '../SelectMenu';
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
  onUpdateGoals,
  onUpdateSet,
  onDeleteSet,
  onSetCompleted,
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
  onUpdateGoals: (goals: string | null) => void;
  onUpdateSet: (setId: string, reps: number | null, weight: number | null, notes: string | null) => void;
  onDeleteSet: (setId: string) => void;
  onSetCompleted?: () => void;
  isAddingSet: boolean;
}) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(exercise.name);
  const [goals, setGoals] = useState(exercise.goals ?? '');

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

  const saveGoals = (value: string) => {
    const trimmed = value.trim();
    if (trimmed !== (exercise.goals ?? '')) onUpdateGoals(trimmed || null);
  };

  const accent = circuitAccentFromGroupId(exercise.circuit_group_id ?? null);
  const done = sets.filter((s) => s.completed).length;

  return (
    <div
      className="yp-card p-5 sm:p-6"
      style={accent ? { borderLeft: accent } : undefined}
    >
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          {editing ? (
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={saveName}
              onKeyDown={(e) => e.key === 'Enter' && saveName()}
              className="w-full font-medium text-[var(--color-ink)] bg-transparent border-b border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)] py-0.5"
              autoFocus
            />
          ) : (
            <button
              type="button"
              onClick={startEditing}
              className="font-medium text-[var(--color-ink)] hover:opacity-80 flex items-center gap-2 text-left"
            >
              <span className="truncate">{exercise.name}</span>
              <Pencil size={14} className="text-[var(--color-muted)] shrink-0" aria-hidden />
            </button>
          )}
          {sets.length > 0 && (
            <p className="text-xs tabular-nums text-[var(--color-muted)] mt-0.5">
              {t('setsProgress', { done, total: sets.length })}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onDelete}
          aria-label={t('delete')}
          className="yp-press p-2.5 min-w-[44px] min-h-[44px] rounded-lg text-[var(--color-muted)] hover:text-[var(--color-error)] hover:bg-[var(--color-error-bg)] touch-manipulation flex items-center justify-center"
        >
          <Trash2 size={16} />
        </button>
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-[var(--color-muted)]">
        <span className="shrink-0">{t('circuitLabel')}</span>
        <SelectMenu
          label={t('circuitLabel')}
          value={exercise.circuit_group_id ?? ''}
          disabled={circuitPending}
          className="min-w-[9rem] max-w-[14rem] flex-1"
          options={[
            { value: '', label: t('circuitNone') },
            ...circuitGroupIds.map((group, index) => ({
              value: group,
              label: t('circuitGroupN', { n: index + 1 }),
            })),
            { value: '__new__', label: t('circuitNew') },
          ]}
          onChange={(value) => {
            if (value === '') onUpdateCircuit(null);
            else if (value === '__new__') onUpdateCircuit(crypto.randomUUID());
            else onUpdateCircuit(value);
          }}
        />
      </div>
      <label className="block text-xs text-[var(--color-muted)] mb-3">
        <span className="sr-only">{t('goals')}</span>
        <input
          value={goals}
          onChange={(e) => setGoals(e.target.value)}
          onBlur={(e) => saveGoals(e.currentTarget.value)}
          placeholder={t('goalsPlaceholder')}
          aria-label={t('goals')}
          className="w-full text-sm rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink)] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
        />
      </label>
      <div className="space-y-2">
        {sets.map((s) => (
          <SetRow
            key={s.id}
            set={s}
            bodyWeightKg={bodyWeightKg}
            isDropSet={isDropSet}
            onToggle={() => {
              if (!s.completed) onSetCompleted?.();
              onToggleSet(s.id, !s.completed);
            }}
            onUpdate={(reps, weight, notes) => onUpdateSet(s.id, reps, weight, notes)}
            onDelete={() => onDeleteSet(s.id)}
          />
        ))}
        <button
          type="button"
          onClick={onAddSet}
          disabled={isAddingSet}
          className="yp-press flex items-center gap-2 py-3 min-h-[44px] text-sm text-[var(--color-muted)] hover:text-[var(--color-ink)] disabled:opacity-50 touch-manipulation"
        >
          <Plus size={16} />
          {t('addSet')}
        </button>
      </div>
    </div>
  );
}
