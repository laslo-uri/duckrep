# YouPeak — Supabase setup & connection checklist

## SQL files

| File | Purpose | When to run |
|------|---------|-------------|
| **reset.sql** | Drops all tables, trigger, and seeded auth users | Before a full rebuild |
| **schema.sql** | Section 0: idempotent upgrades from legacy template/journal DBs; then tables, RLS, analytics triggers, signup trigger | After reset, or on an existing project (back up first) |
| **seed.sql** | Dev users, global exercises, sample workouts (2026-03-11 + 2026-03-23) | After schema (local dev only) |
| **full_sql_script.sql** | All three in one file (reset + schema + seed) | One-shot in SQL Editor (dev); keep in sync with the three files above |

Run order (step-by-step): `reset.sql` → `schema.sql` → `seed.sql`

Or run **`full_sql_script.sql` once** for the same end state (local dev).

Upgrading an existing database (no full reset): run **`schema.sql`** in the SQL Editor after a backup. It starts with **section 0**, which removes `workout_templates` / `template_id`, drops `(user_id, date)` uniqueness on `workout_days`, adds session timestamps, `default_sets`, Part F columns (`activity_type`, soft delete, `media`, `circuit_group_id`), `user_daily_training_stats`, and reapplies policies/triggers below. It also migrates legacy `birth_year` → `birth_date` on `user_stats` when present.

## Frontend <-> database mapping

| App feature         | Tables used                                      | Status |
|---------------------|--------------------------------------------------|--------|
| My Journal          | workout_days, workout_exercises, exercise_sets     | done   |
| Your Stats          | user_stats, body_weight_logs, workout_days       | done   |
| Auth / profiles     | auth.users, profiles                             | done   |
| Public Feed         | workout_days, profiles (is_public)               | done   |
| Exercise Library    | exercise_definitions                             | done   |

## Environment variables

Set in `.env` (copy from `.env.example`):

```
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
```

Get these from Supabase Dashboard -> Project Settings -> API.

## Seeded dev users (from seed.sql)

| Email                         | Password |
|-------------------------------|----------|
| laslo-uri@youpeak.app         | laslo    |
| david-arsenijevic@youpeak.app | david    |
