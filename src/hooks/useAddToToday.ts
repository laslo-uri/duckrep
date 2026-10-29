import { useMutation, useQueryClient } from '@tanstack/react-query';
import { addExerciseToToday } from '../lib/db';
import type { ExerciseDefinition } from '../types';

type Def = Pick<ExerciseDefinition, 'id' | 'name' | 'default_sets'>;

/**
 * One click from the exercise search: into today's open activity, or a new one.
 * `resolve` turns the clicked item into a library exercise (MuscleWiki results are added first).
 */
export function useAddToToday<T = Def>(userId: string, resolve: (input: T) => Promise<Def> = async (input) => input as Def) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: T) => {
      const def = await resolve(input);
      return { ...(await addExerciseToToday(userId, def)), name: def.name };
    },
    onSuccess: ({ workoutId }) => {
      for (const key of ['workout-days', 'workout-days-stats', 'lifetime-training-totals', 'user-daily-training-stats', 'exercises', 'exercise-usage']) {
        void queryClient.invalidateQueries({ queryKey: [key] });
      }
      void queryClient.invalidateQueries({ queryKey: ['workout', workoutId] });
    },
  });
}
