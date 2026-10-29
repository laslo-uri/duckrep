import type { WorkoutDay } from '../types';

/** Per-activity counts (the journal's listWorkoutSummaries). */
export type ActivityTotals = { exercises: number; sets: number; done: number; volume: number };

export type PeriodTotals = { sessions: number; sets: number; volume: number };

export type JournalPeriod = {
  key: string;
  kind: 'thisWeek' | 'lastWeek' | 'month';
  /** First day of the month for `month` (YYYY-MM-01), the Monday for the weeks. */
  start: string;
  dates: { date: string; activities: WorkoutDay[] }[];
  totals: PeriodTotals;
};

function toDate(iso: string): Date {
  return new Date(`${iso}T00:00:00`);
}

function toIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Monday of the week (Serbia and Hungary start weeks on Monday). */
export function weekStart(iso: string): string {
  const date = toDate(iso);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return toIso(date);
}

function addDays(iso: string, days: number): string {
  const date = toDate(iso);
  date.setDate(date.getDate() + days);
  return toIso(date);
}

export function sumTotals(days: WorkoutDay[], summaries: Record<string, ActivityTotals | undefined>): PeriodTotals {
  let sets = 0;
  let volume = 0;
  for (const day of days) {
    sets += summaries[day.id]?.done ?? 0;
    volume += summaries[day.id]?.volume ?? 0;
  }
  return { sessions: days.length, sets, volume };
}

/**
 * The journal as Linear would show it: this week and last week open (by day), then one folded
 * entry per older month with its totals. `days` come newest first.
 */
export function groupJournal(
  days: WorkoutDay[],
  summaries: Record<string, ActivityTotals | undefined>,
  today: string,
): JournalPeriod[] {
  const thisWeek = weekStart(today);
  const lastWeek = addDays(thisWeek, -7);
  const periods: JournalPeriod[] = [];
  const byKey = new Map<string, { period: JournalPeriod; days: WorkoutDay[] }>();

  const periodFor = (date: string): Omit<JournalPeriod, 'dates' | 'totals'> => {
    if (date >= thisWeek) return { key: 'this-week', kind: 'thisWeek', start: thisWeek };
    if (date >= lastWeek) return { key: 'last-week', kind: 'lastWeek', start: lastWeek };
    return { key: date.slice(0, 7), kind: 'month', start: `${date.slice(0, 7)}-01` };
  };

  // This week always shows, even empty, so the page opens on "now".
  const empty = { key: 'this-week', kind: 'thisWeek', start: thisWeek, dates: [], totals: { sessions: 0, sets: 0, volume: 0 } } as JournalPeriod;
  byKey.set(empty.key, { period: empty, days: [] });
  periods.push(empty);

  for (const day of days) {
    const head = periodFor(day.date);
    let entry = byKey.get(head.key);
    if (!entry) {
      entry = { period: { ...head, dates: [], totals: { sessions: 0, sets: 0, volume: 0 } }, days: [] };
      byKey.set(head.key, entry);
      periods.push(entry.period);
    }
    entry.days.push(day);
    const last = entry.period.dates[entry.period.dates.length - 1];
    if (last && last.date === day.date) last.activities.push(day);
    else entry.period.dates.push({ date: day.date, activities: [day] });
  }
  for (const { period, days: inPeriod } of byKey.values()) period.totals = sumTotals(inPeriod, summaries);
  return periods;
}

/** This week against last week, for the Stats strip. */
export function compareWeeks(
  days: WorkoutDay[],
  summaries: Record<string, ActivityTotals | undefined>,
  today: string,
): { thisWeek: PeriodTotals; lastWeek: PeriodTotals } {
  const start = weekStart(today);
  const previous = addDays(start, -7);
  return {
    thisWeek: sumTotals(days.filter((day) => day.date >= start && day.date <= today), summaries),
    lastWeek: sumTotals(days.filter((day) => day.date >= previous && day.date < start), summaries),
  };
}
