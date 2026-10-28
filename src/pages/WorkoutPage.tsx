import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Plus, ChevronLeft } from 'lucide-react';
import { getLatestBodyWeight, getWorkoutWithExercises } from '../lib/db';
import { useLocalUser } from '../contexts/LocalUserContext';
import { useWorkoutMutations } from '../hooks/useWorkoutMutations';
import { useMutationError } from '../hooks/useMutationError';
import { usePageTitle } from '../hooks/usePageTitle';
import { QueryState } from '../components/QueryState';
import { MutationAlert } from '../components/MutationAlert';
import { EmptyState } from '../components/EmptyState';
import { PageBody, PageHeader } from '../components/Layout';
import { WorkoutDetail } from '../components/workout/WorkoutDetail';

function BackToJournal() {
  const { t } = useTranslation();
  return (
    <Link
      to="/journal"
      aria-label={t('backToJournal')}
      className="dr-tap -ml-1 inline-flex shrink-0 items-center gap-1 rounded-md px-1 text-[13px] text-[var(--color-muted)] hover:text-[var(--color-ink)]"
    >
      <ChevronLeft size={15} aria-hidden />
      {t('myJournal')}
    </Link>
  );
}

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

  usePageTitle(isNew ? t('newWorkout') : workout?.title?.trim() || t('myJournal'));

  const mutations = useWorkoutMutations({
    workout: workout ?? undefined,
    userId: user.id,
    workoutId: id,
    defaultExerciseName: t('addExercise'),
    onError: onMutationError,
  });

  if (isNew) {
    return (
      <>
        <PageHeader>
          <BackToJournal />
        </PageHeader>
        <PageBody className="space-y-3">
          <MutationAlert message={mutationError} onDismiss={clearError} />
          <EmptyState
            headingLevel="h1"
            title={t('createWorkout')}
            description={t('createWorkoutHint')}
            action={
              <button
                type="button"
                onClick={() => {
                  clearError();
                  mutations.createMutation.mutate();
                }}
                disabled={mutations.createMutation.isPending}
                className="dr-btn dr-btn-primary"
              >
                <Plus size={14} aria-hidden />
                {t('newWorkout')}
              </button>
            }
          />
        </PageBody>
      </>
    );
  }

  if (!workout) {
    return (
      <>
        <PageHeader>
          <BackToJournal />
        </PageHeader>
        <PageBody>
          <QueryState
            isLoading={isLoading}
            isError={isError}
            error={error}
            refetch={() => void refetch()}
            isEmpty={isFetched}
            empty={<EmptyState title={t('notFound')} />}
          >
            {null}
          </QueryState>
        </PageBody>
      </>
    );
  }

  return (
    <WorkoutDetail
      key={workout.id}
      workout={workout}
      userId={user.id}
      bodyWeight={bodyWeight ?? null}
      alert={
        mutationError ? (
          <div className="px-3 pt-3 md:px-5">
            <MutationAlert message={mutationError} onDismiss={clearError} />
          </div>
        ) : null
      }
      {...mutations}
    />
  );
}
