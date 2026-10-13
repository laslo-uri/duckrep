import { describe, expect, it } from 'vitest';
import type { DbClient } from './db/dbClient';
import { LOCAL_USER_ID } from './db/constants';
import { importJournalWorkouts, parseJournalImport } from './journalImport';

const sample = {
  version: 1,
  exported_at: '2026-10-07T00:00:00.000Z',
  user_id: 'someone-else',
  workouts: [
    {
      id: 'workout-1',
      date: '2026-10-01',
      title: 'Push',
      notes: 'felt strong',
      icon: 'dumbbell',
      is_public: true,
      activity_type: 'strength',
      media: [{ url: 'https://example.com/photo.jpg', caption: 'bench' }, { url: 'http://nope' }],
      workout_exercises: [
        {
          id: 'exercise-1',
          name: 'Bench press',
          exercise_definition_id: 'missing-definition',
          order_index: 0,
          goals: '8 reps',
          sets: [
            {
              id: 'set-1',
              set_number: 1,
              reps: 8,
              weight: 60,
              completed: true,
              notes: 'paused',
            },
          ],
        },
      ],
    },
  ],
};

function recordingDb(): { db: DbClient; calls: { sql: string; params: unknown[] }[] } {
  const calls: { sql: string; params: unknown[] }[] = [];
  const workoutIds = new Set<string>();
  const db: DbClient = {
    async select<T>(sql: string, params: unknown[] = []): Promise<T[]> {
      if (sql.includes('FROM workout_days') && workoutIds.has(String(params[0]))) {
        return [{ id: params[0] } as T];
      }
      return [];
    },
    async execute(sql: string, params: unknown[] = []): Promise<void> {
      calls.push({ sql, params });
      if (sql.includes('INSERT INTO workout_days')) workoutIds.add(String(params[0]));
    },
  };
  return { db, calls };
}

describe('parseJournalImport', () => {
  it('rejects a file that is not a version 1 journal', () => {
    expect(parseJournalImport(null)).toBeNull();
    expect(parseJournalImport({ version: 2, workouts: [] })).toBeNull();
    expect(parseJournalImport({ version: 1, workouts: [{ id: 'x' }] })).toBeNull();
  });

  it('keeps session notes, goals, and https media', () => {
    const parsed = parseJournalImport(sample);
    expect(parsed?.workouts[0]?.notes).toBe('felt strong');
    expect(parsed?.workouts[0]?.media).toEqual([{ url: 'https://example.com/photo.jpg', caption: 'bench' }]);
    expect(parsed?.workouts[0]?.exercises[0]?.goals).toBe('8 reps');
    expect(parsed?.workouts[0]?.exercises[0]?.sets[0]?.notes).toBe('paused');
  });
});

describe('importJournalWorkouts', () => {
  it('writes the activity for the local user, drops a missing exercise, and skips a second import', async () => {
    const parsed = parseJournalImport(sample);
    expect(parsed).not.toBeNull();
    const { db, calls } = recordingDb();

    const first = await importJournalWorkouts(db, LOCAL_USER_ID, parsed!);
    expect(first).toEqual({ imported: 1, skipped: 0 });

    const day = calls.find((call) => call.sql.includes('INSERT INTO workout_days'));
    expect(day?.sql).toContain('is_public');
    expect(day?.sql).toMatch(/\?, 0, \?/);
    expect(day?.params[1]).toBe(LOCAL_USER_ID);
    expect(day?.params[4]).toBe('felt strong');
    expect(day?.params).not.toContain(true);

    const exercise = calls.find((call) => call.sql.includes('INSERT INTO workout_exercises'));
    expect(exercise?.params[2]).toBeNull();
    expect(exercise?.params[6]).toBe('8 reps');

    const set = calls.find((call) => call.sql.includes('INSERT INTO exercise_sets'));
    expect(set?.params[6]).toBe('paused');
    expect(calls.some((call) => call.sql === 'BEGIN')).toBe(true);
    expect(calls.some((call) => call.sql === 'COMMIT')).toBe(true);

    const second = await importJournalWorkouts(db, LOCAL_USER_ID, parsed!);
    expect(second).toEqual({ imported: 0, skipped: 1 });
    expect(calls.filter((call) => call.sql.includes('INSERT INTO workout_days'))).toHaveLength(1);
  });
});
