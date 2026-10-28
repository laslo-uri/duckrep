import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalUser } from '../contexts/LocalUserContext';
import { addLibraryExercise, exerciseSourceExists } from '../lib/db';
import { mapSourceMuscleToGroup } from '../lib/db/muscleGroupMap';
import {
  MuscleWikiError,
  fetchMuscleWikiVideo,
  getMuscleWikiExercise,
  getMuscleWikiKey,
  getMuscleWikiMeta,
  listMuscleWikiExercises,
  pickVideoUrl,
  type MwGender,
} from '../lib/musclewiki';

const PAGE_SIZE = 20;

function musclewikiMessage(error: unknown, t: (key: string) => string): string {
  if (error instanceof MuscleWikiError) {
    if (error.status === 429) return t('musclewikiQuota');
    if (error.status === 401 || error.status === 403) return t('musclewikiForbidden');
  }
  return t('musclewikiFailed');
}

export function ExerciseBrowse() {
  const { t } = useTranslation();
  const { user } = useLocalUser();
  const queryClient = useQueryClient();
  const key = getMuscleWikiKey();
  const [category, setCategory] = useState('');
  const [muscle, setMuscle] = useState('');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [pageCount, setPageCount] = useState(1);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [gender, setGender] = useState<MwGender>('male');
  const timer = useRef<number | null>(null);

  const meta = useQuery({
    queryKey: ['musclewiki', 'meta'],
    queryFn: ({ signal }) => getMuscleWikiMeta(key, signal),
    enabled: Boolean(key),
    staleTime: 30 * 24 * 60 * 60 * 1000,
  });

  const pages = useQueries({
    queries: Array.from({ length: pageCount }, (_, index) => ({
      queryKey: ['musclewiki', 'list', category, muscle, debounced, index],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        listMuscleWikiExercises(
          key,
          {
            limit: PAGE_SIZE,
            offset: index * PAGE_SIZE,
            category: category || undefined,
            muscles: muscle || undefined,
            search: debounced,
          },
          signal,
        ),
      enabled: Boolean(key),
    })),
  });

  const detail = useQuery({
    queryKey: ['musclewiki', 'exercise', selectedId, gender],
    queryFn: ({ signal }) => getMuscleWikiExercise(key, selectedId as number, gender, signal),
    enabled: Boolean(key) && selectedId != null,
  });

  const saved = useQuery({
    queryKey: ['musclewiki', 'saved', selectedId],
    queryFn: () => exerciseSourceExists(`musclewiki:${selectedId}`),
    enabled: selectedId != null,
  });

  const addToLibrary = useMutation({
    mutationFn: () => {
      const exercise = detail.data;
      if (!exercise) throw new Error('missing exercise');
      return addLibraryExercise(user.id, {
        name: exercise.name,
        muscleGroup: mapSourceMuscleToGroup(exercise.primaryMuscles[0]),
        sourceSlug: `musclewiki:${exercise.id}`,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['musclewiki', 'saved', selectedId] });
      queryClient.invalidateQueries({ queryKey: ['exercises'] });
    },
  });

  const results = pages.flatMap((page) => page.data?.results ?? []);
  const total = pages[0]?.data?.total ?? 0;
  const listError = pages.find((page) => page.isError)?.error;
  const listLoading = pages.some((page) => page.isLoading);
  const videoUrl = detail.data ? pickVideoUrl(detail.data.videos, gender) : null;

  const resetList = () => {
    setPageCount(1);
    setSelectedId(null);
  };

  if (!key) {
    return (
      <section className="dr-card p-5 sm:p-6">
        <p className="text-sm text-[var(--color-ink)]">{t('musclewikiKeyMissing')}</p>
        <Link
          to="/settings"
          className="mt-3 inline-flex min-h-[44px] items-center text-sm font-medium text-[var(--color-accent)]"
        >
          {t('musclewikiOpenSettings')}
        </Link>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <input
        type="search"
        value={search}
        onChange={(event) => {
          const value = event.target.value;
          setSearch(value);
          if (timer.current != null) window.clearTimeout(timer.current);
          timer.current = window.setTimeout(() => {
            setDebounced(value.trim());
            resetList();
          }, 300);
        }}
        placeholder={t('searchExercises')}
        aria-label={t('searchExercises')}
        className="w-full min-h-[44px] rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
      />

      {meta.data ? (
        <>
          <ChipRow
            allLabel={t('musclewikiAllEquipment')}
            value={category}
            options={meta.data.categories}
            onChange={(next) => {
              setCategory(next);
              resetList();
            }}
          />
          <ChipRow
            allLabel={t('musclewikiAllMuscles')}
            value={muscle}
            options={meta.data.muscles}
            onChange={(next) => {
              setMuscle(next);
              resetList();
            }}
          />
        </>
      ) : null}

      {listError ? (
        <p className="text-sm text-[var(--color-error)]" role="alert">
          {musclewikiMessage(listError, t)}
        </p>
      ) : null}

      {detail.data ? (
        <article className="dr-card p-5">
          <h2 className="font-medium text-[var(--color-ink)]">{detail.data.name}</h2>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            {[detail.data.primaryMuscles.join(', '), detail.data.difficulty, detail.data.category]
              .filter(Boolean)
              .join(' · ')}
          </p>
          <div className="mt-3 flex gap-2">
            {(['male', 'female'] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={gender === option}
                onClick={() => setGender(option)}
                className={`dr-press min-h-[40px] rounded-lg px-3 text-xs font-medium ${
                  gender === option
                    ? 'bg-[var(--color-accent)] text-[var(--color-on-accent)]'
                    : 'border border-[var(--color-border)] text-[var(--color-muted)]'
                }`}
              >
                {t(option === 'male' ? 'musclewikiMale' : 'musclewikiFemale')}
              </button>
            ))}
          </div>
          {videoUrl ? <PlayVideo key={`${videoUrl}:${gender}`} apiKey={key} url={videoUrl} /> : null}
          {detail.data.steps.length > 0 ? (
            <>
              <h3 className="mt-4 text-sm font-medium text-[var(--color-ink)]">{t('musclewikiSteps')}</h3>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-[var(--color-muted)]">
                {detail.data.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </>
          ) : null}
          <button
            type="button"
            disabled={saved.data || addToLibrary.isPending}
            onClick={() => addToLibrary.mutate()}
            className="dr-press mt-4 min-h-[44px] rounded-xl bg-[var(--color-accent)] px-4 text-sm font-semibold text-[var(--color-on-accent)] disabled:opacity-50"
          >
            {saved.data || addToLibrary.data === 'exists' || addToLibrary.data === 'added'
              ? t('addedToLibrary')
              : t('addToLibrary')}
          </button>
        </article>
      ) : null}

      <ul className="space-y-2">
        {results.map((exercise) => {
          const active = selectedId === exercise.id;
          return (
            <li key={exercise.id}>
              <button
                type="button"
                aria-pressed={active}
                onClick={() => setSelectedId(active ? null : exercise.id)}
                className={`dr-press w-full min-h-[52px] rounded-xl bg-[var(--color-surface)] px-4 text-left text-sm font-medium text-[var(--color-ink)] shadow-[var(--shadow-card)] ${
                  active ? 'ring-2 ring-[var(--color-accent)]' : ''
                }`}
              >
                {exercise.name}
              </button>
            </li>
          );
        })}
      </ul>

      {listLoading ? <p className="text-sm text-[var(--color-muted)]">{t('loading')}</p> : null}

      {!listLoading && !listError && results.length === 0 ? (
        <p className="py-8 text-center text-sm text-[var(--color-muted)]">{t('noExerciseMatches')}</p>
      ) : null}

      {total > results.length ? (
        <button
          type="button"
          onClick={() => setPageCount((count) => count + 1)}
          disabled={listLoading}
          className="dr-press min-h-[44px] rounded-xl border border-[var(--color-border)] px-4 text-sm font-medium disabled:opacity-50"
        >
          {t('showMore')}
        </button>
      ) : null}
    </div>
  );
}

function ChipRow({
  allLabel,
  value,
  options,
  onChange,
}: {
  allLabel: string;
  value: string;
  options: { name: string; label: string }[];
  onChange: (next: string) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <Chip label={allLabel} pressed={value === ''} onClick={() => onChange('')} />
      {options.map((option) => (
        <Chip
          key={option.name}
          label={option.label}
          pressed={value === option.name}
          onClick={() => onChange(option.name)}
        />
      ))}
    </div>
  );
}

function Chip({ label, pressed, onClick }: { label: string; pressed: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      className={`dr-press inline-flex min-h-[40px] shrink-0 items-center rounded-lg border px-3 text-xs font-medium ${
        pressed
          ? 'border-transparent bg-[var(--color-accent)] text-[var(--color-on-accent)]'
          : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-muted)]'
      }`}
    >
      {label}
    </button>
  );
}

function PlayVideo({ apiKey, url }: { apiKey: string; url: string }) {
  const { t } = useTranslation();
  const [src, setSrc] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const srcRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (srcRef.current) URL.revokeObjectURL(srcRef.current);
    };
  }, []);

  return (
    <div className="mt-3">
      {src ? (
        <video src={src} controls autoPlay playsInline className="max-h-80 w-full rounded-xl bg-black" />
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setPending(true);
            setError(null);
            void fetchMuscleWikiVideo(apiKey, url)
              .then((blobUrl) => {
                if (srcRef.current) URL.revokeObjectURL(srcRef.current);
                srcRef.current = blobUrl;
                setSrc(blobUrl);
              })
              .catch((reason: unknown) => setError(musclewikiMessage(reason, t)))
              .finally(() => setPending(false));
          }}
          className="dr-press min-h-[44px] rounded-xl border border-[var(--color-border)] px-4 text-sm font-medium"
        >
          {t('musclewikiPlay')}
        </button>
      )}
      {error ? (
        <p className="mt-2 text-sm text-[var(--color-error)]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
