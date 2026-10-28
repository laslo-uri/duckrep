import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, Pencil } from 'lucide-react';
import type { WorkoutExercise, ExerciseSet } from '../../types';
import { SelectMenu } from '../SelectMenu';
import { SetRow } from './SetRow';

function circuitColorFromGroupId(gid: string | null): string | undefined {
  if (!gid) return undefined;
  let h = 0;
  for (let i = 0; i < gid.length; i++) h = (h * 31 + gid.charCodeAt(i)) % 360;
  return `hsl(${h} 50% 48%)`;
}

export function ExerciseCard({
  index,
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
  index?: number;
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

  const circuitColor = circuitColorFromGroupId(exercise.circuit_group_id ?? null);
  const done = sets.filter((s) => s.completed).length;
  const allDone = sets.length > 0 && done === sets.length;

  return (
    <section
      aria-label={exercise.name}
      className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]"
      style={circuitColor ? { boxShadow: `inset 3px 0 0 ${circuitColor}` } : undefined}
    >
      {/* Header row: number, name, circuit, progress, delete */}
      <div className="flex min-h-10 items-center gap-2 border-b border-[var(--color-border)] px-3 py-1">
        {index != null && (
          <span className="w-4 shrink-0 text-[12px] tabular-nums text-[var(--color-faint)]">{index}</span>
        )}
        <div className="min-w-0 flex-1">
          {editing ? (
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={saveName}
              onKeyDown={(e) => e.key === 'Enter' && saveName()}
              aria-label={t('exercises')}
              className="dr-input w-full font-medium"
              autoFocus
            />
          ) : (
            <button
              type="button"
              onClick={startEditing}
              className="group dr-tap flex max-w-full items-center gap-1.5 text-left font-medium text-[var(--color-ink)]"
            >
              <span className="truncate">{exercise.name}</span>
              <Pencil size={12} className="shrink-0 text-[var(--color-faint)] opacity-0 group-hover:opacity-100 max-md:opacity-60" aria-hidden />
            </button>
          )}
        </div>
        <SelectMenu
          label={t('circuitLabel')}
          value={exercise.circuit_group_id ?? ''}
          disabled={circuitPending}
          compact
          className="hidden w-32 shrink-0 lg:block"
          options={[
            { value: '', label: t('circuitNone') },
            ...circuitGroupIds.map((group, i) => ({
              value: group,
              label: t('circuitGroupN', { n: i + 1 }),
            })),
            { value: '__new__', label: t('circuitNew') },
          ]}
          onChange={(value) => {
            if (value === '') onUpdateCircuit(null);
            else if (value === '__new__') onUpdateCircuit(crypto.randomUUID());
            else onUpdateCircuit(value);
          }}
        />
        {sets.length > 0 && (
          <span
            className={`w-10 shrink-0 text-right text-[12px] font-medium tabular-nums ${
              allDone ? 'text-[var(--color-success)]' : 'text-[var(--color-muted)]'
            }`}
          >
            {t('setsProgress', { done, total: sets.length })}
          </span>
        )}
        <button
          type="button"
          onClick={onDelete}
          aria-label={t('delete')}
          title={t('delete')}
          className="dr-btn dr-btn-ghost dr-icon-btn shrink-0 hover:!text-[var(--color-error)]"
        >
          <Trash2 size={14} aria-hidden />
        </button>
      </div>

      {/* Goal + (on phones) circuit */}
      <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-3 py-1">
        <input
          value={goals}
          onChange={(e) => setGoals(e.target.value)}
          onBlur={(e) => saveGoals(e.currentTarget.value)}
          placeholder={t('goalsPlaceholder')}
          aria-label={t('goals')}
          className="dr-tap min-w-0 flex-1 bg-transparent text-[12px] text-[var(--color-ink)] placeholder:text-[var(--color-faint)] focus:outline-none"
        />
        <SelectMenu
          label={t('circuitLabel')}
          value={exercise.circuit_group_id ?? ''}
          disabled={circuitPending}
          compact
          className="w-28 shrink-0 lg:hidden"
          options={[
            { value: '', label: t('circuitNone') },
            ...circuitGroupIds.map((group, i) => ({
              value: group,
              label: t('circuitGroupN', { n: i + 1 }),
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

      {sets.length > 0 && (
        <div
          className="flex h-7 items-center gap-2 border-b border-[var(--color-border)] px-3 text-[11px] font-medium uppercase tracking-wide text-[var(--color-faint)]"
          aria-hidden
        >
          <span className="w-7 shrink-0 text-center md:w-6">✓</span>
          <span className="w-5 shrink-0 text-center">#</span>
          <span className="w-14 shrink-0 text-center">{t('reps')}</span>
          <span className="w-3 shrink-0" />
          <span className="w-16 shrink-0 text-center">{t('unitKg')}</span>
          <span className="hidden flex-1 sm:block">{t('setNote')}</span>
        </div>
      )}
      <div>
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
      </div>
      <button
        type="button"
        onClick={onAddSet}
        disabled={isAddingSet}
        className="dr-tap flex w-full items-center gap-2 px-3 py-1 text-left text-[12px] text-[var(--color-muted)] transition-colors hover:bg-[var(--color-hover)] hover:text-[var(--color-ink)] disabled:opacity-50"
      >
        <Plus size={13} aria-hidden />
        {t('addSet')}
      </button>
    </section>
  );
}
