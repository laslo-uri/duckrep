-- =============================================================================
-- YouPeak — full SQL script (reset + schema + seed in one run)
-- =============================================================================
--
-- What it does:
--   1. RESET — drops ALL app tables (every workout, set, log, profile
--      row, exercise_definitions row for ALL users), then removes the two
--      seeded dev auth accounts. This is destructive: you will NOT keep any
--      existing data unless you restore from a backup.
--   2. SCHEMA — creates tables, RLS, policies, profile-on-signup trigger
--   3. SEED — recreates dev users, global exercises, sample workouts ONLY for
--      laslo-uri@youpeak.app (LOCAL DEV ONLY)
--
-- How to use:
--   Paste into Supabase Dashboard → SQL Editor → Run (single transaction).
--   After a full run, only the seeded dev user gets sample workouts; any other
--   login will see an empty workout list until they create new workouts.
--
-- Production:
--   Do NOT run this whole file on a project where you care about data.
--   Prefer schema-only changes, or reset.sql + schema.sql without seed, or
--   Supabase migrations / backups.
--
-- Maintenance:
--   This file mirrors reset.sql + schema.sql + seed.sql (same order).
--   schema.sql begins with section 0 (legacy idempotent upgrades); keep PART 2 in sync.
--
-- =============================================================================


-- ##############################################################################
-- PART 1 — RESET (same as supabase/reset.sql)
-- ##############################################################################

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

DROP TABLE IF EXISTS user_daily_training_stats CASCADE;
DROP TABLE IF EXISTS exercise_sets CASCADE;
DROP TABLE IF EXISTS workout_exercises CASCADE;
DROP TABLE IF EXISTS workout_templates CASCADE;
DROP TABLE IF EXISTS workout_days CASCADE;
DROP TABLE IF EXISTS exercise_definitions CASCADE;
DROP TABLE IF EXISTS body_weight_logs CASCADE;
DROP TABLE IF EXISTS user_stats CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

DROP FUNCTION IF EXISTS public.fn_workout_days_refresh_daily_stats();
DROP FUNCTION IF EXISTS public.fn_exercise_sets_refresh_daily_stats();
DROP FUNCTION IF EXISTS public.refresh_user_daily_training_stats(UUID, DATE);

DELETE FROM auth.identities WHERE user_id IN (
  SELECT id FROM auth.users WHERE email IN ('laslo-uri@youpeak.app', 'david-arsenijevic@youpeak.app')
);
DELETE FROM auth.users WHERE email IN ('laslo-uri@youpeak.app', 'david-arsenijevic@youpeak.app');


-- ##############################################################################
-- PART 2 — SCHEMA (same as supabase/schema.sql, including section 0)
-- ##############################################################################

-- =============================================================================
-- 0. Idempotent upgrades (templates removal, journal columns, Part F)
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'workout_exercises' AND column_name = 'template_id'
  ) THEN
    DELETE FROM workout_exercises WHERE template_id IS NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'workout_templates'
  ) THEN
    DROP POLICY IF EXISTS "Users CRUD own templates" ON workout_templates;
  END IF;
END $$;

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

DO $$
BEGIN
  IF to_regclass('public.exercise_sets') IS NOT NULL THEN
    DROP POLICY IF EXISTS "exercise_sets via exercise" ON exercise_sets;
    DROP POLICY IF EXISTS "Anyone can read sets for public workout exercises" ON exercise_sets;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.workout_days') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Anyone can read public workout_days" ON workout_days;
  END IF;
END $$;

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

DO $$
BEGIN
  IF to_regclass('public.exercise_definitions') IS NOT NULL THEN
    ALTER TABLE exercise_definitions ADD COLUMN IF NOT EXISTS default_sets JSONB;
  END IF;
END $$;

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

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE body_weight_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_daily_training_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Anyone can read profiles" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Anyone can read profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users CRUD own user_stats" ON user_stats;
CREATE POLICY "Users CRUD own user_stats" ON user_stats FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users CRUD own body_weight_logs" ON body_weight_logs;
CREATE POLICY "Users CRUD own body_weight_logs" ON body_weight_logs FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users CRUD own workout_days" ON workout_days;
DROP POLICY IF EXISTS "Anyone can read public workout_days" ON workout_days;
CREATE POLICY "Users CRUD own workout_days" ON workout_days FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Anyone can read public workout_days" ON workout_days FOR SELECT
  USING (is_public = TRUE AND deleted_at IS NULL);

DROP POLICY IF EXISTS "Users CRUD own or global exercises" ON exercise_definitions;
DROP POLICY IF EXISTS "Users can read global exercises" ON exercise_definitions;
CREATE POLICY "Users CRUD own or global exercises" ON exercise_definitions FOR ALL
  USING (auth.uid() = user_id OR is_global = TRUE);

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

DROP POLICY IF EXISTS "Users read own daily training stats" ON user_daily_training_stats;
CREATE POLICY "Users read own daily training stats" ON user_daily_training_stats
  FOR SELECT USING (auth.uid() = user_id);

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


-- ##############################################################################
-- PART 3 — SEED (same as supabase/seed.sql) — LOCAL DEV ONLY
-- ##############################################################################

CREATE EXTENSION IF NOT EXISTS pgcrypto;

UPDATE auth.users
SET confirmation_token = '', email_change = '', email_change_token_new = '', recovery_token = ''
WHERE confirmation_token IS NULL OR email_change IS NULL OR email_change_token_new IS NULL OR recovery_token IS NULL;

DO $$
DECLARE
  v_id UUID;
BEGIN
  v_id := gen_random_uuid();
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
  VALUES (v_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'laslo-uri@youpeak.app', crypt('laslo', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}', '{}', NOW(), NOW(), '', '', '', '');
  INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, created_at, updated_at)
  VALUES (v_id, v_id, format('{"sub":"%s","email":"laslo-uri@youpeak.app"}', v_id)::jsonb, 'email', v_id::text, NOW(), NOW());
EXCEPTION WHEN unique_violation THEN NULL;
END $$;

DO $$
DECLARE
  v_id UUID;
BEGIN
  v_id := gen_random_uuid();
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
  VALUES (v_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'david-arsenijevic@youpeak.app', crypt('david', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}', '{}', NOW(), NOW(), '', '', '', '');
  INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, created_at, updated_at)
  VALUES (v_id, v_id, format('{"sub":"%s","email":"david-arsenijevic@youpeak.app"}', v_id)::jsonb, 'email', v_id::text, NOW(), NOW());
EXCEPTION WHEN unique_violation THEN NULL;
END $$;

INSERT INTO public.profiles (id, display_name)
SELECT u.id, COALESCE(u.raw_user_meta_data->>'display_name', split_part(u.email, '@', 1))
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

INSERT INTO exercise_definitions (name, name_sr, muscle_group, is_global)
SELECT v.name, v.name_sr, v.muscle_group, TRUE
FROM (VALUES
  -- Chest
  ('Bench Press',                'Bench potisak',                   'chest'),
  ('Incline Bench Press',        'Kosi bench potisak',              'chest'),
  ('Chest Press (Machine)',      'Potisak za grudi (sprava)',       'chest'),
  ('Dumbbell Bench Press',       'Bench sa bučicama',               'chest'),
  ('Incline Dumbbell Press',     'Kosi potisak sa bučicama',        'chest'),
  ('Butterfly',                  'Butterfly',                       'chest'),
  ('Cable Crossover',            'Kablovski križ',                  'chest'),
  ('Dips (Chest)',               'Propadanja (grudi)',              'chest'),
  ('Push-ups',                   'Sklekovi',                        'chest'),

  -- Shoulders
  ('Shoulder Press (Machine)',   'Potisak za ramena (sprava)',      'shoulders'),
  ('Overhead Press',             'Vojni potisak',                   'shoulders'),
  ('Dumbbell Shoulder Press',    'Potisak sa bučicama (ramena)',    'shoulders'),
  ('Lateral Raise',              'Lateralna podizanja',             'shoulders'),
  ('Lateral Raise (Machine)',    'Lateralna podizanja (sprava)',    'shoulders'),
  ('Cable Lateral Raise',       'Lateralno podizanje na kablu',    'shoulders'),
  ('Front Raise',                'Frontalna podizanja',             'shoulders'),
  ('Rear Delt Fly',              'Zadnja ramena',                   'shoulders'),
  ('Face Pull',                  'Face pull',                       'shoulders'),
  ('Arnold Press',               'Arnold potisak',                  'shoulders'),
  ('Shrugs',                     'Sleganje ramenima',               'shoulders'),

  -- Triceps
  ('Triceps Pushdown',           'Triceps potisak na kablu',        'triceps'),
  ('Triceps Overhead Extension', 'Triceps iznad glave',             'triceps'),
  ('Skull Crushers',             'Skull crushers',                  'triceps'),
  ('Close Grip Bench Press',     'Uski bench potisak',              'triceps'),
  ('Triceps Dips',               'Propadanja (triceps)',            'triceps'),
  ('Triceps Kickback',           'Triceps kickback',                'triceps'),
  ('Seated Triceps Press',       'Triceps potisak u sedu (sprava)', 'triceps'),

  -- Back
  ('Lat Pulldown',               'Lat pulldown',                    'back'),
  ('Seated Row (Cable)',         'Veslanje u sedu (kabl)',          'back'),
  ('Seated Row (Machine)',       'Veslanje u sedu (sprava)',        'back'),
  ('Pull-ups',                   'Zgibovi',                         'back'),
  ('Chin-ups',                   'Zgibovi (potkvat)',               'back'),
  ('Barbell Row',                'Veslanje sa šipkom',              'back'),
  ('T-bar Row',                  'T-bar veslanje',                  'back'),
  ('Dumbbell Row',               'Veslanje sa bučicom',             'back'),
  ('Lower Back Extension',       'Hiperekstenzija',                 'back'),
  ('Deadlift',                   'Mrtvo dizanje',                   'back'),

  -- Biceps
  ('Dumbbell Curl',              'Pregib sa bučicama',              'biceps'),
  ('Hammer Curl',                'Hammer pregib',                   'biceps'),
  ('Barbell Curl',               'Pregib sa šipkom',                'biceps'),
  ('Preacher Curl',              'Preacher pregib',                 'biceps'),
  ('Concentration Curl',         'Koncentracioni pregib',           'biceps'),
  ('Cable Curl',                 'Pregib na kablu',                 'biceps'),
  ('Incline Dumbbell Curl',      'Kosi pregib sa bučicama',         'biceps'),

  -- Legs
  ('Squat',                      'Čučanj',                          'legs'),
  ('Leg Press',                  'Leg press',                       'legs'),
  ('Leg Extension',              'Prednja loža',                    'legs'),
  ('Leg Curl',                   'Zadnja loža',                     'legs'),
  ('Lunges',                     'Iskoraci',                        'legs'),
  ('Bulgarian Split Squat',      'Bugarski split čučanj',           'legs'),
  ('Romanian Deadlift',          'Rumunsko mrtvo dizanje',          'legs'),
  ('Calf Raise',                 'Podizanje na prste',              'legs'),
  ('Hip Thrust',                 'Hip potisak',                     'legs'),
  ('Hack Squat',                 'Hack čučanj',                     'legs'),
  ('Goblet Squat',               'Goblet čučanj',                   'legs'),

  -- Abs
  ('Crunches',                   'Trbušnjaci',                      'abs'),
  ('Plank',                      'Plank',                           'abs'),
  ('Hanging Leg Raise',          'Podizanje nogu u visu',           'abs'),
  ('Russian Twist',              'Ruski twist',                     'abs'),
  ('Cable Crunch',               'Trbušnjaci na kablu',             'abs'),
  ('Ab Wheel Rollout',           'Ab wheel',                        'abs')
) AS v(name, name_sr, muscle_group)
WHERE NOT EXISTS (
  SELECT 1 FROM exercise_definitions ed
  WHERE ed.name = v.name AND ed.is_global = TRUE
);

UPDATE exercise_definitions
SET default_sets = '[{"reps":12},{"reps":12},{"reps":12}]'::jsonb
WHERE is_global = TRUE
  AND name IN ('Bench Press', 'Squat', 'Lat Pulldown', 'Triceps Pushdown', 'Shoulder Press (Machine)');

DO $$
DECLARE
  v_user_id UUID;
  v_day_id UUID;
  v_height_cm DECIMAL(5,2);
  v_bmi DECIMAL(4,2);
  v_ex UUID;
  v_circuit UUID;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'laslo-uri@youpeak.app' LIMIT 1;
  IF v_user_id IS NULL THEN
    RAISE NOTICE 'User laslo-uri@youpeak.app not found — skipping sample workout.';
    RETURN;
  END IF;

  DELETE FROM workout_days WHERE user_id = v_user_id AND date = '2026-03-11';

  INSERT INTO workout_days (user_id, date, title)
  VALUES (v_user_id, '2026-03-11', 'Chest, Shoulders & Triceps')
  RETURNING id INTO v_day_id;

  INSERT INTO workout_exercises (workout_day_id, name, order_index, notes)
  VALUES (v_day_id, 'Drop set', 0, '3 sets x 2 reps')
  RETURNING id INTO v_ex;
  INSERT INTO exercise_sets (workout_exercise_id, set_number, reps, weight, completed) VALUES
    (v_ex, 1, 2, NULL, TRUE), (v_ex, 2, 2, NULL, TRUE), (v_ex, 3, 2, NULL, TRUE);

  INSERT INTO workout_exercises (workout_day_id, name, order_index)
  VALUES (v_day_id, 'Chest press', 1)
  RETURNING id INTO v_ex;
  INSERT INTO exercise_sets (workout_exercise_id, set_number, reps, weight, completed) VALUES
    (v_ex, 1, 12, 9, TRUE), (v_ex, 2, 12, 14, TRUE), (v_ex, 3, 12, 18, TRUE);

  INSERT INTO workout_exercises (workout_day_id, name, order_index, notes)
  VALUES (v_day_id, 'Bench with dumbbells', 2, 'Skip sometimes')
  RETURNING id INTO v_ex;
  INSERT INTO exercise_sets (workout_exercise_id, set_number, reps, weight, completed) VALUES
    (v_ex, 1, 12, 10, TRUE), (v_ex, 2, 12, 10, TRUE), (v_ex, 3, 12, 12.5, TRUE);

  INSERT INTO workout_exercises (workout_day_id, name, order_index)
  VALUES (v_day_id, 'Butterfly', 3)
  RETURNING id INTO v_ex;
  INSERT INTO exercise_sets (workout_exercise_id, set_number, reps, weight, completed) VALUES
    (v_ex, 1, 12, 9, TRUE), (v_ex, 2, 12, 14, TRUE), (v_ex, 3, 10, 18, TRUE);

  INSERT INTO workout_exercises (workout_day_id, name, order_index, notes)
  VALUES (v_day_id, 'Lateral raise', 4, 'Alternative: use lighter weight or skip')
  RETURNING id INTO v_ex;
  INSERT INTO exercise_sets (workout_exercise_id, set_number, reps, weight, completed) VALUES
    (v_ex, 1, 12, 3, TRUE), (v_ex, 2, 12, 4, TRUE), (v_ex, 3, 12, 5, TRUE);

  v_circuit := gen_random_uuid();
  INSERT INTO workout_exercises (workout_day_id, name, order_index, notes, circuit_group_id)
  VALUES (v_day_id, 'Shoulder press', 5, 'Machine 1. Or Henry Cavill raises as alternative.', v_circuit)
  RETURNING id INTO v_ex;
  INSERT INTO exercise_sets (workout_exercise_id, set_number, reps, weight, completed) VALUES
    (v_ex, 1, 12, 9, TRUE), (v_ex, 2, 12, 18, TRUE), (v_ex, 3, 12, 18, TRUE);

  INSERT INTO workout_exercises (workout_day_id, name, order_index, notes, circuit_group_id)
  VALUES (v_day_id, 'Henry Cavill raise', 6, 'Use when no shoulder press machine free, or as 3rd exercise', v_circuit)
  RETURNING id INTO v_ex;
  INSERT INTO exercise_sets (workout_exercise_id, set_number, reps, weight, completed) VALUES
    (v_ex, 1, 12, 5, TRUE), (v_ex, 2, 12, 6, TRUE), (v_ex, 3, 12, 7, TRUE);

  INSERT INTO workout_exercises (workout_day_id, name, order_index, notes)
  VALUES (v_day_id, 'Cable machine lateral', 7, 'Machine 2. Drop sets: 9-14-18-23, 14-18-23-27, 18-23-27-29.5')
  RETURNING id INTO v_ex;
  INSERT INTO exercise_sets (workout_exercise_id, set_number, reps, weight, completed, notes) VALUES
    (v_ex, 1, 12, 23, TRUE, '9-14-18-23 kg'),
    (v_ex, 2, 12, 27, TRUE, '14-18-23-27 kg'),
    (v_ex, 3, 12, 29.5, TRUE, '18-23-27-29.5 kg, barely');

  INSERT INTO workout_exercises (workout_day_id, name, order_index)
  VALUES (v_day_id, 'Triceps pushdown', 8)
  RETURNING id INTO v_ex;
  INSERT INTO exercise_sets (workout_exercise_id, set_number, reps, weight, completed) VALUES
    (v_ex, 1, 12, 4.5, TRUE), (v_ex, 2, 12, 9, TRUE), (v_ex, 3, 12, 13.5, TRUE);

  INSERT INTO workout_exercises (workout_day_id, name, order_index)
  VALUES (v_day_id, 'Triceps overhead extension', 9)
  RETURNING id INTO v_ex;
  INSERT INTO exercise_sets (workout_exercise_id, set_number, reps, weight, completed) VALUES
    (v_ex, 1, 12, 4.5, TRUE), (v_ex, 2, 12, 9, TRUE), (v_ex, 3, 12, 13.5, TRUE);

  INSERT INTO workout_exercises (workout_day_id, name, order_index, notes)
  VALUES (v_day_id, 'Skull crusher', 10, 'Skip first set second time around')
  RETURNING id INTO v_ex;
  INSERT INTO exercise_sets (workout_exercise_id, set_number, reps, weight, completed, notes) VALUES
    (v_ex, 1, 12, 5, TRUE, '4/5/5 drop'),
    (v_ex, 2, 12, 6, TRUE, '5/6/6 drop'),
    (v_ex, 3, 12, 7, TRUE, '6/7/7 drop');

  INSERT INTO workout_exercises (workout_day_id, name, order_index, notes)
  VALUES (v_day_id, 'Seated triceps push machine', 11, 'New machine, sitting and pushing')
  RETURNING id INTO v_ex;
  INSERT INTO exercise_sets (workout_exercise_id, set_number, reps, weight, completed) VALUES
    (v_ex, 1, 12, 14, TRUE), (v_ex, 2, 12, 18, TRUE), (v_ex, 3, 12, 23, TRUE);

  INSERT INTO user_stats (user_id, height_cm, updated_at)
  VALUES (v_user_id, 180, NOW())
  ON CONFLICT (user_id) DO UPDATE SET
    height_cm = COALESCE(user_stats.height_cm, 180),
    updated_at = NOW();

  SELECT COALESCE(height_cm, 180) INTO v_height_cm FROM user_stats WHERE user_id = v_user_id;

  DELETE FROM body_weight_logs WHERE user_id = v_user_id AND date = '2026-03-11';
  INSERT INTO body_weight_logs (user_id, date, weight_kg)
  VALUES (v_user_id, '2026-03-11', 98.55);

  v_bmi := ROUND((98.55 / POWER(v_height_cm / 100, 2))::numeric, 1);

  RAISE NOTICE 'Seed complete. Workout ID: %', v_day_id;
  RAISE NOTICE 'Body weight: 98.55 kg | Height: % cm | BMI: %', v_height_cm, v_bmi;
END $$;

-- Mar 12: Pull Day — Back & Biceps (laslo-uri)
DO $$
DECLARE
  v_user_id UUID;
  v_day_id UUID;
  v_height_cm DECIMAL(5,2);
  v_bmi DECIMAL(4,2);
  v_ex UUID;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'laslo-uri@youpeak.app' LIMIT 1;
  IF v_user_id IS NULL THEN
    RAISE NOTICE 'User laslo-uri@youpeak.app not found — skipping pull day workout.';
    RETURN;
  END IF;

  DELETE FROM workout_days WHERE user_id = v_user_id AND date = '2026-03-12';

  INSERT INTO workout_days (user_id, date, title)
  VALUES (v_user_id, '2026-03-12', 'Back & Biceps')
  RETURNING id INTO v_day_id;

  -- BACK ------------------------------------------------------------------

  INSERT INTO workout_exercises (workout_day_id, name, order_index)
  VALUES (v_day_id, 'Lat Pulldown', 0)
  RETURNING id INTO v_ex;
  INSERT INTO exercise_sets (workout_exercise_id, set_number, reps, weight, completed) VALUES
    (v_ex, 1, 12, 9, TRUE), (v_ex, 2, 12, 13, TRUE), (v_ex, 3, 12, 18, TRUE);

  INSERT INTO workout_exercises (workout_day_id, name, order_index, notes)
  VALUES (v_day_id, 'Seated Row', 1, 'Machine 2. Ruke ravno vraćanje')
  RETURNING id INTO v_ex;
  INSERT INTO exercise_sets (workout_exercise_id, set_number, reps, weight, completed) VALUES
    (v_ex, 1, 12, 9, TRUE), (v_ex, 2, 12, 14, TRUE), (v_ex, 3, 12, 18, TRUE);

  INSERT INTO workout_exercises (workout_day_id, name, order_index, notes)
  VALUES (v_day_id, 'Seated Row Machine', 2, 'Machine 3. Ne radi — no weights recorded')
  RETURNING id INTO v_ex;
  INSERT INTO exercise_sets (workout_exercise_id, set_number, reps, weight, completed, notes) VALUES
    (v_ex, 1, 12, NULL, FALSE, 'Machine broken'),
    (v_ex, 2, 12, NULL, FALSE, NULL),
    (v_ex, 3, 12, NULL, FALSE, NULL);

  INSERT INTO workout_exercises (workout_day_id, name, order_index, notes)
  VALUES (v_day_id, 'Pull-ups', 3, 'Assisted pull-up machine (weight = counterweight)')
  RETURNING id INTO v_ex;
  INSERT INTO exercise_sets (workout_exercise_id, set_number, reps, weight, completed, notes) VALUES
    (v_ex, 1, 12, 82, TRUE, NULL),
    (v_ex, 2, 6, 82, TRUE, NULL),
    (v_ex, 3, 6, 77, TRUE, 'love');

  INSERT INTO workout_exercises (workout_day_id, name, order_index, notes)
  VALUES (v_day_id, 'T-bar Row', 4, 'Nova kul sprava u The One')
  RETURNING id INTO v_ex;
  INSERT INTO exercise_sets (workout_exercise_id, set_number, reps, weight, completed) VALUES
    (v_ex, 1, 12, NULL, TRUE), (v_ex, 2, 12, NULL, TRUE), (v_ex, 3, 12, NULL, TRUE);

  INSERT INTO workout_exercises (workout_day_id, name, order_index, notes)
  VALUES (v_day_id, 'Lower Back Extension', 5, 'Trbušnjaci sa tegom hug')
  RETURNING id INTO v_ex;
  INSERT INTO exercise_sets (workout_exercise_id, set_number, reps, weight, completed) VALUES
    (v_ex, 1, 12, 6, TRUE), (v_ex, 2, 12, 12, TRUE), (v_ex, 3, 12, 5, TRUE);

  -- BICEPS ----------------------------------------------------------------

  INSERT INTO workout_exercises (workout_day_id, name, order_index, notes)
  VALUES (v_day_id, 'Bicep Curl', 6, 'Hammer curl — podižem sa strane')
  RETURNING id INTO v_ex;
  INSERT INTO exercise_sets (workout_exercise_id, set_number, reps, weight, completed) VALUES
    (v_ex, 1, 12, 3, TRUE), (v_ex, 2, 12, 4, TRUE), (v_ex, 3, 12, 5, TRUE);

  INSERT INTO workout_exercises (workout_day_id, name, order_index)
  VALUES (v_day_id, 'Bicep Rotation Curl', 7)
  RETURNING id INTO v_ex;
  INSERT INTO exercise_sets (workout_exercise_id, set_number, reps, weight, completed) VALUES
    (v_ex, 1, 12, 3, TRUE), (v_ex, 2, 12, 4, TRUE), (v_ex, 3, 12, 5, TRUE);

  -- BODY WEIGHT -----------------------------------------------------------

  DELETE FROM body_weight_logs WHERE user_id = v_user_id AND date = '2026-03-12';
  INSERT INTO body_weight_logs (user_id, date, weight_kg)
  VALUES (v_user_id, '2026-03-12', 99.5);

  SELECT COALESCE(height_cm, 180) INTO v_height_cm FROM user_stats WHERE user_id = v_user_id;
  v_bmi := ROUND((99.5 / POWER(v_height_cm / 100, 2))::numeric, 1);

  RAISE NOTICE 'Pull day seed complete. Workout ID: %', v_day_id;
  RAISE NOTICE 'Body weight: 99.5 kg | Height: % cm | BMI: %', v_height_cm, v_bmi;
END $$;

-- Mar 23: Chest & Shoulders (laslo-uri)
DO $$
DECLARE
  v_user_id UUID;
  v_day_id UUID;
  v_height_cm DECIMAL(5,2);
  v_bmi DECIMAL(4,2);
  v_ex UUID;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'laslo-uri@youpeak.app' LIMIT 1;
  IF v_user_id IS NULL THEN
    RAISE NOTICE 'User laslo-uri@youpeak.app not found — skipping Mar 23 workout.';
    RETURN;
  END IF;

  DELETE FROM workout_days WHERE user_id = v_user_id AND date = '2026-03-23';

  INSERT INTO workout_days (
    user_id, date, title, notes, activity_type, media, started_at, ended_at
  )
  VALUES (
    v_user_id,
    '2026-03-23',
    'Chest & Shoulders',
    'Cardio: 2 km (incline + fast walking), ~200 kcal',
    'strength',
    '[{"url":"https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/Example.svg/120px-Example.svg.png","caption":"Seed media demo"}]'::jsonb,
    '2026-03-23T09:00:00Z'::timestamptz,
    '2026-03-23T10:45:00Z'::timestamptz
  )
  RETURNING id INTO v_day_id;

  INSERT INTO workout_days (user_id, date, title, activity_type, started_at, ended_at)
  VALUES (
    v_user_id,
    '2026-03-23',
    'Treadmill / incline walk',
    'cardio',
    '2026-03-23T17:00:00Z'::timestamptz,
    '2026-03-23T17:28:00Z'::timestamptz
  );

  -- CHEST -----------------------------------------------------------------

  INSERT INTO workout_exercises (workout_day_id, name, order_index, notes)
  VALUES (v_day_id, 'Chest Press', 0, 'Brustpresse')
  RETURNING id INTO v_ex;
  INSERT INTO exercise_sets (workout_exercise_id, set_number, reps, weight, completed) VALUES
    (v_ex, 1, 12, 27, TRUE), (v_ex, 2, 12, 27, TRUE), (v_ex, 3, 12, 27, TRUE);

  INSERT INTO workout_exercises (workout_day_id, name, order_index)
  VALUES (v_day_id, 'Butterfly', 1)
  RETURNING id INTO v_ex;
  INSERT INTO exercise_sets (workout_exercise_id, set_number, reps, weight, completed) VALUES
    (v_ex, 1, 12, 23, TRUE), (v_ex, 2, 12, 23, TRUE), (v_ex, 3, 12, 23, TRUE);

  -- SHOULDERS -------------------------------------------------------------

  INSERT INTO workout_exercises (workout_day_id, name, order_index)
  VALUES (v_day_id, 'Shoulder Press', 2)
  RETURNING id INTO v_ex;
  INSERT INTO exercise_sets (workout_exercise_id, set_number, reps, weight, completed) VALUES
    (v_ex, 1, 12, 23, TRUE), (v_ex, 2, 12, 23, TRUE), (v_ex, 3, 12, 23, TRUE);

  INSERT INTO workout_exercises (workout_day_id, name, order_index, notes)
  VALUES (v_day_id, 'Lateral Raise', 3, 'Seithebemachine')
  RETURNING id INTO v_ex;
  INSERT INTO exercise_sets (workout_exercise_id, set_number, reps, weight, completed) VALUES
    (v_ex, 1, 12, 23, TRUE), (v_ex, 2, 10, 23, TRUE), (v_ex, 3, 9, 23, TRUE);

  -- BODY WEIGHT -----------------------------------------------------------

  DELETE FROM body_weight_logs WHERE user_id = v_user_id AND date = '2026-03-23';
  INSERT INTO body_weight_logs (user_id, date, weight_kg)
  VALUES (v_user_id, '2026-03-23', 100);

  SELECT COALESCE(height_cm, 180) INTO v_height_cm FROM user_stats WHERE user_id = v_user_id;
  v_bmi := ROUND((100 / POWER(v_height_cm / 100, 2))::numeric, 1);

  RAISE NOTICE 'Mar 23 workout seeded. Workout ID: %', v_day_id;
  RAISE NOTICE 'Body weight: 100 kg | Height: % cm | BMI: %', v_height_cm, v_bmi;
END $$;
