import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { useLocalUser } from '../contexts/LocalUserContext';
import { useTheme } from '../contexts/ThemeContext';
import { useDialogA11y } from '../hooks/useDialogA11y';
import { useExerciseCatalog } from '../hooks/useExerciseCatalog';
import { useAddToToday } from '../hooks/useAddToToday';
import { listWorkoutDays, lockJournal } from '../lib/db';
import { appLocale } from '../lib/locale';
import { PALETTE_GROUPS, rankPalette, type PaletteGroup, type PaletteItem } from '../lib/commandPalette';

const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'sr', name: 'Srpski' },
  { code: 'hu', name: 'Magyar' },
] as const;

/**
 * Ctrl+K: jump anywhere, run an action, open an activity, or add an exercise to today's activity,
 * from any page (Linear's command menu). Mounted only while open.
 */
export function CommandPalette({ onClose, onNew }: { onClose: () => void; onNew: () => void }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user } = useLocalUser();
  const { theme, toggleTheme } = useTheme();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  useDialogA11y({ open: true, onClose, containerRef: dialogRef, initialFocusRef: inputRef });

  const catalog = useExerciseCatalog(user.id);
  const { data: days = [] } = useQuery({
    queryKey: ['workout-days', user.id],
    queryFn: () => listWorkoutDays(user.id),
  });
  const addToToday = useAddToToday(user.id);
  const locale = appLocale(i18n.language);

  const items = useMemo<PaletteItem[]>(() => {
    const go = (to: string) => () => {
      onClose();
      navigate(to);
    };
    const actions: PaletteItem[] = [
      { id: 'new', group: 'actions', label: t('newWorkout'), shortcut: 'C', keywords: 'new activity start workout session', run: () => (onClose(), onNew()) },
      { id: 'journal', group: 'actions', label: t('paletteGoTo', { page: t('myJournal') }), shortcut: 'G J', keywords: 'journal home', run: go('/journal') },
      { id: 'exercises', group: 'actions', label: t('paletteGoTo', { page: t('exercises') }), shortcut: 'G E', keywords: 'exercises library body map', run: go('/exercises') },
      { id: 'stats', group: 'actions', label: t('paletteGoTo', { page: t('yourStats') }), shortcut: 'G S', keywords: 'stats weight streak', run: go('/stats') },
      { id: 'settings', group: 'actions', label: t('paletteGoTo', { page: t('settings') }), shortcut: 'G ,', keywords: 'settings profile backup export', run: go('/settings') },
      {
        id: 'theme',
        group: 'actions',
        label: theme === 'dark' ? t('lightMode') : t('darkMode'),
        keywords: 'theme dark light mode',
        run: () => (onClose(), toggleTheme()),
      },
      ...LANGUAGES.filter((lang) => lang.code !== i18n.resolvedLanguage).map<PaletteItem>((lang) => ({
        id: `lang-${lang.code}`,
        group: 'actions',
        label: t('paletteLanguage', { lang: lang.name }),
        keywords: 'language jezik nyelv',
        run: () => (onClose(), void i18n.changeLanguage(lang.code)),
      })),
      { id: 'lock', group: 'actions', label: t('securityLockNow'), keywords: 'lock passphrase', run: () => void lockJournal() },
    ];

    // Most used first, so a short query lands on what you train.
    const ranked = [...catalog.entries].sort((a, b) => (b.usage?.sessions ?? 0) - (a.usage?.sessions ?? 0) || Number(b.anatomy.essential) - Number(a.anatomy.essential));
    const exercises = ranked.map<PaletteItem>(({ ex, names, anatomy, usage }) => ({
      id: `ex-${ex.id}`,
      group: 'exercises',
      label: names.primary,
      hint: [names.alt, anatomy.muscle ? t(`muscles.${anatomy.muscle}`) : '', usage ? t('paletteYours') : ''].filter(Boolean).join(' · '),
      keywords: names.search,
      names: [ex.name, ex.name_sr ?? '', ex.name_hu ?? ''].filter(Boolean),
      yours: Boolean(usage),
      run: () =>
        addToToday.mutate(ex, {
          onSuccess: ({ workoutId }) => {
            onClose();
            navigate(`/activity/${workoutId}`);
          },
        }),
    }));

    const activities = days.map<PaletteItem>((day) => {
      const date = new Date(`${day.date}T00:00:00`).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });
      return {
        id: `day-${day.id}`,
        group: 'activities',
        label: day.title || date,
        hint: day.title ? date : undefined,
        keywords: `${day.date} ${day.activity_type}`,
        run: go(`/activity/${day.id}`),
      };
    });
    return [...actions, ...exercises, ...activities];
  }, [t, i18n, theme, toggleTheme, navigate, onClose, onNew, catalog.entries, days, locale, addToToday]);

  // Nothing typed: only exercises you have logged (none yet = no exercise group at all).
  const results = useMemo(
    () => rankPalette(query.trim() ? items : items.filter((item) => item.group !== 'exercises' || item.yours), query),
    [items, query],
  );
  const active = Math.min(activeIndex, Math.max(results.length - 1, 0));

  const move = (delta: number) => {
    if (results.length === 0) return;
    const next = (active + delta + results.length) % results.length;
    setActiveIndex(next);
    listRef.current?.querySelector(`[data-index="${next}"]`)?.scrollIntoView({ block: 'nearest' });
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      move(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      move(-1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      results[active]?.run();
    }
  };

  const groupLabel: Record<PaletteGroup, string> = {
    actions: t('paletteActions'),
    exercises: query.trim() ? t('paletteAddExercise') : t('paletteYourExercises'),
    activities: t('recentActivities'),
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-start justify-center p-3 pt-[12vh] max-md:pt-3">
      <div className="absolute inset-0 bg-black/50" aria-hidden onClick={onClose} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('paletteTitle')}
        className="dr-enter relative flex max-h-[min(70dvh,560px)] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-pop)]"
      >
        <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-3">
          <Search size={15} className="shrink-0 text-[var(--color-faint)]" aria-hidden />
          <input
            ref={inputRef}
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-list"
            aria-autocomplete="list"
            aria-activedescendant={results[active] ? `palette-${results[active].id}` : undefined}
            aria-label={t('paletteTitle')}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={onKeyDown}
            placeholder={t('palettePlaceholder')}
            className="h-12 min-w-0 flex-1 bg-transparent text-[14px] text-[var(--color-ink)] outline-none placeholder:text-[var(--color-faint)] max-md:text-[16px]"
          />
          <kbd className="dr-kbd max-md:hidden">Esc</kbd>
        </div>

        <div ref={listRef} id="palette-list" role="listbox" aria-label={t('paletteTitle')} className="min-h-0 flex-1 overflow-y-auto p-1">
          {results.length === 0 ? (
            <p className="px-3 py-6 text-center text-[13px] text-[var(--color-muted)]">{t('paletteNothing')}</p>
          ) : (
            PALETTE_GROUPS.map((group) => {
              const rows = results.map((item, index) => ({ item, index })).filter(({ item }) => item.group === group);
              if (rows.length === 0) return null;
              return (
                <div key={group} role="group" aria-labelledby={`palette-group-${group}`}>
                  <div id={`palette-group-${group}`} role="presentation" className="px-2 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wide text-[var(--color-faint)]">
                    {groupLabel[group]}
                  </div>
                  {rows.map(({ item, index }) => (
                    <div
                      key={item.id}
                      id={`palette-${item.id}`}
                      role="option"
                      aria-selected={index === active}
                      data-index={index}
                      onMouseMove={() => index !== active && setActiveIndex(index)}
                      onClick={() => item.run()}
                      className={`flex h-9 cursor-pointer items-center gap-2 rounded-md px-2 text-[13px] max-md:h-11 ${
                        index === active ? 'bg-[var(--color-active)] text-[var(--color-ink)]' : 'text-[var(--color-ink)]'
                      }`}
                    >
                      <span className="min-w-0 truncate">{item.label}</span>
                      {item.hint ? <span className="min-w-0 truncate text-[12px] text-[var(--color-muted)]">{item.hint}</span> : null}
                      <span className="ml-auto flex shrink-0 items-center gap-1.5">
                        {item.group === 'exercises' && index === active ? (
                          <span className="text-[12px] text-[var(--color-muted)]">{addToToday.isPending ? t('loading') : t('addToToday')}</span>
                        ) : null}
                        {item.shortcut ? <kbd className="dr-kbd max-md:hidden">{item.shortcut}</kbd> : null}
                      </span>
                    </div>
                  ))}
                </div>
              );
            })
          )}
        </div>

        {addToToday.isError ? (
          <p role="alert" className="border-t border-[var(--color-border)] px-3 py-2 text-[12px] text-[var(--color-error)]">
            {t('actionFailed')}
          </p>
        ) : null}
        <div className="flex items-center gap-3 border-t border-[var(--color-border)] px-3 py-2 text-[11px] text-[var(--color-muted)] max-md:hidden">
          <span><kbd className="dr-kbd">↑</kbd> <kbd className="dr-kbd">↓</kbd> {t('paletteMove')}</span>
          <span><kbd className="dr-kbd">Enter</kbd> {t('paletteRun')}</span>
          <span className="ml-auto"><kbd className="dr-kbd">Ctrl</kbd> <kbd className="dr-kbd">K</kbd></span>
        </div>
      </div>
    </div>
  );
}
