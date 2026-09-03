-- YouPeak: verify exercise_definitions RLS after deploy (run in Supabase SQL Editor)
-- Expected: four split policies; legacy "Users CRUD own or global exercises" must be absent.

-- Step A: list policies on exercise_definitions
SELECT
  policyname,
  cmd,
  qual::text AS using_expr,
  with_check::text AS with_check_expr
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'exercise_definitions'
ORDER BY policyname;

-- Step B: assert legacy policy is gone (should return 0 rows)
SELECT policyname
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'exercise_definitions'
  AND policyname = 'Users CRUD own or global exercises';

-- Step C: if Step B returned a row, apply section 6 from schema.sql (idempotent):
-- DROP POLICY IF EXISTS "Users CRUD own or global exercises" ON exercise_definitions;
-- ... then CREATE POLICY "Users read own or global exercises" ...
-- (full block is at the end of supabase/schema.sql)
