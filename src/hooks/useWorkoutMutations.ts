import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  createWorkoutDay,
  addWorkoutExercise,
  insertExerciseSets,
  updateWorkoutExercise,
  deleteWorkoutExercise,
  updateExerciseSet,
  deleteExerciseSet,
  updateWorkoutDay,
  addExerciseSet,
  softDeleteWorkoutDay,
} from '../lib/db';
import {
  getWorkoutFromCache,
  setWorkoutInCache,
  applyPatchSetCompleted,
  applyPatchSetRepsWeight,
  applyPatchExerciseName,
  applyPatchExerciseGoals,
  applyPatchExerciseCircuit,
  applyPatchWorkoutFields,
  invalidateDailyStats,
  type WorkoutFieldPatch,
} from '../lib/workoutQueryCache';
import type {
  WorkoutDayWithExercises,
  ExerciseDefinition,
  ActivityMediaItem,
  ActivityType,
  WorkoutExercise,
  ExerciseSet,
} from '../types';

type OptimisticCtx = { previous: WorkoutDayWithExercises | undefined };

function useOptimisticWorkout(workoutId: string | undefined, userId: string) {
  const queryClient = useQueryClient();

  const snapshot = (): OptimisticCtx => ({
    previous: workoutId ? getWorkoutFromCache(queryClient, workoutId) : undefined,
  });

  const apply = (patch: (w: WorkoutDayWithExercises) => WorkoutDayWithExercises) => {
    if (!workoutId) return;
    const current = getWorkoutFromCache(queryClient, workoutId);
    if (current) setWorkoutInCache(queryClient, workoutId, patch(current));
  };

  const rollback = (ctx: OptimisticCtx | undefined) => {
    if (workoutId && ctx?.previous) {
      setWorkoutInCache(queryClient, workoutId, ctx.previous);
    }
  };

  const onSettledStats = () => {
    invalidateDailyStats(queryClient, userId);
    queryClient.invalidateQueries({ queryKey: ['lifetime-training-totals'] });
  };

  return { snapshot, apply, rollback, onSettledStats };
}

export function useWorkoutMutations({
  workout,
  userId,
  workoutId,
  defaultExerciseName,
  onError,
}: {
  workout: WorkoutDayWithExercises | null | undefined;
  userId: string;
  workoutId: string | undefined;
  defaultExerciseName: string;
  onError: (err: Error) => void;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const optimistic = useOptimisticWorkout(workoutId, userId);

  const createMutation = useMutation({
    mutationFn: async () => {
      const day = await createWorkoutDay(userId);
      await updateWorkoutDay(day.id, { started_at: new Date().toISOString() });
      return day;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['workout-days'] });
      navigate(`/activity/${data.id}`);
    },
    onError,
  });

  const addExerciseMutation = useMutation({
    mutationFn: async (def?: ExerciseDefinition) => {
      const data = await addWorkoutExercise(workout!.id, {
        name: def?.name ?? defaultExerciseName,
        exercise_definition_id: def?.id ?? null,
        order_index: workout?.workout_exercises?.length ?? 0,
      });

      if (def?.default_sets?.length) {
        await insertExerciseSets(
          def.default_sets.map((s, i) => ({
            workout_exercise_id: data.id,
            set_number: i + 1,
            reps: s.reps ?? null,
            weight: s.weight ?? null,
            completed: false,
          })),
        );
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workout', workoutId] });
      optimistic.onSettledStats();
    },
    onError,
  });

  const updateExerciseCircuitMutation = useMutation({
    mutationFn: ({ exId, circuit_group_id }: { exId: string; circuit_group_id: string | null }) =>
      updateWorkoutExercise(exId, { circuit_group_id }),
    onMutate: async ({ exId, circuit_group_id }) => {
      const ctx = optimistic.snapshot();
      optimistic.apply((w) => applyPatchExerciseCircuit(w, exId, circuit_group_id));
      return ctx;
    },
    onError: (err, _vars, ctx) => {
      optimistic.rollback(ctx);
      onError(err);
    },
    onSettled: optimistic.onSettledStats,
  });

  const deleteExerciseMutation = useMutation({
    mutationFn: (exId: string) => deleteWorkoutExercise(exId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workout', workoutId] }),
    onError,
  });

  const toggleSetMutation = useMutation({
    mutationFn: ({ setId, completed }: { setId: string; completed: boolean }) =>
      updateExerciseSet(setId, { completed }),
    onMutate: async ({ setId, completed }) => {
      const ctx = optimistic.snapshot();
      optimistic.apply((w) => applyPatchSetCompleted(w, setId, completed));
      return ctx;
    },
    onError: (err, _vars, ctx) => {
      optimistic.rollback(ctx);
      onError(err);
    },
    onSettled: optimistic.onSettledStats,
  });

  const updateExerciseGoalsMutation = useMutation({
    mutationFn: ({ exId, goals }: { exId: string; goals: string | null }) =>
      updateWorkoutExercise(exId, { goals }),
    onMutate: async ({ exId, goals }) => {
      const ctx = optimistic.snapshot();
      optimistic.apply((w) => applyPatchExerciseGoals(w, exId, goals));
      return ctx;
    },
    onError: (err, _vars, ctx) => {
      optimistic.rollback(ctx);
      onError(err);
    },
  });

  const updateExerciseMutation = useMutation({
    mutationFn: ({ exId, name }: { exId: string; name: string }) =>
      updateWorkoutExercise(exId, { name }),
    onMutate: async ({ exId, name }) => {
      const ctx = optimistic.snapshot();
      optimistic.apply((w) => applyPatchExerciseName(w, exId, name));
      return ctx;
    },
    onError: (err, _vars, ctx) => {
      optimistic.rollback(ctx);
      onError(err);
    },
  });

  const updateWorkoutMutation = useMutation({
    mutationFn: (updates: {
      title?: string;
      notes?: string | null;
      icon?: string | null;
      started_at?: string | null;
      ended_at?: string | null;
      activity_type?: ActivityType;
      media?: ActivityMediaItem[];
    }) => updateWorkoutDay(workout!.id, updates),
    onMutate: async (updates) => {
      const ctx = optimistic.snapshot();
      optimistic.apply((w) => applyPatchWorkoutFields(w, updates as WorkoutFieldPatch));
      return ctx;
    },
    onError: (err, _vars, ctx) => {
      optimistic.rollback(ctx);
      onError(err);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['workout-days'] });
      queryClient.invalidateQueries({ queryKey: ['workout-days-stats'] });
      optimistic.onSettledStats();
    },
  });

  const updateSetMutation = useMutation({
    mutationFn: ({
      setId,
      reps,
      weight,
      notes,
    }: {
      setId: string;
      reps: number | null;
      weight: number | null;
      notes: string | null;
    }) => updateExerciseSet(setId, { reps, weight, notes }),
    onMutate: async ({ setId, reps, weight, notes }) => {
      const ctx = optimistic.snapshot();
      optimistic.apply((w) => applyPatchSetRepsWeight(w, setId, reps, weight, notes));
      return ctx;
    },
    onError: (err, _vars, ctx) => {
      optimistic.rollback(ctx);
      onError(err);
    },
  });

  const deleteSetMutation = useMutation({
    mutationFn: (setId: string) => deleteExerciseSet(setId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workout', workoutId] });
      optimistic.onSettledStats();
    },
    onError,
  });

  const addSetMutation = useMutation({
    mutationFn: (exId: string) => {
      const ex = workout!.workout_exercises?.find((e) => e.id === exId) as
        | (WorkoutExercise & { exercise_sets?: ExerciseSet[]; sets?: ExerciseSet[] })
        | undefined;
      const sets = ex?.exercise_sets ?? ex?.sets ?? [];
      const nextNum = sets.length ? Math.max(...sets.map((s) => s.set_number)) + 1 : 1;
      return addExerciseSet(exId, nextNum);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workout', workoutId] }),
    onError,
  });

  const deleteWorkoutMutation = useMutation({
    mutationFn: (workoutDayId: string) => softDeleteWorkoutDay(workoutDayId),
    onSuccess: (_data, workoutDayId) => {
      queryClient.invalidateQueries({ queryKey: ['workout-days'] });
      queryClient.invalidateQueries({ queryKey: ['workout-days-stats'] });
      optimistic.onSettledStats();
      queryClient.invalidateQueries({ queryKey: ['trashed-activities'] });
      queryClient.removeQueries({ queryKey: ['workout', workoutDayId] });
      navigate('/journal');
    },
    onError,
  });

  return {
    createMutation,
    addExerciseMutation,
    updateExerciseCircuitMutation,
    deleteExerciseMutation,
    toggleSetMutation,
    updateExerciseMutation,
    updateExerciseGoalsMutation,
    updateWorkoutMutation,
    updateSetMutation,
    addSetMutation,
    deleteSetMutation,
    deleteWorkoutMutation,
  };
}
