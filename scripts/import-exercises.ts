/**
 * Build-time import: fetches yuhonas/free-exercise-db, merges curated YouPeak
 * exercises, writes src/lib/db/seedExercises.generated.ts
 *
 * Run: npm run import-exercises
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CURATED_EXERCISES } from '../src/lib/db/seedExercises.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = join(__dirname, '../src/lib/db/seedExercises.generated.ts');

const DATASET_URL =
  'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json';
const IMAGE_BASE =
  'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/';

export interface SeedExercise {
  source_slug: string;
  name: string;
  name_sr: string | null;
  name_hu: string | null;
  muscle_group: string;
  description: string | null;
  image_url: string | null;
  default_sets: string | null;
}

interface SourceExercise {
  id: string;
  name: string;
  primaryMuscles?: string[];
  instructions?: string[];
  images?: string[];
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function slugifyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function sourceIdToSlug(id: string): string {
  return id.toLowerCase().replace(/_/g, '-');
}

function mapSourceMuscleToGroup(primaryMuscle: string | undefined | null): string {
  const map: Record<string, string> = {
    chest: 'chest',
    shoulders: 'shoulders',
    deltoids: 'shoulders',
    triceps: 'triceps',
    lats: 'back',
    'middle back': 'back',
    'lower back': 'back',
    traps: 'back',
    biceps: 'biceps',
    forearms: 'biceps',
    quadriceps: 'legs',
    hamstrings: 'legs',
    glutes: 'legs',
    calves: 'legs',
    abductors: 'legs',
    adductors: 'legs',
    abdominals: 'abs',
  };
  if (!primaryMuscle) return 'other';
  return map[primaryMuscle.trim().toLowerCase()] ?? 'other';
}

function buildDescription(instructions: string[] | undefined): string | null {
  if (!instructions?.length) return null;
  return instructions.slice(0, 3).join(' ');
}

function buildImageUrl(images: string[] | undefined): string | null {
  if (!images?.length) return null;
  return `${IMAGE_BASE}${images[0]}`;
}

function escapeTsString(value: string): string {
  return JSON.stringify(value);
}

function formatExercise(ex: SeedExercise): string {
  const parts = [
    `source_slug: ${escapeTsString(ex.source_slug)}`,
    `name: ${escapeTsString(ex.name)}`,
    `name_sr: ${ex.name_sr ? escapeTsString(ex.name_sr) : 'null'}`,
    `name_hu: null`,
    `muscle_group: ${escapeTsString(ex.muscle_group)}`,
    `description: ${ex.description ? escapeTsString(ex.description) : 'null'}`,
    `image_url: ${ex.image_url ? escapeTsString(ex.image_url) : 'null'}`,
    `default_sets: ${ex.default_sets ? escapeTsString(ex.default_sets) : 'null'}`,
  ];
  return `  { ${parts.join(', ')} }`;
}

async function main(): Promise<void> {
  const res = await fetch(DATASET_URL);
  if (!res.ok) throw new Error(`Failed to fetch dataset: ${res.status}`);
  const source = (await res.json()) as SourceExercise[];

  const curatedByNorm = new Map(
    CURATED_EXERCISES.map((ex) => [normalizeName(ex.name), ex]),
  );
  const curatedSlugs = new Set(
    CURATED_EXERCISES.map((ex) => slugifyName(ex.name)),
  );
  const usedSlugs = new Set<string>();
  const result: SeedExercise[] = [];

  for (const row of source) {
    const norm = normalizeName(row.name);
    const curated = curatedByNorm.get(norm);
    const sourceSlug = sourceIdToSlug(row.id);

    if (usedSlugs.has(sourceSlug)) continue;

    if (curated) {
      usedSlugs.add(sourceSlug);
      curatedSlugs.delete(slugifyName(curated.name));
      result.push({
        source_slug: sourceSlug,
        name: curated.name,
        name_sr: curated.name_sr,
        name_hu: null,
        muscle_group: curated.muscle_group,
        description: buildDescription(row.instructions),
        image_url: buildImageUrl(row.images),
        default_sets: curated.default_sets ?? null,
      });
      continue;
    }

    usedSlugs.add(sourceSlug);
    result.push({
      source_slug: sourceSlug,
      name: row.name,
      name_sr: null,
      name_hu: null,
      muscle_group: mapSourceMuscleToGroup(row.primaryMuscles?.[0]),
      description: buildDescription(row.instructions),
      image_url: buildImageUrl(row.images),
      default_sets: null,
    });
  }

  for (const curated of CURATED_EXERCISES) {
    const slug = slugifyName(curated.name);
    if (curatedSlugs.has(slug) && !usedSlugs.has(slug)) {
      usedSlugs.add(slug);
      result.unshift({
        source_slug: slug,
        name: curated.name,
        name_sr: curated.name_sr,
        name_hu: null,
        muscle_group: curated.muscle_group,
        description: null,
        image_url: null,
        default_sets: curated.default_sets ?? null,
      });
    }
  }

  result.sort((a, b) => a.name.localeCompare(b.name, 'en'));

  const body = result.map(formatExercise).join(',\n');
  const output = `/** Auto-generated by scripts/import-exercises.ts — do not edit manually. */
export interface GlobalSeedExercise {
  source_slug: string;
  name: string;
  name_sr: string | null;
  name_hu: string | null;
  muscle_group: string;
  description: string | null;
  image_url: string | null;
  default_sets: string | null;
}

export const GLOBAL_EXERCISES: GlobalSeedExercise[] = [
${body},
];
`;

  writeFileSync(OUT_PATH, output, 'utf8');
  console.log(`Wrote ${result.length} exercises to ${OUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
