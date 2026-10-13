/** Personal index. Opens at 100, the way a position opens. */
export const MARK_OPEN = 100;
const SESSION_POINTS = 4;
const SET_POINTS = 0.25;

export function personalMark(sessions: number, completedSets: number) {
  const raw = MARK_OPEN + sessions * SESSION_POINTS + completedSets * SET_POINTS;
  return Math.round(raw * 100) / 100;
}

/** Session counts for the last `weeks` weeks, oldest first. */
export function weeklyCounts(dateKeys: string[], todayKey: string, weeks = 8): number[] {
  const today = new Date(`${todayKey}T00:00:00`);
  const counts = Array.from({ length: weeks }, () => 0);
  for (const key of dateKeys) {
    const day = new Date(`${key}T00:00:00`);
    const diffDays = Math.round((today.getTime() - day.getTime()) / 86_400_000);
    if (diffDays < 0 || diffDays >= weeks * 7) continue;
    const bucket = weeks - 1 - Math.floor(diffDays / 7);
    counts[bucket] += 1;
  }
  return counts;
}
