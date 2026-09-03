import type {
  WorkoutDayWithExercises,
  WorkoutExercise,
  ActivityMediaItem,
  ActivityType,
} from '../types';

export function parseActivityMedia(raw: unknown): ActivityMediaItem[] {
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

export function normalizeWorkoutRow(data: Record<string, unknown>): WorkoutDayWithExercises {
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
