import type { ExerciseDefinition } from '../types';

/** Muscles the body map can select (free-exercise-db's primary muscles, in Duckrep's own keys). */
export const BODY_MUSCLES = [
  'neck',
  'traps',
  'shoulders',
  'chest',
  'biceps',
  'triceps',
  'forearms',
  'abs',
  'lats',
  'midBack',
  'lowerBack',
  'glutes',
  'abductors',
  'adductors',
  'quads',
  'hamstrings',
  'calves',
] as const;

export type BodyMuscle = (typeof BODY_MUSCLES)[number];

export const EQUIPMENT = [
  'barbell',
  'dumbbell',
  'kettlebell',
  'cable',
  'machine',
  'bodyweight',
  'band',
  'ball',
  'other',
] as const;

export type Equipment = (typeof EQUIPMENT)[number];

/** free-exercise-db categories (powerlifting folded into strength). */
export const EXERCISE_TYPES = ['strength', 'stretching', 'plyometrics', 'cardio', 'olympic', 'strongman'] as const;

export type ExerciseType = (typeof EXERCISE_TYPES)[number];

export type ExerciseLevel = 'beginner' | 'intermediate' | 'expert';

/** The coarse muscle_group each muscle belongs to (what the library and stats use). */
export const MUSCLE_GROUP_OF: Record<BodyMuscle, string> = {
  neck: 'shoulders',
  traps: 'back',
  shoulders: 'shoulders',
  chest: 'chest',
  biceps: 'biceps',
  triceps: 'triceps',
  forearms: 'biceps',
  abs: 'abs',
  lats: 'back',
  midBack: 'back',
  lowerBack: 'back',
  glutes: 'legs',
  abductors: 'legs',
  adductors: 'legs',
  quads: 'legs',
  hamstrings: 'legs',
  calves: 'legs',
};

/** Muscle names MuscleWiki may use for each region; the first one its /muscles list knows wins. */
const MUSCLEWIKI_NAMES: Record<BodyMuscle, string[]> = {
  neck: ['neck'],
  traps: ['traps'],
  shoulders: ['shoulders', 'front shoulders', 'rear shoulders'],
  chest: ['chest'],
  biceps: ['biceps'],
  triceps: ['triceps'],
  forearms: ['forearms'],
  abs: ['abdominals', 'obliques'],
  lats: ['lats'],
  midBack: ['traps (mid-back)', 'middle back', 'mid back'],
  lowerBack: ['lower back'],
  glutes: ['glutes'],
  abductors: ['abductors', 'outer thigh'],
  adductors: ['groin', 'adductors', 'inner thigh'],
  quads: ['quads', 'quadriceps'],
  hamstrings: ['hamstrings'],
  calves: ['calves'],
};

export type ExerciseAnatomy = {
  muscle: BodyMuscle | null;
  equipment: Equipment | null;
  /** Custom exercises count as strength. */
  type: ExerciseType;
  level: ExerciseLevel | null;
  /** One of the ~100 the page and the picker open on. */
  essential: boolean;
};

/** Fallback for exercises the dataset does not know (custom and curated ones): the group's main muscle. */
const GROUP_MAIN_MUSCLE: Record<string, BodyMuscle> = {
  chest: 'chest',
  shoulders: 'shoulders',
  triceps: 'triceps',
  biceps: 'biceps',
  back: 'lats',
  legs: 'quads',
  abs: 'abs',
};

function isMuscle(value: string): value is BodyMuscle {
  return (BODY_MUSCLES as readonly string[]).includes(value);
}

function isEquipment(value: string): value is Equipment {
  return (EQUIPMENT as readonly string[]).includes(value);
}

function isType(value: string): value is ExerciseType {
  return (EXERCISE_TYPES as readonly string[]).includes(value);
}

export function anatomyOf(
  exercise: Pick<ExerciseDefinition, 'source_slug' | 'muscle_group'>,
  table: Record<string, string>,
): ExerciseAnatomy {
  const raw = exercise.source_slug ? table[exercise.source_slug] : undefined;
  const [muscle = '', equipment = '', level = '', type = '', essential = ''] = raw ? raw.split('|') : [];
  return {
    muscle: isMuscle(muscle) ? muscle : GROUP_MAIN_MUSCLE[exercise.muscle_group ?? ''] ?? null,
    equipment: isEquipment(equipment) ? equipment : null,
    type: isType(type) ? type : 'strength',
    level: level === 'beginner' || level === 'intermediate' || level === 'expert' ? level : null,
    essential: essential === 'e',
  };
}

/** True when the exercise trains one of the selected muscles (none selected = every exercise). */
export function matchesMuscles(
  anatomy: ExerciseAnatomy,
  muscleGroup: string | null,
  selected: ReadonlySet<BodyMuscle>,
): boolean {
  if (selected.size === 0) return true;
  if (anatomy.muscle) return selected.has(anatomy.muscle);
  // No muscle at all: let any selected muscle of the same group through.
  for (const muscle of selected) if (MUSCLE_GROUP_OF[muscle] === muscleGroup) return true;
  return false;
}

/** Comma list for MuscleWiki's `muscles` filter, using the names its /muscles endpoint returned. */
export function muscleWikiMuscles(selected: Iterable<BodyMuscle>, known: { name: string }[]): string {
  const names = new Map(known.map((facet) => [facet.name.toLowerCase(), facet.name]));
  const out: string[] = [];
  for (const muscle of selected) {
    const candidates = MUSCLEWIKI_NAMES[muscle];
    const hits = candidates.map((name) => names.get(name)).filter((name): name is string => Boolean(name));
    if (hits.length > 0) out.push(...(muscle === 'abs' || muscle === 'shoulders' ? hits : hits.slice(0, 1)));
    else if (names.size === 0) out.push(candidates[0]);
  }
  return [...new Set(out)].join(',');
}

/** Body-map muscle for a MuscleWiki muscle name (to file a found exercise under the right group). */
export function muscleFromMuscleWiki(name: string | undefined): BodyMuscle | null {
  const key = name?.trim().toLowerCase();
  if (!key) return null;
  for (const muscle of BODY_MUSCLES) if (MUSCLEWIKI_NAMES[muscle].includes(key)) return muscle;
  return null;
}
