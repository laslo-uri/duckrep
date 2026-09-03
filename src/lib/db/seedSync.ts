import type { DbClient } from './dbClient';
import { GLOBAL_EXERCISES, type GlobalSeedExercise } from './seedExercises.generated';
import { newId } from './utils';

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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

async function backfillSourceSlugs(client: DbClient): Promise<void> {
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
      description = COALESCE(description, ?),
      image_url = COALESCE(image_url, ?),
      default_sets = COALESCE(default_sets, ?),
      source_slug = COALESCE(source_slug, ?)
     WHERE is_global = 1 AND source_slug = ?
       AND (
         name_sr IS NULL OR description IS NULL OR image_url IS NULL
         OR default_sets IS NULL OR source_slug IS NULL
       )`,
    [ex.name_sr, ex.description, ex.image_url, ex.default_sets, ex.source_slug, ex.source_slug],
  );
}

/** Insert missing global exercises and backfill metadata on existing rows. */
export async function syncGlobalExercises(client: DbClient): Promise<void> {
  await backfillSourceSlugs(client);

  const existing = await client.select<{ source_slug: string | null }>(
    `SELECT source_slug FROM exercise_definitions WHERE is_global = 1 AND source_slug IS NOT NULL`,
  );
  const knownSlugs = new Set(
    existing.map((row) => row.source_slug).filter((slug): slug is string => !!slug),
  );

  const missing = GLOBAL_EXERCISES.filter((ex) => !knownSlugs.has(ex.source_slug));
  if (missing.length === 0) {
    const needsBackfill = await client.select<{ c: number }>(
      `SELECT COUNT(*) as c FROM exercise_definitions
       WHERE is_global = 1 AND (
         source_slug IS NULL OR description IS NULL OR image_url IS NULL
         OR name_sr IS NULL OR default_sets IS NULL
       )`,
    );
    if ((needsBackfill[0]?.c ?? 0) === 0) return;
  }

  for (const ex of GLOBAL_EXERCISES) {
    if (knownSlugs.has(ex.source_slug)) {
      await backfillMetadata(client, ex);
      continue;
    }
    await insertGlobalExercise(client, ex);
    knownSlugs.add(ex.source_slug);
  }
}

export async function seedGlobalExercisesIfEmpty(client: DbClient): Promise<void> {
  const globals = await client.select<{ c: number }>(
    'SELECT COUNT(*) as c FROM exercise_definitions WHERE is_global = 1',
  );
  if ((globals[0]?.c ?? 0) > 0) return;

  for (const ex of GLOBAL_EXERCISES) {
    await insertGlobalExercise(client, ex);
  }
}
