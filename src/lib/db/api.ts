import type {
  ActivityMediaItem,
  ActivityType,
  BodyWeightLog,
  ExerciseDefinition,
  LegacyFoodEntry,
  LegacyNutritionGoals,
  UserDailyTrainingStats,
  UserStats,
  WorkoutDay,
  WorkoutDayWithExercises,
  WorkoutExercise,
} from '../../types';
import { importJournalWorkouts, parseJournalImport } from '../journalImport';
import { getDb, newId, nowIso, todayIso } from './client';
import type { DbClient } from './dbClient';
import {
  assembleWorkout,
  mapBodyWeightLog,
  mapDailyStats,
  mapExerciseDefinition,
  mapLegacyFoodEntry,
  mapUserStats,
  mapWorkoutDay,
} from './rows';

// ── Profile ──────────────────────────────────────────────────────────────────

export async function getProfileDisplayName(userId: string): Promise<string | null> {
  const db = await getDb();
  const rows = await db.select<{ display_name: string | null }>(
    'SELECT display_name FROM profiles WHERE id = ?',
    [userId],
  );
  return rows[0]?.display_name ?? null;
}

export async function setProfileDisplayName(userId: string, displayName: string): Promise<void> {
  const db = await getDb();
  await db.execute('UPDATE profiles SET display_name = ?, updated_at = ? WHERE id = ?', [
    displayName,
    nowIso(),
    userId,
  ]);
}

// ── Workout days ─────────────────────────────────────────────────────────────

export async function listWorkoutDays(userId: string): Promise<WorkoutDay[]> {
  const db = await getDb();
  const rows = await db.select(
    `SELECT * FROM workout_days
     WHERE user_id = ? AND deleted_at IS NULL
     ORDER BY date DESC, started_at DESC, created_at DESC`,
    [userId],
  );
  return rows.map(mapWorkoutDay);
}

export async function getWorkoutWithExercises(id: string): Promise<WorkoutDayWithExercises | null> {
  const db = await getDb();
  const days = await db.select('SELECT * FROM workout_days WHERE id = ?', [id]);
  if (!days[0]) return null;

  const exercises = await db.select(
    `SELECT * FROM workout_exercises WHERE workout_day_id = ? ORDER BY order_index`,
    [id],
  );
  const exIds = exercises.map((e) => e.id);
  let sets: Record<string, unknown>[] = [];
  if (exIds.length > 0) {
    const placeholders = exIds.map(() => '?').join(',');
    sets = await db.select(
      `SELECT * FROM exercise_sets WHERE workout_exercise_id IN (${placeholders}) ORDER BY set_number`,
      exIds,
    );
  }
  return assembleWorkout(days[0], exercises, sets);
}

export async function createWorkoutDay(userId: string, date = todayIso()): Promise<WorkoutDay> {
  const db = await getDb();
  const id = newId();
  const ts = nowIso();
  await db.execute(
    `INSERT INTO workout_days (id, user_id, date, activity_type, media, created_at, updated_at)
     VALUES (?, ?, ?, 'strength', '[]', ?, ?)`,
    [id, userId, date, ts, ts],
  );
  const rows = await db.select('SELECT * FROM workout_days WHERE id = ?', [id]);
  return mapWorkoutDay(rows[0]);
}

export async function updateWorkoutDay(
  id: string,
  updates: {
    title?: string;
    notes?: string | null;
    icon?: string | null;
    started_at?: string | null;
    ended_at?: string | null;
    activity_type?: ActivityType;
    media?: ActivityMediaItem[];
    deleted_at?: string | null;
  },
): Promise<void> {
  const db = await getDb();
  const fields: string[] = ['updated_at = ?'];
  const params: unknown[] = [nowIso()];

  if (updates.title !== undefined) {
    fields.push('title = ?');
    params.push(updates.title);
  }
  if (updates.notes !== undefined) {
    fields.push('notes = ?');
    params.push(updates.notes);
  }
  if (updates.icon !== undefined) {
    fields.push('icon = ?');
    params.push(updates.icon);
  }
  // is_public is an unused column. Callers cannot change it.
  if (updates.started_at !== undefined) {
    fields.push('started_at = ?');
    params.push(updates.started_at);
  }
  if (updates.ended_at !== undefined) {
    fields.push('ended_at = ?');
    params.push(updates.ended_at);
  }
  if (updates.activity_type !== undefined) {
    fields.push('activity_type = ?');
    params.push(updates.activity_type);
  }
  if (updates.media !== undefined) {
    fields.push('media = ?');
    params.push(JSON.stringify(updates.media));
  }
  if (updates.deleted_at !== undefined) {
    fields.push('deleted_at = ?');
    params.push(updates.deleted_at);
  }

  params.push(id);
  await db.execute(`UPDATE workout_days SET ${fields.join(', ')} WHERE id = ?`, params);
}

export async function softDeleteWorkoutDay(id: string): Promise<void> {
  await updateWorkoutDay(id, { deleted_at: nowIso() });
}

export async function restoreWorkoutDay(id: string): Promise<void> {
  await updateWorkoutDay(id, { deleted_at: null });
}

export async function hardDeleteWorkoutDay(id: string): Promise<void> {
  const db = await getDb();
  await db.execute('DELETE FROM workout_days WHERE id = ?', [id]);
}

export async function listTrashedActivities(userId: string) {
  const db = await getDb();
  return db.select<{ id: string; title: string | null; date: string; deleted_at: string }>(
    `SELECT id, title, date, deleted_at FROM workout_days
     WHERE user_id = ? AND deleted_at IS NOT NULL
     ORDER BY deleted_at DESC`,
    [userId],
  );
}

export async function listWorkoutDaysForStats(userId: string, sinceDate: string) {
  const db = await getDb();
  return db.select<{ date: string; icon: string | null }>(
    `SELECT date, icon FROM workout_days
     WHERE user_id = ? AND deleted_at IS NULL AND date >= ?`,
    [userId, sinceDate],
  );
}

// ── Workout exercises & sets ─────────────────────────────────────────────────

export async function addWorkoutExercise(
  workoutDayId: string,
  data: { name: string; exercise_definition_id?: string | null; order_index: number },
): Promise<WorkoutExercise> {
  const db = await getDb();
  const id = newId();
  const ts = nowIso();
  await db.execute(
    `INSERT INTO workout_exercises (id, workout_day_id, name, exercise_definition_id, order_index, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, workoutDayId, data.name, data.exercise_definition_id ?? null, data.order_index, ts, ts],
  );
  const rows = await db.select('SELECT * FROM workout_exercises WHERE id = ?', [id]);
  return rows[0] as unknown as WorkoutExercise;
}

export async function insertExerciseSets(
  sets: { workout_exercise_id: string; set_number: number; reps?: number | null; weight?: number | null; completed?: boolean }[],
): Promise<void> {
  const db = await getDb();
  for (const s of sets) {
    await db.execute(
      `INSERT INTO exercise_sets (id, workout_exercise_id, set_number, reps, weight, completed)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [newId(), s.workout_exercise_id, s.set_number, s.reps ?? null, s.weight ?? null, s.completed ? 1 : 0],
    );
  }
}

export async function updateWorkoutExercise(
  id: string,
  updates: { name?: string; circuit_group_id?: string | null; goals?: string | null },
): Promise<void> {
  const db = await getDb();
  const fields: string[] = ['updated_at = ?'];
  const params: unknown[] = [nowIso()];
  if (updates.name !== undefined) {
    fields.push('name = ?');
    params.push(updates.name);
  }
  if (updates.circuit_group_id !== undefined) {
    fields.push('circuit_group_id = ?');
    params.push(updates.circuit_group_id);
  }
  if (updates.goals !== undefined) {
    fields.push('goals = ?');
    params.push(updates.goals);
  }
  params.push(id);
  await db.execute(`UPDATE workout_exercises SET ${fields.join(', ')} WHERE id = ?`, params);
}

export async function deleteWorkoutExercise(id: string): Promise<void> {
  const db = await getDb();
  await db.execute('DELETE FROM workout_exercises WHERE id = ?', [id]);
}

export async function updateExerciseSet(
  id: string,
  updates: { completed?: boolean; reps?: number | null; weight?: number | null; notes?: string | null },
): Promise<void> {
  const db = await getDb();
  const fields: string[] = [];
  const params: unknown[] = [];
  if (updates.completed !== undefined) {
    fields.push('completed = ?');
    params.push(updates.completed ? 1 : 0);
  }
  if (updates.reps !== undefined) {
    fields.push('reps = ?');
    params.push(updates.reps);
  }
  if (updates.weight !== undefined) {
    fields.push('weight = ?');
    params.push(updates.weight);
  }
  if (updates.notes !== undefined) {
    fields.push('notes = ?');
    params.push(updates.notes);
  }
  if (fields.length === 0) return;
  params.push(id);
  await db.execute(`UPDATE exercise_sets SET ${fields.join(', ')} WHERE id = ?`, params);
}

export async function deleteExerciseSet(id: string): Promise<void> {
  const db = await getDb();
  await db.execute('DELETE FROM exercise_sets WHERE id = ?', [id]);
}

export async function addExerciseSet(workoutExerciseId: string, setNumber: number): Promise<void> {
  const db = await getDb();
  await db.execute(
    'INSERT INTO exercise_sets (id, workout_exercise_id, set_number) VALUES (?, ?, ?)',
    [newId(), workoutExerciseId, setNumber],
  );
}

// ── Exercise library ─────────────────────────────────────────────────────────

export async function listExercises(userId: string): Promise<ExerciseDefinition[]> {
  const db = await getDb();
  const rows = await db.select(
    'SELECT * FROM exercise_definitions WHERE user_id = ? OR is_global = 1 ORDER BY name',
    [userId],
  );
  return rows.map(mapExerciseDefinition);
}

export async function exerciseSourceExists(sourceSlug: string): Promise<boolean> {
  const db = await getDb();
  const rows = await db.select<{ id: string }>('SELECT id FROM exercise_definitions WHERE source_slug = ?', [sourceSlug]);
  return rows.length > 0;
}

export async function addLibraryExercise(
  userId: string,
  data: { name: string; muscleGroup: string; sourceSlug: string },
): Promise<'added' | 'exists'> {
  if (await exerciseSourceExists(data.sourceSlug)) return 'exists';
  const db = await getDb();
  const ts = nowIso();
  await db.execute(
    `INSERT INTO exercise_definitions
      (id, user_id, name, muscle_group, source_slug, is_global, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
    [newId(), userId, data.name, data.muscleGroup, data.sourceSlug, ts, ts],
  );
  return 'added';
}

// ── Stats ────────────────────────────────────────────────────────────────────

export async function getUserStats(userId: string): Promise<UserStats | null> {
  const db = await getDb();
  const rows = await db.select('SELECT * FROM user_stats WHERE user_id = ?', [userId]);
  return rows[0] ? mapUserStats(rows[0]) : null;
}

export async function upsertUserStats(
  userId: string,
  updates: {
    birth_date?: string | null;
    height_cm?: number | null;
    goal_weight_kg?: number | null;
  },
): Promise<void> {
  const db = await getDb();
  const existing = await getUserStats(userId);
  const ts = nowIso();
  const COLUMNS = ['birth_date', 'height_cm', 'goal_weight_kg'] as const;
  if (existing) {
    const fields: string[] = ['updated_at = ?'];
    const params: unknown[] = [ts];
    for (const col of COLUMNS) {
      if (updates[col] !== undefined) {
        fields.push(`${col} = ?`);
        params.push(updates[col]);
      }
    }
    params.push(userId);
    await db.execute(`UPDATE user_stats SET ${fields.join(', ')} WHERE user_id = ?`, params);
  } else {
    await db.execute(
      `INSERT INTO user_stats (user_id, ${COLUMNS.join(', ')}, created_at, updated_at)
       VALUES (?, ${COLUMNS.map(() => '?').join(', ')}, ?, ?)`,
      [userId, ...COLUMNS.map((col) => updates[col] ?? null), ts, ts],
    );
  }
}

export async function listBodyWeightLogs(userId: string, limit = 90): Promise<BodyWeightLog[]> {
  const db = await getDb();
  const rows = await db.select(
    'SELECT * FROM body_weight_logs WHERE user_id = ? ORDER BY date DESC LIMIT ?',
    [userId, limit],
  );
  return rows.map(mapBodyWeightLog);
}

export async function getLatestBodyWeight(userId: string): Promise<number | null> {
  const db = await getDb();
  const rows = await db.select<{ weight_kg: number }>(
    'SELECT weight_kg FROM body_weight_logs WHERE user_id = ? ORDER BY date DESC LIMIT 1',
    [userId],
  );
  return rows[0]?.weight_kg ?? null;
}

export async function upsertBodyWeightLog(userId: string, date: string, weightKg: number): Promise<void> {
  const db = await getDb();
  const existing = await db.select(
    'SELECT id FROM body_weight_logs WHERE user_id = ? AND date = ?',
    [userId, date],
  );
  if (existing[0]) {
    await db.execute('UPDATE body_weight_logs SET weight_kg = ? WHERE user_id = ? AND date = ?', [
      weightKg,
      userId,
      date,
    ]);
  } else {
    await db.execute(
      'INSERT INTO body_weight_logs (id, user_id, date, weight_kg) VALUES (?, ?, ?, ?)',
      [newId(), userId, date, weightKg],
    );
  }
}

/**
 * The food log moved to Dovediet. Journals started under YouPeak still hold its table
 * (`food_entries`) and the goal columns on `user_stats`; nothing drops them, and the journal
 * export carries them so Dovediet can import them. Fresh journals have neither: then null.
 */
export async function exportLegacyFood(
  userId: string,
  db: DbClient | null = null,
): Promise<{ entries: LegacyFoodEntry[]; goals: LegacyNutritionGoals | null } | null> {
  db ??= await getDb();
  const tables = await db.select<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'food_entries'",
  );
  if (!tables[0]) return null;
  const rows = await db.select('SELECT * FROM food_entries WHERE user_id = ? ORDER BY date, created_at', [userId]);
  const statCols = await db.select<{ name: string }>('PRAGMA table_info(user_stats)');
  let goals: LegacyNutritionGoals | null = null;
  if (statCols.some((c) => c.name === 'calorie_goal')) {
    const stats = await db.select<LegacyNutritionGoals>(
      'SELECT calorie_goal, protein_goal_g, carbs_goal_g, fat_goal_g FROM user_stats WHERE user_id = ?',
      [userId],
    );
    goals = stats[0] ?? null;
  }
  return { entries: rows.map(mapLegacyFoodEntry), goals };
}

/** JSON backup of non-deleted workouts (with exercises + sets) for Settings export, plus the old food log if any. */
export async function exportWorkoutJournalJson(userId: string): Promise<{
  version: 1;
  exported_at: string;
  user_id: string;
  workouts: WorkoutDayWithExercises[];
  food?: { entries: LegacyFoodEntry[]; goals: LegacyNutritionGoals | null };
}> {
  const days = await listWorkoutDays(userId);
  const workouts: WorkoutDayWithExercises[] = [];
  for (const day of days) {
    const full = await getWorkoutWithExercises(day.id);
    if (full) workouts.push(full);
  }
  const food = await exportLegacyFood(userId);
  return {
    version: 1,
    exported_at: nowIso(),
    user_id: userId,
    workouts,
    ...(food ? { food } : {}),
  };
}

/** Restores a journal JSON export. Activities already stored under the same id are skipped. */
export async function importWorkoutJournalJson(
  userId: string,
  raw: unknown,
): Promise<{ imported: number; skipped: number }> {
  const file = parseJournalImport(raw);
  if (!file) throw new Error('Invalid journal file');
  const db = await getDb();
  return importJournalWorkouts(db, userId, file);
}

/** Lifetime totals for the personal mark: all non-deleted sessions and completed sets. */
export async function getLifetimeTrainingTotals(
  userId: string,
): Promise<{ sessions: number; completedSets: number }> {
  const db = await getDb();
  const sessionRows = await db.select<{ c: number }>(
    'SELECT COUNT(*) AS c FROM workout_days WHERE user_id = ? AND deleted_at IS NULL',
    [userId],
  );
  const setRows = await db.select<{ c: number }>(
    `SELECT COUNT(*) AS c
     FROM exercise_sets es
     JOIN workout_exercises we ON es.workout_exercise_id = we.id
     JOIN workout_days wd ON we.workout_day_id = wd.id
     WHERE wd.user_id = ? AND wd.deleted_at IS NULL AND es.completed = 1`,
    [userId],
  );
  return {
    sessions: Number(sessionRows[0]?.c ?? 0),
    completedSets: Number(setRows[0]?.c ?? 0),
  };
}

export async function getDailyTrainingStats(userId: string, sinceDate: string): Promise<UserDailyTrainingStats[]> {
  const db = await getDb();

  const activityRows = await db.select(
    `SELECT date,
       SUM(CASE WHEN deleted_at IS NULL THEN 1 ELSE 0 END) AS activity_count,
       SUM(CASE WHEN deleted_at IS NULL AND activity_type = 'strength' THEN 1 ELSE 0 END) AS strength_count,
       SUM(CASE WHEN deleted_at IS NULL AND activity_type = 'cardio' THEN 1 ELSE 0 END) AS cardio_count
     FROM workout_days
     WHERE user_id = ? AND date >= ?
     GROUP BY date`,
    [userId, sinceDate],
  );

  const setRows = await db.select(
    `SELECT wd.date, COUNT(*) AS completed_sets
     FROM exercise_sets es
     JOIN workout_exercises we ON es.workout_exercise_id = we.id
     JOIN workout_days wd ON we.workout_day_id = wd.id
     WHERE wd.user_id = ? AND wd.deleted_at IS NULL AND es.completed = 1 AND wd.date >= ?
     GROUP BY wd.date`,
    [userId, sinceDate],
  );

  const setsByDate = new Map(setRows.map((r) => [String(r.date), Number(r.completed_sets)]));

  return activityRows.map((row) =>
    mapDailyStats(
      { ...row, completed_sets: setsByDate.get(String(row.date)) ?? 0 },
      userId,
    ),
  );
}
