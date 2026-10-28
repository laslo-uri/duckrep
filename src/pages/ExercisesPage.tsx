import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ChevronDown, Plus, X } from 'lucide-react';
import { usePageTitle } from '../hooks/usePageTitle';
import { useAddToToday } from '../hooks/useAddToToday';
import { listExercises } from '../lib/db';
import { useLocalUser } from '../contexts/LocalUserContext';
import { ExerciseBrowse } from '../components/ExerciseBrowse';
import { useMuscleWikiMeta } from '../hooks/useMuscleWikiMeta';
import { BodyMap } from '../components/BodyMap';
import { QueryState } from '../components/QueryState';
import { EmptyState } from '../components/EmptyState';
import { BODY_MUSCLES, EQUIPMENT, anatomyOf, matchesMuscles, type BodyMuscle } from '../lib/bodyMap';
import { exerciseDisplayNames, isSafeHttpsImageUrl, resolveExerciseLocale } from '../utils/exerciseDisplay';
import type { ExerciseDefinition } from '../types';
import { PageBody, PageHeader } from '../components/Layout';

const ROW_HEIGHT = 44;

type Source = 'library' | 'musclewiki';

export function ExercisesPage() {
  const { t, i18n } = useTranslation();
  usePageTitle(t('exercises'));
  const exerciseLocale = resolveExerciseLocale(i18n.resolvedLanguage ?? i18n.language);
  const { user } = useLocalUser();
  const [source, setSource] = useState<Source>('library');
  const [search, setSearch] = useState('');
  const [muscles, setMuscles] = useState<ReadonlySet<BodyMuscle>>(new Set());
  const [equipment, setEquipment] = useState('');
  const [mapOpen, setMapOpen] = useState(false);
  const addToToday = useAddToToday(user.id);

  const { data: exercises = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['exercises', user.id],
    queryFn: () => listExercises(user.id),
  });
  // Muscle + equipment per seeded exercise (public-domain free-exercise-db), its own small chunk.
  const { data: anatomyTable } = useQuery({
    queryKey: ['exercise-anatomy'],
    queryFn: () => import('../lib/db/exerciseAnatomy.generated').then((m) => m.EXERCISE_ANATOMY),
    staleTime: Infinity,
  });
  const meta = useMuscleWikiMeta(source === 'musclewiki');

  const rows = useMemo(() => {
    const table = anatomyTable ?? {};
    const q = search.trim().toLowerCase();
    return exercises
      .map((ex) => ({ ex, anatomy: anatomyOf(ex, table), names: exerciseDisplayNames(ex, exerciseLocale) }))
      .filter(({ anatomy, names }) => {
        if (equipment && anatomy.equipment !== equipment) return false;
        return !q || names.primary.toLowerCase().includes(q) || names.alt.toLowerCase().includes(q);
      })
      .sort((a, b) => a.ex.name.localeCompare(b.ex.name, 'en'));
  }, [exercises, anatomyTable, search, equipment, exerciseLocale]);

  const filtered = useMemo(
    () => rows.filter(({ ex, anatomy }) => matchesMuscles(anatomy, ex.muscle_group, muscles)),
    [rows, muscles],
  );

  // How many exercises each region would show with the other filters applied.
  const counts = useMemo(() => {
    if (source !== 'library') return undefined;
    const out: Partial<Record<BodyMuscle, number>> = {};
    for (const { anatomy } of rows) if (anatomy.muscle) out[anatomy.muscle] = (out[anatomy.muscle] ?? 0) + 1;
    return out;
  }, [rows, source]);

  const toggleMuscle = (muscle: BodyMuscle) =>
    setMuscles((current) => {
      const next = new Set(current);
      if (next.has(muscle)) next.delete(muscle);
      else next.add(muscle);
      return next;
    });

  const equipmentOptions =
    source === 'library'
      ? EQUIPMENT.map((name) => ({ name, label: t(`equipment.${name}`) }))
      : (meta.data?.categories ?? []);

  const switchSource = (next: Source) => {
    setSource(next);
    setEquipment('');
  };

  return (
    <>
      <PageHeader
        title={t('exercises')}
        meta={
          source === 'library' && !isLoading && !isError && exercises.length > 0
            ? t('libraryCount', { count: filtered.length })
            : undefined
        }
        actions={
          <div className="flex rounded-md border border-[var(--color-border)] p-0.5" role="group" aria-label={t('exercises')}>
            {(['library', 'musclewiki'] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={source === option}
                onClick={() => switchSource(option)}
                className={`dr-btn dr-btn-ghost h-6 border-0 px-2 text-[12px] max-md:h-9 ${
                  source === option ? '!bg-[var(--color-active)] !text-[var(--color-ink)]' : ''
                }`}
              >
                {t(option === 'library' ? 'sourceLibrary' : 'sourceMuscleWiki')}
              </button>
            ))}
          </div>
        }
      />
      <PageBody className="lg:grid lg:grid-cols-[272px_minmax(0,1fr)] lg:items-start lg:gap-6">
        <aside className="lg:sticky lg:top-[calc(var(--dr-header-h)+1rem)]" aria-label={t('bodyMap')}>
          <button
            type="button"
            aria-expanded={mapOpen}
            onClick={() => setMapOpen((open) => !open)}
            className="dr-btn dr-btn-ghost -ml-2 lg:hidden"
          >
            <ChevronDown size={14} aria-hidden className={mapOpen ? 'rotate-180' : ''} />
            {t('bodyMapShow')}
            {muscles.size > 0 ? <span className="text-[var(--color-accent)]">· {muscles.size}</span> : null}
          </button>
          <div className={`${mapOpen ? 'block' : 'hidden'} mt-2 lg:mt-0 lg:block`}>
            <div className="dr-card p-2 max-w-[340px] mx-auto lg:max-w-none">
              <BodyMap selected={muscles} counts={counts} onToggle={toggleMuscle} />
            </div>
          </div>
          {muscles.size > 0 ? (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {BODY_MUSCLES.filter((muscle) => muscles.has(muscle)).map((muscle) => (
                <button
                  key={muscle}
                  type="button"
                  onClick={() => toggleMuscle(muscle)}
                  aria-pressed
                  className="dr-chip dr-chip-tap gap-1"
                >
                  {t(`muscles.${muscle}`)}
                  <X size={12} aria-hidden />
                </button>
              ))}
              <button type="button" onClick={() => setMuscles(new Set())} className="dr-btn dr-btn-ghost h-6 px-2 text-[12px]">
                {t('clearMuscles')}
              </button>
            </div>
          ) : null}
          {equipmentOptions.length > 0 ? (
            <div className="mt-3">
              <p className="dr-label" id="equipment-label">{t('equipmentLabel')}</p>
              <div
                className="mt-1.5 flex gap-1.5 overflow-x-auto pb-0.5 lg:flex-wrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                role="group"
                aria-labelledby="equipment-label"
              >
                <Chip label={t('allEquipment')} pressed={equipment === ''} onClick={() => setEquipment('')} />
                {equipmentOptions.map((option) => (
                  <Chip
                    key={option.name}
                    label={option.label}
                    pressed={equipment === option.name}
                    onClick={() => setEquipment(equipment === option.name ? '' : option.name)}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </aside>

        <section className="mt-3 min-w-0 lg:mt-0" aria-label={t(source === 'library' ? 'sourceLibrary' : 'sourceMuscleWiki')}>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('searchExercises')}
            aria-label={t('searchExercises')}
            className="dr-input w-full md:max-w-sm"
          />

          {addToToday.data ? (
            <p role="status" className="mt-2 flex items-center gap-2 text-[12px] text-[var(--color-muted)]">
              <span className="truncate">
                <span className="font-medium text-[var(--color-ink)]">{addToToday.data.name}</span>{' '}
                {addToToday.data.created ? t('addedNewToday') : t('addedToToday', { title: t('todaysActivity') })}
              </span>
              <Link to={`/activity/${addToToday.data.workoutId}`} className="shrink-0 text-[var(--color-accent)] hover:underline">
                {t('openActivity')}
              </Link>
            </p>
          ) : null}
          {addToToday.isError ? (
            <p role="alert" className="mt-2 text-[12px] text-[var(--color-error)]">{t('actionFailed')}</p>
          ) : null}

          {source === 'musclewiki' ? (
            <ExerciseBrowse
              meta={meta}
              search={search}
              muscles={muscles}
              category={equipment}
            />
          ) : (
            <QueryState
              isLoading={isLoading}
              isError={isError}
              error={error}
              refetch={() => void refetch()}
              isEmpty={!isLoading && !isError && exercises.length === 0}
              empty={<EmptyState title={t('noExercisesLibrary')} />}
            >
              <LibraryList
                rows={filtered}
                locale={exerciseLocale}
                adding={addToToday.isPending}
                onAdd={(ex) => addToToday.mutate(ex)}
              />
            </QueryState>
          )}
        </section>
      </PageBody>
    </>
  );
}

function LibraryList({
  rows,
  locale,
  adding,
  onAdd,
}: {
  rows: { ex: ExerciseDefinition; anatomy: ReturnType<typeof anatomyOf>; names: { primary: string; alt: string } }[];
  locale: ReturnType<typeof resolveExerciseLocale>;
  adding: boolean;
  onAdd: (ex: ExerciseDefinition) => void;
}) {
  const { t } = useTranslation();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const selected = rows.find((row) => row.ex.id === selectedId)?.ex ?? null;

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
  });

  if (rows.length === 0) {
    return <p className="py-8 text-center text-sm text-[var(--color-muted)]">{t('noExerciseMatches')}</p>;
  }

  return (
    <>
      {selected ? <ExerciseDetail exercise={selected} locale={locale} adding={adding} onAdd={() => onAdd(selected)} /> : null}
      <div
        ref={listRef}
        className="mt-2 h-[calc(var(--app-dvh)-14rem)] overflow-y-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] lg:h-[calc(var(--app-dvh)-9rem)]"
      >
        <div className="relative w-full" style={{ height: `${virtualizer.getTotalSize()}px` }}>
          {virtualizer.getVirtualItems().map((item) => {
            const { ex, anatomy, names } = rows[item.index];
            const safeImage = isSafeHttpsImageUrl(ex.image_url) ? ex.image_url!.trim() : null;
            const active = selectedId === ex.id;
            return (
              <div
                key={ex.id}
                className={`absolute left-0 top-0 flex w-full items-center border-b border-[var(--color-border)] hover:bg-[var(--color-hover)] ${
                  active ? 'bg-[var(--color-accent-soft)] hover:bg-[var(--color-accent-soft)]' : ''
                }`}
                style={{ height: `${item.size}px`, transform: `translateY(${item.start}px)` }}
              >
                <button
                  type="button"
                  onClick={() => setSelectedId(active ? null : ex.id)}
                  aria-pressed={active}
                  className="flex h-full min-w-0 flex-1 items-center gap-3 pl-3 text-left touch-manipulation"
                >
                  {safeImage ? (
                    <img
                      src={safeImage}
                      alt=""
                      className="h-7 w-7 flex-shrink-0 rounded-md bg-[var(--color-hover)] object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="h-7 w-7 flex-shrink-0 rounded-md bg-[var(--color-hover)]" aria-hidden />
                  )}
                  <span className="flex min-w-0 flex-1 items-baseline gap-2">
                    <span className="truncate font-medium text-[var(--color-ink)]">{names.primary}</span>
                    {names.alt ? <span className="hidden truncate text-[12px] text-[var(--color-faint)] sm:inline">{names.alt}</span> : null}
                  </span>
                  {anatomy.equipment ? (
                    <span className="hidden shrink-0 text-[12px] text-[var(--color-faint)] md:inline">{t(`equipment.${anatomy.equipment}`)}</span>
                  ) : null}
                  <span className="dr-chip h-5 shrink-0 px-1.5 text-[11px]">
                    {anatomy.muscle ? t(`muscles.${anatomy.muscle}`) : t(`muscleGroups.${ex.muscle_group || 'other'}`)}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => onAdd(ex)}
                  disabled={adding}
                  className="dr-icon-btn dr-tap dr-tap-w mx-1 shrink-0"
                  aria-label={`${t('addToToday')}: ${names.primary}`}
                  title={t('addToToday')}
                >
                  <Plus size={15} aria-hidden />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

function Chip({ label, pressed, onClick }: { label: string; pressed: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={pressed} className="dr-chip dr-chip-tap shrink-0">
      {label}
    </button>
  );
}

function ExerciseDetail({
  exercise,
  locale,
  adding,
  onAdd,
}: {
  exercise: ExerciseDefinition;
  locale: ReturnType<typeof resolveExerciseLocale>;
  adding: boolean;
  onAdd: () => void;
}) {
  const { t } = useTranslation();
  const { primary, alt } = exerciseDisplayNames(exercise, locale);
  const safeImage = isSafeHttpsImageUrl(exercise.image_url) ? exercise.image_url!.trim() : null;
  const group = exercise.muscle_group || 'other';

  return (
    <article className="dr-card mt-2 flex gap-3 p-3">
      {safeImage ? (
        <img src={safeImage} alt="" className="h-16 w-16 shrink-0 rounded-md bg-[var(--color-hover)] object-cover" />
      ) : (
        <div className="h-16 w-16 shrink-0 rounded-md bg-[var(--color-hover)]" aria-hidden />
      )}
      <div className="min-w-0 flex-1">
        <h2 className="font-medium text-[var(--color-ink)]">{primary}</h2>
        {alt ? <p className="text-sm text-[var(--color-muted)]">{alt}</p> : null}
        <p className="dr-label mt-1">{t(`muscleGroups.${group}`)}</p>
        {exercise.description ? (
          <p className="mt-1.5 text-[12px] leading-relaxed text-[var(--color-muted)]">{exercise.description}</p>
        ) : null}
        <button type="button" onClick={onAdd} disabled={adding} className="dr-btn dr-btn-primary mt-2">
          <Plus size={14} aria-hidden />
          {t('addToToday')}
        </button>
      </div>
    </article>
  );
}
