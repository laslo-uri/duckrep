import { describe, expect, it } from 'vitest';
import { summarizeUsage, type UsageRow } from './exerciseUsage';

const row = (over: Partial<UsageRow>): UsageRow => ({
  definition_id: 'bench',
  workout_id: 'w1',
  date: '2026-10-20',
  weight: null,
  reps: null,
  completed: 1,
  ...over,
});

describe('summarizeUsage', () => {
  it('counts sessions and keeps the best done set of the last day', () => {
    const usage = summarizeUsage([
      row({ workout_id: 'w1', date: '2026-10-20', weight: 100, reps: 5 }),
      row({ workout_id: 'w2', date: '2026-10-27', weight: 80, reps: 8 }),
      row({ workout_id: 'w2', date: '2026-10-27', weight: 80, reps: 10 }),
      row({ workout_id: 'w2', date: '2026-10-27', weight: 90, reps: 3, completed: 0 }),
    ]);
    expect(usage.bench).toEqual({ sessions: 2, lastDate: '2026-10-27', lastWeight: 80, lastReps: 10 });
  });

  it('keeps an exercise that was added without sets', () => {
    expect(summarizeUsage([row({ definition_id: 'plank' })]).plank).toEqual({
      sessions: 1,
      lastDate: '2026-10-20',
      lastWeight: null,
      lastReps: null,
    });
  });
});
