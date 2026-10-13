import { describe, it, expect } from 'vitest';
import {
  calculateBMI,
  bmiCategory,
  ageFromBirthDate,
  countSessionsThisWeek,
  activityStreak,
  buildMondayWeeks,
} from './statsHelpers';

describe('calculateBMI', () => {
  it('computes BMI for valid height', () => {
    expect(calculateBMI(80, 180)).toBe(24.7);
  });

  it('returns 0 for invalid height', () => {
    expect(calculateBMI(80, 0)).toBe(0);
  });
});

describe('bmiCategory', () => {
  it('classifies ranges', () => {
    expect(bmiCategory(17)).toBe('underweight');
    expect(bmiCategory(22)).toBe('normal');
    expect(bmiCategory(27)).toBe('overweight');
    expect(bmiCategory(32)).toBe('obese');
  });
});

describe('ageFromBirthDate', () => {
  it('returns null for invalid input', () => {
    expect(ageFromBirthDate(null)).toBeNull();
    expect(ageFromBirthDate('bad')).toBeNull();
  });

  it('returns a non-negative age for a past birth date', () => {
    const age = ageFromBirthDate('1990-06-15');
    expect(age).not.toBeNull();
    expect(age!).toBeGreaterThanOrEqual(30);
  });
});

describe('journal summary', () => {
  const today = '2026-10-08';

  it('counts sessions in the current Monday week', () => {
    expect(
      countSessionsThisWeek(['2026-10-04', '2026-10-05', '2026-10-08', '2026-10-08'], today),
    ).toBe(3);
  });

  it('keeps a streak through yesterday when today is empty', () => {
    expect(activityStreak(['2026-10-06', '2026-10-07'], today)).toBe(2);
  });

  it('breaks the streak when the last session is older than yesterday', () => {
    expect(activityStreak(['2026-10-05', '2026-10-06'], today)).toBe(0);
  });

  it('aligns weeks to Monday', () => {
    const weeks = buildMondayWeeks(['2026-10-07', '2026-10-08']);
    expect(weeks).toEqual([[null, null, '2026-10-07', '2026-10-08', null, null, null]]);
  });
});
