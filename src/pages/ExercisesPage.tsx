import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { listExercises } from '../lib/db';
import { useLocalUser } from '../contexts/LocalUserContext';
import { QueryState } from '../components/QueryState';
import { EmptyState } from '../components/EmptyState';
import { MUSCLE_GROUPS, exerciseDisplayNames, isSafeHttpsImageUrl, resolveExerciseLocale } from '../utils/exerciseDisplay';
import type { ExerciseDefinition } from '../types';

export function ExercisesPage() {
  const { t, i18n } = useTranslation();
  const exerciseLocale = resolveExerciseLocale(i18n.resolvedLanguage ?? i18n.language);
  const { user } = useLocalUser();

  const { data: exercises = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['exercises', user.id],
    queryFn: () => listExercises(user.id),
  });

  const byGroup = MUSCLE_GROUPS.reduce<Record<string, ExerciseDefinition[]>>((acc, g) => {
    acc[g] = exercises.filter((e) => (e.muscle_group || 'other') === g);
    return acc;
  }, {});

  return (
    <div>
      <h1 className="font-serif text-xl sm:text-2xl font-semibold text-[var(--color-ink)] tracking-tight mb-6 sm:mb-8">
        {t('exercises')}
      </h1>

      <QueryState
        isLoading={isLoading}
        isError={isError}
        error={error}
        refetch={() => void refetch()}
        isEmpty={!isLoading && !isError && exercises.length === 0}
        empty={<EmptyState title={t('noExercisesLibrary')} />}
      >
        <div className="space-y-8">
          {MUSCLE_GROUPS.map((group) => {
            const list = byGroup[group];
            if (!list?.length) return null;
            return (
              <div key={group}>
                <h2 className="text-sm font-medium text-[var(--color-muted)] uppercase tracking-wider mb-3">
                  {t(`muscleGroups.${group}`)}
                </h2>
                <ul className="space-y-2">
                  {list.map((ex) => {
                    const { primary, alt } = exerciseDisplayNames(ex, exerciseLocale);
                    const safeImage = isSafeHttpsImageUrl(ex.image_url) ? ex.image_url!.trim() : null;
                    return (
                      <li
                        key={ex.id}
                        className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] flex items-center gap-3 sm:gap-4 min-h-[44px]"
                      >
                        {safeImage && (
                          <img
                            src={safeImage}
                            alt={primary}
                            className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg object-cover bg-[var(--color-hover)] flex-shrink-0"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-[var(--color-ink)]">{primary}</p>
                          {alt ? <p className="text-sm text-[var(--color-muted)]">{alt}</p> : null}
                          {ex.description && (
                            <p className="text-sm text-[var(--color-muted)] mt-0.5 truncate">
                              {ex.description}
                            </p>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      </QueryState>
    </div>
  );
}
