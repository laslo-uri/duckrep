import { describe, expect, it } from 'vitest';
import { compareWeeks, groupJournal, weekStart } from './journalPeriods';
import type { WorkoutDay } from '../types';

const day = (id: string, date: string) => ({ id, date }) as WorkoutDay;
const summaries = {
  a: { exercises: 3, sets: 9, done: 9, volume: 4000 },
  b: { exercises: 2, sets: 6, done: 4, volume: 1500 },
  c: { exercises: 4, sets: 12, done: 12, volume: 6000 },
  d: { exercises: 1, sets: 3, done: 3, volume: 0 },
};
// Thursday 29 October 2026; the week starts Monday the 26th.
const TODAY = '2026-10-29';
const days = [day('a', '2026-10-29'), day('b', '2026-10-26'), day('c', '2026-10-20'), day('d', '2026-09-02'), day('e', '2026-09-01')];

describe('journal periods', () => {
  it('starts weeks on Monday', () => {
    expect(weekStart('2026-10-29')).toBe('2026-10-26');
    expect(weekStart('2026-10-26')).toBe('2026-10-26');
    expect(weekStart('2026-11-01')).toBe('2026-10-26');
  });

  it('opens this week and last week by day, then folds older months with totals', () => {
    const periods = groupJournal(days, summaries, TODAY);
    expect(periods.map((p) => [p.key, p.kind, p.dates.length])).toEqual([
      ['this-week', 'thisWeek', 2],
      ['last-week', 'lastWeek', 1],
      ['2026-09', 'month', 2],
    ]);
    expect(periods[0].totals).toEqual({ sessions: 2, sets: 13, volume: 5500 });
    expect(periods[2].totals).toEqual({ sessions: 2, sets: 3, volume: 0 });
  });

  it('keeps an empty this-week period so the page opens on now', () => {
    expect(groupJournal([day('c', '2026-10-20')], summaries, TODAY).map((p) => p.key)).toEqual(['this-week', 'last-week']);
  });

  it('compares this week with last week', () => {
    expect(compareWeeks(days, summaries, TODAY)).toEqual({
      thisWeek: { sessions: 2, sets: 13, volume: 5500 },
      lastWeek: { sessions: 1, sets: 12, volume: 6000 },
    });
  });
});
