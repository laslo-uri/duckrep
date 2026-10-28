import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { personalMark, weeklyCounts } from '../lib/mark';
import { appLocale } from '../lib/locale';

function Sparkline({ counts }: { counts: number[] }) {
  const rawId = useId();
  const gradId = `mark-fill-${rawId.replace(/:/g, '')}`;
  const width = 160;
  const height = 64;
  const max = Math.max(...counts, 1);
  const step = counts.length > 1 ? width / (counts.length - 1) : width;
  const points = counts.map((count, i) => {
    const x = i * step;
    const y = height - 8 - (count / max) * (height - 16);
    return [x, y] as const;
  });
  const line = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const area = `${line} L${width} ${height} L0 ${height} Z`;
  const last = points[points.length - 1];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-16" aria-hidden>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-mint)" stopOpacity="0.45" />
          <stop offset="100%" stopColor="var(--color-mint)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.35, 0.7].map((f) => (
        <line
          key={f}
          x1="0"
          x2={width}
          y1={height * f}
          y2={height * f}
          stroke="var(--color-muted)"
          strokeWidth="0.6"
          strokeDasharray="2 4"
          opacity="0.35"
        />
      ))}
      <path d={area} fill={`url(#${gradId})`} />
      <path
        d={line}
        fill="none"
        stroke="var(--color-mint)"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="dr-mark-line"
      />
      <circle className="dr-mark-dot" cx={last[0]} cy={last[1]} r="3.2" fill="var(--color-mint)" />
    </svg>
  );
}

export function MarkWidget({
  sessions,
  completedSets,
  streakDays,
  dateKeys,
  todayKey,
}: {
  sessions: number;
  completedSets: number;
  streakDays: number;
  dateKeys: string[];
  todayKey: string;
}) {
  const { t, i18n } = useTranslation();
  const mark = personalMark(sessions, completedSets);
  const gain = Math.round((mark - 100) * 100) / 100;
  const atPeak = streakDays > 0;
  const locale = appLocale(i18n.language);
  const price = mark.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const gainLabel = gain.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="dr-card p-5 sm:p-6">
      <div className="flex flex-col gap-4 min-[480px]:flex-row min-[480px]:items-center">
        <div className="min-[480px]:w-44 shrink-0">
          <Sparkline counts={weeklyCounts(dateKeys, todayKey)} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="dr-label">{t('markLabel')}</p>
          <p className="mt-1 font-serif text-3xl sm:text-4xl font-semibold tabular-nums tracking-tight">
            {price}
          </p>
          <p className={`mt-1 text-sm font-semibold tabular-nums ${atPeak ? 'text-[var(--color-mint)]' : 'text-[var(--color-muted)]'}`}>
            {atPeak ? '▲' : '▼'} {t('markGain', { gain: gainLabel })}
          </p>
          <p className="mt-1.5 text-sm text-[var(--color-muted)]">
            <span className={atPeak ? 'text-[var(--color-mint)] font-medium' : ''}>
              {atPeak ? t('markAtPeak') : t('markOffPeak')}
            </span>
            {streakDays > 0 && (
              <span className="tabular-nums"> · {t('streakCount', { count: streakDays })}</span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
