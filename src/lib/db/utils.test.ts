import { describe, expect, it } from 'vitest';
import { localDateKey, todayIso } from './utils';

describe('localDateKey', () => {
  it('uses the local calendar day when UTC has already rolled over', () => {
    const earlyMorning = new Date(2026, 0, 11, 0, 30, 0);
    expect(localDateKey(earlyMorning)).toBe('2026-01-11');
    expect(todayIso(earlyMorning)).toBe('2026-01-11');

    const lateEvening = new Date(2026, 0, 11, 23, 30, 0);
    expect(localDateKey(lateEvening)).toBe('2026-01-11');

    if (Math.abs(earlyMorning.getTimezoneOffset()) >= 60) {
      const utcDiffers = [earlyMorning, lateEvening].some(
        (date) => localDateKey(date) !== date.toISOString().slice(0, 10),
      );
      expect(utcDiffers).toBe(true);
    }
  });
});
