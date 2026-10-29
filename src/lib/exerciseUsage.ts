/** How you have used one library exercise: sessions, last day, and the best set of that last day. */
export type ExerciseUsage = {
  sessions: number;
  lastDate: string;
  lastWeight: number | null;
  lastReps: number | null;
};

export type UsageRow = {
  definition_id: string;
  workout_id: string;
  date: string;
  weight: number | null;
  reps: number | null;
  completed: number;
};

/** Rows of every set (or a set-less line) of a library exercise → usage per exercise definition id. */
export function summarizeUsage(rows: UsageRow[]): Record<string, ExerciseUsage> {
  const out: Record<string, ExerciseUsage & { workouts: Set<string>; done: boolean }> = {};
  for (const row of rows) {
    const usage = (out[row.definition_id] ??= {
      sessions: 0,
      lastDate: row.date,
      lastWeight: null,
      lastReps: null,
      workouts: new Set(),
      done: false,
    });
    usage.workouts.add(row.workout_id);
    if (row.date > usage.lastDate) {
      Object.assign(usage, { lastDate: row.date, lastWeight: null, lastReps: null, done: false });
    }
    if (row.date !== usage.lastDate || (row.weight == null && row.reps == null)) continue;
    // Best set of the last day: done sets beat planned ones, then weight, then reps.
    const done = row.completed === 1;
    const better =
      (done && !usage.done) ||
      (done === usage.done &&
        ((row.weight ?? -1) > (usage.lastWeight ?? -1) ||
          ((row.weight ?? -1) === (usage.lastWeight ?? -1) && (row.reps ?? -1) > (usage.lastReps ?? -1))));
    if (better) Object.assign(usage, { lastWeight: row.weight, lastReps: row.reps, done });
  }
  return Object.fromEntries(
    Object.entries(out).map(([id, usage]) => [
      id,
      { sessions: usage.workouts.size, lastDate: usage.lastDate, lastWeight: usage.lastWeight, lastReps: usage.lastReps },
    ]),
  );
}
