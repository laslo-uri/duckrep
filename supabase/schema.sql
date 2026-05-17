-- YouPeak schema: tables, RLS, policies, triggers (journal + Part F analytics).
-- Run in Supabase SQL Editor. To wipe first: reset.sql → this file → seed.sql (dev only).
--
-- This file is idempotent on existing projects: legacy template-era DBs are upgraded
-- in section 0 before CREATE TABLE IF NOT EXISTS (no separate migration file).

-- =============================================================================
-- 0. Idempotent upgrades (templates removal, journal columns, Part F)
--     Skips automatically when objects are already current.
-- =============================================================================

-- 0a) Template-linked rows (skip if column already removed)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'workout_exercises' AND column_name = 'template_id'
  ) THEN
    DELETE FROM workout_exercises WHERE template_id IS NOT NULL;
  END IF;
END $$;

-- 0b) Drop policies on workout_templates (recreated never — table removed)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'workout_templates'
  ) THEN
    DROP POLICY IF EXISTS "Users CRUD own templates" ON workout_templates;
  END IF;
END $$;

-- 0c) Drop policies + strip template_id / add circuit_group_id on workout_exercises
DO $$
BEGIN
  IF to_regclass('public.workout_exercises') IS NOT NULL THEN
    DROP POLICY IF EXISTS "workout_exercises via template" ON workout_exercises;
    DROP POLICY IF EXISTS "Anyone can read workout_exercises for public days" ON workout_exercises;
    ALTER TABLE workout_exercises DROP CONSTRAINT IF EXISTS workout_exercises_workout_day_id_template_id_check;
    ALTER TABLE workout_exercises DROP CONSTRAINT IF EXISTS workout_exercises_template_id_fkey;
    ALTER TABLE workout_exercises DROP COLUMN IF EXISTS template_id;
    ALTER TABLE workout_exercises ADD COLUMN IF NOT EXISTS circuit_group_id UUID;
  END IF;
END $$;

-- 0d) Drop policies on exercise_sets (recreated in section 3)
DO $$
BEGIN
  IF to_regclass('public.exercise_sets') IS NOT NULL THEN
    DROP POLICY IF EXISTS "exercise_sets via exercise" ON exercise_sets;
    DROP POLICY IF EXISTS "Anyone can read sets for public workout exercises" ON exercise_sets;
  END IF;
END $$;

-- 0e) Drop public read policy on workout_days (recreated in section 3)
DO $$
BEGIN
  IF to_regclass('public.workout_days') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Anyone can read public workout_days" ON workout_days;
  END IF;
END $$;

-- 0f) Require workout_day_id when no orphan rows remain
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'workout_exercises'
  ) AND NOT EXISTS (SELECT 1 FROM workout_exercises WHERE workout_day_id IS NULL) THEN
    ALTER TABLE workout_exercises ALTER COLUMN workout_day_id SET NOT NULL;
  END IF;
END $$;

DROP TABLE IF EXISTS workout_templates CASCADE;

-- 0g) workout_days: multiple activities per day + session + Part F columns
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'workout_days'
  ) THEN
    ALTER TABLE workout_days DROP CONSTRAINT IF EXISTS workout_days_user_id_date_key;
    ALTER TABLE workout_days ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
    ALTER TABLE workout_days ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ;
    ALTER TABLE workout_days ADD COLUMN IF NOT EXISTS activity_type TEXT;
    ALTER TABLE workout_days ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
    ALTER TABLE workout_days ADD COLUMN IF NOT EXISTS media JSONB;
    UPDATE workout_days SET activity_type = 'strength' WHERE activity_type IS NULL;
    UPDATE workout_days SET media = '[]'::jsonb WHERE media IS NULL;
    ALTER TABLE workout_days ALTER COLUMN activity_type SET DEFAULT 'strength';
    ALTER TABLE workout_days ALTER COLUMN media SET DEFAULT '[]'::jsonb;
    ALTER TABLE workout_days ALTER COLUMN activity_type SET NOT NULL;
    ALTER TABLE workout_days ALTER COLUMN media SET NOT NULL;
    ALTER TABLE workout_days DROP CONSTRAINT IF EXISTS workout_days_activity_type_check;
    ALTER TABLE workout_days ADD CONSTRAINT workout_days_activity_type_check
      CHECK (activity_type IN ('strength', 'cardio', 'mobility', 'other'));
  END IF;
END $$;

-- 0h) Library default_sets (circuit_group_id handled in 0c)
DO $$
BEGIN
  IF to_regclass('public.exercise_definitions') IS NOT NULL THEN
    ALTER TABLE exercise_definitions ADD COLUMN IF NOT EXISTS default_sets JSONB;
  END IF;
END $$;

-- 0i) Analytics rollup table (policies + functions in sections 2–4)
CREATE TABLE IF NOT EXISTS user_daily_training_stats (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  activity_count INT NOT NULL DEFAULT 0,
  strength_count INT NOT NULL DEFAULT 0,
  cardio_count INT NOT NULL DEFAULT 0,
  completed_sets INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, date)
);

-- =============================================================================
-- 1. Tables
-- =============================================================================

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_stats (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  birth_date DATE,
  height_cm DECIMAL(5,2),
  goal_weight_kg DECIMAL(5,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Legacy: migrate birth_year → birth_date (existing DBs only; no-op on fresh installs)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_stats' AND column_name = 'birth_year'
  ) THEN
    ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS birth_date DATE;
    UPDATE user_stats SET birth_date = make_date(birth_year, 1, 1)
      WHERE birth_date IS NULL AND birth_year IS NOT NULL;
    ALTER TABLE user_stats DROP COLUMN birth_year;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS body_weight_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  weight_kg DECIMAL(5,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

CREATE TABLE IF NOT EXISTS workout_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  title TEXT,
  notes TEXT,
  icon TEXT,
  is_public BOOLEAN DEFAULT FALSE,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  activity_type TEXT NOT NULL DEFAULT 'strength'
    CHECK (activity_type IN ('strength', 'cardio', 'mobility', 'other')),
  deleted_at TIMESTAMPTZ,
  media JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS exercise_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_sr TEXT,
  description TEXT,
  image_url TEXT,
  muscle_group TEXT,
  is_global BOOLEAN DEFAULT FALSE,
  default_sets JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workout_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_day_id UUID NOT NULL REFERENCES workout_days(id) ON DELETE CASCADE,
  exercise_definition_id UUID REFERENCES exercise_definitions(id) ON DELETE SET NULL,
  circuit_group_id UUID,
  name TEXT NOT NULL,
  order_index INT DEFAULT 0,
  goals TEXT,
  notes TEXT,
  completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS exercise_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_exercise_id UUID NOT NULL REFERENCES workout_exercises(id) ON DELETE CASCADE,
  set_number INT NOT NULL,
  reps INT,
  weight DECIMAL(10,2),
  completed BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workout_exercise_id, set_number)
);

-- Pre-aggregated daily metrics (maintained by triggers; optional read-heavy stats UI)
CREATE TABLE IF NOT EXISTS user_daily_training_stats (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  activity_count INT NOT NULL DEFAULT 0,
  strength_count INT NOT NULL DEFAULT 0,
  cardio_count INT NOT NULL DEFAULT 0,
  completed_sets INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, date)
);

-- =============================================================================
-- 2. Row-Level Security
-- =============================================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE body_weight_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_daily_training_stats ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 3. Policies
-- =============================================================================

-- profiles
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Anyone can read profiles" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Anyone can read profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- user_stats
DROP POLICY IF EXISTS "Users CRUD own user_stats" ON user_stats;
CREATE POLICY "Users CRUD own user_stats" ON user_stats FOR ALL USING (auth.uid() = user_id);

-- body_weight_logs
DROP POLICY IF EXISTS "Users CRUD own body_weight_logs" ON body_weight_logs;
CREATE POLICY "Users CRUD own body_weight_logs" ON body_weight_logs FOR ALL USING (auth.uid() = user_id);

-- workout_days (own rows include soft-deleted; public only non-deleted)
DROP POLICY IF EXISTS "Users CRUD own workout_days" ON workout_days;
DROP POLICY IF EXISTS "Anyone can read public workout_days" ON workout_days;
CREATE POLICY "Users CRUD own workout_days" ON workout_days FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Anyone can read public workout_days" ON workout_days FOR SELECT
  USING (is_public = TRUE AND deleted_at IS NULL);

-- exercise_definitions (FOR ALL covers SELECT too; no separate read policy needed)
DROP POLICY IF EXISTS "Users CRUD own or global exercises" ON exercise_definitions;
DROP POLICY IF EXISTS "Users can read global exercises" ON exercise_definitions;
CREATE POLICY "Users CRUD own or global exercises" ON exercise_definitions FOR ALL
  USING (auth.uid() = user_id OR is_global = TRUE);

-- workout_exercises: access via parent workout_day
DROP POLICY IF EXISTS "workout_exercises via day" ON workout_exercises;
DROP POLICY IF EXISTS "workout_exercises via template" ON workout_exercises;
DROP POLICY IF EXISTS "Anyone can read workout_exercises for public days" ON workout_exercises;
CREATE POLICY "workout_exercises via day" ON workout_exercises FOR ALL
  USING (EXISTS (
    SELECT 1 FROM workout_days wd WHERE wd.id = workout_exercises.workout_day_id AND wd.user_id = auth.uid()
  ));
CREATE POLICY "Anyone can read workout_exercises for public days" ON workout_exercises FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM workout_days wd
    WHERE wd.id = workout_exercises.workout_day_id AND wd.is_public = TRUE AND wd.deleted_at IS NULL
  ));

-- exercise_sets: access via parent exercise chain
DROP POLICY IF EXISTS "exercise_sets via exercise" ON exercise_sets;
DROP POLICY IF EXISTS "Anyone can read sets for public workout exercises" ON exercise_sets;
CREATE POLICY "exercise_sets via exercise" ON exercise_sets FOR ALL
  USING (EXISTS (
    SELECT 1 FROM workout_exercises we
    JOIN workout_days wd ON we.workout_day_id = wd.id
    WHERE we.id = exercise_sets.workout_exercise_id
      AND wd.user_id = auth.uid()
  ));
CREATE POLICY "Anyone can read sets for public workout exercises" ON exercise_sets FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM workout_exercises we
    JOIN workout_days wd ON we.workout_day_id = wd.id
    WHERE we.id = exercise_sets.workout_exercise_id AND wd.is_public = TRUE AND wd.deleted_at IS NULL
  ));

-- user_daily_training_stats: read-only for users (rows written by triggers)
DROP POLICY IF EXISTS "Users read own daily training stats" ON user_daily_training_stats;
CREATE POLICY "Users read own daily training stats" ON user_daily_training_stats
  FOR SELECT USING (auth.uid() = user_id);

-- =============================================================================
-- 4. Daily analytics refresh (trigger-maintained)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.refresh_user_daily_training_stats(p_user_id UUID, p_date DATE)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
  v_strength INT;
  v_cardio INT;
  v_sets BIGINT;
BEGIN
  SELECT
    COUNT(*) FILTER (WHERE deleted_at IS NULL),
    COUNT(*) FILTER (WHERE deleted_at IS NULL AND activity_type = 'strength'),
    COUNT(*) FILTER (WHERE deleted_at IS NULL AND activity_type = 'cardio')
  INTO v_count, v_strength, v_cardio
  FROM workout_days
  WHERE user_id = p_user_id AND date = p_date;

  SELECT COUNT(*) INTO v_sets
  FROM exercise_sets es
  JOIN workout_exercises we ON es.workout_exercise_id = we.id
  JOIN workout_days wd ON we.workout_day_id = wd.id
  WHERE wd.user_id = p_user_id AND wd.date = p_date AND wd.deleted_at IS NULL AND es.completed = true;

  INSERT INTO user_daily_training_stats (user_id, date, activity_count, strength_count, cardio_count, completed_sets, updated_at)
  VALUES (
    p_user_id,
    p_date,
    COALESCE(v_count, 0),
    COALESCE(v_strength, 0),
    COALESCE(v_cardio, 0),
    LEAST(COALESCE(v_sets, 0), 2147483647)::INT,
    NOW()
  )
  ON CONFLICT (user_id, date) DO UPDATE SET
    activity_count = EXCLUDED.activity_count,
    strength_count = EXCLUDED.strength_count,
    cardio_count = EXCLUDED.cardio_count,
    completed_sets = EXCLUDED.completed_sets,
    updated_at = EXCLUDED.updated_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_workout_days_refresh_daily_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM refresh_user_daily_training_stats(OLD.user_id, OLD.date);
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF OLD.user_id IS DISTINCT FROM NEW.user_id OR OLD.date IS DISTINCT FROM NEW.date THEN
      PERFORM refresh_user_daily_training_stats(OLD.user_id, OLD.date);
    END IF;
    PERFORM refresh_user_daily_training_stats(NEW.user_id, NEW.date);
    RETURN NEW;
  END IF;
  PERFORM refresh_user_daily_training_stats(NEW.user_id, NEW.date);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_workout_days_refresh_daily_stats ON workout_days;
CREATE TRIGGER tr_workout_days_refresh_daily_stats
  AFTER INSERT OR UPDATE OF user_id, date, deleted_at, activity_type OR DELETE
  ON workout_days
  FOR EACH ROW EXECUTE FUNCTION public.fn_workout_days_refresh_daily_stats();

CREATE OR REPLACE FUNCTION public.fn_exercise_sets_refresh_daily_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID;
  d DATE;
  we_id UUID;
BEGIN
  we_id := COALESCE(NEW.workout_exercise_id, OLD.workout_exercise_id);
  SELECT wd.user_id, wd.date INTO uid, d
  FROM workout_exercises we
  JOIN workout_days wd ON we.workout_day_id = wd.id
  WHERE we.id = we_id;
  IF uid IS NOT NULL AND d IS NOT NULL THEN
    PERFORM refresh_user_daily_training_stats(uid, d);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS tr_exercise_sets_refresh_daily_stats ON exercise_sets;
CREATE TRIGGER tr_exercise_sets_refresh_daily_stats
  AFTER INSERT OR UPDATE OR DELETE
  ON exercise_sets
  FOR EACH ROW EXECUTE FUNCTION public.fn_exercise_sets_refresh_daily_stats();

-- =============================================================================
-- 5. Trigger: auto-create profile on signup
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
