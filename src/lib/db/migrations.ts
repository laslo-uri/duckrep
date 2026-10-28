export async function runMigrations(client: {
  select<T>(sql: string, params?: unknown[]): Promise<T[]>;
  execute(sql: string, params?: unknown[]): Promise<void>;
}): Promise<void> {
  const cols = await client.select<{ name: string }>('PRAGMA table_info(exercise_definitions)');
  const names = new Set(cols.map((c) => c.name));

  if (!names.has('source_slug')) {
    await client.execute('ALTER TABLE exercise_definitions ADD COLUMN source_slug TEXT');
  }
  if (!names.has('name_hu')) {
    await client.execute('ALTER TABLE exercise_definitions ADD COLUMN name_hu TEXT');
  }
  await client.execute(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_exercise_definitions_source_slug
     ON exercise_definitions(source_slug) WHERE source_slug IS NOT NULL`,
  );

  // v4 (Duckrep): the food log moved to Dovediet. Journals from YouPeak keep `food_entries` and the
  // nutrition goal columns on `user_stats` untouched (no DROP), so no data is lost; the app no longer
  // reads or writes them except for the journal export. New journals do not create them.
}
