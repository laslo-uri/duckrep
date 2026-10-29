import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Check, Plus } from 'lucide-react';
import type { CatalogEntry, CatalogItem, Section } from '../lib/exerciseCatalog';
import { todayIso } from '../lib/db';
import { isSafeHttpsImageUrl } from '../utils/exerciseDisplay';

function sectionLabel(section: Section, t: (key: string) => string): string {
  if ('tier' in section) {
    return t({ yours: 'sectionYours', essentials: 'sectionEssentials', more: 'sectionMore', all: 'sectionAll' }[section.tier]);
  }
  if ('muscle' in section) return section.muscle ? t(`muscles.${section.muscle}`) : t('muscleGroups.other');
  return section.equipment ? t(`equipment.${section.equipment}`) : t('equipmentUnknown');
}

/** "today", "3 days ago", "last month" in the app language. */
function sinceLabel(date: string, language: string): string {
  const days = Math.round((Date.parse(todayIso()) - Date.parse(date)) / 86_400_000);
  const format = new Intl.RelativeTimeFormat(language, { numeric: 'auto' });
  if (days < 7) return format.format(-days, 'day');
  if (days < 60) return format.format(-Math.round(days / 7), 'week');
  return format.format(-Math.round(days / 30), 'month');
}

/** Your last best set, else the equipment; other types than strength say so. */
function RowMeta({ entry }: { entry: CatalogEntry }) {
  const { t, i18n } = useTranslation();
  const { usage, anatomy } = entry;
  const parts: string[] = [];
  if (usage) {
    if (usage.lastWeight != null && usage.lastReps != null) parts.push(t('lastSet', { weight: usage.lastWeight, reps: usage.lastReps }));
    else if (usage.lastReps != null) parts.push(t('lastReps', { reps: usage.lastReps }));
    parts.push(sinceLabel(usage.lastDate, i18n.resolvedLanguage ?? i18n.language));
  } else if (anatomy.equipment) {
    parts.push(t(`equipment.${anatomy.equipment}`));
  }
  if (anatomy.type !== 'strength') parts.push(t(`exerciseTypes.${anatomy.type}`));
  if (parts.length === 0) return null;
  return <span className="hidden shrink-0 truncate text-[12px] tabular-nums text-[var(--color-muted)] sm:inline">{parts.join(' · ')}</span>;
}

/**
 * The grouped exercise list of the Exercises page ("select" opens the detail, + adds) and of the
 * activity picker (the whole row adds and stays open). Virtualized: a search can return hundreds.
 */
export function ExerciseList({
  items,
  mode,
  selectedId,
  addedIds,
  adding,
  onSelect,
  onAdd,
  className,
  footer,
}: {
  items: CatalogItem[];
  mode: 'page' | 'picker';
  selectedId?: string | null;
  addedIds?: ReadonlySet<string>;
  adding: boolean;
  onSelect?: (entry: CatalogEntry) => void;
  onAdd: (entry: CatalogEntry) => void;
  className: string;
  footer?: React.ReactNode;
}) {
  const { t } = useTranslation();
  const listRef = useRef<HTMLDivElement>(null);
  // Under the page's h1 the sections are h2; inside the picker dialog (its title is h2) they are h3.
  const Heading = mode === 'page' ? 'h2' : 'h3';
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => listRef.current,
    estimateSize: (index) => (items[index].kind === 'header' ? 32 : 44),
    getItemKey: (index) => items[index].key,
    overscan: 10,
  });

  return (
    <div ref={listRef} className={`overflow-y-auto ${className}`}>
      <div className="relative w-full" style={{ height: `${virtualizer.getTotalSize()}px` }}>
        {virtualizer.getVirtualItems().map((virtual) => {
          const item = items[virtual.index];
          const style = { transform: `translateY(${virtual.start}px)` };
          if (item.kind === 'header') {
            return (
              <div
                key={item.key}
                ref={virtualizer.measureElement}
                data-index={virtual.index}
                className="dr-group absolute left-0 top-0 w-full bg-[var(--color-panel)]"
                style={style}
              >
                <Heading className="text-[12px] font-medium text-[var(--color-ink)]">{sectionLabel(item.section, t)}</Heading>
                <span className="text-[11px] tabular-nums text-[var(--color-muted)]">{item.count}</span>
              </div>
            );
          }
          const { entry } = item;
          const { ex, anatomy, names } = entry;
          const image = isSafeHttpsImageUrl(ex.image_url) ? ex.image_url!.trim() : null;
          const active = selectedId === ex.id;
          const added = addedIds?.has(ex.id) ?? false;
          const body = (
            <>
              {image ? (
                <img src={image} alt="" loading="lazy" className="h-7 w-7 shrink-0 rounded-md bg-[var(--color-hover)] object-cover" />
              ) : (
                <span className="h-7 w-7 shrink-0 rounded-md bg-[var(--color-hover)]" aria-hidden />
              )}
              <span className="flex min-w-0 flex-1 items-baseline gap-2">
                <span className="truncate font-medium text-[var(--color-ink)]">{names.primary}</span>
                {names.alt ? <span className="hidden truncate text-[12px] text-[var(--color-faint)] md:inline">{names.alt}</span> : null}
              </span>
              <RowMeta entry={entry} />
              <span className="dr-chip h-5 shrink-0 px-1.5 text-[11px]">
                {anatomy.muscle ? t(`muscles.${anatomy.muscle}`) : t(`muscleGroups.${ex.muscle_group || 'other'}`)}
              </span>
            </>
          );
          return (
            <div
              key={item.key}
              ref={virtualizer.measureElement}
              data-index={virtual.index}
              className={`dr-row absolute left-0 top-0 w-full gap-0 px-0 ${active ? 'bg-[var(--color-accent-soft)] hover:bg-[var(--color-accent-soft)]' : ''}`}
              style={style}
            >
              {mode === 'page' ? (
                <>
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() => onSelect?.(entry)}
                    className="flex min-w-0 flex-1 items-center gap-3 self-stretch pl-3 text-left touch-manipulation"
                  >
                    {body}
                  </button>
                  <button
                    type="button"
                    onClick={() => onAdd(entry)}
                    disabled={adding}
                    className="dr-icon-btn dr-tap dr-tap-w mx-1 shrink-0"
                    aria-label={`${t('addToToday')}: ${names.primary}`}
                    title={t('addToToday')}
                  >
                    <Plus size={15} aria-hidden />
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => onAdd(entry)}
                  disabled={adding}
                  aria-label={`${t(added ? 'addAgain' : 'addExercise')}: ${names.primary}`}
                  className="flex min-w-0 flex-1 items-center gap-3 self-stretch px-3 text-left touch-manipulation"
                >
                  {body}
                  {added ? (
                    <Check size={15} className="shrink-0 text-[var(--color-success)]" aria-hidden />
                  ) : (
                    <Plus size={15} className="shrink-0 text-[var(--color-muted)]" aria-hidden />
                  )}
                </button>
              )}
            </div>
          );
        })}
      </div>
      {footer}
    </div>
  );
}
