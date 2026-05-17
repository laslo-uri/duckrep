-- YouPeak seed: dev users, global exercises, and sample workout.
-- LOCAL DEV ONLY — do NOT run in production.
-- Run after schema.sql in the Supabase SQL Editor.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =============================================================================
-- 1. Dev users
-- =============================================================================

-- Fix: auth.users token columns must be '' not NULL for sign-in to work
UPDATE auth.users
SET confirmation_token = '', email_change = '', email_change_token_new = '', recovery_token = ''
WHERE confirmation_token IS NULL OR email_change IS NULL OR email_change_token_new IS NULL OR recovery_token IS NULL;

-- laslo-uri
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

-- david-arsenijevic
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

-- Backfill profiles for users seeded before the trigger existed
INSERT INTO public.profiles (id, display_name)
SELECT u.id, COALESCE(u.raw_user_meta_data->>'display_name', split_part(u.email, '@', 1))
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- 2. Global exercise library
-- =============================================================================

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

-- Suggested default sets (3×12) for a few globals — copied into the log when adding from library
UPDATE exercise_definitions
SET default_sets = '[{"reps":12},{"reps":12},{"reps":12}]'::jsonb
WHERE is_global = TRUE
  AND name IN ('Bench Press', 'Squat', 'Lat Pulldown', 'Triceps Pushdown', 'Shoulder Press (Machine)');

-- =============================================================================
-- 3. Sample workout: Chest, Shoulders & Triceps (laslo-uri, 2026-03-11)
-- =============================================================================

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

  -- Remove previous data for this date (idempotent)
  DELETE FROM workout_days WHERE user_id = v_user_id AND date = '2026-03-11';

  INSERT INTO workout_days (user_id, date, title)
  VALUES (v_user_id, '2026-03-11', 'Chest, Shoulders & Triceps')
  RETURNING id INTO v_day_id;

  -- CHEST ---------------------------------------------------------------

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

  -- SHOULDERS ------------------------------------------------------------

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

  -- TRICEPS --------------------------------------------------------------

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

  -- BODY WEIGHT ----------------------------------------------------------

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

-- =============================================================================
-- 4. Pull Day: Back & Biceps (laslo-uri, 2026-03-12)
-- =============================================================================

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

-- =============================================================================
-- 5. Chest & Shoulders (laslo-uri, 2026-03-23)
-- =============================================================================

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

