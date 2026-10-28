export interface Profile {
  id: string;
  display_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserStats {
  user_id: string;
  birth_date: string | null;
  height_cm: number | null;
  goal_weight_kg: number | null;
  created_at: string;
  updated_at: string;
}

/** A row of the old food log (moved to Dovediet); only read for the journal export. */
export interface LegacyFoodEntry {
  id: string;
  user_id: string;
  date: string;
  name: string;
  calories: number;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  created_at: string;
}

/** Nutrition goals from the old food log, exported with the food rows. */
export interface LegacyNutritionGoals {
  calorie_goal: number | null;
  protein_goal_g: number | null;
  carbs_goal_g: number | null;
  fat_goal_g: number | null;
}

export interface BodyWeightLog {
  id: string;
  user_id: string;
  date: string;
  weight_kg: number;
  created_at: string;
}

export const ACTIVITY_TYPES = ['strength', 'cardio', 'mobility', 'other'] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export interface ActivityMediaItem {
  url: string;
  caption?: string;
}

export interface WorkoutDay {
  id: string;
  user_id: string;
  date: string;
  title: string | null;
  notes: string | null;
  icon: string | null;
  is_public: boolean;
  started_at: string | null;
  ended_at: string | null;
  activity_type: ActivityType;
  deleted_at: string | null;
  media: ActivityMediaItem[];
  created_at: string;
  updated_at: string;
}

export interface UserDailyTrainingStats {
  user_id: string;
  date: string;
  activity_count: number;
  strength_count: number;
  cardio_count: number;
  completed_sets: number;
  updated_at: string;
}

/** Valid workout day icon keys (body-part / fitness related lucide icon names) */
export const WORKOUT_DAY_ICONS = [
  'dumbbell',
  'heart',
  'heart-pulse',
  'biceps-flexed',
  'hand-metal',
  'footprints',
  'hand',
  'bone',
  'brain',
  'activity',
  'circle-user',
] as const;
export type WorkoutDayIcon = (typeof WORKOUT_DAY_ICONS)[number];

export interface ExerciseSetDefault {
  reps?: number;
  weight?: number;
}

export interface ExerciseDefinition {
  id: string;
  user_id: string | null;
  name: string;
  name_sr: string | null;
  name_hu: string | null;
  description: string | null;
  image_url: string | null;
  muscle_group: string | null;
  source_slug: string | null;
  is_global: boolean;
  default_sets: ExerciseSetDefault[] | null;
  created_at: string;
  updated_at: string;
}

export interface ExerciseSet {
  id: string;
  workout_exercise_id: string;
  set_number: number;
  reps: number | null;
  weight: number | null;
  completed: boolean;
  notes: string | null;
  created_at: string;
}

export interface WorkoutExercise {
  id: string;
  workout_day_id: string;
  exercise_definition_id: string | null;
  circuit_group_id: string | null;
  name: string;
  order_index: number;
  goals: string | null;
  notes: string | null;
  completed: boolean;
  created_at: string;
  updated_at: string;
  sets?: ExerciseSet[];
}

export interface WorkoutDayWithExercises extends WorkoutDay {
  workout_exercises?: (WorkoutExercise & { sets?: ExerciseSet[] })[];
}
