import { describe, expect, it } from 'vitest';
import { buildCatalog, catalogRows, YOURS_LIMIT, type CatalogEntry, type CatalogFilters } from './exerciseCatalog';
import type { BodyMuscle, ExerciseType } from './bodyMap';
import type { ExerciseDefinition } from '../types';

function entry(
  id: string,
  over: Partial<CatalogEntry['anatomy']> = {},
  usage: CatalogEntry['usage'] = null,
): CatalogEntry {
  const name = id.replace(/-/g, ' ');
  return {
    ex: { id, name, muscle_group: 'chest' } as ExerciseDefinition,
    anatomy: { muscle: 'chest', equipment: 'barbell', type: 'strength', level: null, essential: false, ...over },
    names: { primary: name, alt: '', search: name },
    usage,
  };
}

const filters = (over: Partial<CatalogFilters> = {}): CatalogFilters => ({
  search: '',
  muscles: new Set<BodyMuscle>(),
  equipment: '',
  types: new Set<ExerciseType>(['strength']),
  all: false,
  ...over,
});

const used = (sessions: number, lastDate = '2026-10-20') => ({ sessions, lastDate, lastWeight: 80, lastReps: 8 });

const library = [
  entry('bench-press', { essential: true }, used(3)),
  entry('squat', { muscle: 'quads', essential: true }),
  entry('lat-pulldown', { muscle: 'lats', equipment: 'cable', essential: true }, used(9)),
  entry('chest-stretch', { type: 'stretching', equipment: 'bodyweight' }),
  entry('svend-press', { equipment: 'other' }),
];

describe('buildCatalog', () => {
  it('opens on your exercises, then the essentials by muscle, never the whole library', () => {
    const items = buildCatalog(library, filters());
    expect(items.map((item) => item.key)).toEqual([
      'h:yours',
      'yours:lat-pulldown',
      'yours:bench-press',
      'h:e:quads',
      'e:quads:squat',
    ]);
  });

  it('caps your exercises until expanded', () => {
    const many = Array.from({ length: YOURS_LIMIT + 3 }, (_, i) => entry(`ex-${i}`, {}, used(i + 1)));
    expect(catalogRows(buildCatalog(many, filters()))).toHaveLength(YOURS_LIMIT);
    expect(catalogRows(buildCatalog(many, filters(), true))).toHaveLength(YOURS_LIMIT + 3);
  });

  it('searches every type, tiered yours / essentials / more', () => {
    const items = buildCatalog(library, filters({ search: 'stretch' }));
    expect(items.map((item) => item.key)).toEqual(['h:more', 'more:chest-stretch']);
    expect(catalogRows(buildCatalog(library, filters({ search: 'press' }))).map((e) => e.ex.id)).toEqual([
      'bench-press',
      'svend-press',
    ]);
  });

  it('groups a muscle by equipment and keeps the type filter', () => {
    const items = buildCatalog(library, filters({ muscles: new Set<BodyMuscle>(['chest']) }));
    expect(items.map((item) => item.key)).toEqual(['h:q:barbell', 'q:barbell:bench-press', 'h:q:other', 'q:other:svend-press']);
    const everyType = buildCatalog(library, filters({ muscles: new Set<BodyMuscle>(['chest']), types: new Set() }));
    expect(catalogRows(everyType).map((e) => e.ex.id)).toContain('chest-stretch');
  });

  it('groups an equipment by muscle', () => {
    const items = buildCatalog(library, filters({ equipment: 'cable' }));
    expect(items.map((item) => item.key)).toEqual(['h:m:lats', 'm:lats:lat-pulldown']);
  });

  it('lists everything A–Z on "All exercises"', () => {
    expect(catalogRows(buildCatalog(library, filters({ all: true }))).map((e) => e.ex.id)).toEqual([
      'bench-press',
      'lat-pulldown',
      'squat',
      'svend-press',
    ]);
  });
});
