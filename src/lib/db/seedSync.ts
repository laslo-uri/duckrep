import type { DbClient } from './dbClient';
import type { GlobalSeedExercise } from './seedExercises.generated';
import { newId } from './utils';

/** The seed list is ~700 kB of source; load it as its own chunk instead of the main bundle. */
async function loadGlobalExercises(): Promise<GlobalSeedExercise[]> {
  return (await import('./seedExercises.generated')).GLOBAL_EXERCISES;
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const YIELD_EVERY = 25;

/** Let the browser paint and handle input between batches of writes. */
function yieldToMain(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

interface ExistingGlobalRow {
  source_slug: string | null;
  name_sr: string | null;
  name_hu: string | null;
  description: string | null;
  image_url: string | null;
  default_sets: string | null;
}

/** True when the seed has a value for a column that is still null on the row. */
function canBackfill(row: ExistingGlobalRow, ex: GlobalSeedExercise): boolean {
  return (
    (row.name_sr == null && ex.name_sr != null) ||
    (row.name_hu == null && ex.name_hu != null) ||
    (row.description == null && ex.description != null) ||
    (row.image_url == null && ex.image_url != null) ||
    (row.default_sets == null && ex.default_sets != null)
  );
}

async function insertGlobalExercise(client: DbClient, ex: GlobalSeedExercise): Promise<void> {
  await client.execute(
    `INSERT INTO exercise_definitions (
      id, name, name_sr, name_hu, description, image_url, muscle_group, source_slug, is_global, default_sets
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
    [
      newId(),
      ex.name,
      ex.name_sr,
      ex.name_hu,
      ex.description,
      ex.image_url,
      ex.muscle_group,
      ex.source_slug,
      ex.default_sets,
    ],
  );
}

async function backfillSourceSlugs(
  client: DbClient,
  GLOBAL_EXERCISES: GlobalSeedExercise[],
): Promise<void> {
  const byNorm = new Map(GLOBAL_EXERCISES.map((ex) => [normalizeName(ex.name), ex.source_slug]));
  const rows = await client.select<{ id: string; name: string }>(
    `SELECT id, name FROM exercise_definitions
     WHERE is_global = 1 AND (source_slug IS NULL OR source_slug = '')`,
  );

  for (const row of rows) {
    const slug = byNorm.get(normalizeName(row.name));
    if (!slug) continue;
    await client.execute('UPDATE exercise_definitions SET source_slug = ? WHERE id = ?', [
      slug,
      row.id,
    ]);
  }
}

async function backfillMetadata(client: DbClient, ex: GlobalSeedExercise): Promise<void> {
  await client.execute(
    `UPDATE exercise_definitions SET
      name_sr = COALESCE(name_sr, ?),
      name_hu = COALESCE(name_hu, ?),
      description = COALESCE(description, ?),
      image_url = COALESCE(image_url, ?),
      default_sets = COALESCE(default_sets, ?),
      source_slug = COALESCE(source_slug, ?)
     WHERE is_global = 1 AND source_slug = ?
       AND (
         name_sr IS NULL OR name_hu IS NULL OR description IS NULL OR image_url IS NULL
         OR default_sets IS NULL OR source_slug IS NULL
       )`,
    [ex.name_sr, ex.name_hu, ex.description, ex.image_url, ex.default_sets, ex.source_slug, ex.source_slug],
  );
}

/** Insert missing global exercises and backfill metadata on existing rows. */
export async function syncGlobalExercises(client: DbClient): Promise<void> {
  const GLOBAL_EXERCISES = await loadGlobalExercises();
  await backfillSourceSlugs(client, GLOBAL_EXERCISES);

  const existing = await client.select<ExistingGlobalRow>(
    `SELECT source_slug, name_sr, name_hu, description, image_url, default_sets
     FROM exercise_definitions WHERE is_global = 1 AND source_slug IS NOT NULL`,
  );
  const knownSlugs = new Set<string>();
  const fillableSlugs = new Set<string>();
  const seedBySlug = new Map(GLOBAL_EXERCISES.map((ex) => [ex.source_slug, ex]));
  for (const row of existing) {
    if (!row.source_slug) continue;
    knownSlugs.add(row.source_slug);
    const ex = seedBySlug.get(row.source_slug);
    if (ex && canBackfill(row, ex)) fillableSlugs.add(row.source_slug);
  }

  // Only touch rows that change: most seed entries have null fields, so a blanket
  // backfill would run ~900 UPDATEs on every start.
  let writes = 0;
  for (const ex of GLOBAL_EXERCISES) {
    if (knownSlugs.has(ex.source_slug)) {
      if (!fillableSlugs.has(ex.source_slug)) continue;
      await backfillMetadata(client, ex);
    } else {
      await insertGlobalExercise(client, ex);
      knownSlugs.add(ex.source_slug);
    }
    if (++writes % YIELD_EVERY === 0) await yieldToMain();
  }
}

export async function seedGlobalExercisesIfEmpty(client: DbClient): Promise<void> {
  const globals = await client.select<{ c: number }>(
    'SELECT COUNT(*) as c FROM exercise_definitions WHERE is_global = 1',
  );
  if ((globals[0]?.c ?? 0) > 0) return;

  const GLOBAL_EXERCISES = await loadGlobalExercises();
  for (const [i, ex] of GLOBAL_EXERCISES.entries()) {
    await insertGlobalExercise(client, ex);
    if ((i + 1) % YIELD_EVERY === 0) await yieldToMain();
  }
}
