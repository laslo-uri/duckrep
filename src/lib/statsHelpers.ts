export function calculateBMI(weightKg: number, heightCm: number): number {
  if (!heightCm || heightCm <= 0) return 0;
  const heightM = heightCm / 100;
  return Math.round((weightKg / (heightM * heightM)) * 10) / 10;
}

export function bmiCategory(bmi: number): string {
  if (bmi < 18.5) return 'underweight';
  if (bmi < 25) return 'normal';
  if (bmi < 30) return 'overweight';
  return 'obese';
}

/** ISO date YYYY-MM-DD → age in full years (local calendar). */
export function ageFromBirthDate(isoDate: string | null | undefined): number | null {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return null;
  const [y, m, d] = isoDate.split('-').map(Number);
  const birth = new Date(y, m - 1, d);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age -= 1;
  return age >= 0 ? age : null;
}

export function formatBirthDateDisplay(isoDate: string, locale?: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  if (!y || !m || !d) return isoDate;
  return new Date(y, m - 1, d).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function utcDateFromKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function utcKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Sessions whose date falls in the Monday–Sunday week of `todayKey` (UTC date keys). */
export function countSessionsThisWeek(dateKeys: string[], todayKey: string): number {
  const today = utcDateFromKey(todayKey);
  const monday = new Date(today);
  monday.setUTCDate(today.getUTCDate() - ((today.getUTCDay() + 6) % 7));
  const start = utcKey(monday);
  return dateKeys.filter((key) => key >= start && key <= todayKey).length;
}

/**
 * Consecutive active days ending today, or yesterday if today has no session yet.
 * Multiple sessions on one day count as a single day.
 */
export function activityStreak(dateKeys: string[], todayKey: string): number {
  const days = new Set(dateKeys);
  const cursor = utcDateFromKey(todayKey);
  if (!days.has(utcKey(cursor))) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
    if (!days.has(utcKey(cursor))) return 0;
  }
  let streak = 0;
  while (days.has(utcKey(cursor))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

/** Monday-first week columns. `dateKeys` must be chronological UTC dates. */
export function buildMondayWeeks(dateKeys: string[]): (string | null)[][] {
  if (dateKeys.length === 0) return [];
  const first = utcDateFromKey(dateKeys[0]);
  const lead = (first.getUTCDay() + 6) % 7;
  const cells: (string | null)[] = [...Array.from({ length: lead }, () => null), ...dateKeys];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}
