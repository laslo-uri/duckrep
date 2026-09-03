import type {
  ActivityMediaItem,
  ActivityType,
  BodyWeightLog,
  ExerciseDefinition,
  ExerciseSet,
  ExerciseSetDefault,
  UserDailyTrainingStats,
  UserStats,
  WorkoutDay,
  WorkoutDayWithExercises,
  WorkoutExercise,
} from '../../types';

type Row = Record<string, unknown>;

function bool(v: unknown): boolean {
  return v === true || v === 1 || v === '1';
}

function num(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function str(v: unknown): string | null {
  if (v == null) return null;
  return String(v);
}

function parseJson<T>(raw: unknown, fallback: T): T {
  if (raw == null || raw === '') return fallback;
  if (typeof raw === 'object') return raw as T;
  try {
    return JSON.parse(String(raw)) as T;
  } catch {
    return fallback;
  }
}

export function mapWorkoutDay(row: Row): WorkoutDay {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    date: String(row.date),
    title: str(row.title),
    notes: str(row.notes),
    icon: str(row.icon),
    is_public: bool(row.is_public),
    started_at: str(row.started_at),
    ended_at: str(row.ended_at),
    activity_type: (row.activity_type as ActivityType) ?? 'strength',
    deleted_at: str(row.deleted_at),
    media: parseJson<ActivityMediaItem[]>(row.media, []),
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
  };
}

export function mapExerciseSet(row: Row): ExerciseSet {
  return {
    id: String(row.id),
    workout_exercise_id: String(row.workout_exercise_id),
    set_number: Number(row.set_number),
    reps: num(row.reps) != null ? Math.trunc(num(row.reps)!) : null,
    weight: num(row.weight),
    completed: bool(row.completed),
    notes: str(row.notes),
    created_at: String(row.created_at ?? ''),
  };
}

export function mapWorkoutExercise(row: Row, sets?: ExerciseSet[]): WorkoutExercise & { exercise_sets?: ExerciseSet[] } {
  const ex: WorkoutExercise & { exercise_sets?: ExerciseSet[] } = {
    id: String(row.id),
    workout_day_id: String(row.workout_day_id),
    exercise_definition_id: str(row.exercise_definition_id),
    circuit_group_id: str(row.circuit_group_id),
    name: String(row.name),
    order_index: Number(row.order_index ?? 0),
    goals: str(row.goals),
    notes: str(row.notes),
    completed: bool(row.completed),
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
  };
  if (sets) {
    ex.exercise_sets = sets;
    ex.sets = sets;
  }
  return ex;
}

export function mapExerciseDefinition(row: Row): ExerciseDefinition {
  const defaultSets = parseJson<ExerciseSetDefault[] | null>(row.default_sets, null);
  return {
    id: String(row.id),
    user_id: str(row.user_id),
    name: String(row.name),
    name_sr: str(row.name_sr),
    name_hu: str(row.name_hu),
    description: str(row.description),
    image_url: str(row.image_url),
    muscle_group: str(row.muscle_group),
    source_slug: str(row.source_slug),
    is_global: bool(row.is_global),
    default_sets: defaultSets,
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
  };
}

export function mapUserStats(row: Row): UserStats {
  return {
    user_id: String(row.user_id),
    birth_date: str(row.birth_date),
    height_cm: num(row.height_cm),
    goal_weight_kg: num(row.goal_weight_kg),
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
  };
}

export function mapBodyWeightLog(row: Row): BodyWeightLog {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    date: String(row.date),
    weight_kg: num(row.weight_kg) ?? 0,
    created_at: String(row.created_at ?? ''),
  };
}

export function mapDailyStats(row: Row, userId: string): UserDailyTrainingStats {
  return {
    user_id: userId,
    date: String(row.date),
    activity_count: Number(row.activity_count ?? 0),
    strength_count: Number(row.strength_count ?? 0),
    cardio_count: Number(row.cardio_count ?? 0),
    completed_sets: Number(row.completed_sets ?? 0),
    updated_at: nowIso(),
  };
}

function nowIso(): string {
  return new Date().toISOString();
}

export function assembleWorkout(
  dayRow: Row,
  exerciseRows: Row[],
  setRows: Row[],
): WorkoutDayWithExercises {
  const setsByExercise = new Map<string, ExerciseSet[]>();
  for (const s of setRows) {
    const exId = String(s.workout_exercise_id);
    const list = setsByExercise.get(exId) ?? [];
    list.push(mapExerciseSet(s));
    setsByExercise.set(exId, list);
  }
  for (const [, list] of setsByExercise) {
    list.sort((a, b) => a.set_number - b.set_number);
  }

  const exercises = exerciseRows
    .map((ex) => mapWorkoutExercise(ex, setsByExercise.get(String(ex.id)) ?? []))
    .sort((a, b) => a.order_index - b.order_index);

  return {
    ...mapWorkoutDay(dayRow),
    workout_exercises: exercises,
  };
}
