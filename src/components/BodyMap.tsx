import { useTranslation } from 'react-i18next';
import type { KeyboardEvent } from 'react';
import type { BodyMuscle } from '../lib/bodyMap';

/**
 * Duckrep's own body map: a front and a back figure drawn on a 160 × 300 grid.
 * Each region is drawn once for the figure's right side and mirrored for the left.
 */
type Region = { muscle: BodyMuscle; paths: string[] };

const FRONT: Region[] = [
  { muscle: 'neck', paths: ['M73 40 L80 41 L80 52 L72 50 Z'] },
  { muscle: 'traps', paths: ['M71 47 L72 54 L58 55 Z'] },
  { muscle: 'shoulders', paths: ['M57 56 C47 56 40 63 40 75 L48 81 C50 71 54 63 62 59 Z'] },
  { muscle: 'chest', paths: ['M64 58 C70 56 76 57 79 58 L79 84 C70 88 59 86 52 80 C51 70 55 62 64 58 Z'] },
  { muscle: 'biceps', paths: ['M40 78 L48 84 C47 93 46 101 44 108 L36 106 C35 96 36 86 40 78 Z'] },
  { muscle: 'forearms', paths: ['M36 110 L44 112 C43 124 41 136 38 146 L31 144 C31 132 32 120 36 110 Z'] },
  {
    muscle: 'abs',
    paths: [
      'M66 90 L79 88 L79 140 L68 138 C66 124 65 106 66 90 Z',
      'M54 85 L63 90 C62 106 63 124 65 138 L58 141 C55 124 53 104 54 85 Z',
    ],
  },
  { muscle: 'abductors', paths: ['M55 144 L62 147 L56 169 C52 161 52 151 55 144 Z'] },
  { muscle: 'quads', paths: ['M63 147 C68 149 72 151 74 155 C75 176 73 196 71 211 L59 211 C55 196 54 179 57 169 Z'] },
  { muscle: 'adductors', paths: ['M76 152 L79 150 L79 192 C77 184 76 170 76 152 Z'] },
  { muscle: 'calves', paths: ['M58 227 C62 225 68 225 72 227 C72 246 70 264 68 280 L62 280 C59 264 57 246 58 227 Z'] },
];

const BACK: Region[] = [
  { muscle: 'neck', paths: ['M73 40 L80 41 L80 48 L72 47 Z'] },
  { muscle: 'traps', paths: ['M80 44 L66 52 L70 64 L80 84 Z'] },
  { muscle: 'shoulders', paths: ['M57 56 C47 56 40 63 40 75 L48 81 C50 71 54 63 62 59 Z'] },
  { muscle: 'triceps', paths: ['M40 78 L48 84 C47 93 46 101 44 108 L36 106 C35 96 36 86 40 78 Z'] },
  { muscle: 'forearms', paths: ['M36 110 L44 112 C43 124 41 136 38 146 L31 144 C31 132 32 120 36 110 Z'] },
  { muscle: 'midBack', paths: ['M70 66 L80 86 L80 104 L69 98 C67 88 67 76 70 66 Z'] },
  { muscle: 'lats', paths: ['M63 61 L68 64 C65 76 65 90 67 100 L79 107 L79 112 C72 117 64 121 58 124 C54 104 54 80 63 61 Z'] },
  { muscle: 'lowerBack', paths: ['M68 117 L79 113 L79 140 L70 140 C68 132 67 124 68 117 Z'] },
  { muscle: 'glutes', paths: ['M58 141 L79 143 L79 172 C70 176 61 174 56 168 C54 158 55 148 58 141 Z'] },
  { muscle: 'hamstrings', paths: ['M56 175 C62 179 72 179 78 177 C77 192 74 204 71 211 L59 211 C55 200 54 187 56 175 Z'] },
  { muscle: 'calves', paths: ['M58 226 C64 222 70 224 72 228 C73 244 71 260 68 277 L62 277 C58 260 56 244 58 226 Z'] },
];

/** Head, hands, knees and feet: drawn, never selectable. */
const SKIN = ['M80 8 C88 8 93 15 93 24 C93 33 88 40 80 40 Z', 'M34 147 C38 147 40 151 39 157 C38 162 34 164 31 162 C28 159 29 150 34 147 Z', 'M60 213 L71 213 L71 223 L60 223 Z', 'M61 283 L69 283 C72 287 72 292 68 294 L59 294 C57 291 58 286 61 283 Z'];

const MIRROR = 'translate(160 0) scale(-1 1)';

export function BodyMap({
  selected,
  counts,
  onToggle,
}: {
  selected: ReadonlySet<BodyMuscle>;
  counts?: Partial<Record<BodyMuscle, number>>;
  onToggle: (muscle: BodyMuscle) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="dr-bodymap grid grid-cols-2 gap-1" role="group" aria-label={t('bodyMap')}>
      <Figure side="front" label={t('bodyFront')} regions={FRONT} selected={selected} counts={counts} onToggle={onToggle} />
      <Figure side="back" label={t('bodyBack')} regions={BACK} selected={selected} counts={counts} onToggle={onToggle} />
    </div>
  );
}

function Figure({
  side,
  label,
  regions,
  selected,
  counts,
  onToggle,
}: {
  side: 'front' | 'back';
  label: string;
  regions: Region[];
  selected: ReadonlySet<BodyMuscle>;
  counts?: Partial<Record<BodyMuscle, number>>;
  onToggle: (muscle: BodyMuscle) => void;
}) {
  const { t } = useTranslation();
  const onKey = (event: KeyboardEvent, muscle: BodyMuscle) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    onToggle(muscle);
  };
  return (
    <figure className="m-0 flex min-w-0 flex-col items-center">
      <svg viewBox="0 0 160 300" className="h-auto w-full max-w-[150px]" data-side={side}>
        <g className="dr-bodymap-skin" aria-hidden>
          {SKIN.map((d) => (
            <g key={d}>
              <path d={d} />
              <path d={d} transform={MIRROR} />
            </g>
          ))}
        </g>
        {regions.map(({ muscle, paths }) => {
          const name = t(`muscles.${muscle}`);
          const count = counts?.[muscle];
          const pressed = selected.has(muscle);
          return (
            <g
              key={muscle}
              role="button"
              tabIndex={0}
              aria-pressed={pressed}
              aria-label={count == null ? name : t('muscleWithCount', { name, count })}
              data-muscle={muscle}
              className="dr-bodymap-muscle"
              onClick={() => onToggle(muscle)}
              onKeyDown={(event) => onKey(event, muscle)}
            >
              <title>{count == null ? name : t('muscleWithCount', { name, count })}</title>
              {paths.map((d) => (
                <g key={d}>
                  <path d={d} />
                  <path d={d} transform={MIRROR} />
                </g>
              ))}
            </g>
          );
        })}
      </svg>
      <figcaption className="dr-label mt-1">{label}</figcaption>
    </figure>
  );
}
