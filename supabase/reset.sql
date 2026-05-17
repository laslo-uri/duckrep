-- Full reset: drops all YouPeak tables, trigger, and seeded auth users.
-- Run this, then schema.sql, then seed.sql.

-- 1. Drop trigger and function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- 2. Drop tables (CASCADE removes triggers on these tables)
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

-- 3. Remove seeded dev users
DELETE FROM auth.identities WHERE user_id IN (
  SELECT id FROM auth.users WHERE email IN ('laslo-uri@youpeak.app', 'david-arsenijevic@youpeak.app')
);
DELETE FROM auth.users WHERE email IN ('laslo-uri@youpeak.app', 'david-arsenijevic@youpeak.app');
