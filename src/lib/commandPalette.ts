/** One line of the Ctrl+K palette. `keywords` add other words (other languages, synonyms) it answers to. */
export type PaletteItem = {
  id: string;
  group: PaletteGroup;
  label: string;
  hint?: string;
  shortcut?: string;
  keywords?: string;
  /** The same thing in the other languages (exercise names): an exact or leading match ranks like the label. */
  names?: string[];
  /** An exercise you have logged (the only ones listed before you type). */
  yours?: boolean;
  run: () => void;
};

export type PaletteGroup = 'actions' | 'activities' | 'exercises';

export const PALETTE_GROUPS: PaletteGroup[] = ['actions', 'exercises', 'activities'];

/** Per group, how much shows with nothing typed and with a query. */
const LIMITS: Record<PaletteGroup, { idle: number; query: number }> = {
  actions: { idle: 9, query: 6 },
  exercises: { idle: 5, query: 8 },
  activities: { idle: 3, query: 5 },
};

/** Lowercase without diacritics, so "cucanj" finds "Čučanj" and "fekvenyomas" finds "Fekvenyomás". */
export function fold(text: string): string {
  return text
    .toLowerCase()
    .replace(/đ/g, 'd')
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

/**
 * 0 = a name is exactly it or the label starts with it, 1 = another name or a word of the label starts with it,
 * 2 = anywhere in label or keywords; null = no match.
 */
function score(item: PaletteItem, query: string): number | null {
  const label = fold(item.label);
  const names = (item.names ?? []).map(fold);
  if (label === query || names.includes(query) || label.startsWith(query)) return 0;
  if (names.some((name) => name.startsWith(query))) return 1;
  if (label.split(/[\s(/-]+/).some((word) => word.startsWith(query))) return 1;
  if (label.includes(query) || fold(item.keywords ?? '').includes(query)) return 2;
  return null;
}

/** What the palette lists, in group order; best matches first, then (exercises) the shorter name, then the given order. */
export function rankPalette(items: PaletteItem[], rawQuery: string): PaletteItem[] {
  const query = fold(rawQuery.trim());
  const out: PaletteItem[] = [];
  for (const group of PALETTE_GROUPS) {
    const inGroup = items.filter((item) => item.group === group);
    if (!query) {
      out.push(...inGroup.slice(0, LIMITS[group].idle));
      continue;
    }
    const scored = inGroup
      .map((item, index) => ({ item, index, score: score(item, query) }))
      .filter((row): row is { item: PaletteItem; index: number; score: number } => row.score !== null)
      .sort(
        (a, b) =>
          a.score - b.score ||
          (group === 'exercises' ? a.item.label.length - b.item.label.length : 0) ||
          a.index - b.index,
      );
    out.push(...scored.slice(0, LIMITS[group].query).map((row) => row.item));
  }
  return out;
}
