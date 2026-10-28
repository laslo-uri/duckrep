import type { ExerciseDefinition } from '../../types';

export type MuscleGroup = NonNullable<ExerciseDefinition['muscle_group']>;

const SOURCE_MUSCLE_MAP: Record<string, MuscleGroup> = {
  chest: 'chest',
  shoulders: 'shoulders',
  deltoids: 'shoulders',
  triceps: 'triceps',
  lats: 'back',
  'middle back': 'back',
  'lower back': 'back',
  traps: 'back',
  biceps: 'biceps',
  forearms: 'biceps',
  quadriceps: 'legs',
  hamstrings: 'legs',
  glutes: 'legs',
  calves: 'legs',
  abductors: 'legs',
  adductors: 'legs',
  abdominals: 'abs',
};

/** Map free-exercise-db primary muscle label to Duckrep muscle_group. */
export function mapSourceMuscleToGroup(primaryMuscle: string | undefined | null): MuscleGroup {
  if (!primaryMuscle) return 'other';
  const key = primaryMuscle.trim().toLowerCase();
  return SOURCE_MUSCLE_MAP[key] ?? 'other';
}
