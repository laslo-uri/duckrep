import { describe, expect, it } from 'vitest';
import { exerciseDisplayNames, resolveExerciseLocale } from '../utils/exerciseDisplay';
import type { ExerciseDefinition } from '../types';

const sample: ExerciseDefinition = {
  id: '1',
  user_id: null,
  name: 'Bench Press',
  name_sr: 'Bench potisak',
  name_hu: 'Fekvenyomás',
  description: null,
  image_url: null,
  muscle_group: 'chest',
  source_slug: 'bench-press',
  is_global: true,
  default_sets: null,
  created_at: '',
  updated_at: '',
};

describe('resolveExerciseLocale', () => {
  it('maps language codes', () => {
    expect(resolveExerciseLocale('sr')).toBe('sr');
    expect(resolveExerciseLocale('hu-HU')).toBe('hu');
    expect(resolveExerciseLocale('en-US')).toBe('en');
  });
});

describe('exerciseDisplayNames', () => {
  it('prefers Serbian with English alt', () => {
    const { primary, alt } = exerciseDisplayNames(sample, 'sr');
    expect(primary).toBe('Bench potisak');
    expect(alt).toContain('Bench Press');
  });

  it('falls back to English when Hungarian missing', () => {
    const ex = { ...sample, name_hu: null };
    const { primary } = exerciseDisplayNames(ex, 'hu');
    expect(primary).toBe('Bench Press');
  });

  it('shows Hungarian when available', () => {
    const { primary, alt } = exerciseDisplayNames(sample, 'hu');
    expect(primary).toBe('Fekvenyomás');
    expect(alt).toBe('Bench Press');
  });

  it('shows no second name in English and searches all three', () => {
    const { alt, search } = exerciseDisplayNames(sample, 'en');
    expect(alt).toBe('');
    expect(search).toContain('fekvenyomás');
    expect(search).toContain('bench potisak');
  });
});
