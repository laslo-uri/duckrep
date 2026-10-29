import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronDown, X } from 'lucide-react';
import { usePageTitle } from '../hooks/usePageTitle';
import { useAddToToday } from '../hooks/useAddToToday';
import { useExerciseCatalog } from '../hooks/useExerciseCatalog';
import { useLocalUser } from '../contexts/LocalUserContext';
import { ExerciseBrowse } from '../components/ExerciseBrowse';
import { useMuscleWikiMeta } from '../hooks/useMuscleWikiMeta';
import { BodyMap } from '../components/BodyMap';
import { ExerciseDetail } from '../components/ExerciseDetail';
import { ExerciseList } from '../components/ExerciseList';
import { QueryState } from '../components/QueryState';
import { EmptyState } from '../components/EmptyState';
import { BODY_MUSCLES, EQUIPMENT, EXERCISE_TYPES, type BodyMuscle, type ExerciseType } from '../lib/bodyMap';
import { GYM_ORDER, YOURS_LIMIT, buildCatalog, catalogRows, isBrowsing, type CatalogFilters } from '../lib/exerciseCatalog';
import { PageBody, PageHeader } from '../components/Layout';

type Source = 'library' | 'musclewiki';

const DEFAULT_TYPES: ReadonlySet<ExerciseType> = new Set(['strength']);

function toggle<T>(set: ReadonlySet<T>, value: T): ReadonlySet<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

export function ExercisesPage() {
  const { t } = useTranslation();
  usePageTitle(t('exercises'));
  const { user } = useLocalUser();
  const [source, setSource] = useState<Source>('library');
  const [search, setSearch] = useState('');
  const [muscles, setMuscles] = useState<ReadonlySet<BodyMuscle>>(new Set());
  const [equipment, setEquipment] = useState('');
  const [types, setTypes] = useState<ReadonlySet<ExerciseType>>(DEFAULT_TYPES);
  const [all, setAll] = useState(false);
  const [yoursExpanded, setYoursExpanded] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const addToToday = useAddToToday(user.id);
  const catalog = useExerciseCatalog(user.id);
  const meta = useMuscleWikiMeta(source === 'musclewiki');

  const filters: CatalogFilters = { search, muscles, equipment, types, all };
  const browsing = isBrowsing(filters);
  const items = useMemo(
    () => buildCatalog(catalog.entries, { search, muscles, equipment, types, all }, yoursExpanded),
    [catalog.entries, search, muscles, equipment, types, all, yoursExpanded],
  );
  const shown = catalogRows(items).length;
  const yoursTotal = catalog.entries.filter((entry) => entry.usage).length;
  const selected = catalog.entries.find((entry) => entry.ex.id === selectedId) ?? null;

  // How many exercises each region would show with the other filters applied.
  const counts = useMemo(() => {
    if (source !== 'library') return undefined;
    const term = search.trim().toLowerCase();
    const out: Partial<Record<BodyMuscle, number>> = {};
    for (const { anatomy, names } of catalog.entries) {
      if (!anatomy.muscle) continue;
      if (term ? !names.search.includes(term) : types.size > 0 && !types.has(anatomy.type)) continue;
      if (equipment && anatomy.equipment !== equipment) continue;
      out[anatomy.muscle] = (out[anatomy.muscle] ?? 0) + 1;
    }
    return out;
  }, [catalog.entries, source, search, types, equipment]);

  const toggleMuscle = (muscle: BodyMuscle) => setMuscles((current) => toggle(current, muscle));
  const reset = () => {
    setSearch('');
    setMuscles(new Set());
    setEquipment('');
    setAll(false);
  };

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
          source === 'library' && catalog.total > 0
            ? t('libraryCount', { count: browsing ? shown : catalog.total })
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
            <div className="dr-card mx-auto max-w-[340px] p-2 lg:max-w-none">
              <BodyMap selected={muscles} counts={counts} onToggle={toggleMuscle} />
            </div>
          </div>
          {/* Narrow screens with the map folded: every muscle one tap away. */}
          {!mapOpen ? (
            <div
              className="mt-1 flex gap-1.5 overflow-x-auto pb-0.5 lg:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              role="group"
              aria-label={t('bodyMap')}
            >
              {GYM_ORDER.map((muscle) => (
                <Chip
                  key={muscle}
                  label={counts?.[muscle] != null ? `${t(`muscles.${muscle}`)} ${counts[muscle]}` : t(`muscles.${muscle}`)}
                  pressed={muscles.has(muscle)}
                  onClick={() => toggleMuscle(muscle)}
                />
              ))}
            </div>
          ) : null}
          {muscles.size > 0 ? (
            <div className="mt-2 hidden flex-wrap items-center gap-1.5 lg:flex">
              {BODY_MUSCLES.filter((muscle) => muscles.has(muscle)).map((muscle) => (
                <button key={muscle} type="button" onClick={() => toggleMuscle(muscle)} aria-pressed className="dr-chip dr-chip-tap gap-1">
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
            <ChipGroup label={t('equipmentLabel')} id="equipment-label">
              <Chip label={t('allEquipment')} pressed={equipment === ''} onClick={() => setEquipment('')} />
              {equipmentOptions.map((option) => (
                <Chip
                  key={option.name}
                  label={option.label}
                  pressed={equipment === option.name}
                  onClick={() => setEquipment(equipment === option.name ? '' : option.name)}
                />
              ))}
            </ChipGroup>
          ) : null}
          {source === 'library' ? (
            <ChipGroup label={t('typeLabel')} id="type-label">
              {EXERCISE_TYPES.map((type) => (
                <Chip key={type} label={t(`exerciseTypes.${type}`)} pressed={types.has(type)} onClick={() => setTypes((current) => toggle(current, type))} />
              ))}
            </ChipGroup>
          ) : null}
        </aside>

        <section className="mt-3 min-w-0 lg:mt-0" aria-label={t(source === 'library' ? 'sourceLibrary' : 'sourceMuscleWiki')}>
          <div className="flex items-center gap-2">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('searchExercises')}
              aria-label={t('searchExercises')}
              className="dr-input min-w-0 flex-1 md:max-w-sm"
            />
            {source === 'library' ? (
              browsing ? (
                <button type="button" onClick={reset} className="dr-btn dr-btn-ghost shrink-0">
                  {t('clearFilters')}
                </button>
              ) : (
                <button type="button" onClick={() => setAll(true)} className="dr-btn dr-btn-ghost shrink-0">
                  {t('allExercises', { count: catalog.total })}
                </button>
              )
            ) : null}
          </div>

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
            <ExerciseBrowse meta={meta} search={search} muscles={muscles} category={equipment} />
          ) : (
            <QueryState
              isLoading={catalog.isLoading}
              isError={catalog.isError}
              error={catalog.error}
              refetch={() => void catalog.refetch()}
              isEmpty={!catalog.isLoading && !catalog.isError && catalog.total === 0}
              empty={<EmptyState title={t('noExercisesLibrary')} />}
            >
              {selected ? (
                <ExerciseDetail
                  exercise={selected.ex}
                  anatomy={selected.anatomy}
                  locale={catalog.locale}
                  adding={addToToday.isPending}
                  onAdd={() => addToToday.mutate(selected.ex)}
                />
              ) : null}
              {!browsing && yoursTotal === 0 ? (
                <p className="mt-2 text-[12px] text-[var(--color-muted)]">{t('essentialsHint')}</p>
              ) : null}
              {shown === 0 ? (
                <p className="py-8 text-center text-sm text-[var(--color-muted)]">{t('noExerciseMatches')}</p>
              ) : (
                <ExerciseList
                  items={items}
                  mode="page"
                  selectedId={selectedId}
                  adding={addToToday.isPending}
                  onSelect={(entry) => setSelectedId(entry.ex.id === selectedId ? null : entry.ex.id)}
                  onAdd={(entry) => addToToday.mutate(entry.ex)}
                  className="mt-2 h-[calc(var(--app-dvh)-15rem)] rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] lg:h-[calc(var(--app-dvh)-9rem)]"
                  footer={
                    !browsing && yoursTotal > YOURS_LIMIT ? (
                      <button
                        type="button"
                        onClick={() => setYoursExpanded((open) => !open)}
                        className="dr-btn dr-btn-ghost m-2"
                      >
                        {yoursExpanded ? t('showFewerYours') : t('showAllYours', { count: yoursTotal })}
                      </button>
                    ) : null
                  }
                />
              )}
            </QueryState>
          )}
        </section>
      </PageBody>
    </>
  );
}

function ChipGroup({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div className="mt-3">
      <p className="dr-label" id={id}>{label}</p>
      <div
        className="mt-1.5 flex gap-1.5 overflow-x-auto pb-0.5 lg:flex-wrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="group"
        aria-labelledby={id}
      >
        {children}
      </div>
    </div>
  );
}

function Chip({ label, pressed, onClick }: { label: string; pressed: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={pressed} className="dr-chip dr-chip-tap shrink-0">
      {label}
    </button>
  );
}
