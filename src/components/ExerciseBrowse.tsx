import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQueries, useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { MuscleWikiMeta } from '../lib/musclewiki';
import { Plus } from 'lucide-react';
import { useLocalUser } from '../contexts/LocalUserContext';
import { useAddToToday } from '../hooks/useAddToToday';
import { ensureLibraryExercise } from '../lib/db';
import { MUSCLE_GROUP_OF, muscleFromMuscleWiki, muscleWikiMuscles, type BodyMuscle } from '../lib/bodyMap';
import {
  MuscleWikiError,
  getMuscleWikiExercise,
  listMuscleWikiExercises,
  pickVideoUrl,
  type MwGender,
} from '../lib/musclewiki';

const PAGE_SIZE = 20;


function musclewikiMessage(error: unknown, t: (key: string) => string): string {
  if (error instanceof MuscleWikiError) {
    if (error.status === 0) return t('musclewikiUnavailable');
    if (error.status === 503) return t('musclewikiNotConfigured');
    if (error.status === 429) return t('musclewikiQuota');
    if (error.status === 401 || error.status === 403) return t('musclewikiForbidden');
  }
  return t('musclewikiFailed');
}

function useDebounced(value: string, ms: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value.trim()), ms);
    return () => window.clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

export function ExerciseBrowse({
  meta,
  search,
  muscles,
  category,
}: {
  meta: UseQueryResult<MuscleWikiMeta>;
  search: string;
  muscles: ReadonlySet<BodyMuscle>;
  category: string;
}) {
  const { t } = useTranslation();
  const { user } = useLocalUser();
  const debounced = useDebounced(search, 300);
  const muscleParam = muscleWikiMuscles(muscles, meta.data?.muscles ?? []);
  const filterKey = `${category}|${muscleParam}|${debounced}`;
  const [paging, setPaging] = useState({ key: filterKey, count: 1 });
  const pageCount = paging.key === filterKey ? paging.count : 1;
  const [selected, setSelected] = useState<{ key: string; id: number } | null>(null);
  const selectedId = selected?.key === filterKey ? selected.id : null;
  const [gender, setGender] = useState<MwGender>('male');

  // Only the name and group are kept in the library (no steps or media), filed under musclewiki:<id>.
  const addToToday = useAddToToday(user.id, async (input: { id: number; name: string; muscleGroup: string }) => {
    const id = await ensureLibraryExercise(user.id, {
      name: input.name,
      muscleGroup: input.muscleGroup,
      sourceSlug: `musclewiki:${input.id}`,
    });
    return { id, name: input.name, default_sets: null };
  });

  const pages = useQueries({
    queries: Array.from({ length: pageCount }, (_, index) => ({
      queryKey: ['musclewiki', 'list', category, muscleParam, debounced, index],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        listMuscleWikiExercises(
          { limit: PAGE_SIZE, offset: index * PAGE_SIZE, category: category || undefined, muscles: muscleParam || undefined, search: debounced },
          signal,
        ),
      enabled: meta.isSuccess,
      retry: false,
    })),
  });

  const detail = useQuery({
    queryKey: ['musclewiki', 'exercise', selectedId, gender],
    queryFn: ({ signal }) => getMuscleWikiExercise(selectedId as number, gender, signal),
    enabled: meta.isSuccess && selectedId != null,
  });

  if (meta.isPending) return <p className="mt-3 text-sm text-[var(--color-muted)]">{t('loading')}</p>;
  if (meta.isError) {
    return (
      <div className="dr-card mt-3 p-3 text-[13px] text-[var(--color-muted)]" role="status">
        <p>{musclewikiMessage(meta.error, t)}</p>
        <button type="button" onClick={() => void meta.refetch()} className="dr-btn mt-2">
          {t('retry')}
        </button>
      </div>
    );
  }

  const results = pages.flatMap((page) => page.data?.results ?? []);
  const total = pages[0]?.data?.total ?? 0;
  const listError = pages.find((page) => page.isError)?.error;
  const listLoading = pages.some((page) => page.isLoading);
  const videoUrl = detail.data ? pickVideoUrl(detail.data.videos, gender) : null;

  const add = (id: number, name: string, primaryMuscle?: string) => {
    const muscle = muscleFromMuscleWiki(primaryMuscle) ?? [...muscles][0];
    addToToday.mutate({ id, name, muscleGroup: muscle ? MUSCLE_GROUP_OF[muscle] : 'other' });
  };

  return (
    <div className="mt-2 space-y-2">
      {addToToday.data ? (
        <p role="status" className="flex items-center gap-2 text-[12px] text-[var(--color-muted)]">
          <span className="truncate">
            <span className="font-medium text-[var(--color-ink)]">{addToToday.data.name}</span>{' '}
            {addToToday.data.created ? t('addedNewToday') : t('addedToToday', { title: t('todaysActivity') })}
          </span>
          <Link to={`/activity/${addToToday.data.workoutId}`} className="shrink-0 text-[var(--color-accent)] hover:underline">
            {t('openActivity')}
          </Link>
        </p>
      ) : null}

      {listError ? (
        <p className="text-sm text-[var(--color-error)]" role="alert">
          {musclewikiMessage(listError, t)}
        </p>
      ) : null}

      {detail.data ? (
        <article className="dr-card p-3">
          <h2 className="text-[14px] font-semibold text-[var(--color-ink)]">{detail.data.name}</h2>
          <p className="mt-0.5 text-[12px] text-[var(--color-muted)]">
            {[detail.data.primaryMuscles.join(', '), detail.data.difficulty, detail.data.category].filter(Boolean).join(' · ')}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => add(detail.data!.id, detail.data!.name, detail.data!.primaryMuscles[0])}
              disabled={addToToday.isPending}
              className="dr-btn dr-btn-primary"
            >
              <Plus size={14} aria-hidden />
              {t('addToToday')}
            </button>
            {(['male', 'female'] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={gender === option}
                onClick={() => setGender(option)}
                className="dr-chip dr-chip-tap"
              >
                {t(option === 'male' ? 'musclewikiMale' : 'musclewikiFemale')}
              </button>
            ))}
          </div>
          {videoUrl ? (
            // Streamed through the proxy with MuscleWiki's no-store headers; never saved.
            <video key={videoUrl} src={videoUrl} controls playsInline preload="metadata" className="mt-3 max-h-80 w-full rounded-lg bg-black" />
          ) : null}
          {detail.data.steps.length > 0 ? (
            <>
              <h3 className="mt-3 text-[12px] font-semibold text-[var(--color-ink)]">{t('musclewikiSteps')}</h3>
              <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-[12px] text-[var(--color-muted)]">
                {detail.data.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </>
          ) : null}
        </article>
      ) : null}

      {results.length > 0 ? (
        <ul className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
          {results.map((exercise) => {
            const active = selectedId === exercise.id;
            return (
              <li key={exercise.id} className={`dr-row pr-1 ${active ? 'bg-[var(--color-accent-soft)]' : ''}`}>
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => setSelected(active ? null : { key: filterKey, id: exercise.id })}
                  className="dr-tap min-w-0 flex-1 self-stretch truncate text-left font-medium text-[var(--color-ink)]"
                >
                  {exercise.name}
                </button>
                <button
                  type="button"
                  onClick={() => add(exercise.id, exercise.name)}
                  disabled={addToToday.isPending}
                  className="dr-icon-btn dr-tap dr-tap-w shrink-0"
                  aria-label={`${t('addToToday')}: ${exercise.name}`}
                  title={t('addToToday')}
                >
                  <Plus size={15} aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      {listLoading ? <p className="text-sm text-[var(--color-muted)]">{t('loading')}</p> : null}

      {!listLoading && !listError && results.length === 0 ? (
        <p className="py-8 text-center text-sm text-[var(--color-muted)]">{t('noExerciseMatches')}</p>
      ) : null}

      {total > results.length ? (
        <button
          type="button"
          onClick={() => setPaging({ key: filterKey, count: pageCount + 1 })}
          disabled={listLoading}
          className="dr-btn"
        >
          {t('showMore')}
        </button>
      ) : null}

      <p className="pt-1 text-[11px] text-[var(--color-faint)]">
        <a href="https://musclewiki.com" target="_blank" rel="noreferrer" className="hover:underline">
          {t('musclewikiCredit')}
        </a>
      </p>
    </div>
  );
}
