import { describe, expect, it } from 'vitest';
import type { DbClient } from './dbClient';
import { exportLegacyFood } from './api';

/** Answers the few queries exportLegacyFood makes, as a YouPeak journal (with food) or a fresh one would. */
function fakeDb(withFood: boolean): DbClient {
  return {
    async select<T>(sql: string): Promise<T[]> {
      if (sql.includes('sqlite_master')) return (withFood ? [{ name: 'food_entries' }] : []) as T[];
      if (sql.startsWith('SELECT * FROM food_entries')) {
        return [
          { id: 'f1', user_id: 'u', date: '2026-10-01', name: 'Oats', calories: 370, protein_g: 13.5, carbs_g: 60, fat_g: 7, created_at: 't1' },
        ] as T[];
      }
      if (sql.startsWith('PRAGMA table_info(user_stats)')) return [{ name: 'user_id' }, { name: 'calorie_goal' }] as T[];
      if (sql.includes('calorie_goal, protein_goal_g')) {
        return [{ calorie_goal: 2400, protein_goal_g: 150, carbs_goal_g: null, fat_goal_g: 70 }] as T[];
      }
      throw new Error(`unexpected query: ${sql}`);
    },
    async execute() {
      throw new Error('export must not write');
    },
  };
}

describe('exportLegacyFood', () => {
  it('exports the old food log and goals from a YouPeak journal', async () => {
    const food = await exportLegacyFood('u', fakeDb(true));
    expect(food?.entries).toEqual([
      { id: 'f1', user_id: 'u', date: '2026-10-01', name: 'Oats', calories: 370, protein_g: 13.5, carbs_g: 60, fat_g: 7, created_at: 't1' },
    ]);
    expect(food?.goals).toEqual({ calorie_goal: 2400, protein_goal_g: 150, carbs_goal_g: null, fat_goal_g: 70 });
  });

  it('returns null for a journal that never had food', async () => {
    expect(await exportLegacyFood('u', fakeDb(false))).toBeNull();
  });
});
