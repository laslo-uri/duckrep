import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { SelectMenu } from '../SelectMenu';
import { appLocale } from '../../lib/locale';
import { ExerciseCard } from './ExerciseCard';
import { RestTimer } from './RestTimer';

type WorkoutDetailProps = {
  workout: WorkoutDayWithExercises;
  userId: string;
  bodyWeight: number | null;
  updateWorkoutMutation: {
    mutate: (u: {
      title?: string;
      notes?: string | null;
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
  updateExerciseGoalsMutation: { mutate: (p: { exId: string; goals: string | null }) => void };
  updateSetMutation: {
    mutate: (p: { setId: string; reps: number | null; weight: number | null; notes: string | null }) => void;
  };
  addSetMutation: { mutate: (exId: string) => void; isPending?: boolean };
  deleteSetMutation: { mutate: (setId: string) => void; isPending?: boolean };
  deleteWorkoutMutation: { mutate: (workoutId: string) => void; isPending?: boolean };
  updateExerciseCircuitMutation: {
    mutate: (p: { exId: string; circuit_group_id: string | null }) => void;
    isPending?: boolean;
  };
};

function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

function formatClock(iso: string, locale: string): string {
  return new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
}

export function WorkoutDetail({
  workout,
  userId,
  bodyWeight,
  updateWorkoutMutation,
  addExerciseMutation,
  deleteExerciseMutation,
  toggleSetMutation,
  updateExerciseMutation,
  updateExerciseGoalsMutation,
  updateSetMutation,
  addSetMutation,
  deleteSetMutation,
  deleteWorkoutMutation,
  updateExerciseCircuitMutation,
}: WorkoutDetailProps) {
  const { t, i18n } = useTranslation();
  const locale = appLocale(i18n.language);
  const { confirm, confirmState, handleConfirm, handleCancel } = useConfirm();
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [editingTitle, setEditingTitle] = useState(!workout.title);
  const [titleInput, setTitleInput] = useState(workout.title ?? '');
  const [notesInput, setNotesInput] = useState(workout.notes ?? '');
  const [mediaUrlInput, setMediaUrlInput] = useState('');
  const [mediaCaptionInput, setMediaCaptionInput] = useState('');
  const [mediaUrlError, setMediaUrlError] = useState<string | null>(null);
  const [rest, setRest] = useState<{ until: number; total: number } | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(
    () => Boolean(workout.notes || (workout.media ?? []).length),
  );
  const [now, setNow] = useState(() => Date.now());

  const exercises = (workout.workout_exercises ?? []).sort((a, b) => a.order_index - b.order_index);
  const circuitGroupIds = [...new Set(exercises.map((e) => e.circuit_group_id).filter(Boolean) as string[])].sort();
  const live = Boolean(workout.started_at && !workout.ended_at);

  useEffect(() => {
    if (!live) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [live]);

  const elapsed = workout.started_at
    ? formatElapsed(
        (workout.ended_at ? new Date(workout.ended_at).getTime() : now) - new Date(workout.started_at).getTime(),
      )
    : null;

  const summary = useMemo(() => {
    let sets = 0;
    let done = 0;
    let volume = 0;
    for (const ex of exercises) {
      for (const s of ex.sets ?? []) {
        sets += 1;
        if (s.completed) done += 1;
        if (s.reps != null && s.weight != null) volume += s.reps * s.weight;
      }
    }
    return { sets, done, volume };
  }, [exercises]);

  const displayTitle =
    workout.title ||
    new Date(workout.date + 'T00:00:00').toLocaleDateString(locale, {
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

  const saveNotes = (value: string) => {
    const trimmed = value.trim();
    if (trimmed !== (workout.notes ?? '')) {
      updateWorkoutMutation.mutate({ notes: trimmed || null });
    }
  };

  const startRest = useCallback(() => {
    setRest({ until: Date.now() + 90_000, total: 90_000 });
  }, []);
  const addRest = useCallback(() => {
    setRest((current) =>
      current ? { until: current.until + 15_000, total: current.total + 15_000 } : current,
    );
  }, []);
  const clearRest = useCallback(() => setRest(null), []);

  const volumeLabel = Math.round(summary.volume).toLocaleString(locale);
  const completedSets = summary.done;
  const setCount = summary.sets;

  return (
    <div className="space-y-5">
      <Link
        to="/journal"
        className="dr-press inline-flex items-center gap-2 text-[var(--color-muted)] hover:text-[var(--color-ink)] min-h-[44px] touch-manipulation"
      >
        <ArrowLeft size={18} />
        {t('backToJournal')}
      </Link>

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {editingTitle ? (
            <input
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={(e) => e.key === 'Enter' && saveTitle()}
              placeholder={t('nameWorkoutPlaceholder')}
              autoFocus
              className="font-serif text-3xl sm:text-4xl font-semibold text-[var(--color-ink)] tracking-tight w-full bg-transparent border-b border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)] py-0.5"
            />
          ) : (
            <button
              type="button"
              onClick={startEditingTitle}
              className="font-serif text-3xl sm:text-4xl font-semibold text-[var(--color-ink)] tracking-tight hover:opacity-80 flex items-center gap-2 text-left w-full max-w-full min-w-0"
            >
              <span className="truncate">{displayTitle}</span>
              <Pencil size={16} className="text-[var(--color-muted)] flex-shrink-0" aria-hidden />
            </button>
          )}
          <p className="text-sm text-[var(--color-muted)] mt-1">
            {new Date(workout.date + 'T00:00:00').toLocaleDateString(locale, {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>
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
          aria-label={deleteWorkoutMutation.isPending ? t('removingLog') : t('removeLog')}
          className="dr-press p-2.5 min-w-[44px] min-h-[44px] rounded-lg text-[var(--color-muted)] hover:text-[var(--color-error)] hover:bg-[var(--color-error-bg)] touch-manipulation flex items-center justify-center disabled:opacity-50"
        >
          <Trash2 size={18} />
        </button>
      </div>

      {/* Session card */}
      <section className="dr-card p-5 sm:p-6">
        {live && elapsed && (
          <div className="flex items-end justify-between gap-3 mb-4">
            <div>
              <p className="dr-label !text-[var(--color-accent)]">{t('sessionLive')}</p>
              <p className="font-serif text-4xl tabular-nums leading-none mt-1 text-[var(--color-ink)]">{elapsed}</p>
              {workout.started_at && (
                <p className="text-xs text-[var(--color-muted)] mt-1">
                  {t('sessionStarted')} {formatClock(workout.started_at, locale)}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => updateWorkoutMutation.mutate({ ended_at: new Date().toISOString() })}
              disabled={updateWorkoutMutation.isPending}
              className="dr-press px-5 min-h-[48px] rounded-xl bg-[var(--color-accent)] text-[var(--color-on-accent)] text-sm font-semibold touch-manipulation disabled:opacity-50 sticky bottom-24 md:static"
            >
              {t('endSession')}
            </button>
          </div>
        )}

        {!workout.started_at && (
          <button
            type="button"
            onClick={() => updateWorkoutMutation.mutate({ started_at: new Date().toISOString(), ended_at: null })}
            disabled={updateWorkoutMutation.isPending}
            className="dr-press mb-4 w-full sm:w-auto px-5 min-h-[48px] rounded-xl bg-[var(--color-accent)] text-[var(--color-on-accent)] text-sm font-semibold touch-manipulation disabled:opacity-50"
          >
            {t('startSession')}
          </button>
        )}

        {workout.started_at && workout.ended_at && (
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <p className="text-sm text-[var(--color-muted)] tabular-nums">
              {formatClock(workout.started_at, locale)} — {formatClock(workout.ended_at, locale)}
              {elapsed ? ` · ${elapsed}` : ''}
            </p>
            <button
              type="button"
              onClick={() => updateWorkoutMutation.mutate({ started_at: null, ended_at: null })}
              disabled={updateWorkoutMutation.isPending}
              className="text-xs underline text-[var(--color-muted)] hover:text-[var(--color-ink)] min-h-[44px] px-1 touch-manipulation disabled:opacity-50"
            >
              {t('resetSessionTimes')}
            </button>
          </div>
        )}

        {/* Stats row */}
        <dl className="grid grid-cols-3 gap-2">
          <div className="rounded-2xl bg-[var(--color-accent-soft)] px-3 py-3">
            <dt className="dr-label">{t('statExercises')}</dt>
            <dd className="font-serif text-2xl tabular-nums text-[var(--color-ink)] mt-1">{exercises.length}</dd>
          </div>
          <div className="rounded-2xl bg-[var(--color-accent-soft)] px-3 py-3">
            <dt className="dr-label">{t('statSets')}</dt>
            <dd className="font-serif text-2xl tabular-nums text-[var(--color-ink)] mt-1">
              {completedSets}/{setCount}
            </dd>
          </div>
          <div className="rounded-2xl bg-[var(--color-accent-soft)] px-3 py-3">
            <dt className="dr-label">{t('statVolume')}</dt>
            <dd className="font-serif text-2xl tabular-nums text-[var(--color-ink)] mt-1">{t('volumeKg', { n: volumeLabel })}</dd>
          </div>
        </dl>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <WorkoutIconPicker
            value={workout.icon}
            onChange={(icon) => updateWorkoutMutation.mutate({ icon })}
          />
          <SelectMenu
            label={t('activityTypeLabel')}
            value={workout.activity_type ?? 'strength'}
            disabled={updateWorkoutMutation.isPending}
            className="min-w-[10rem]"
            options={ACTIVITY_TYPES.map((activity) => ({
              value: activity,
              label: t(`activityTypes.${activity}`),
            }))}
            onChange={(value) => updateWorkoutMutation.mutate({ activity_type: value as ActivityType })}
          />
        </div>
      </section>

      {/* Add exercise buttons */}
      <div className="flex flex-col sm:flex-row gap-2">
        <button
          type="button"
          onClick={() => setLibraryOpen(true)}
          disabled={addExerciseMutation.isPending}
          className="dr-press flex items-center justify-center gap-2 px-5 py-3 min-h-[48px] rounded-xl bg-[var(--color-accent)] text-[var(--color-on-accent)] text-sm font-semibold touch-manipulation disabled:opacity-50"
        >
          <BookOpen size={18} />
          {t('addFromLibrary')}
        </button>
        <button
          type="button"
          onClick={() => addExerciseMutation.mutate()}
          disabled={addExerciseMutation.isPending}
          className="dr-press flex items-center justify-center gap-2 px-5 py-3 min-h-[48px] rounded-xl border border-[var(--color-border)] hover:bg-[var(--color-hover)] text-sm font-medium touch-manipulation disabled:opacity-50"
        >
          <Plus size={18} />
          {t('addExercise')}
        </button>
      </div>

      {exercises.length === 0 ? (
        <EmptyState title={t('noExercises')} />
      ) : (
        <div className="space-y-4">
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
                onUpdateGoals={(goals) => updateExerciseGoalsMutation.mutate({ exId: ex.id, goals })}
                onUpdateSet={(setId, reps, weight, notes) =>
                  updateSetMutation.mutate({ setId, reps, weight, notes })
                }
                onDeleteSet={async (setId) => {
                  const ok = await confirm({
                    title: t('confirmRemoveTitle'),
                    message: t('confirmRemoveSet'),
                    confirmLabel: t('deleteSet'),
                    cancelLabel: t('cancel'),
                    variant: 'danger',
                  });
                  if (ok) deleteSetMutation.mutate(setId);
                }}
                onSetCompleted={startRest}
                isAddingSet={addSetMutation.isPending ?? false}
              />
            );
          })}
        </div>
      )}

      {/* Notes & links */}
      <details
        className="dr-card"
        open={detailsOpen}
        onToggle={(event) => setDetailsOpen(event.currentTarget.open)}
      >
        <summary className="cursor-pointer list-none px-5 py-4 min-h-[44px] flex items-center justify-between font-medium text-[var(--color-ink)] [&::-webkit-details-marker]:hidden">
          {t('notesAndLinks')}
          <span className="text-xs text-[var(--color-muted)] tabular-nums">
            {(workout.media ?? []).length > 0 ? (workout.media ?? []).length : ''}
          </span>
        </summary>
        <div className="px-5 pb-5">
          <label className="block mb-4">
            <span className="text-sm font-medium text-[var(--color-ink)]">{t('notes')}</span>
            <textarea
              value={notesInput}
              onChange={(e) => setNotesInput(e.target.value)}
              onBlur={(e) => saveNotes(e.currentTarget.value)}
              rows={3}
              placeholder={t('notesPlaceholder')}
              className="mt-2 w-full px-3 py-2 text-sm rounded-xl border border-[var(--color-border)] bg-[var(--color-paper)] text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
            />
          </label>
          <h2 className="text-sm font-medium text-[var(--color-ink)] mb-3">{t('mediaTitle')}</h2>
          <div className="flex flex-col sm:flex-row gap-2 mb-3">
            <input
              type="url"
              value={mediaUrlInput}
              onChange={(e) => setMediaUrlInput(e.target.value)}
              placeholder={t('mediaAddUrl')}
              aria-label={t('mediaAddUrl')}
              className="flex-1 px-3 py-2 text-sm rounded-xl border border-[var(--color-border)] bg-[var(--color-paper)]"
            />
            <input
              type="text"
              value={mediaCaptionInput}
              onChange={(e) => setMediaCaptionInput(e.target.value)}
              placeholder={t('mediaCaption')}
              aria-label={t('mediaCaption')}
              className="flex-1 px-3 py-2 text-sm rounded-xl border border-[var(--color-border)] bg-[var(--color-paper)]"
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
              className="dr-press px-4 py-2 min-h-[44px] rounded-xl bg-[var(--color-accent)] text-[var(--color-on-accent)] text-sm font-semibold touch-manipulation"
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
                    className="text-[var(--color-error)] text-xs shrink-0 min-h-[44px]"
                  >
                    {t('mediaRemove')}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </details>

      <ExerciseLibraryPicker
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        userId={userId}
        onPick={(def) => addExerciseMutation.mutate(def)}
      />

      {rest && (
        <RestTimer until={rest.until} totalMs={rest.total} onExpire={clearRest} onAdd={addRest} />
      )}

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
