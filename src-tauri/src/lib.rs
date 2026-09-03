#[path = "../../user-store/user_store.rs"]
mod user_store;

use tauri_plugin_sql::{Migration, MigrationKind};

const SCHEMA_MIGRATION: &str = r#"
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  display_name TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user_stats (
  user_id TEXT PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  birth_date TEXT,
  height_cm REAL,
  goal_weight_kg REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS body_weight_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  weight_kg REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, date)
);

CREATE TABLE IF NOT EXISTS workout_days (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  title TEXT,
  notes TEXT,
  icon TEXT,
  is_public INTEGER NOT NULL DEFAULT 0,
  started_at TEXT,
  ended_at TEXT,
  activity_type TEXT NOT NULL DEFAULT 'strength'
    CHECK (activity_type IN ('strength', 'cardio', 'mobility', 'other')),
  deleted_at TEXT,
  media TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS exercise_definitions (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_sr TEXT,
  name_hu TEXT,
  description TEXT,
  image_url TEXT,
  muscle_group TEXT,
  source_slug TEXT,
  is_global INTEGER NOT NULL DEFAULT 0,
  default_sets TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS workout_exercises (
  id TEXT PRIMARY KEY,
  workout_day_id TEXT NOT NULL REFERENCES workout_days(id) ON DELETE CASCADE,
  exercise_definition_id TEXT REFERENCES exercise_definitions(id) ON DELETE SET NULL,
  circuit_group_id TEXT,
  name TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  goals TEXT,
  notes TEXT,
  completed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS exercise_sets (
  id TEXT PRIMARY KEY,
  workout_exercise_id TEXT NOT NULL REFERENCES workout_exercises(id) ON DELETE CASCADE,
  set_number INTEGER NOT NULL,
  reps INTEGER,
  weight REAL,
  completed INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(workout_exercise_id, set_number)
);

CREATE INDEX IF NOT EXISTS idx_workout_days_user_date ON workout_days(user_id, date);
CREATE INDEX IF NOT EXISTS idx_body_weight_logs_user_date ON body_weight_logs(user_id, date);
CREATE INDEX IF NOT EXISTS idx_exercise_definitions_global ON exercise_definitions(is_global);
CREATE UNIQUE INDEX IF NOT EXISTS idx_exercise_definitions_source_slug
  ON exercise_definitions(source_slug) WHERE source_slug IS NOT NULL;
"#;

// v1 SCHEMA_MIGRATION already creates source_slug / name_hu.
// Keep v2 as a no-op so fresh installs that applied v1 do not fail on ADD COLUMN.
const MIGRATION_V2: &str = r#"
CREATE UNIQUE INDEX IF NOT EXISTS idx_exercise_definitions_source_slug
  ON exercise_definitions(source_slug) WHERE source_slug IS NOT NULL;
"#;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "initial youpeak schema",
            sql: SCHEMA_MIGRATION,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "exercise library source_slug and name_hu",
            sql: MIGRATION_V2,
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:youpeak.db", migrations)
                .build(),
        )
        .manage(user_store::new_state("com.youpeak.app", None))
        .invoke_handler(tauri::generate_handler![
            user_store::user_store_load,
            user_store::user_store_save,
        ])
        .run(tauri::generate_context!())
        .expect("error while running YouPeak");
}
