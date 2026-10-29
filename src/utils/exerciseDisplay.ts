import type { ExerciseDefinition } from '../types';

export const MUSCLE_GROUPS = ['chest', 'shoulders', 'triceps', 'back', 'biceps', 'legs', 'abs', 'other'] as const;

export type ExerciseLocale = 'en' | 'sr' | 'hu';

export function resolveExerciseLocale(language: string | undefined): ExerciseLocale {
  const lang = (language ?? 'en').toLowerCase();
  if (lang.startsWith('sr')) return 'sr';
  if (lang.startsWith('hu')) return 'hu';
  return 'en';
}

export function exerciseDisplayNames(ex: ExerciseDefinition, locale: ExerciseLocale) {
  const en = ex.name.trim();
  const sr = ex.name_sr?.trim() ?? '';
  const hu = ex.name_hu?.trim() ?? '';

  let primary: string;
  if (locale === 'sr') primary = sr || en;
  else if (locale === 'hu') primary = hu || en;
  else primary = en;

  // Next to a Serbian or Hungarian name the gym's English one helps; the third language would be noise.
  const alt = primary !== en ? en : '';
  /** Every name, lowercased: search finds an exercise in any of the three languages. */
  const search = [...new Set([en, sr, hu].filter(Boolean))].join(' ').toLowerCase();
  return { primary, alt, search };
}

export function isSafeHttpsImageUrl(url: string | null | undefined): boolean {
  return typeof url === 'string' && /^https:\/\//i.test(url.trim());
}
