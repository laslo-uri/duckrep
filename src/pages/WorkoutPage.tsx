import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, Trash2, Check, Circle, Pencil, BookOpen } from 'lucide-react';
import { WorkoutIconPicker } from '../components/WorkoutIconPicker';
import { ExerciseLibraryPicker } from '../components/ExerciseLibraryPicker';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  ACTIVITY_TYPES,
  type WorkoutDayWithExercises,
  type WorkoutExercise,
  type ExerciseSet,
  type ExerciseDefinition,
  type ActivityMediaItem,
  type ActivityType,
} from '../types';

function parseActivityMedia(raw: unknown): ActivityMediaItem[] {
  if (!Array.isArray(raw)) return [];
  const out: ActivityMediaItem[] = [];
  for (const x of raw) {
    if (!x || typeof x !== 'object') continue;
    const url = (x as { url?: string }).url;
    if (typeof url !== 'string' || !/^https:\/\//i.test(url.trim())) continue;
    const cap = (x as { caption?: string }).caption;
    out.push({ url: url.trim(), caption: typeof cap === 'string' ? cap : undefined });
  }
  return out;
}

function normalizeWorkoutRow(data: Record<string, unknown>): WorkoutDayWithExercises {
  const wex = (data.workout_exercises as Record<string, unknown>[]) ?? [];
  return {
    ...(data as unknown as WorkoutDayWithExercises),
    activity_type: (data.activity_type as ActivityType) ?? 'strength',
    deleted_at: (data.deleted_at as string | null) ?? null,
    media: parseActivityMedia(data.media),
    workout_exercises: wex.map((row) => ({
      ...(row as unknown as WorkoutExercise),
      circuit_group_id: (row.circuit_group_id as string | null) ?? null,
    })),
  };
}

function circuitAccentFromGroupId(gid: string | null): string | undefined {
  if (!gid) return undefined;
  let h = 0;
  for (let i = 0; i < gid.length; i++) h = (h * 31 + gid.charCodeAt(i)) % 360;
  return `3px solid hsl(${h} 50% 42%)`;
}

export function WorkoutPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isNew = id === 'new';

  const { data: bodyWeight } = useQuery({
    queryKey: ['body-weight-latest', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('body_weight_logs')
        .select('weight_kg')
        .eq('user_id', user!.id)
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data?.weight_kg ?? null;
    },
    enabled: !!user?.id,
  });

  const { data: workout, isLoading } = useQuery({
    queryKey: ['workout', id],
    queryFn: async () => {
      if (isNew) return null;
      const { data, error } = await supabase
        .from('workout_days')
        .select(`
          *,
          workout_exercises (
            id, name, order_index, goals, notes, completed, exercise_definition_id, circuit_group_id,
            exercise_sets (id, set_number, reps, weight, completed, notes)
          )
        `)
        .eq('id', id)
        .single();
      if (error) throw error;
      return normalizeWorkoutRow(data as Record<string, unknown>);
    },
    enabled: !isNew && !!id,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const date = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from('workout_days')
        .insert({ user_id: user!.id, date })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['workout-days'] });
      navigate(`/activity/${data.id}`);
    },
  });

  const addExerciseMutation = useMutation({
    mutationFn: async (def?: ExerciseDefinition) => {
      const { data, error } = await supabase
        .from('workout_exercises')
        .insert({
          workout_day_id: workout!.id,
          name: def?.name ?? t('addExercise'),
          exercise_definition_id: def?.id ?? null,
          order_index: (workout?.workout_exercises?.length ?? 0),
        })
        .select()
        .single();
      if (error) throw error;

      if (def?.default_sets?.length) {
        const sets = def.default_sets.map((s, i) => ({
          workout_exercise_id: data.id,
          set_number: i + 1,
          reps: s.reps ?? null,
          weight: s.weight ?? null,
          completed: false,
        }));
        const { error: setsError } = await supabase.from('exercise_sets').insert(sets);
        if (setsError) throw setsError;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workout', id] });
      queryClient.invalidateQueries({ queryKey: ['user-daily-training-stats'] });
    },
  });

  const updateExerciseCircuitMutation = useMutation({
    mutationFn: async ({ exId, circuit_group_id }: { exId: string; circuit_group_id: string | null }) => {
      const { error } = await supabase.from('workout_exercises').update({ circuit_group_id }).eq('id', exId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workout', id] }),
  });

  const deleteExerciseMutation = useMutation({
    mutationFn: async (exId: string) => {
      const { error } = await supabase.from('workout_exercises').delete().eq('id', exId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workout', id] }),
  });

  const toggleSetMutation = useMutation({
    mutationFn: async ({ setId, completed }: { setId: string; completed: boolean }) => {
      const { error } = await supabase
        .from('exercise_sets')
        .update({ completed })
        .eq('id', setId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workout', id] }),
  });

  const updateExerciseMutation = useMutation({
    mutationFn: async ({ exId, name }: { exId: string; name: string }) => {
      const { error } = await supabase
        .from('workout_exercises')
        .update({ name })
        .eq('id', exId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workout', id] }),
  });

  const updateWorkoutMutation = useMutation({
    mutationFn: async (updates: {
      title?: string;
      notes?: string;
      icon?: string | null;
      is_public?: boolean;
      started_at?: string | null;
      ended_at?: string | null;
      activity_type?: ActivityType;
      media?: ActivityMediaItem[];
    }) => {
      const payload: Record<string, unknown> = { ...updates };
      if (updates.media !== undefined) payload.media = updates.media;
      const { error } = await supabase.from('workout_days').update(payload).eq('id', workout!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workout', id] });
      queryClient.invalidateQueries({ queryKey: ['workout-days'] });
      queryClient.invalidateQueries({ queryKey: ['workout-days-stats'] });
      queryClient.invalidateQueries({ queryKey: ['user-daily-training-stats'] });
    },
  });

  const updateSetMutation = useMutation({
    mutationFn: async ({
      setId,
      reps,
      weight,
    }: {
      setId: string;
      reps: number | null;
      weight: number | null;
    }) => {
      const { error } = await supabase
        .from('exercise_sets')
        .update({ reps, weight })
        .eq('id', setId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workout', id] }),
  });

  const addSetMutation = useMutation({
    mutationFn: async (exId: string) => {
      const ex = workout!.workout_exercises?.find((e) => e.id === exId) as (WorkoutExercise & { exercise_sets?: ExerciseSet[]; sets?: ExerciseSet[] }) | undefined;
      const sets = ex?.exercise_sets ?? ex?.sets ?? [];
      const nextNum = sets.length ? Math.max(...sets.map((s: ExerciseSet) => s.set_number)) + 1 : 1;
      const { data, error } = await supabase
        .from('exercise_sets')
        .insert({ workout_exercise_id: exId, set_number: nextNum })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workout', id] }),
  });

  const deleteWorkoutMutation = useMutation({
    mutationFn: async (workoutId: string) => {
      const { error } = await supabase
        .from('workout_days')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', workoutId);
      if (error) throw error;
    },
    onSuccess: (_data, workoutId) => {
      queryClient.invalidateQueries({ queryKey: ['workout-days'] });
      queryClient.invalidateQueries({ queryKey: ['workout-days-stats'] });
      queryClient.invalidateQueries({ queryKey: ['user-daily-training-stats'] });
      queryClient.invalidateQueries({ queryKey: ['trashed-activities'] });
      queryClient.removeQueries({ queryKey: ['workout', workoutId] });
      navigate('/');
    },
  });

  if (isNew) {
    return (
      <div>
        <Link to="/" className="inline-flex items-center gap-2 text-[var(--color-muted)] hover:text-[var(--color-ink)] mb-6 sm:mb-8 min-h-[44px] items-center touch-manipulation">
          <ArrowLeft size={18} />
          {t('cancel')}
        </Link>
        <div className="text-center py-12 sm:py-16 px-4 border border-dashed border-[var(--color-border)] rounded-2xl">
          <p className="text-[var(--color-muted)] mb-4">{t('createWorkout')}</p>
          <button
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending}
            className="inline-flex items-center gap-2 px-5 py-3 min-h-[44px] rounded-lg bg-[var(--color-ink)] text-[var(--color-paper)] text-sm font-medium hover:opacity-90 disabled:opacity-50 touch-manipulation"
          >
            <Plus size={18} />
            {t('newWorkout')}
          </button>
        </div>
      </div>
    );
  }

  if (isLoading || !workout) {
    return <p className="text-[var(--color-muted)]">{t('loading')}</p>;
  }

  return (
    <WorkoutDetail
      key={workout.id}
      workout={workout}
      userId={user!.id}
      bodyWeight={bodyWeight ?? null}
      t={t}
      updateWorkoutMutation={updateWorkoutMutation}
      addExerciseMutation={addExerciseMutation}
      deleteExerciseMutation={deleteExerciseMutation}
      toggleSetMutation={toggleSetMutation}
      updateExerciseMutation={updateExerciseMutation}
      updateSetMutation={updateSetMutation}
      addSetMutation={addSetMutation}
      deleteWorkoutMutation={deleteWorkoutMutation}
      updateExerciseCircuitMutation={updateExerciseCircuitMutation}
    />
  );
}

function WorkoutDetail({
  workout,
  userId,
  bodyWeight,
  t,
  updateWorkoutMutation,
  addExerciseMutation,
  deleteExerciseMutation,
  toggleSetMutation,
  updateExerciseMutation,
  updateSetMutation,
  addSetMutation,
  deleteWorkoutMutation,
  updateExerciseCircuitMutation,
}: {
  workout: WorkoutDayWithExercises;
  userId: string;
  bodyWeight: number | null;
  t: (key: string) => string;
  updateWorkoutMutation: {
    mutate: (u: {
      title?: string;
      notes?: string;
      icon?: string | null;
      is_public?: boolean;
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
}) {
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [editingTitle, setEditingTitle] = useState(!workout.title);
  const [titleInput, setTitleInput] = useState(workout.title ?? '');
  const [mediaUrlInput, setMediaUrlInput] = useState('');
  const [mediaCaptionInput, setMediaCaptionInput] = useState('');
  const exercises = (workout.workout_exercises ?? []).sort((a, b) => a.order_index - b.order_index);
  const circuitGroupIds = [...new Set(exercises.map((e) => e.circuit_group_id).filter(Boolean) as string[])].sort();
  const displayTitle = workout.title || new Date(workout.date).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

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
      <Link to="/" className="inline-flex items-center gap-2 text-[var(--color-muted)] hover:text-[var(--color-ink)] mb-6 sm:mb-8 min-h-[44px] items-center touch-manipulation">
        <ArrowLeft size={18} />
        {t('cancel')}
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
            <h1
              onClick={startEditingTitle}
              className="font-serif text-xl sm:text-2xl font-semibold text-[var(--color-ink)] tracking-tight cursor-pointer hover:opacity-80 flex items-center gap-2"
            >
              {displayTitle}
              <Pencil size={16} className="text-[var(--color-muted)] flex-shrink-0" />
            </h1>
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
                  {new Date(workout.started_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
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
                  {new Date(workout.started_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                  {' — '}
                  {new Date(workout.ended_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
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
              <input
                type="checkbox"
                checked={workout.is_public}
                onChange={(e) => updateWorkoutMutation.mutate({ is_public: e.target.checked })}
                className="rounded border-[var(--color-border)] accent-[var(--color-ink)]"
              />
              {t('public')}
            </label>
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
            onClick={() => {
              if (!window.confirm(t('confirmRemoveLog'))) return;
              deleteWorkoutMutation.mutate(workout.id);
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
            className="flex-1 px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-paper)]"
          />
          <input
            type="text"
            value={mediaCaptionInput}
            onChange={(e) => setMediaCaptionInput(e.target.value)}
            placeholder={t('mediaCaption')}
            className="flex-1 px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-paper)]"
          />
          <button
            type="button"
            onClick={() => {
              const u = mediaUrlInput.trim();
              if (!/^https:\/\//i.test(u)) return;
              const next = [...(workout.media ?? []), { url: u, caption: mediaCaptionInput.trim() || undefined }];
              updateWorkoutMutation.mutate({ media: next });
              setMediaUrlInput('');
              setMediaCaptionInput('');
            }}
            className="px-4 py-2 rounded-lg bg-[var(--color-ink)] text-[var(--color-paper)] text-sm font-medium"
          >
            {t('mediaAdd')}
          </button>
        </div>
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
        <div className="text-center py-12 sm:py-16 px-4 border border-dashed border-[var(--color-border)] rounded-2xl">
          <p className="text-[var(--color-muted)] mb-4">{t('noExercises')}</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setLibraryOpen(true)}
              className="text-[var(--color-ink)] font-medium hover:underline"
            >
              {t('addFromLibrary')}
            </button>
            <button
              type="button"
              onClick={() => addExerciseMutation.mutate()}
              className="text-[var(--color-ink)] font-medium hover:underline"
            >
              {t('addExercise')}
            </button>
          </div>
        </div>
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
                onDelete={() => deleteExerciseMutation.mutate(ex.id)}
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
    </div>
  );
}

function SetRow({
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
    const r = reps.trim() ? parseInt(reps, 10) : null;
    const w = weight.trim() ? parseFloat(weight) : null;
    if (r !== set.reps || w !== set.weight) onUpdate(r, w);
    setEditing(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-2 sm:gap-3 py-3 sm:py-2 border-b border-[var(--color-border)] last:border-0">
      <button onClick={onToggle} className="flex-shrink-0 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center touch-manipulation">
        {set.completed ? (
          <Check size={20} className="text-[var(--color-success)]" />
        ) : (
          <Circle size={20} className="text-[var(--color-muted)]" />
        )}
      </button>
      <span className="text-sm text-[var(--color-muted)] w-8">Set {set.set_number}</span>
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
              placeholder={isDropSet && bodyWeightKg ? `${t('weight')} (${bodyWeightKg} ${t('bodyKg')})` : t('weight')}
              className="w-14 sm:w-16 px-2 py-2 text-sm rounded border border-[var(--color-border)] bg-[var(--color-surface)] focus:outline-none focus:ring-1 focus:ring-[var(--color-ink)] touch-manipulation"
            />
            <span className="text-xs text-[var(--color-muted)] whitespace-nowrap">kg</span>
          </span>
          <div className="flex gap-2">
            <button
              onClick={save}
              className="text-xs text-[var(--color-ink)] font-medium py-2 px-2 min-h-[36px] touch-manipulation"
            >
              {t('save')}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="text-xs text-[var(--color-muted)] py-2 px-2 min-h-[36px] touch-manipulation"
            >
              {t('cancel')}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="text-left text-[var(--color-ink)] hover:underline py-2 min-h-[36px] touch-manipulation"
        >
          {set.reps ?? '—'} × {effectiveWeight ?? '—'} kg{isDropSet && effectiveWeight === bodyWeightKg && bodyWeightKg ? ` (${t('bodyKg')})` : ''}
        </button>
      )}
      {set.notes && !editing && (
        <span className="text-xs text-[var(--color-muted)]">{set.notes}</span>
      )}
    </div>
  );
}

function ExerciseCard({
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
    (a, b) => a.set_number - b.set_number
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
          <h3
            className="font-medium text-[var(--color-ink)] cursor-pointer hover:opacity-80 flex items-center gap-2"
            onClick={startEditing}
          >
            {exercise.name}
            <Pencil size={14} className="text-[var(--color-muted)]" />
          </h3>
        )}
        <button
          onClick={onDelete}
          className="p-2.5 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 sm:p-1.5 rounded-lg text-[var(--color-muted)] hover:text-[var(--color-error)] hover:bg-[var(--color-error-bg)] transition-colors touch-manipulation flex items-center justify-center"
          title={t('delete')}
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
          className="text-xs rounded-lg border border-[var(--color-border)] bg-[var(--color-paper)] text-[var(--color-ink)] px-2 py-1.5 max-w-[min(100%,14rem)]"
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
      {exercise.goals && (
        <p className="text-sm text-[var(--color-muted)] mb-3">{exercise.goals}</p>
      )}
      <div className="space-y-2">
        {sets.map((s) => (
          <SetRow
            key={`${s.id}-${s.reps}-${s.weight}`}
            set={s}
            bodyWeightKg={bodyWeightKg}
            isDropSet={isDropSet}
            onToggle={() => onToggleSet(s.id, !s.completed)}
            onUpdate={(reps, weight) => onUpdateSet(s.id, reps, weight)}
          />
        ))}
        <button
          onClick={onAddSet}
          disabled={isAddingSet}
          className="flex items-center gap-2 py-3 min-h-[44px] text-sm text-[var(--color-muted)] hover:text-[var(--color-ink)] disabled:opacity-50 touch-manipulation"
        >
          <Plus size={16} />
          {t('sets')}
        </button>
      </div>
    </div>
  );
}
