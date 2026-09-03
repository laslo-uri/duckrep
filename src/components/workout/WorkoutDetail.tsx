import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Plus, Trash2, Pencil, BookOpen } from 'lucide-react';
import { WorkoutIconPicker } from '../WorkoutIconPicker';
import { ExerciseLibraryPicker } from '../ExerciseLibraryPicker';
import { ConfirmDialog } from '../ConfirmDialog';
import { EmptyState } from '../EmptyState';
import { useConfirm } from '../../hooks/useConfirm';
import {
  ACTIVITY_TYPES,
  type WorkoutDayWithExercises,
  type ExerciseDefinition,
  type ActivityMediaItem,
  type ActivityType,
} from '../../types';
import { ExerciseCard } from './ExerciseCard';

type WorkoutDetailProps = {
  workout: WorkoutDayWithExercises;
  userId: string;
  bodyWeight: number | null;
  updateWorkoutMutation: {
    mutate: (u: {
      title?: string;
      notes?: string;
      icon?: string | null;
      started_at?: string | null;
      ended_at?: string | null;
      activity_type?: ActivityType;
      media?: ActivityMediaItem[];
    }) => void;
    isPending?: boolean;
  };
  addExerciseMutation: { mutate: (def?: ExerciseDefinition) => void; isPending?: boolean };
  deleteExerciseMutation: { mutate: (exId: string) => void };
  toggleSetMutation: { mutate: (p: { setId: string; completed: boolean }) => void };
  updateExerciseMutation: { mutate: (p: { exId: string; name: string }) => void };
  updateSetMutation: { mutate: (p: { setId: string; reps: number | null; weight: number | null }) => void };
  addSetMutation: { mutate: (exId: string) => void; isPending?: boolean };
  deleteWorkoutMutation: { mutate: (workoutId: string) => void; isPending?: boolean };
  updateExerciseCircuitMutation: {
    mutate: (p: { exId: string; circuit_group_id: string | null }) => void;
    isPending?: boolean;
  };
};

export function WorkoutDetail({
  workout,
  userId,
  bodyWeight,
  updateWorkoutMutation,
  addExerciseMutation,
  deleteExerciseMutation,
  toggleSetMutation,
  updateExerciseMutation,
  updateSetMutation,
  addSetMutation,
  deleteWorkoutMutation,
  updateExerciseCircuitMutation,
}: WorkoutDetailProps) {
  const { t } = useTranslation();
  const { confirm, confirmState, handleConfirm, handleCancel } = useConfirm();
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [editingTitle, setEditingTitle] = useState(!workout.title);
  const [titleInput, setTitleInput] = useState(workout.title ?? '');
  const [mediaUrlInput, setMediaUrlInput] = useState('');
  const [mediaCaptionInput, setMediaCaptionInput] = useState('');
  const [mediaUrlError, setMediaUrlError] = useState<string | null>(null);
  const exercises = (workout.workout_exercises ?? []).sort((a, b) => a.order_index - b.order_index);
  const circuitGroupIds = [...new Set(exercises.map((e) => e.circuit_group_id).filter(Boolean) as string[])].sort();
  const displayTitle =
    workout.title ||
    new Date(workout.date).toLocaleDateString(undefined, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });

  const startEditingTitle = () => {
    setTitleInput(workout.title ?? '');
    setEditingTitle(true);
  };

  const saveTitle = () => {
    const trimmed = titleInput.trim();
    if (trimmed !== (workout.title ?? '')) {
      updateWorkoutMutation.mutate({ title: trimmed || undefined });
    }
    setEditingTitle(false);
  };

  return (
    <div>
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-[var(--color-muted)] hover:text-[var(--color-ink)] mb-6 sm:mb-8 min-h-[44px] items-center touch-manipulation"
      >
        <ArrowLeft size={18} />
        {t('backToJournal')}
      </Link>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-6 sm:mb-8">
        <div className="flex-1 min-w-0">
          {editingTitle ? (
            <input
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={(e) => e.key === 'Enter' && saveTitle()}
              placeholder={t('nameWorkoutPlaceholder')}
              autoFocus
              className="font-serif text-xl sm:text-2xl font-semibold text-[var(--color-ink)] tracking-tight w-full bg-transparent border-b border-[var(--color-border)] focus:outline-none focus:border-[var(--color-ink)] py-0.5"
            />
          ) : (
            <button
              type="button"
              onClick={startEditingTitle}
              className="font-serif text-xl sm:text-2xl font-semibold text-[var(--color-ink)] tracking-tight hover:opacity-80 flex items-center gap-2 text-left"
            >
              {displayTitle}
              <Pencil size={16} className="text-[var(--color-muted)] flex-shrink-0" aria-hidden />
            </button>
          )}
          <p className="text-sm text-[var(--color-muted)] mt-0.5">{workout.date}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-[var(--color-muted)]">
            {!workout.started_at && (
              <button
                type="button"
                onClick={() => updateWorkoutMutation.mutate({ started_at: new Date().toISOString(), ended_at: null })}
                disabled={updateWorkoutMutation.isPending}
                className="px-3 py-2 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-hover)] text-[var(--color-ink)] font-medium touch-manipulation disabled:opacity-50"
              >
                {t('startSession')}
              </button>
            )}
            {workout.started_at && !workout.ended_at && (
              <>
                <span className="text-xs sm:text-sm">
                  {t('sessionStarted')}{' '}
                  {new Date(workout.started_at).toLocaleTimeString(undefined, {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                <button
                  type="button"
                  onClick={() => updateWorkoutMutation.mutate({ ended_at: new Date().toISOString() })}
                  disabled={updateWorkoutMutation.isPending}
                  className="px-3 py-2 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-hover)] text-[var(--color-ink)] font-medium touch-manipulation disabled:opacity-50"
                >
                  {t('endSession')}
                </button>
              </>
            )}
            {workout.started_at && workout.ended_at && (
              <>
                <span className="text-xs sm:text-sm">
                  {new Date(workout.started_at).toLocaleTimeString(undefined, {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                  {' — '}
                  {new Date(workout.ended_at).toLocaleTimeString(undefined, {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                <button
                  type="button"
                  onClick={() => updateWorkoutMutation.mutate({ started_at: null, ended_at: null })}
                  disabled={updateWorkoutMutation.isPending}
                  className="text-xs underline text-[var(--color-muted)] hover:text-[var(--color-ink)] touch-manipulation px-1 py-2 disabled:opacity-50"
                >
                  {t('resetSessionTimes')}
                </button>
              </>
            )}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-4">
            <WorkoutIconPicker
              value={workout.icon}
              onChange={(icon) => updateWorkoutMutation.mutate({ icon })}
            />
            <label className="flex items-center gap-2 text-sm text-[var(--color-muted)]">
              <span className="whitespace-nowrap">{t('activityTypeLabel')}</span>
              <select
                value={workout.activity_type ?? 'strength'}
                onChange={(e) =>
                  updateWorkoutMutation.mutate({ activity_type: e.target.value as ActivityType })
                }
                disabled={updateWorkoutMutation.isPending}
                className="text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink)] px-2 py-1.5"
              >
                {ACTIVITY_TYPES.map((at) => (
                  <option key={at} value={at}>
                    {t(`activityTypes.${at}`)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto flex-shrink-0">
          <button
            type="button"
            onClick={() => setLibraryOpen(true)}
            disabled={addExerciseMutation.isPending}
            className="flex items-center justify-center gap-2 px-4 py-3 min-h-[44px] rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-hover)] text-sm font-medium touch-manipulation w-full sm:w-auto"
          >
            <BookOpen size={18} />
            {t('addFromLibrary')}
          </button>
          <button
            type="button"
            onClick={() => addExerciseMutation.mutate()}
            disabled={addExerciseMutation.isPending}
            className="flex items-center justify-center gap-2 px-4 py-3 min-h-[44px] rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-hover)] text-sm font-medium touch-manipulation w-full sm:w-auto"
          >
            <Plus size={18} />
            {t('addExercise')}
          </button>
          <button
            type="button"
            onClick={async () => {
              const ok = await confirm({
                title: t('confirmRemoveTitle'),
                message: t('confirmRemoveLog'),
                confirmLabel: t('removeLog'),
                cancelLabel: t('cancel'),
                variant: 'danger',
              });
              if (ok) deleteWorkoutMutation.mutate(workout.id);
            }}
            disabled={deleteWorkoutMutation.isPending}
            className="flex items-center justify-center gap-2 px-4 py-3 min-h-[44px] rounded-lg border border-[var(--color-error)]/40 text-[var(--color-error)] hover:bg-[var(--color-error-bg)] text-sm font-medium touch-manipulation w-full sm:w-auto disabled:opacity-50"
          >
            <Trash2 size={18} />
            {deleteWorkoutMutation.isPending ? t('removingLog') : t('removeLog')}
          </button>
        </div>
      </div>

      {workout.notes && (
        <div className="p-4 mb-6 rounded-xl bg-[var(--color-hover)] text-sm text-[var(--color-muted)]">
          {workout.notes}
        </div>
      )}

      <section className="mb-6 p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
        <h2 className="text-sm font-medium text-[var(--color-ink)] mb-3">{t('mediaTitle')}</h2>
        <div className="flex flex-col sm:flex-row gap-2 mb-3">
          <input
            type="url"
            value={mediaUrlInput}
            onChange={(e) => setMediaUrlInput(e.target.value)}
            placeholder={t('mediaAddUrl')}
            className="flex-1 px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]"
          />
          <input
            type="text"
            value={mediaCaptionInput}
            onChange={(e) => setMediaCaptionInput(e.target.value)}
            placeholder={t('mediaCaption')}
            className="flex-1 px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]"
          />
          <button
            type="button"
            onClick={() => {
              const u = mediaUrlInput.trim();
              if (!/^https:\/\//i.test(u)) {
                setMediaUrlError(t('mediaUrlHttpsOnly'));
                return;
              }
              setMediaUrlError(null);
              const next = [...(workout.media ?? []), { url: u, caption: mediaCaptionInput.trim() || undefined }];
              updateWorkoutMutation.mutate({ media: next });
              setMediaUrlInput('');
              setMediaCaptionInput('');
            }}
            className="px-4 py-2 min-h-[44px] rounded-lg bg-[var(--color-ink)] text-[var(--color-paper)] text-sm font-medium touch-manipulation"
          >
            {t('mediaAdd')}
          </button>
        </div>
        {mediaUrlError ? (
          <p className="text-sm text-[var(--color-error)] mb-3" role="alert">
            {mediaUrlError}
          </p>
        ) : null}
        {(workout.media ?? []).length === 0 ? (
          <p className="text-xs text-[var(--color-muted)]">{t('mediaEmpty')}</p>
        ) : (
          <ul className="space-y-2">
            {(workout.media ?? []).map((m, idx) => (
              <li key={`${m.url}-${idx}`} className="flex flex-wrap items-start gap-3 text-sm">
                <a
                  href={m.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--color-ink)] underline break-all min-w-0 flex-1"
                >
                  {m.url}
                </a>
                {m.caption ? <span className="text-[var(--color-muted)]">{m.caption}</span> : null}
                <button
                  type="button"
                  onClick={() => {
                    const next = (workout.media ?? []).filter((_, i) => i !== idx);
                    updateWorkoutMutation.mutate({ media: next });
                  }}
                  className="text-[var(--color-error)] text-xs shrink-0"
                >
                  {t('mediaRemove')}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {exercises.length === 0 ? (
        <EmptyState
          title={t('noExercises')}
          action={
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setLibraryOpen(true)}
                className="inline-flex items-center gap-2 px-5 py-3 min-h-[44px] rounded-lg border border-[var(--color-border)] text-sm font-medium hover:bg-[var(--color-hover)] touch-manipulation"
              >
                {t('addFromLibrary')}
              </button>
              <button
                type="button"
                onClick={() => addExerciseMutation.mutate()}
                className="inline-flex items-center gap-2 px-5 py-3 min-h-[44px] rounded-lg bg-[var(--color-ink)] text-[var(--color-paper)] text-sm font-medium hover:opacity-90 touch-manipulation"
              >
                {t('addExercise')}
              </button>
            </div>
          }
        />
      ) : (
        <div className="space-y-6">
          {exercises.map((ex) => {
            const isDropSet = /drop set|propadanje/i.test(ex.name);
            return (
              <ExerciseCard
                key={ex.id}
                exercise={ex}
                bodyWeightKg={bodyWeight}
                isDropSet={isDropSet}
                circuitGroupIds={circuitGroupIds}
                onUpdateCircuit={(circuit_group_id) =>
                  updateExerciseCircuitMutation.mutate({ exId: ex.id, circuit_group_id })
                }
                circuitPending={updateExerciseCircuitMutation.isPending ?? false}
                onDelete={async () => {
                  const ok = await confirm({
                    title: t('confirmRemoveTitle'),
                    message: t('confirmRemoveExercise'),
                    confirmLabel: t('delete'),
                    cancelLabel: t('cancel'),
                    variant: 'danger',
                  });
                  if (ok) deleteExerciseMutation.mutate(ex.id);
                }}
                onToggleSet={(setId, completed) => toggleSetMutation.mutate({ setId, completed })}
                onAddSet={() => addSetMutation.mutate(ex.id)}
                onUpdateName={(name) => updateExerciseMutation.mutate({ exId: ex.id, name })}
                onUpdateSet={(setId, reps, weight) => updateSetMutation.mutate({ setId, reps, weight })}
                isAddingSet={addSetMutation.isPending ?? false}
              />
            );
          })}
        </div>
      )}

      <ExerciseLibraryPicker
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        userId={userId}
        onPick={(def) => addExerciseMutation.mutate(def)}
      />

      {confirmState && (
        <ConfirmDialog
          open={confirmState.open}
          title={confirmState.title}
          message={confirmState.message}
          confirmLabel={confirmState.confirmLabel}
          cancelLabel={confirmState.cancelLabel}
          variant={confirmState.variant}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}
    </div>
  );
}
