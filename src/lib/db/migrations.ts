/** SQL applied once when upgrading DBs created before the expanded exercise library. */
export const MIGRATION_V2_SQL = `
ALTER TABLE exercise_definitions ADD COLUMN source_slug TEXT;
ALTER TABLE exercise_definitions ADD COLUMN name_hu TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_exercise_definitions_source_slug
  ON exercise_definitions(source_slug) WHERE source_slug IS NOT NULL;
`;

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

  // v3: nutrition goals on user_stats (food tracking).
  const statCols = await client.select<{ name: string }>('PRAGMA table_info(user_stats)');
  const statNames = new Set(statCols.map((c) => c.name));
  for (const col of ['calorie_goal', 'protein_goal_g', 'carbs_goal_g', 'fat_goal_g']) {
    if (!statNames.has(col)) {
      await client.execute(`ALTER TABLE user_stats ADD COLUMN ${col} REAL`);
    }
  }
}
