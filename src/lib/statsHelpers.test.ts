import { describe, it, expect } from 'vitest';
import { calculateBMI, bmiCategory, ageFromBirthDate } from './statsHelpers';

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
