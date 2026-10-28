import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { personalMark, weeklyCounts } from '../lib/mark';
import { appLocale } from '../lib/locale';

function Sparkline({ counts }: { counts: number[] }) {
  const rawId = useId();
  const gradId = `mark-fill-${rawId.replace(/:/g, '')}`;
  const width = 120;
  const height = 36;
  const max = Math.max(...counts, 1);
  const step = counts.length > 1 ? width / (counts.length - 1) : width;
  const points = counts.map((count, i) => {
    const x = i * step;
    const y = height - 4 - (count / max) * (height - 8);
    return [x, y] as const;
  });
  const line = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const area = `${line} L${width} ${height} L0 ${height} Z`;
  const last = points[points.length - 1];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-9 w-full" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-mint)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--color-mint)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradId})`} />
      <path
        d={line}
        fill="none"
        stroke="var(--color-mint)"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        className="dr-mark-line"
      />
      <circle className="dr-mark-dot" cx={last[0]} cy={last[1]} r="2.6" fill="var(--color-mint)" />
    </svg>
  );
}

/** The personal mark plus lifetime totals, as one row of KPI tiles. */
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
    <dl className="grid grid-cols-3 gap-2 lg:grid-cols-4">
      <div className="dr-kpi relative col-span-3 pr-36 lg:col-span-1 lg:pr-20 xl:pr-28">
        <dt className="dr-label">{t('markLabel')}</dt>
        <dd className="dr-kpi-value">{price}</dd>
        <dd className={`mt-0.5 truncate text-[11px] font-medium ${atPeak ? 'text-[var(--color-success)]' : 'text-[var(--color-muted)]'}`}>
          {atPeak ? '▲' : '▼'} {t('markGain', { gain: gainLabel })}
        </dd>
        <dd className="absolute right-3 top-1/2 w-28 -translate-y-1/2 lg:w-16 xl:w-24" aria-hidden>
          <Sparkline counts={weeklyCounts(dateKeys, todayKey)} />
        </dd>
      </div>
      <div className="dr-kpi">
        <dt className="dr-label">{t('sessionsTotal')}</dt>
        <dd className="dr-kpi-value">{sessions.toLocaleString(locale)}</dd>
      </div>
      <div className="dr-kpi">
        <dt className="dr-label">{t('setsDone')}</dt>
        <dd className="dr-kpi-value">{completedSets.toLocaleString(locale)}</dd>
      </div>
      <div className="dr-kpi">
        <dt className="dr-label">{t('streakLabel')}</dt>
        <dd className="dr-kpi-value">{t('streakCount', { count: streakDays })}</dd>
        <dd className={`mt-0.5 text-[11px] ${atPeak ? 'font-medium text-[var(--color-success)]' : 'text-[var(--color-muted)]'}`}>
          {atPeak ? t('markAtPeak') : t('markOffPeak')}
        </dd>
      </div>
    </dl>
  );
}
