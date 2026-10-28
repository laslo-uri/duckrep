import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, Plus, Trash2, Pencil, BookOpen, Square, Play, RotateCcw } from 'lucide-react';
import { WorkoutIconPicker } from '../WorkoutIconPicker';
import { ExerciseLibraryPicker } from '../ExerciseLibraryPicker';
import { ConfirmDialog } from '../ConfirmDialog';
import { PageHeader } from '../Layout';
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
  /** Rendered between the header and the content (mutation errors). */
  alert?: ReactNode;
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

/** One label/value line of the properties aside (Hawkdone's issue sidebar). */
function Prop({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-8 items-center gap-3 py-0.5">
      <span className="w-20 shrink-0 text-[12px] text-[var(--color-muted)]">{label}</span>
      <div className="flex min-w-0 flex-1 items-center gap-2 text-[13px]">{children}</div>
    </div>
  );
}

export function WorkoutDetail({
  workout,
  userId,
  bodyWeight,
  alert,
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

  const longDate = new Date(workout.date + 'T00:00:00').toLocaleDateString(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const shortDate = new Date(workout.date + 'T00:00:00').toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
  });
  const displayTitle = workout.title || longDate;

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
  const allDone = summary.sets > 0 && summary.done === summary.sets;

  const removeActivity = async () => {
    const ok = await confirm({
      title: t('confirmRemoveTitle'),
      message: t('confirmRemoveLog'),
      confirmLabel: t('removeLog'),
      cancelLabel: t('cancel'),
      variant: 'danger',
    });
    if (ok) deleteWorkoutMutation.mutate(workout.id);
  };

  const addMedia = () => {
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
  };

  return (
    <>
      <PageHeader
        actions={
          <button
            type="button"
            onClick={() => void removeActivity()}
            disabled={deleteWorkoutMutation.isPending}
            aria-label={deleteWorkoutMutation.isPending ? t('removingLog') : t('removeLog')}
            title={t('removeLog')}
            className="dr-btn dr-btn-ghost dr-icon-btn hover:!text-[var(--color-error)]"
          >
            <Trash2 size={15} aria-hidden />
          </button>
        }
      >
        <Link
          to="/journal"
          aria-label={t('backToJournal')}
          className="dr-tap -ml-1 inline-flex shrink-0 items-center gap-1 rounded-md px-1 text-[13px] text-[var(--color-muted)] hover:text-[var(--color-ink)]"
        >
          <ChevronLeft size={15} aria-hidden />
          <span className="hidden sm:inline">{t('myJournal')}</span>
        </Link>
        <span className="hidden text-[var(--color-faint)] sm:inline" aria-hidden>
          ›
        </span>
        <span className="truncate text-[13px] font-medium text-[var(--color-ink)]">{shortDate}</span>
        {live && <span className="dr-live-dot ml-1 shrink-0" aria-hidden />}
      </PageHeader>

      {alert}

      <div className="flex min-w-0 flex-1 flex-col md:flex-row">
        {/* ── Main column: title, session bar, exercises ── */}
        <div className="min-w-0 flex-1 px-3 py-4 md:px-5 lg:px-8">
          <div className="mx-auto max-w-3xl">
            {editingTitle ? (
              <>
              {/* The page keeps its h1 while the title is being typed. */}
              <h1 className="sr-only">{displayTitle}</h1>
              <input
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                onBlur={saveTitle}
                onKeyDown={(e) => e.key === 'Enter' && saveTitle()}
                placeholder={t('nameWorkoutPlaceholder')}
                aria-label={t('nameWorkoutPlaceholder')}
                autoFocus
                className="w-full border-b border-[var(--color-border)] bg-transparent py-0.5 text-[20px] font-semibold tracking-tight text-[var(--color-ink)] focus:border-[var(--color-accent)] focus:outline-none"
              />
              </>
            ) : (
              <h1 className="min-w-0">
                <button
                  type="button"
                  onClick={startEditingTitle}
                  className="group flex w-full min-w-0 max-w-full items-center gap-2 text-left text-[20px] font-semibold tracking-tight text-[var(--color-ink)]"
                >
                  <span className="truncate">{displayTitle}</span>
                  <Pencil
                    size={13}
                    className="shrink-0 text-[var(--color-faint)] opacity-60 group-hover:opacity-100"
                    aria-hidden
                  />
                </button>
              </h1>
            )}
            <p className="mt-0.5 text-[12px] text-[var(--color-muted)]">{longDate}</p>

            {/* Session bar: clock, totals and the one session action */}
            <section
              aria-label={t('sessionTime')}
              className={`mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border px-3 py-2 ${
                live
                  ? 'border-[var(--color-accent)]/45 bg-[var(--color-accent-soft)]'
                  : 'border-[var(--color-border)] bg-[var(--color-surface)]'
              }`}
            >
              <div className="flex min-w-0 items-center gap-2">
                {live ? (
                  <>
                    <span className="dr-live-dot shrink-0" aria-hidden />
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-accent)]">
                      {t('sessionLive')}
                    </span>
                    <span className="text-[18px] font-semibold tabular-nums leading-none">{elapsed}</span>
                    {workout.started_at && (
                      <span className="text-[12px] text-[var(--color-muted)]">
                        {t('sessionStarted')} {formatClock(workout.started_at, locale)}
                      </span>
                    )}
                  </>
                ) : workout.started_at && workout.ended_at ? (
                  <span className="text-[13px] tabular-nums text-[var(--color-muted)]">
                    {formatClock(workout.started_at, locale)} – {formatClock(workout.ended_at, locale)}
                    {elapsed ? <span className="ml-1.5 font-medium text-[var(--color-ink)]">{elapsed}</span> : null}
                  </span>
                ) : (
                  <span className="text-[13px] text-[var(--color-muted)]">—</span>
                )}
              </div>

              <dl className="flex items-center gap-4 text-[12px]">
                <div className="flex items-baseline gap-1.5">
                  <dt className="text-[var(--color-muted)]">{t('statExercises')}</dt>
                  <dd className="font-semibold tabular-nums">{exercises.length}</dd>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <dt className="text-[var(--color-muted)]">{t('statSets')}</dt>
                  <dd className={`font-semibold tabular-nums ${allDone ? 'text-[var(--color-success)]' : ''}`}>
                    {summary.done}/{summary.sets}
                  </dd>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <dt className="text-[var(--color-muted)]">{t('statVolume')}</dt>
                  <dd className="font-semibold tabular-nums">{t('volumeKg', { n: volumeLabel })}</dd>
                </div>
              </dl>

              <div className="ml-auto flex items-center gap-1">
                {live && (
                  <button
                    type="button"
                    onClick={() => updateWorkoutMutation.mutate({ ended_at: new Date().toISOString() })}
                    disabled={updateWorkoutMutation.isPending}
                    className="dr-btn dr-btn-primary"
                  >
                    <Square size={12} aria-hidden />
                    {t('endSession')}
                  </button>
                )}
                {!workout.started_at && (
                  <button
                    type="button"
                    onClick={() => updateWorkoutMutation.mutate({ started_at: new Date().toISOString(), ended_at: null })}
                    disabled={updateWorkoutMutation.isPending}
                    className="dr-btn dr-btn-primary"
                  >
                    <Play size={12} aria-hidden />
                    {t('startSession')}
                  </button>
                )}
                {workout.started_at && workout.ended_at && (
                  <button
                    type="button"
                    onClick={() => updateWorkoutMutation.mutate({ started_at: null, ended_at: null })}
                    disabled={updateWorkoutMutation.isPending}
                    className="dr-btn dr-btn-ghost text-[12px]"
                  >
                    <RotateCcw size={12} aria-hidden />
                    {t('resetSessionTimes')}
                  </button>
                )}
              </div>
            </section>

            {/* Exercises */}
            <div className="mt-5 flex items-center gap-2">
              <h2 className="text-[12px] font-medium text-[var(--color-ink)]">
                {t('exercises')}
                <span className="ml-1.5 text-[var(--color-faint)] tabular-nums">{exercises.length}</span>
              </h2>
              <div className="ml-auto flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => addExerciseMutation.mutate()}
                  disabled={addExerciseMutation.isPending}
                  className="dr-btn dr-btn-ghost"
                >
                  <Plus size={14} aria-hidden />
                  {t('addExercise')}
                </button>
                <button
                  type="button"
                  onClick={() => setLibraryOpen(true)}
                  disabled={addExerciseMutation.isPending}
                  className="dr-btn dr-btn-primary"
                >
                  <BookOpen size={14} aria-hidden />
                  {t('addFromLibrary')}
                </button>
              </div>
            </div>

            {exercises.length === 0 ? (
              <div className="mt-2 rounded-lg border border-dashed border-[var(--color-line-strong)] px-4 py-8 text-center">
                <h2 className="text-[13px] font-medium text-[var(--color-ink)]">{t('noExercises')}</h2>
              </div>
            ) : (
              <div className="mt-2 space-y-3">
                {exercises.map((ex, index) => {
                  const isDropSet = /drop set|propadanje/i.test(ex.name);
                  return (
                    <ExerciseCard
                      key={ex.id}
                      index={index + 1}
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
          </div>
        </div>

        {/* ── Properties aside: stacks under the exercises on phones ── */}
        <aside
          aria-label={t('activityDetails')}
          className="w-full shrink-0 border-t border-[var(--color-border)] bg-[var(--color-panel)] px-3 py-4 md:sticky md:top-[var(--dr-header-h)] md:h-[calc(var(--app-dvh)-var(--dr-header-h))] md:w-72 md:overflow-y-auto md:border-l md:border-t-0 md:px-4"
        >
          <p className="dr-label mb-2">{t('activityDetails')}</p>
          <Prop label={t('activityTypeLabel')}>
            <SelectMenu
              label={t('activityTypeLabel')}
              value={workout.activity_type ?? 'strength'}
              disabled={updateWorkoutMutation.isPending}
              className="w-full"
              options={ACTIVITY_TYPES.map((activity) => ({
                value: activity,
                label: t(`activityTypes.${activity}`),
              }))}
              onChange={(value) => updateWorkoutMutation.mutate({ activity_type: value as ActivityType })}
            />
          </Prop>
          <Prop label={t('activityIcon')}>
            <WorkoutIconPicker value={workout.icon} onChange={(icon) => updateWorkoutMutation.mutate({ icon })} />
          </Prop>
          <Prop label={t('sessionTime')}>
            <span className="tabular-nums text-[var(--color-muted)]">
              {workout.started_at ? formatClock(workout.started_at, locale) : '—'}
              {workout.ended_at ? ` – ${formatClock(workout.ended_at, locale)}` : ''}
            </span>
          </Prop>

          <div className="mt-4 border-t border-[var(--color-border)] pt-4">
            <label className="block">
              <span className="dr-label">{t('notes')}</span>
              <textarea
                value={notesInput}
                onChange={(e) => setNotesInput(e.target.value)}
                onBlur={(e) => saveNotes(e.currentTarget.value)}
                rows={3}
                placeholder={t('notesPlaceholder')}
                className="dr-input mt-1.5 w-full resize-y"
              />
            </label>
          </div>

          <div className="mt-4 border-t border-[var(--color-border)] pt-4">
            <h2 className="dr-label">
              {t('mediaTitle')}
              {(workout.media ?? []).length > 0 ? (
                <span className="ml-1 tabular-nums">{(workout.media ?? []).length}</span>
              ) : null}
            </h2>
            {(workout.media ?? []).length === 0 ? (
              <p className="mt-1.5 text-[12px] text-[var(--color-faint)]">{t('mediaEmpty')}</p>
            ) : (
              <ul className="mt-1.5 space-y-1">
                {(workout.media ?? []).map((m, idx) => (
                  <li key={`${m.url}-${idx}`} className="group flex items-start gap-2 text-[12px]">
                    <a
                      href={m.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-w-0 flex-1 break-all text-[var(--color-ink)] underline decoration-[var(--color-line-strong)] underline-offset-2 hover:decoration-[var(--color-accent)]"
                    >
                      {m.caption || m.url}
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        const next = (workout.media ?? []).filter((_, i) => i !== idx);
                        updateWorkoutMutation.mutate({ media: next });
                      }}
                      className="dr-tap shrink-0 text-[11px] text-[var(--color-error)] hover:underline"
                    >
                      {t('mediaRemove')}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-2 flex flex-col gap-1.5">
              <input
                type="url"
                value={mediaUrlInput}
                onChange={(e) => setMediaUrlInput(e.target.value)}
                placeholder={t('mediaAddUrl')}
                aria-label={t('mediaAddUrl')}
                className="dr-input w-full"
              />
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={mediaCaptionInput}
                  onChange={(e) => setMediaCaptionInput(e.target.value)}
                  placeholder={t('mediaCaption')}
                  aria-label={t('mediaCaption')}
                  className="dr-input min-w-0 flex-1"
                />
                <button type="button" onClick={addMedia} className="dr-btn shrink-0">
                  {t('mediaAdd')}
                </button>
              </div>
            </div>
            {mediaUrlError ? (
              <p className="mt-1.5 text-[12px] text-[var(--color-error)]" role="alert">
                {mediaUrlError}
              </p>
            ) : null}
          </div>
        </aside>
      </div>

      <ExerciseLibraryPicker
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        userId={userId}
        onPick={(def) => addExerciseMutation.mutate(def)}
      />

      {rest && <RestTimer until={rest.until} totalMs={rest.total} onExpire={clearRest} onAdd={addRest} />}

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
    </>
  );
}
