import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { ExerciseDefinition } from '../types';

const MUSCLE_GROUPS = ['chest', 'shoulders', 'triceps', 'back', 'biceps', 'legs', 'abs', 'other'] as const;

function parseDefaultSets(raw: unknown): ExerciseDefinition['default_sets'] {
  if (!raw || !Array.isArray(raw)) return null;
  return raw as ExerciseDefinition['default_sets'];
}

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

export function ExerciseLibraryPicker({
  open,
  onClose,
  userId,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  userId: string;
  onPick: (def: ExerciseDefinition) => void;
}) {
  const { t, i18n } = useTranslation();
  const [filter, setFilter] = useState('');
  const localeIsSr = (i18n.resolvedLanguage ?? i18n.language ?? 'en').toLowerCase().startsWith('sr');

  const { data: exercises = [], isLoading } = useQuery({
    queryKey: ['exercises', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('exercise_definitions')
        .select('*')
        .or(`user_id.eq.${userId},is_global.eq.true`);
      if (error) throw error;
      return (data ?? []).map((row) => ({
        ...row,
        default_sets: parseDefaultSets(row.default_sets),
      })) as ExerciseDefinition[];
    },
    enabled: open && !!userId,
  });

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return exercises;
    return exercises.filter((ex) => {
      const { primary, alt } = exerciseDisplayNames(ex, localeIsSr);
      return primary.toLowerCase().includes(q) || alt.toLowerCase().includes(q);
    });
  }, [exercises, filter, localeIsSr]);

  const byGroup = useMemo(() => {
    return MUSCLE_GROUPS.reduce<Record<string, ExerciseDefinition[]>>((acc, g) => {
      acc[g] = filtered.filter((e) => (e.muscle_group || 'other') === g);
      return acc;
    }, {});
  }, [filtered]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="library-picker-title"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-lg max-h-[85dvh] sm:rounded-2xl bg-[var(--color-paper)] border-t sm:border border-[var(--color-border)] shadow-lg flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 p-4 border-b border-[var(--color-border)]">
          <h2 id="library-picker-title" className="font-serif text-lg font-semibold text-[var(--color-ink)]">
            {t('addFromLibrary')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2.5 rounded-lg hover:bg-[var(--color-hover)] text-[var(--color-muted)] touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label={t('cancel')}
          >
            <X size={22} />
          </button>
        </div>
        <div className="p-3 border-b border-[var(--color-border)]">
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={t('searchExercises')}
            className="w-full px-3 py-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-ink)]"
            autoFocus
          />
        </div>
        <div className="overflow-y-auto flex-1 p-3 pb-6">
          {isLoading ? (
            <p className="text-sm text-[var(--color-muted)] px-1">{t('loading')}</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-[var(--color-muted)] px-1">{t('noExercisesLibrary')}</p>
          ) : (
            <div className="space-y-6">
              {MUSCLE_GROUPS.map((group) => {
                const list = byGroup[group];
                if (!list?.length) return null;
                return (
                  <div key={group}>
                    <h3 className="text-xs font-medium text-[var(--color-muted)] uppercase tracking-wider mb-2 px-1">
                      {t(`muscleGroups.${group}`)}
                    </h3>
                    <ul className="space-y-1">
                      {list.map((ex) => {
                        const { primary, alt } = exerciseDisplayNames(ex, localeIsSr);
                        return (
                          <li key={ex.id}>
                            <button
                              type="button"
                              onClick={() => {
                                onPick(ex);
                                onClose();
                                setFilter('');
                              }}
                              className="w-full text-left px-3 py-3 rounded-xl border border-transparent hover:border-[var(--color-border)] hover:bg-[var(--color-hover)] transition-colors touch-manipulation"
                            >
                              <span className="font-medium text-[var(--color-ink)]">{primary}</span>
                              {alt ? (
                                <span className="block text-xs text-[var(--color-muted)] mt-0.5">{alt}</span>
                              ) : null}
                            </button>
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
      </div>
    </div>
  );
}
