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
      <section className="dr-card p-3 sm:p-4">
        <p className="text-[13px] text-[var(--color-ink)]">{t('musclewikiKeyMissing')}</p>
        <Link
          to="/settings"
          className="dr-btn mt-2"
        >
          {t('musclewikiOpenSettings')}
        </Link>
      </section>
    );
  }

  return (
    <div className="space-y-2">
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
        className="dr-input w-full md:max-w-sm"
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
        <article className="dr-card p-3 sm:p-4">
          <h2 className="text-[14px] font-semibold text-[var(--color-ink)]">{detail.data.name}</h2>
          <p className="mt-0.5 text-[12px] text-[var(--color-muted)]">
            {[detail.data.primaryMuscles.join(', '), detail.data.difficulty, detail.data.category]
              .filter(Boolean)
              .join(' · ')}
          </p>
          <div className="mt-2 flex gap-1.5">
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
          {videoUrl ? <PlayVideo key={`${videoUrl}:${gender}`} apiKey={key} url={videoUrl} /> : null}
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
          <button
            type="button"
            disabled={saved.data || addToLibrary.isPending}
            onClick={() => addToLibrary.mutate()}
            className="dr-btn dr-btn-primary mt-3"
          >
            {saved.data || addToLibrary.data === 'exists' || addToLibrary.data === 'added'
              ? t('addedToLibrary')
              : t('addToLibrary')}
          </button>
        </article>
      ) : null}

      <ul className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
        {results.map((exercise) => {
          const active = selectedId === exercise.id;
          return (
            <li key={exercise.id}>
              <button
                type="button"
                aria-pressed={active}
                onClick={() => setSelectedId(active ? null : exercise.id)}
                className={`dr-row w-full text-left font-medium text-[var(--color-ink)] ${
                  active ? 'bg-[var(--color-accent-soft)]' : ''
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
          className="dr-btn"
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
    <div className="flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
      className="dr-chip dr-chip-tap shrink-0"
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
        <video src={src} controls autoPlay playsInline className="max-h-80 w-full rounded-lg bg-black" />
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
          className="dr-btn"
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
