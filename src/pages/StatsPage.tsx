import { useId, useState } from 'react';
import { usePageTitle } from '../hooks/usePageTitle';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  Calendar as CalendarIcon,
  Scale,
  Target,
  Zap,
  Moon,
  TrendingDown,
} from 'lucide-react';
import {
  getUserStats,
  upsertUserStats,
  listBodyWeightLogs,
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
  formatBirthDateDisplay,
} from '../lib/statsHelpers';
import { parseOptionalFloat } from '../utils/numbers';
import { useMutationError } from '../hooks/useMutationError';
import { BirthCalendar } from '../components/BirthCalendar';
import { MutationAlert } from '../components/MutationAlert';
import { QueryState } from '../components/QueryState';
import { UnitInput } from '../components/UnitInput';
import type { BodyWeightLog } from '../types';
import { buildMondayWeeks } from '../lib/statsHelpers';
import { appLocale } from '../lib/locale';

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
  const [editingStats, setEditingStats] = useState(false);
  const [birthDate, setBirthDate] = useState<string>('');
  const [heightCm, setHeightCm] = useState<string>('');
  const [goalKg, setGoalKg] = useState<string>('');
  const [todayWeight, setTodayWeight] = useState<string>('');
  const [weightError, setWeightError] = useState(false);

  const userStatsQuery = useQuery({
    queryKey: ['user-stats', user.id],
    queryFn: () => getUserStats(user.id),
  });

  // Sync form state when entering edit mode (avoid setState in effect)
  const startEditingStats = () => {
    if (userStats) {
      setBirthDate(userStats.birth_date ? userStats.birth_date.slice(0, 10) : '');
      setHeightCm(String(userStats.height_cm ?? ''));
      setGoalKg(String(userStats.goal_weight_kg ?? ''));
    }
    setEditingStats(true);
  };

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

  const workoutDays = workoutDaysQuery.data ?? [];
  const workoutDaysMap = new Map(workoutDays.map((d) => [d.date, d.icon]));

  const dailyStatsQuery = useQuery({
    queryKey: ['user-daily-training-stats', user.id],
    queryFn: async () => {
      const start = new Date();
      start.setDate(start.getDate() - 84);
      return getDailyTrainingStats(user.id, localDateKey(start));
    },
  });

  const dailyStatsRows = dailyStatsQuery.data ?? [];

  const statsLoading =
    userStatsQuery.isLoading ||
    weightLogsQuery.isLoading ||
    workoutDaysQuery.isLoading ||
    dailyStatsQuery.isLoading;
  const statsError =
    userStatsQuery.error ??
    weightLogsQuery.error ??
    workoutDaysQuery.error ??
    dailyStatsQuery.error;
  const statsIsError =
    userStatsQuery.isError ||
    weightLogsQuery.isError ||
    workoutDaysQuery.isError ||
    dailyStatsQuery.isError;
  const refetchStats = () => {
    void userStatsQuery.refetch();
    void weightLogsQuery.refetch();
    void workoutDaysQuery.refetch();
    void dailyStatsQuery.refetch();
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

  const updateStatsMutation = useMutation({
    mutationFn: (updates: {
      birth_date?: string | null;
      height_cm?: number | null;
      goal_weight_kg?: number | null;
    }) => upsertUserStats(user.id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-stats', user.id] });
      setEditingStats(false);
    },
    onError: onMutationError,
  });

  const addWeightMutation = useMutation({
    mutationFn: (weight: number) => {
      return upsertBodyWeightLog(user.id, todayIso(), weight);
    },
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

  const saveStats = () => {
    updateStatsMutation.mutate({
      birth_date: birthDate.trim() ? birthDate.trim() : null,
      height_cm: parseOptionalFloat(heightCm.replace(',', '.')),
      goal_weight_kg: parseOptionalFloat(goalKg.replace(',', '.')),
    });
  };

  const addTodayWeight = () => {
    const w = parseOptionalFloat(todayWeight.replace(',', '.'));
    if (w == null || w <= 0 || w > 500) {
      setWeightError(true);
      return;
    }
    setWeightError(false);
    addWeightMutation.mutate(w);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-semibold text-[var(--color-ink)] tracking-tight text-balance">
          {t('yourStats')}
        </h1>
        <p className="text-sm text-[var(--color-muted)] mt-1">
          {t('statsSubtitle')} · {new Date().toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      <MutationAlert message={mutationError} onDismiss={clearError} />

      <QueryState
        isLoading={statsLoading}
        isError={statsIsError}
        error={statsError as Error | null}
        refetch={refetchStats}
      >
      {/* Quick stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          icon={<Scale size={20} />}
          label={t('currentKg')}
          value={currentWeight != null ? `${currentWeight} kg` : '—'}
        />
        <StatCard
          icon={<Activity size={20} />}
          label={t('age')}
          value={age != null ? `${age} ${t('yearsOld')}` : '—'}
        />
        <StatCard
          icon={<Target size={20} />}
          label={t('goalKg')}
          value={goal != null ? `${goal} kg` : '—'}
        />
        <StatCard
          icon={<TrendingDown size={20} />}
          label={t('bmiLabel')}
          value={
            bmi != null
              ? `${bmi} (${t(bmiCategory(bmi))})`
              : '—'
          }
        />
      </div>

      {/* Add today's weight */}
      <section className="dr-card p-5 sm:p-6">
        <h2 className="font-medium text-[var(--color-ink)] mb-3 flex items-center gap-2">
          <Scale size={18} />
          {t('logWeight')}
        </h2>
        <form
          className="flex flex-wrap items-start gap-2"
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
          <button
            type="submit"
            disabled={!todayWeight.trim() || addWeightMutation.isPending}
            className="dr-press min-h-[48px] shrink-0 rounded-xl bg-[var(--color-accent)] px-5 text-sm font-semibold text-[var(--color-on-accent)] disabled:opacity-50 touch-manipulation"
          >
            {t('save')}
          </button>
        </form>
      </section>

      {/* User stats: birth date, height, goal */}
      <section className="dr-card p-5 sm:p-6">
        <h2 className="font-medium text-[var(--color-ink)] mb-3 flex items-center gap-2">
          <CalendarIcon size={18} />
          {t('profileSettings')}
        </h2>
        {editingStats ? (
          <div className="space-y-3">
            <div>
              <p className="mb-1 text-sm text-[var(--color-muted)]">{t('birthDate')}</p>
              <BirthCalendar value={birthDate} onChange={setBirthDate} />
            </div>
            <label className="block max-w-xs">
              <span className="mb-1 block text-sm text-[var(--color-muted)]">{t('heightCm')}</span>
              <UnitInput
                value={heightCm}
                onChange={setHeightCm}
                unit={t('unitCm')}
                placeholder="175"
              />
            </label>
            <label className="block max-w-xs">
              <span className="mb-1 block text-sm text-[var(--color-muted)]">{t('goalKg')}</span>
              <UnitInput
                value={goalKg}
                onChange={setGoalKg}
                unit={t('unitKg')}
                placeholder="75"
              />
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={saveStats}
                disabled={updateStatsMutation.isPending}
                className="dr-press px-5 py-2 min-h-[44px] rounded-xl bg-[var(--color-accent)] text-[var(--color-on-accent)] text-sm font-semibold touch-manipulation"
              >
                {t('save')}
              </button>
              <button
                type="button"
                onClick={() => setEditingStats(false)}
                className="dr-press px-5 py-2 min-h-[44px] rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink)] text-sm hover:bg-[var(--color-hover)] touch-manipulation"
              >
                {t('cancel')}
              </button>
            </div>
          </div>
        ) : (
          <div>
          <dl className="grid gap-2.5 text-sm">
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-[var(--color-muted)]">{t('birthDate')}</dt>
              <dd className="tabular-nums text-right">{userStats?.birth_date ? formatBirthDateDisplay(userStats.birth_date.slice(0, 10), locale) : '—'}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-[var(--color-muted)]">{t('heightCm')}</dt>
              <dd className="tabular-nums text-right">{userStats?.height_cm ? `${userStats.height_cm} cm` : '—'}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-[var(--color-muted)]">{t('goalKg')}</dt>
              <dd className="tabular-nums text-right">{userStats?.goal_weight_kg ? `${userStats.goal_weight_kg} kg` : '—'}</dd>
            </div>
          </dl>
          <button
            type="button"
            onClick={startEditingStats}
            className="mt-3 inline-flex items-center min-h-[44px] text-[var(--color-ink)] font-medium hover:underline touch-manipulation"
          >
            {t('edit')}
          </button>
          </div>
        )}
      </section>

      {/* Weight goal graph */}
      {(weightsForChart.length > 0 || goal != null) && (
        <section className="dr-card p-5 sm:p-6">
          <h2 className="font-medium text-[var(--color-ink)] mb-4 flex items-center gap-2">
            <TrendingDown size={18} />
            {t('weightGoalGraph')}
          </h2>
          <WeightChart weights={weightsForChart} goalKg={goal} />
        </section>
      )}

      {/* Activity grid - GitHub style */}
      <section className="dr-card p-5 sm:p-6">
        <h2 className="font-medium text-[var(--color-ink)] mb-3 flex items-center gap-2">
          <Activity size={18} />
          {t('activityDays')}
        </h2>
        <div className="flex items-center gap-4 mb-3 text-xs text-[var(--color-muted)]">
          <span className="flex items-center gap-1">
            <Zap size={14} style={{ color: 'var(--color-chart-active)' }} />
            {t('activeDays')}
          </span>
          <span className="flex items-center gap-1">
            <Moon size={14} style={{ color: 'var(--color-chart-rest)' }} />
            {t('restDays')}
          </span>
        </div>
        <ContributionGrid days={days} workoutDaysMap={workoutDaysMap} />
      </section>

      <section className="dr-card p-5 sm:p-6">
        <h2 className="font-medium text-[var(--color-ink)] mb-1 flex items-center gap-2">
          <Zap size={18} />
          {t('analyticsRollupTitle')}
        </h2>
        <p className="text-xs text-[var(--color-muted)] mb-4">{t('analyticsRollupSubtitle')}</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div className="p-3 rounded-2xl bg-[var(--color-accent-soft)]">
            <p className="text-[var(--color-muted)] text-xs">{t('analyticsTotalActivities')}</p>
            <p className="font-semibold text-[var(--color-ink)] tabular-nums">{analyticsTotals.activities}</p>
          </div>
          <div className="p-3 rounded-2xl bg-[var(--color-accent-soft)]">
            <p className="text-[var(--color-muted)] text-xs">{t('analyticsStrengthSessions')}</p>
            <p className="font-semibold text-[var(--color-ink)] tabular-nums">{analyticsTotals.strength}</p>
          </div>
          <div className="p-3 rounded-2xl bg-[var(--color-accent-soft)]">
            <p className="text-[var(--color-muted)] text-xs">{t('analyticsCardioSessions')}</p>
            <p className="font-semibold text-[var(--color-ink)] tabular-nums">{analyticsTotals.cardio}</p>
          </div>
          <div className="p-3 rounded-2xl bg-[var(--color-accent-soft)]">
            <p className="text-[var(--color-muted)] text-xs">{t('analyticsCompletedSets')}</p>
            <p className="font-semibold text-[var(--color-ink)] tabular-nums">{analyticsTotals.sets}</p>
          </div>
        </div>
      </section>
      </QueryState>
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
    <div className="dr-card p-4 sm:p-5 min-w-0">
      <div className="flex items-center gap-2 text-[var(--color-muted)]">
        {icon}
        <p className="dr-label">{label}</p>
      </div>
      <p className="font-serif text-xl text-[var(--color-ink)] mt-2 min-w-0 break-words">{value}</p>
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
          className="w-full max-w-full h-auto min-h-[220px]"
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
      <p className="text-xs text-[var(--color-muted)] mt-3">{t('last12Weeks')}</p>
    </div>
  );
}
