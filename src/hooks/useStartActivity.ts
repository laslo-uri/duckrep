import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { createWorkoutDay, updateWorkoutDay } from '../lib/db';

/** Creates today's activity with the session clock running and opens it (sidebar button and the C shortcut). */
export function useStartActivity(userId: string, onError?: (err: Error) => void) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: async () => {
      const day = await createWorkoutDay(userId);
      await updateWorkoutDay(day.id, { started_at: new Date().toISOString() });
      return day;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['workout-days'] });
      navigate(`/activity/${data.id}`);
    },
    onError,
  });
}
