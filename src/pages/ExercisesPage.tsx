import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { ExerciseDefinition } from '../types';

const MUSCLE_GROUPS = ['chest', 'shoulders', 'triceps', 'back', 'biceps', 'legs', 'abs', 'other'] as const;

function exerciseDisplayNames(ex: ExerciseDefinition, localeIsSr: boolean) {
  const en = ex.name.trim();
  const sr = ex.name_sr?.trim() ?? '';
  if (localeIsSr) {
    const primary = sr || en;
    const alt = primary && en && en !== primary ? en : '';
    return { primary, alt };
  }
  const primary = en;
  const alt = sr && sr !== primary ? sr : '';
  return { primary, alt };
}

export function ExercisesPage() {
  const { t, i18n } = useTranslation();
  const localeIsSr = (i18n.resolvedLanguage ?? i18n.language ?? 'en')
    .toLowerCase()
    .startsWith('sr');
  const { user } = useAuth();

  const { data: exercises = [], isLoading } = useQuery({
    queryKey: ['exercises', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('exercise_definitions')
        .select('*')
        .or(`user_id.eq.${user!.id},is_global.eq.true`);
      if (error) throw error;
      return data as ExerciseDefinition[];
    },
    enabled: !!user?.id,
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

      {isLoading ? (
        <p className="text-[var(--color-muted)]">{t('loading')}</p>
      ) : exercises.length === 0 ? (
        <div className="text-center py-12 sm:py-16 px-4 border border-dashed border-[var(--color-border)] rounded-2xl">
          <p className="text-[var(--color-muted)]">{t('noExercisesLibrary')}</p>
        </div>
      ) : (
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
                    const { primary, alt } = exerciseDisplayNames(ex, localeIsSr);
                    return (
                    <li
                      key={ex.id}
                      className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] flex items-center gap-3 sm:gap-4 min-h-[44px]"
                    >
                      {ex.image_url && (
                        <img
                          src={ex.image_url}
                          alt=""
                          className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg object-cover bg-[var(--color-hover)] flex-shrink-0"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-[var(--color-ink)]">{primary}</p>
                        {alt ? (
                          <p className="text-sm text-[var(--color-muted)]">{alt}</p>
                        ) : null}
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
      )}
    </div>
  );
}
