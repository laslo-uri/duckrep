import { ACTIVITY_TYPES, type ActivityMediaItem, type ActivityType } from '../types';
import type { DbClient } from './db/dbClient';
import { newId, nowIso } from './db/utils';

export type JournalImportSet = {
  id: string;
  set_number: number;
  reps: number | null;
  weight: number | null;
  completed: boolean;
  notes: string | null;
};

export type JournalImportExercise = {
  id: string;
  name: string;
  exercise_definition_id: string | null;
  circuit_group_id: string | null;
  order_index: number;
  goals: string | null;
  notes: string | null;
  sets: JournalImportSet[];
};

export type JournalImportWorkout = {
  id: string;
  date: string;
  title: string | null;
  notes: string | null;
  icon: string | null;
  started_at: string | null;
  ended_at: string | null;
  activity_type: ActivityType;
  media: ActivityMediaItem[];
  exercises: JournalImportExercise[];
};

export type JournalImportFile = {
  version: 1;
  workouts: JournalImportWorkout[];
};

export type JournalImportResult = {
  imported: number;
  skipped: number;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asNullableString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function asActivityType(value: unknown): ActivityType {
  return ACTIVITY_TYPES.includes(value as ActivityType) ? (value as ActivityType) : 'strength';
}

function asMedia(value: unknown): ActivityMediaItem[] {
  if (!Array.isArray(value)) return [];
  const items: ActivityMediaItem[] = [];
  for (const entry of value) {
    if (!isRecord(entry) || typeof entry.url !== 'string' || !/^https:\/\//i.test(entry.url)) continue;
    const caption = asNullableString(entry.caption);
    items.push(caption ? { url: entry.url.trim(), caption } : { url: entry.url.trim() });
  }
  return items;
}

function asSets(value: unknown): JournalImportSet[] | null {
  if (!Array.isArray(value)) return [];
  const sets: JournalImportSet[] = [];
  const usedNumbers = new Set<number>();
  let nextNumber = 1;
  for (const entry of value) {
    if (!isRecord(entry) || typeof entry.id !== 'string' || !entry.id.trim()) return null;
    let setNumber = Number(entry.set_number);
    if (!Number.isInteger(setNumber) || setNumber < 1 || usedNumbers.has(setNumber)) {
      while (usedNumbers.has(nextNumber)) nextNumber += 1;
      setNumber = nextNumber;
    }
    usedNumbers.add(setNumber);
    nextNumber = Math.max(nextNumber, setNumber + 1);
    const reps = entry.reps == null || entry.reps === '' ? null : Number(entry.reps);
    const weight = entry.weight == null || entry.weight === '' ? null : Number(entry.weight);
    sets.push({
      id: entry.id.trim(),
      set_number: setNumber,
      reps: reps != null && Number.isFinite(reps) ? Math.trunc(reps) : null,
      weight: weight != null && Number.isFinite(weight) ? weight : null,
      completed: entry.completed === true || entry.completed === 1,
      notes: asNullableString(entry.notes),
    });
  }
  return sets;
}

function asExercises(workout: Record<string, unknown>): JournalImportExercise[] | null {
  const raw = workout.workout_exercises ?? workout.exercises;
  if (raw == null) return [];
  if (!Array.isArray(raw)) return null;
  const exercises: JournalImportExercise[] = [];
  for (const [index, entry] of raw.entries()) {
    if (!isRecord(entry) || typeof entry.id !== 'string' || !entry.id.trim()) return null;
    const name = asNullableString(entry.name);
    if (!name) return null;
    const setsRaw = entry.sets ?? entry.exercise_sets;
    const sets = asSets(setsRaw);
    if (!sets) return null;
    const order = Number(entry.order_index);
    exercises.push({
      id: entry.id.trim(),
      name,
      exercise_definition_id: asNullableString(entry.exercise_definition_id),
      circuit_group_id: asNullableString(entry.circuit_group_id),
      order_index: Number.isInteger(order) ? order : index,
      goals: asNullableString(entry.goals),
      notes: asNullableString(entry.notes),
      sets,
    });
  }
  return exercises;
}

/** Accepts the JSON written by `exportWorkoutJournalJson`. Returns null when the file is not that shape. */
export function parseJournalImport(raw: unknown): JournalImportFile | null {
  if (!isRecord(raw) || raw.version !== 1 || !Array.isArray(raw.workouts)) return null;
  const workouts: JournalImportWorkout[] = [];
  for (const entry of raw.workouts) {
    if (!isRecord(entry) || typeof entry.id !== 'string' || !entry.id.trim()) return null;
    if (typeof entry.date !== 'string' || !DATE_RE.test(entry.date)) return null;
    const exercises = asExercises(entry);
    if (!exercises) return null;
    workouts.push({
      id: entry.id.trim(),
      date: entry.date,
      title: asNullableString(entry.title),
      notes: asNullableString(entry.notes),
      icon: asNullableString(entry.icon),
      started_at: asNullableString(entry.started_at),
      ended_at: asNullableString(entry.ended_at),
      activity_type: asActivityType(entry.activity_type),
      media: asMedia(entry.media),
      exercises,
    });
  }
  return { version: 1, workouts };
}

async function takeId(db: DbClient, table: 'workout_exercises' | 'exercise_sets', id: string): Promise<string> {
  const rows = await db.select<{ id: string }>(`SELECT id FROM ${table} WHERE id = ?`, [id]);
  return rows[0] ? newId() : id;
}

async function definitionIdOrNull(db: DbClient, id: string | null): Promise<string | null> {
  if (!id) return null;
  const rows = await db.select<{ id: string }>('SELECT id FROM exercise_definitions WHERE id = ?', [id]);
  return rows[0] ? id : null;
}

/** Inserts workouts whose ids are not already stored. Existing activities are left unchanged. */
export async function importJournalWorkouts(
  db: DbClient,
  userId: string,
  file: JournalImportFile,
): Promise<JournalImportResult> {
  let imported = 0;
  let skipped = 0;

  for (const workout of file.workouts) {
    const existing = await db.select<{ id: string }>('SELECT id FROM workout_days WHERE id = ?', [workout.id]);
    if (existing[0]) {
      skipped += 1;
      continue;
    }

    const ts = nowIso();
    await db.execute('BEGIN');
    try {
      await db.execute(
        `INSERT INTO workout_days (
           id, user_id, date, title, notes, icon, is_public, started_at, ended_at,
           activity_type, deleted_at, media, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, NULL, ?, ?, ?)`,
        [
          workout.id,
          userId,
          workout.date,
          workout.title,
          workout.notes,
          workout.icon,
          workout.started_at,
          workout.ended_at,
          workout.activity_type,
          JSON.stringify(workout.media),
          ts,
          ts,
        ],
      );

      for (const exercise of workout.exercises) {
        const exerciseId = await takeId(db, 'workout_exercises', exercise.id);
        const definitionId = await definitionIdOrNull(db, exercise.exercise_definition_id);
        await db.execute(
          `INSERT INTO workout_exercises (
             id, workout_day_id, exercise_definition_id, circuit_group_id, name,
             order_index, goals, notes, created_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            exerciseId,
            workout.id,
            definitionId,
            exercise.circuit_group_id,
            exercise.name,
            exercise.order_index,
            exercise.goals,
            exercise.notes,
            ts,
            ts,
          ],
        );
        for (const set of exercise.sets) {
          const setId = await takeId(db, 'exercise_sets', set.id);
          await db.execute(
            `INSERT INTO exercise_sets (
               id, workout_exercise_id, set_number, reps, weight, completed, notes
             ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              setId,
              exerciseId,
              set.set_number,
              set.reps,
              set.weight,
              set.completed ? 1 : 0,
              set.notes,
            ],
          );
        }
      }
      await db.execute('COMMIT');
      imported += 1;
    } catch (err) {
      await db.execute('ROLLBACK');
      throw err;
    }
  }

  return { imported, skipped };
}
