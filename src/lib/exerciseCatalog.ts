import { EQUIPMENT, matchesMuscles, type BodyMuscle, type ExerciseAnatomy, type ExerciseType } from './bodyMap';
import type { ExerciseUsage } from './exerciseUsage';
import type { ExerciseDefinition } from '../types';

export type CatalogEntry = {
  ex: ExerciseDefinition;
  anatomy: ExerciseAnatomy;
  names: { primary: string; alt: string; search: string };
  usage: ExerciseUsage | null;
};

export type CatalogFilters = {
  search: string;
  muscles: ReadonlySet<BodyMuscle>;
  equipment: string;
  /** Empty = every type. Ignored while searching: a search looks everywhere. */
  types: ReadonlySet<ExerciseType>;
  /** The whole library A–Z, from the "All exercises" button. */
  all: boolean;
};

export type CatalogItem =
  | { kind: 'header'; key: string; section: Section; count: number }
  | { kind: 'row'; key: string; entry: CatalogEntry };

/** What a header names: one of the home tiers, a muscle, or an equipment. */
export type Section =
  | { tier: 'yours' | 'essentials' | 'more' | 'all' }
  | { muscle: BodyMuscle | null }
  | { equipment: string | null };

/** Gym order for the essentials (push, pull, legs, core), not head to toe. */
export const GYM_ORDER: BodyMuscle[] = [
  'chest', 'shoulders', 'triceps', 'lats', 'midBack', 'lowerBack', 'traps', 'biceps', 'forearms',
  'quads', 'hamstrings', 'glutes', 'calves', 'adductors', 'abductors', 'abs', 'neck',
];

/** How many of your own exercises the home view lists before "more". */
export const YOURS_LIMIT = 12;

export function isBrowsing(filters: CatalogFilters): boolean {
  return filters.all || filters.search.trim().length > 0 || filters.muscles.size > 0 || filters.equipment !== '';
}

const byName = (a: CatalogEntry, b: CatalogEntry) => a.names.primary.localeCompare(b.names.primary);

/** Yours (most sessions, then most recent) → essentials → the rest, each A–Z within. */
function rank(a: CatalogEntry, b: CatalogEntry): number {
  if (a.usage && b.usage) return b.usage.sessions - a.usage.sessions || b.usage.lastDate.localeCompare(a.usage.lastDate);
  if (a.usage || b.usage) return a.usage ? -1 : 1;
  if (a.anatomy.essential !== b.anatomy.essential) return a.anatomy.essential ? -1 : 1;
  return byName(a, b);
}

function push(items: CatalogItem[], key: string, section: Section, rows: CatalogEntry[]) {
  if (rows.length === 0) return;
  items.push({ kind: 'header', key: `h:${key}`, section, count: rows.length });
  for (const entry of rows) items.push({ kind: 'row', key: `${key}:${entry.ex.id}`, entry });
}

/**
 * Turns the library into what the Exercises page and the activity picker show:
 * - nothing typed or picked: your exercises, then the essentials by muscle (never all 917 A–Z);
 * - a search: everything that matches, tiered yours / essentials / more;
 * - muscles picked: grouped by equipment; only equipment picked: grouped by muscle;
 * - "All exercises": the whole library (types still apply), A–Z.
 */
export function buildCatalog(entries: CatalogEntry[], filters: CatalogFilters, yoursExpanded = false): CatalogItem[] {
  const items: CatalogItem[] = [];
  const term = filters.search.trim().toLowerCase();

  if (!isBrowsing(filters)) {
    const yours = entries.filter((entry) => entry.usage).sort(rank);
    push(items, 'yours', { tier: 'yours' }, yoursExpanded ? yours : yours.slice(0, YOURS_LIMIT));
    const shown = new Set(yours.map((entry) => entry.ex.id));
    const essentials = entries.filter((entry) => entry.anatomy.essential && !shown.has(entry.ex.id));
    for (const muscle of GYM_ORDER) {
      push(items, `e:${muscle}`, { muscle }, essentials.filter((entry) => entry.anatomy.muscle === muscle).sort(byName));
    }
    push(items, 'e:other', { muscle: null }, essentials.filter((entry) => !entry.anatomy.muscle).sort(byName));
    return items;
  }

  const matches = entries.filter(({ ex, anatomy, names }) => {
    if (term) {
      if (!names.search.includes(term)) return false;
    } else if (filters.types.size > 0 && !filters.types.has(anatomy.type)) {
      return false;
    }
    if (filters.equipment && anatomy.equipment !== filters.equipment) return false;
    return matchesMuscles(anatomy, ex.muscle_group, filters.muscles);
  });

  if (term) {
    push(items, 'yours', { tier: 'yours' }, matches.filter((entry) => entry.usage).sort(rank));
    push(items, 'essentials', { tier: 'essentials' }, matches.filter((entry) => !entry.usage && entry.anatomy.essential).sort(byName));
    push(items, 'more', { tier: 'more' }, matches.filter((entry) => !entry.usage && !entry.anatomy.essential).sort(byName));
    return items;
  }
  if (filters.muscles.size > 0) {
    for (const equipment of [...EQUIPMENT, null]) {
      push(items, `q:${equipment}`, { equipment }, matches.filter((entry) => entry.anatomy.equipment === equipment).sort(rank));
    }
    return items;
  }
  if (filters.equipment) {
    for (const muscle of [...GYM_ORDER, null]) {
      push(items, `m:${muscle}`, { muscle }, matches.filter((entry) => entry.anatomy.muscle === muscle).sort(rank));
    }
    return items;
  }
  push(items, 'all', { tier: 'all' }, matches.sort(byName));
  return items;
}

/** Rows only, for counts and keyboard order. */
export function catalogRows(items: CatalogItem[]): CatalogEntry[] {
  return items.flatMap((item) => (item.kind === 'row' ? [item.entry] : []));
}
