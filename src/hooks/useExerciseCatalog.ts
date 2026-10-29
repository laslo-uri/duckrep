import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { listExerciseUsage, listExercises } from '../lib/db';
import { anatomyOf } from '../lib/bodyMap';
import type { CatalogEntry } from '../lib/exerciseCatalog';
import { exerciseDisplayNames, resolveExerciseLocale } from '../utils/exerciseDisplay';

/** The library with muscle, equipment, type and your own history per exercise (Exercises page and picker). */
export function useExerciseCatalog(userId: string, enabled = true) {
  const { i18n } = useTranslation();
  const locale = resolveExerciseLocale(i18n.resolvedLanguage ?? i18n.language);

  const exercises = useQuery({
    queryKey: ['exercises', userId],
    queryFn: () => listExercises(userId),
    enabled,
  });
  // Muscle, equipment, type per seeded exercise (public-domain free-exercise-db), its own small chunk.
  const anatomy = useQuery({
    queryKey: ['exercise-anatomy'],
    queryFn: () => import('../lib/db/exerciseAnatomy.generated').then((m) => m.EXERCISE_ANATOMY),
    staleTime: Infinity,
    enabled,
  });
  const usage = useQuery({
    queryKey: ['exercise-usage', userId],
    queryFn: () => listExerciseUsage(userId),
    enabled,
  });

  const entries = useMemo<CatalogEntry[]>(() => {
    const table = anatomy.data ?? {};
    const history = usage.data ?? {};
    return (exercises.data ?? []).map((ex) => ({
      ex,
      anatomy: anatomyOf(ex, table),
      names: exerciseDisplayNames(ex, locale),
      usage: history[ex.id] ?? null,
    }));
  }, [exercises.data, anatomy.data, usage.data, locale]);

  return {
    entries,
    locale,
    total: exercises.data?.length ?? 0,
    isLoading: exercises.isLoading,
    isError: exercises.isError,
    error: exercises.error,
    refetch: exercises.refetch,
  };
}
