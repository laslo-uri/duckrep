import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, Play, Plus } from 'lucide-react';
import type { ExerciseAnatomy } from '../lib/bodyMap';
import { exercisePhotos, muscleWikiSearchUrl, videoSearchUrl } from '../lib/exerciseMedia';
import { exerciseDisplayNames, type resolveExerciseLocale } from '../utils/exerciseDisplay';
import type { ExerciseDefinition } from '../types';

/** Library exercise: start and end photo, every step, and where to watch it. */
export function ExerciseDetail({
  exercise,
  anatomy,
  locale,
  adding,
  onAdd,
}: {
  exercise: ExerciseDefinition;
  anatomy: ExerciseAnatomy;
  locale: ReturnType<typeof resolveExerciseLocale>;
  adding: boolean;
  onAdd: () => void;
}) {
  const { t } = useTranslation();
  const { primary, alt } = exerciseDisplayNames(exercise, locale);
  const [broken, setBroken] = useState<ReadonlySet<string>>(new Set());
  const photos = exercisePhotos(exercise.image_url).filter((url) => !broken.has(url));
  // Every step from free-exercise-db (own lazy chunk); custom exercises keep their own description.
  const { data: guide } = useQuery({
    queryKey: ['exercise-guide'],
    queryFn: () => import('../lib/db/exerciseGuide.generated').then((m) => m.EXERCISE_GUIDE),
    staleTime: Infinity,
    enabled: Boolean(exercise.source_slug && exercise.is_global),
  });
  const steps = (exercise.source_slug && guide?.[exercise.source_slug]) || null;
  const muscle = anatomy.muscle ? t(`muscles.${anatomy.muscle}`) : t(`muscleGroups.${exercise.muscle_group || 'other'}`);

  return (
    <article className="dr-card mt-2 p-3" aria-labelledby="exercise-detail-title">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <h2 id="exercise-detail-title" className="text-[14px] font-semibold text-[var(--color-ink)]">{primary}</h2>
        {alt ? <span className="text-[12px] text-[var(--color-muted)]">{alt}</span> : null}
        <span className="dr-chip h-5 px-1.5 text-[11px]">{muscle}</span>
        {anatomy.equipment ? <span className="dr-chip h-5 px-1.5 text-[11px]">{t(`equipment.${anatomy.equipment}`)}</span> : null}
      </div>

      {photos.length > 0 ? (
        <div className="mt-2 grid max-w-md grid-cols-2 gap-2">
          {photos.map((url, index) => (
            <figure key={url} className="m-0">
              <img
                src={url}
                alt={t(index === 0 ? 'exerciseStartPhoto' : 'exerciseEndPhoto', { name: primary })}
                loading="lazy"
                onError={() => setBroken((current) => new Set(current).add(url))}
                className="aspect-[4/3] w-full rounded-md bg-[var(--color-hover)] object-cover"
              />
              {photos.length > 1 ? (
                <figcaption className="dr-label mt-1">{t(index === 0 ? 'exerciseStart' : 'exerciseEnd')}</figcaption>
              ) : null}
            </figure>
          ))}
        </div>
      ) : null}

      {steps ? (
        <>
          <h3 className="mt-3 text-[12px] font-semibold text-[var(--color-ink)]">{t('musclewikiSteps')}</h3>
          <ol className="mt-1 max-w-2xl list-decimal space-y-1 pl-5 text-[12px] leading-relaxed text-[var(--color-muted)]">
            {steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </>
      ) : exercise.description ? (
        <p className="mt-2 max-w-2xl text-[12px] leading-relaxed text-[var(--color-muted)]">{exercise.description}</p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <button type="button" onClick={onAdd} disabled={adding} className="dr-btn dr-btn-primary">
          <Plus size={14} aria-hidden />
          {t('addToToday')}
        </button>
        <a href={videoSearchUrl(exercise.name)} target="_blank" rel="noopener noreferrer" className="dr-btn">
          <Play size={14} aria-hidden />
          {t('watchVideo')}
        </a>
        <a href={muscleWikiSearchUrl(exercise.name)} target="_blank" rel="noopener noreferrer" className="dr-btn dr-btn-ghost">
          <ExternalLink size={14} aria-hidden />
          {t('findOnMuscleWiki')}
        </a>
      </div>
    </article>
  );
}
