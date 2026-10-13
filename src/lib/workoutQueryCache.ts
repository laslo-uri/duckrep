import type { QueryClient } from '@tanstack/react-query';
import type {
  WorkoutDayWithExercises,
  WorkoutExercise,
  ExerciseSet,
  ActivityMediaItem,
  ActivityType,
} from '../types';

type ExerciseWithSets = WorkoutExercise & {
  exercise_sets?: ExerciseSet[];
  sets?: ExerciseSet[];
};

function getSets(ex: ExerciseWithSets): ExerciseSet[] {
  return ex.exercise_sets ?? ex.sets ?? [];
}

function withSets(ex: ExerciseWithSets, sets: ExerciseSet[]): ExerciseWithSets {
  return { ...ex, exercise_sets: sets, sets };
}

function mapExercises(
  workout: WorkoutDayWithExercises,
  fn: (ex: ExerciseWithSets) => ExerciseWithSets,
): WorkoutDayWithExercises {
  return {
    ...workout,
    workout_exercises: (workout.workout_exercises ?? []).map((ex) => fn(ex as ExerciseWithSets)),
  };
}

export function workoutQueryKey(workoutId: string) {
  return ['workout', workoutId] as const;
}

export function getWorkoutFromCache(
  queryClient: QueryClient,
  workoutId: string,
): WorkoutDayWithExercises | undefined {
  return queryClient.getQueryData<WorkoutDayWithExercises>(workoutQueryKey(workoutId));
}

export function setWorkoutInCache(
  queryClient: QueryClient,
  workoutId: string,
  data: WorkoutDayWithExercises,
) {
  queryClient.setQueryData(workoutQueryKey(workoutId), data);
}

export function applyPatchSetCompleted(
  workout: WorkoutDayWithExercises,
  setId: string,
  completed: boolean,
): WorkoutDayWithExercises {
  return mapExercises(workout, (ex) =>
    withSets(
      ex,
      getSets(ex).map((s) => (s.id === setId ? { ...s, completed } : s)),
    ),
  );
}

export function applyPatchSetRepsWeight(
  workout: WorkoutDayWithExercises,
  setId: string,
  reps: number | null,
  weight: number | null,
  notes?: string | null,
): WorkoutDayWithExercises {
  return mapExercises(workout, (ex) =>
    withSets(
      ex,
      getSets(ex).map((s) =>
        s.id === setId ? { ...s, reps, weight, ...(notes !== undefined ? { notes } : {}) } : s,
      ),
    ),
  );
}

export function applyPatchExerciseName(
  workout: WorkoutDayWithExercises,
  exId: string,
  name: string,
): WorkoutDayWithExercises {
  return mapExercises(workout, (ex) => (ex.id === exId ? { ...ex, name } : ex));
}

export function applyPatchExerciseGoals(
  workout: WorkoutDayWithExercises,
  exId: string,
  goals: string | null,
): WorkoutDayWithExercises {
  return mapExercises(workout, (ex) => (ex.id === exId ? { ...ex, goals } : ex));
}

export function applyPatchExerciseCircuit(
  workout: WorkoutDayWithExercises,
  exId: string,
  circuit_group_id: string | null,
): WorkoutDayWithExercises {
  return mapExercises(workout, (ex) =>
    ex.id === exId ? { ...ex, circuit_group_id } : ex,
  );
}

export type WorkoutFieldPatch = {
  title?: string;
  notes?: string | null;
  icon?: string | null;
  is_public?: boolean;
  started_at?: string | null;
  ended_at?: string | null;
  activity_type?: ActivityType;
  media?: ActivityMediaItem[];
};

export function applyPatchWorkoutFields(
  workout: WorkoutDayWithExercises,
  updates: WorkoutFieldPatch,
): WorkoutDayWithExercises {
  return { ...workout, ...updates };
}

export function invalidateDailyStats(queryClient: QueryClient, userId: string) {
  queryClient.invalidateQueries({ queryKey: ['user-daily-training-stats', userId] });
}
