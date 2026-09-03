import { describe, it, expect } from 'vitest';
import {
  applyPatchSetCompleted,
  applyPatchSetRepsWeight,
  applyPatchExerciseName,
  applyPatchExerciseCircuit,
  applyPatchWorkoutFields,
} from './workoutQueryCache';
import type { WorkoutDayWithExercises } from '../types';

const baseWorkout: WorkoutDayWithExercises = {
  id: 'w1',
  user_id: 'u1',
  date: '2026-05-20',
  title: 'Leg day',
  notes: null,
  icon: null,
  is_public: false,
  started_at: null,
  ended_at: null,
  activity_type: 'strength',
  deleted_at: null,
  media: [],
  created_at: '',
  updated_at: '',
  workout_exercises: [
    {
      id: 'ex1',
      workout_day_id: 'w1',
      exercise_definition_id: null,
      circuit_group_id: null,
      name: 'Squat',
      order_index: 0,
      goals: null,
      notes: null,
      completed: false,
      created_at: '',
      updated_at: '',
      sets: [
        {
          id: 's1',
          workout_exercise_id: 'ex1',
          set_number: 1,
          reps: 5,
          weight: 100,
          completed: false,
          notes: null,
          created_at: '',
        },
      ],
    },
  ],
};

describe('applyPatchSetCompleted', () => {
  it('updates matching set only', () => {
    const next = applyPatchSetCompleted(baseWorkout, 's1', true);
    const sets = next.workout_exercises?.[0].sets ?? [];
    expect(sets[0]?.completed).toBe(true);
  });
});

describe('applyPatchSetRepsWeight', () => {
  it('updates reps and weight', () => {
    const next = applyPatchSetRepsWeight(baseWorkout, 's1', 8, 90);
    const set = next.workout_exercises?.[0].sets?.[0];
    expect(set?.reps).toBe(8);
    expect(set?.weight).toBe(90);
  });
});

describe('applyPatchExerciseName', () => {
  it('renames exercise', () => {
    const next = applyPatchExerciseName(baseWorkout, 'ex1', 'Front squat');
    expect(next.workout_exercises?.[0].name).toBe('Front squat');
  });
});

describe('applyPatchExerciseCircuit', () => {
  it('sets circuit_group_id', () => {
    const next = applyPatchExerciseCircuit(baseWorkout, 'ex1', 'circuit-a');
    expect(next.workout_exercises?.[0].circuit_group_id).toBe('circuit-a');
  });
});

describe('applyPatchWorkoutFields', () => {
  it('merges workout-level fields', () => {
    const next = applyPatchWorkoutFields(baseWorkout, { title: 'Push', is_public: true });
    expect(next.title).toBe('Push');
    expect(next.is_public).toBe(true);
  });
});
