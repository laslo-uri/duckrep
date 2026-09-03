import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Plus, ArrowLeft } from 'lucide-react';
import { getLatestBodyWeight, getWorkoutWithExercises } from '../lib/db';
import { useLocalUser } from '../contexts/LocalUserContext';
import { useWorkoutMutations } from '../hooks/useWorkoutMutations';
import { useMutationError } from '../hooks/useMutationError';
import { QueryState } from '../components/QueryState';
import { MutationAlert } from '../components/MutationAlert';
import { EmptyState } from '../components/EmptyState';
import { WorkoutDetail } from '../components/workout/WorkoutDetail';

export function WorkoutPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const { user } = useLocalUser();
  const { mutationError, clearError, onMutationError } = useMutationError();
  const isNew = id === 'new';

  const { data: bodyWeight } = useQuery({
    queryKey: ['body-weight-latest', user.id],
    queryFn: () => getLatestBodyWeight(user.id),
  });

  const {
    data: workout,
    isLoading,
    isError,
    error,
    refetch,
    isFetched,
  } = useQuery({
    queryKey: ['workout', id],
    queryFn: () => (isNew ? null : getWorkoutWithExercises(id!)),
    enabled: !isNew && !!id,
  });

  const mutations = useWorkoutMutations({
    workout: workout ?? undefined,
    userId: user.id,
    workoutId: id,
    defaultExerciseName: t('addExercise'),
    onError: onMutationError,
  });

  if (isNew) {
    return (
      <div>
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-[var(--color-muted)] hover:text-[var(--color-ink)] mb-6 sm:mb-8 min-h-[44px] items-center touch-manipulation"
        >
          <ArrowLeft size={18} />
          {t('backToJournal')}
        </Link>
        <MutationAlert message={mutationError} onDismiss={clearError} />
        <EmptyState
          title={t('createWorkout')}
          action={
            <button
              type="button"
              onClick={() => {
                clearError();
                mutations.createMutation.mutate();
              }}
              disabled={mutations.createMutation.isPending}
              className="inline-flex items-center gap-2 px-5 py-3 min-h-[44px] rounded-lg bg-[var(--color-ink)] text-[var(--color-paper)] text-sm font-medium hover:opacity-90 disabled:opacity-50 touch-manipulation"
            >
              <Plus size={18} />
              {t('newWorkout')}
            </button>
          }
        />
      </div>
    );
  }

  return (
    <QueryState
      isLoading={isLoading}
      isError={isError}
      error={error}
      refetch={() => void refetch()}
      isEmpty={isFetched && !workout}
      empty={<EmptyState title={t('notFound')} />}
    >
      {workout && (
        <>
          <MutationAlert message={mutationError} onDismiss={clearError} />
          <WorkoutDetail
            key={workout.id}
            workout={workout}
            userId={user.id}
            bodyWeight={bodyWeight ?? null}
            {...mutations}
          />
        </>
      )}
    </QueryState>
  );
}
