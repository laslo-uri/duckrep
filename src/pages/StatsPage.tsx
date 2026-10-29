import { useId, useState } from 'react';
import { usePageTitle } from '../hooks/usePageTitle';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Activity,
  Scale,
  Target,
  Zap,
  Moon,
  TrendingDown,
} from 'lucide-react';
import {
  getUserStats,
  listBodyWeightLogs,
  listWorkoutDays,
  listWorkoutSummaries,
  upsertBodyWeightLog,
  listWorkoutDaysForStats,
  getDailyTrainingStats,
  localDateKey,
  todayIso,
} from '../lib/db';
import { useLocalUser } from '../contexts/LocalUserContext';
import {
  calculateBMI,
  bmiCategory,
  ageFromBirthDate,
} from '../lib/statsHelpers';
import { compareWeeks } from '../lib/journalPeriods';
import { parseOptionalFloat } from '../utils/numbers';
import { useMutationError } from '../hooks/useMutationError';
import { MutationAlert } from '../components/MutationAlert';
import { QueryState } from '../components/QueryState';
import { UnitInput } from '../components/UnitInput';
import type { BodyWeightLog } from '../types';
import { buildMondayWeeks } from '../lib/statsHelpers';
import { appLocale } from '../lib/locale';
import { PageBody, PageHeader } from '../components/Layout';

function getDaysInPastWeeks(weeks: number): Date[] {
  const days: Date[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setDate(start.getDate() - weeks * 7);
  for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
    days.push(new Date(d));
  }
  return days;
}

export function StatsPage() {
  const { t, i18n } = useTranslation();
  usePageTitle(t('yourStats'));
  const locale = appLocale(i18n.language);
  const { user } = useLocalUser();
  const queryClient = useQueryClient();
  const { mutationError, clearError, onMutationError } = useMutationError();
  const [todayWeight, setTodayWeight] = useState<string>('');
  const [weightError, setWeightError] = useState(false);

  const userStatsQuery = useQuery({
    queryKey: ['user-stats', user.id],
    queryFn: () => getUserStats(user.id),
  });
  const userStats = userStatsQuery.data;

  const weightLogsQuery = useQuery({
    queryKey: ['body-weight-logs', user.id],
    queryFn: () => listBodyWeightLogs(user.id, 90),
  });
  const weightLogs = weightLogsQuery.data ?? [];

  const workoutDaysQuery = useQuery({
    queryKey: ['workout-days-stats', user.id],
    queryFn: async () => {
      const start = new Date();
      start.setDate(start.getDate() - 84);
      return listWorkoutDaysForStats(user.id, localDateKey(start));
    },
  });
  const workoutDaysMap = new Map((workoutDaysQuery.data ?? []).map((d) => [d.date, d.icon]));

  const dailyStatsQuery = useQuery({
    queryKey: ['user-daily-training-stats', user.id],
    queryFn: async () => {
      const start = new Date();
      start.setDate(start.getDate() - 84);
      return getDailyTrainingStats(user.id, localDateKey(start));
    },
  });
  const dailyStatsRows = dailyStatsQuery.data ?? [];

  // Same caches as the journal: activities and their set / volume summaries.
  const daysQuery = useQuery({
    queryKey: ['workout-days', user.id],
    queryFn: () => listWorkoutDays(user.id),
  });
  const { data: summaries = {} } = useQuery({
    queryKey: ['workout-days', user.id, 'summaries'],
    queryFn: () => listWorkoutSummaries(user.id),
    staleTime: 0,
  });
  const week = compareWeeks(daysQuery.data ?? [], summaries, todayIso());

  const queries = [userStatsQuery, weightLogsQuery, workoutDaysQuery, dailyStatsQuery, daysQuery];
  const statsLoading = queries.some((query) => query.isLoading);
  const statsIsError = queries.some((query) => query.isError);
  const statsError = queries.find((query) => query.error)?.error ?? null;
  const refetchStats = () => {
    for (const query of queries) void query.refetch();
  };

  const analyticsTotals = dailyStatsRows.reduce(
    (acc, r) => ({
      activities: acc.activities + r.activity_count,
      strength: acc.strength + r.strength_count,
      cardio: acc.cardio + r.cardio_count,
      sets: acc.sets + r.completed_sets,
    }),
    { activities: 0, strength: 0, cardio: 0, sets: 0 },
  );

  const addWeightMutation = useMutation({
    mutationFn: (weight: number) => upsertBodyWeightLog(user.id, todayIso(), weight),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['body-weight-logs', user.id] });
      setTodayWeight('');
    },
    onError: onMutationError,
  });

  const currentWeight = weightLogs[0]?.weight_kg ?? null;
  const height = userStats?.height_cm ? Number(userStats.height_cm) : 0;
  const goal = userStats?.goal_weight_kg ? Number(userStats.goal_weight_kg) : null;
  const age = ageFromBirthDate(userStats?.birth_date ?? null);
  const bmi = currentWeight && height ? calculateBMI(currentWeight, height) : null;

  const days = getDaysInPastWeeks(12);
  const weightsForChart = [...weightLogs].reverse();

  const addTodayWeight = () => {
    const w = parseOptionalFloat(todayWeight.replace(',', '.'));
    if (w == null || w <= 0 || w > 500) {
      setWeightError(true);
      return;
    }
    setWeightError(false);
    addWeightMutation.mutate(w);
  };

  const kg = (n: number) => t('volumeKg', { n: Math.round(n).toLocaleString(locale) });
  const delta = (now: number, before: number, format: (n: number) => string) => {
    const diff = now - before;
    if (diff === 0) return t('weekSame');
    return t('weekVsLast', { delta: (diff > 0 ? '+' : '−') + format(Math.abs(diff)) });
  };

  return (
    <>
      <PageHeader
        title={t('yourStats')}
        meta={new Date().toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
      />
      <PageBody className="space-y-4">
        <MutationAlert message={mutationError} onDismiss={clearError} />

        <QueryState isLoading={statsLoading} isError={statsIsError} error={statsError as Error | null} refetch={refetchStats}>
          {/* Training first: this week against last week, then the 12-week grid. */}
          <section aria-labelledby="stats-week">
            <h2 id="stats-week" className="mb-2 text-[13px] font-semibold text-[var(--color-ink)]">
              {t('periodThisWeek')}
            </h2>
            <div className="grid grid-cols-3 gap-2">
              <WeekCard label={t('sessionsTotal')} value={String(week.thisWeek.sessions)} delta={delta(week.thisWeek.sessions, week.lastWeek.sessions, String)} />
              <WeekCard label={t('statSets')} value={String(week.thisWeek.sets)} delta={delta(week.thisWeek.sets, week.lastWeek.sets, String)} />
              <WeekCard label={t('statVolume')} value={kg(week.thisWeek.volume)} delta={delta(week.thisWeek.volume, week.lastWeek.volume, kg)} />
            </div>
          </section>

          <section className="dr-card p-3 sm:p-4" aria-labelledby="stats-grid">
            <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1">
              <h2 id="stats-grid" className="flex items-center gap-2 text-[13px] font-semibold text-[var(--color-ink)]">
                <Activity size={14} className="text-[var(--color-accent)]" aria-hidden />
                {t('last12Weeks')}
              </h2>
              <p className="text-[12px] tabular-nums text-[var(--color-muted)]">
                {[
                  analyticsTotals.activities + ' ' + t('analyticsTotalActivities').toLowerCase(),
                  analyticsTotals.strength + ' ' + t('analyticsStrengthSessions').toLowerCase(),
                  analyticsTotals.cardio + ' ' + t('analyticsCardioSessions').toLowerCase(),
                  analyticsTotals.sets + ' ' + t('analyticsCompletedSets').toLowerCase(),
                ].join(' · ')}
              </p>
              <span className="ml-auto flex items-center gap-3 text-xs text-[var(--color-muted)]">
                <span className="flex items-center gap-1">
                  <Zap size={14} style={{ color: 'var(--color-chart-active)' }} aria-hidden />
                  {t('activeDays')}
                </span>
                <span className="flex items-center gap-1">
                  <Moon size={14} style={{ color: 'var(--color-chart-rest)' }} aria-hidden />
                  {t('restDays')}
                </span>
              </span>
            </div>
            <ContributionGrid days={days} workoutDaysMap={workoutDaysMap} />
          </section>

          {/* Body: the numbers, today's weight, the trend. Profile fields live in Settings. */}
          <section className="dr-card p-3 sm:p-4" aria-labelledby="stats-body">
            <h2 id="stats-body" className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-[var(--color-ink)]">
              <Scale size={14} className="text-[var(--color-accent)]" aria-hidden />
              {t('bodySection')}
            </h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <StatCard icon={<Scale size={13} />} label={t('currentKg')} value={currentWeight != null ? currentWeight + ' kg' : '—'} />
              <StatCard icon={<Target size={13} />} label={t('goalKg')} value={goal != null ? goal + ' kg' : '—'} />
              <StatCard icon={<TrendingDown size={13} />} label={t('bmiLabel')} value={bmi != null ? bmi + ' (' + t(bmiCategory(bmi)) + ')' : '—'} />
              <StatCard icon={<Activity size={13} />} label={t('age')} value={age != null ? age + ' ' + t('yearsOld') : '—'} />
            </div>
            <form
              className="mt-3 flex flex-wrap items-start gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                addTodayWeight();
              }}
            >
              <div className="min-w-0 max-w-xs flex-1">
                <UnitInput
                  value={todayWeight}
                  onChange={(value) => {
                    setTodayWeight(value);
                    setWeightError(false);
                  }}
                  unit={t('unitKg')}
                  label={t('logWeight')}
                  placeholder="72.5"
                  invalid={weightError}
                />
                {weightError ? (
                  <p role="alert" className="mt-2 text-sm text-[var(--color-error)]">
                    {t('weightInvalid')}
                  </p>
                ) : null}
              </div>
              <button type="submit" disabled={!todayWeight.trim() || addWeightMutation.isPending} className="dr-btn dr-btn-primary h-9 shrink-0 max-md:h-11">
                {t('logWeight')}
              </button>
            </form>
            {weightsForChart.length > 0 || goal != null ? (
              <div className="mt-4">
                <h3 className="mb-2 text-[12px] font-medium text-[var(--color-muted)]">{t('weightGoalGraph')}</h3>
                <WeightChart weights={weightsForChart} goalKg={goal} />
              </div>
            ) : null}
            <p className="mt-3 text-[12px] text-[var(--color-muted)]">
              <Link to="/settings#profile" className="underline underline-offset-2 hover:text-[var(--color-ink)]">
                {t('editProfileInSettings')}
              </Link>
            </p>
          </section>
        </QueryState>
      </PageBody>
    </>
  );
}

function WeekCard({ label, value, delta }: { label: string; value: string; delta: string }) {
  return (
    <div className="dr-kpi">
      <p className="dr-label">{label}</p>
      <p className="dr-kpi-value tabular-nums">{value}</p>
      <p className="truncate text-[11px] tabular-nums text-[var(--color-muted)]">{delta}</p>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="dr-kpi">
      <div className="flex items-center gap-1.5 text-[var(--color-faint)]">
        {icon}
        <p className="dr-label">{label}</p>
      </div>
      <p className="dr-kpi-value min-w-0 break-words">{value}</p>
    </div>
  );
}

function formatChartDate(iso: string, locale: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString(locale, { month: 'short', day: 'numeric' });
}

function niceYStep(range: number): number {
  if (range <= 0 || !Number.isFinite(range)) return 1;
  const rough = range / 4;
  const p = 10 ** Math.floor(Math.log10(rough));
  const n = rough / p;
  if (n < 1.5) return p;
  if (n < 3.5) return 2 * p;
  if (n < 7.5) return 5 * p;
  return 10 * p;
}

function WeightChart({ weights, goalKg }: { weights: BodyWeightLog[]; goalKg: number | null }) {
  const { t, i18n } = useTranslation();
  const locale = appLocale(i18n.language);
  const gradId = useId().replace(/:/g, '');
  if (weights.length === 0 && goalKg == null) return null;

  const W = 640;
  const H = 248;
  const pad = { t: 22, r: 20, b: 48, l: 54 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;

  const nums = weights.map((x) => Number(x.weight_kg));
  let dMin = nums.length ? Math.min(...nums) : goalKg ?? 75;
  let dMax = nums.length ? Math.max(...nums) : goalKg ?? 85;
  if (goalKg != null) {
    dMin = Math.min(dMin, goalKg);
    dMax = Math.max(dMax, goalKg);
  }
  const spread = dMax - dMin;
  const margin = spread < 0.5 ? 1.5 : Math.max(spread * 0.12, 1);
  const yMin = dMin - margin;
  let yMax = dMax + margin;
  if (yMax <= yMin) yMax = yMin + 4;

  let step = niceYStep(yMax - yMin);
  while ((yMax - yMin) / step > 7) step *= 2;

  const tickMin = Math.floor(yMin / step) * step;
  const tickMax = Math.ceil(yMax / step) * step;
  const yTicks: number[] = [];
  for (let v = tickMin; v <= tickMax + step * 0.001; v += step) {
    yTicks.push(Math.round(v * 20) / 20);
  }
  const plotMin = yTicks[0] ?? yMin;
  const plotMax = yTicks[yTicks.length - 1] ?? yMax;
  const yRange = plotMax - plotMin || 1;

  const toY = (val: number) => pad.t + ih - ((val - plotMin) / yRange) * ih;
  const n = weights.length;
  const toX = (i: number) => {
    if (n <= 1) return pad.l + iw / 2;
    return pad.l + (i / (n - 1)) * iw;
  };
  const baselineY = toY(plotMin);

  const pathD =
    weights.length > 0
      ? weights.map((log, i) => `${i === 0 ? 'M' : 'L'} ${toX(i)} ${toY(log.weight_kg)}`).join(' ')
      : '';

  let areaD = '';
  if (weights.length >= 2) {
    areaD = `M ${toX(0)} ${baselineY} ${weights
      .map((log, i) => `L ${toX(i)} ${toY(log.weight_kg)}`)
      .join(' ')} L ${toX(n - 1)} ${baselineY} Z`;
  }

  const labelFill = 'var(--color-muted)';
  const gridStroke = 'var(--color-border)';

  const chartSummary =
    weights.length > 0
      ? weights
          .map((log) => `${formatChartDate(log.date, locale)}: ${log.weight_kg} ${t('unitKg')}`)
          .join('; ')
      : '';

  return (
    <div className="space-y-3">
      {chartSummary ? (
        <p className="sr-only">
          {t('weightChartSummary', { entries: chartSummary })}
        </p>
      ) : null}
      <div className="overflow-x-auto -mx-1 px-1">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full max-w-full h-auto min-h-[180px]"
          role="img"
          aria-label={
            chartSummary
              ? `${t('weightGoalGraph')}. ${t('weightChartSummary', { entries: chartSummary })}`
              : t('weightGoalGraph')
          }
        >
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-ink)" stopOpacity="0.14" />
              <stop offset="100%" stopColor="var(--color-ink)" stopOpacity="0" />
            </linearGradient>
          </defs>

          {yTicks.map((tick) => {
            const y = toY(tick);
            return (
              <g key={tick}>
                <line
                  x1={pad.l}
                  y1={y}
                  x2={W - pad.r}
                  y2={y}
                  stroke={gridStroke}
                  strokeWidth={1}
                />
                <text
                  x={pad.l - 10}
                  y={y + 4}
                  textAnchor="end"
                  fill={labelFill}
                  style={{ fontSize: 11 }}
                >
                  {Number.isInteger(tick) ? tick : tick.toFixed(1)}
                </text>
              </g>
            );
          })}

          {goalKg != null && (
            <>
              <line
                x1={pad.l}
                y1={toY(goalKg)}
                x2={W - pad.r}
                y2={toY(goalKg)}
                stroke="var(--color-muted)"
                strokeDasharray="7 6"
                strokeWidth={1.5}
              />
              <text
                x={W - pad.r}
                y={toY(goalKg) - 8}
                textAnchor="end"
                fill={labelFill}
                style={{ fontSize: 11, fontWeight: 500 }}
              >
                {t('chartGoalLineLabel')} {goalKg} kg
              </text>
            </>
          )}

          {areaD ? <path d={areaD} fill={`url(#${gradId})`} /> : null}

          {weights.length > 0 ? (
            <path
              d={pathD}
              fill="none"
              stroke="var(--color-ink)"
              strokeWidth={2.25}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}

          {weights.map((log, i) => (
            <circle
              key={log.id}
              cx={toX(i)}
              cy={toY(log.weight_kg)}
              r={5}
              fill="var(--color-paper)"
              stroke="var(--color-ink)"
              strokeWidth={2}
            >
              <title>{`${formatChartDate(log.date, locale)} · ${log.weight_kg} kg`}</title>
            </circle>
          ))}

          {n > 0 ? (
            <g>
              <text x={toX(0)} y={H - 16} textAnchor="middle" fill={labelFill} style={{ fontSize: 11 }}>
                {formatChartDate(weights[0].date, locale)}
              </text>
              {n > 2 ? (
                <text
                  x={toX(Math.floor((n - 1) / 2))}
                  y={H - 16}
                  textAnchor="middle"
                  fill={labelFill}
                  style={{ fontSize: 11 }}
                >
                  {formatChartDate(weights[Math.floor((n - 1) / 2)].date, locale)}
                </text>
              ) : null}
              {n > 1 ? (
                <text
                  x={toX(n - 1)}
                  y={H - 16}
                  textAnchor="middle"
                  fill={labelFill}
                  style={{ fontSize: 11 }}
                >
                  {formatChartDate(weights[n - 1].date, locale)}
                </text>
              ) : null}
            </g>
          ) : null}
        </svg>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[var(--color-muted)]">
        {weights.length > 0 ? (
          <span className="flex items-center gap-2">
            <span className="inline-block w-4 h-1 rounded-full bg-[var(--color-ink)]" aria-hidden />
            {t('chartMeasuredWeight')}
          </span>
        ) : null}
        {goalKg != null ? (
          <span className="flex items-center gap-2">
            <span className="inline-block w-6 border-t-[3px] border-dashed border-[var(--color-muted)]" aria-hidden />
            {t('chartGoalLineLabel')} ({goalKg} kg)
          </span>
        ) : null}
      </div>

      {weights.length === 0 && goalKg != null ? (
        <p className="text-sm text-[var(--color-muted)]">{t('chartNoWeightYet')}</p>
      ) : null}
    </div>
  );
}

function ContributionGrid({
  days,
  workoutDaysMap,
}: {
  days: Date[];
  workoutDaysMap: Map<string, string | null>;
}) {
  const { t, i18n } = useTranslation();
  const keys = days.map((d) => localDateKey(d));
  const cells = buildMondayWeeks(keys).flat();
  const activeCount = keys.filter((key) => workoutDaysMap.has(key)).length;
  const weekdayLabels = [1, 2, 3, 4, 5, 6, 7].map((day) =>
    new Intl.DateTimeFormat(appLocale(i18n.language), { weekday: 'narrow', timeZone: 'UTC' }).format(
      new Date(Date.UTC(2024, 0, day)),
    ),
  );

  return (
    <div role="img" aria-label={t('activityDaysCount', { count: activeCount })}>
      <div className="flex gap-1.5 overflow-x-auto">
        <div className="grid grid-rows-7 gap-[3px] shrink-0">
          {weekdayLabels.map((label, i) => (
            <div
              key={`${label}-${i}`}
              className="h-3.5 flex items-center text-[10px] leading-none text-[var(--color-muted)] pr-1"
            >
              {i % 2 === 0 ? label : ''}
            </div>
          ))}
        </div>
        <div className="grid grid-flow-col grid-rows-7 gap-[3px] auto-cols-[0.875rem]">
          {cells.map((dateStr, i) => {
            if (!dateStr) return <div key={`empty-${i}`} className="w-3.5 h-3.5" />;
            const isActive = workoutDaysMap.has(dateStr);
            const label = new Date(`${dateStr}T00:00:00Z`).toLocaleDateString(appLocale(i18n.language), {
              timeZone: 'UTC',
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            });
            return (
              <div
                key={dateStr}
                title={label}
                className="w-3.5 h-3.5 rounded-[3px]"
                style={{
                  backgroundColor: isActive ? 'var(--color-chart-active)' : 'var(--color-chart-rest)',
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
