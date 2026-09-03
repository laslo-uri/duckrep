import { useId, useState } from 'react';
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
import { MutationAlert } from '../components/MutationAlert';
import { QueryState } from '../components/QueryState';
import type { BodyWeightLog } from '../types';
import { WorkoutDayIcon } from '../components/WorkoutIconPicker';

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
  const { t } = useTranslation();
  const { user } = useLocalUser();
  const queryClient = useQueryClient();
  const { mutationError, clearError, onMutationError } = useMutationError();
  const [editingStats, setEditingStats] = useState(false);
  const [birthDate, setBirthDate] = useState<string>('');
  const [heightCm, setHeightCm] = useState<string>('');
  const [goalKg, setGoalKg] = useState<string>('');
  const [todayWeight, setTodayWeight] = useState<string>('');

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
      return listWorkoutDaysForStats(user.id, start.toISOString().slice(0, 10));
    },
  });

  const workoutDays = workoutDaysQuery.data ?? [];
  const workoutDaysMap = new Map(workoutDays.map((d) => [d.date, d.icon]));

  const dailyStatsQuery = useQuery({
    queryKey: ['user-daily-training-stats', user.id],
    queryFn: async () => {
      const start = new Date();
      start.setDate(start.getDate() - 84);
      return getDailyTrainingStats(user.id, start.toISOString().slice(0, 10));
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
      const date = new Date().toISOString().slice(0, 10);
      return upsertBodyWeightLog(user.id, date, weight);
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
      height_cm: parseOptionalFloat(heightCm),
      goal_weight_kg: parseOptionalFloat(goalKg),
    });
  };

  const addTodayWeight = () => {
    const w = parseOptionalFloat(todayWeight);
    if (w != null && w > 0) addWeightMutation.mutate(w);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-xl sm:text-2xl font-semibold text-[var(--color-ink)] tracking-tight">
          {t('yourStats')}
        </h1>
        <p className="text-sm text-[var(--color-muted)] mt-1">
          {t('statsSubtitle')} · {new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
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
      <section className="p-4 sm:p-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
        <h2 className="font-medium text-[var(--color-ink)] mb-3 flex items-center gap-2">
          <Scale size={18} />
          {t('logWeight')}
        </h2>
        <div className="flex flex-wrap gap-2">
          <input
            type="number"
            step="0.1"
            placeholder={t('unitKg')}
            value={todayWeight}
            onChange={(e) => setTodayWeight(e.target.value)}
            className="w-24 px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] focus:outline-none focus:ring-1 focus:ring-[var(--color-ink)]"
          />
          <button
            type="button"
            onClick={addTodayWeight}
            disabled={!todayWeight || addWeightMutation.isPending}
            className="px-4 py-2 min-h-[44px] rounded-lg bg-[var(--color-ink)] text-[var(--color-paper)] text-sm font-medium hover:opacity-90 disabled:opacity-50 touch-manipulation"
          >
            {t('save')}
          </button>
        </div>
      </section>

      {/* User stats: birth date, height, goal */}
      <section className="p-4 sm:p-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
        <h2 className="font-medium text-[var(--color-ink)] mb-3 flex items-center gap-2">
          <CalendarIcon size={18} />
          {t('profileSettings')}
        </h2>
        {editingStats ? (
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-[var(--color-muted)] mb-1">{t('birthDate')}</label>
              <input
                type="date"
                min="1920-01-01"
                max={new Date().toISOString().slice(0, 10)}
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                className="w-full max-w-xs px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink)] focus:outline-none focus:ring-1 focus:ring-[var(--color-ink)] [color-scheme:light] dark:[color-scheme:dark]"
              />
            </div>
            <div>
              <label className="block text-sm text-[var(--color-muted)] mb-1">{t('heightCm')}</label>
              <input
                type="number"
                step="0.1"
                min="100"
                max="250"
                placeholder="175"
                value={heightCm}
                onChange={(e) => setHeightCm(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] focus:outline-none focus:ring-1 focus:ring-[var(--color-ink)]"
              />
            </div>
            <div>
              <label className="block text-sm text-[var(--color-muted)] mb-1">{t('goalKg')}</label>
              <input
                type="number"
                step="0.1"
                min="30"
                max="300"
                placeholder="75"
                value={goalKg}
                onChange={(e) => setGoalKg(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] focus:outline-none focus:ring-1 focus:ring-[var(--color-ink)]"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={saveStats}
                disabled={updateStatsMutation.isPending}
                className="px-4 py-2 min-h-[44px] rounded-lg bg-[var(--color-ink)] text-[var(--color-paper)] text-sm font-medium touch-manipulation"
              >
                {t('save')}
              </button>
              <button
                type="button"
                onClick={() => setEditingStats(false)}
                className="px-4 py-2 min-h-[44px] rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink)] text-sm hover:bg-[var(--color-hover)] touch-manipulation"
              >
                {t('cancel')}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2 text-sm">
            <p>
              <span className="text-[var(--color-muted)]">{t('birthDate')}:</span>{' '}
              {userStats?.birth_date ? formatBirthDateDisplay(userStats.birth_date.slice(0, 10)) : '—'}
            </p>
            <p>
              <span className="text-[var(--color-muted)]">{t('heightCm')}:</span>{' '}
              {userStats?.height_cm ? `${userStats.height_cm} cm` : '—'}
            </p>
            <p>
              <span className="text-[var(--color-muted)]">{t('goalKg')}:</span>{' '}
              {userStats?.goal_weight_kg ? `${userStats.goal_weight_kg} kg` : '—'}
            </p>
            <button
              type="button"
              onClick={startEditingStats}
              className="text-[var(--color-ink)] font-medium hover:underline mt-2 min-h-[44px] touch-manipulation"
            >
              {t('edit')}
            </button>
          </div>
        )}
      </section>

      {/* Weight goal graph */}
      {(weightsForChart.length > 0 || goal != null) && (
        <section className="p-4 sm:p-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
          <h2 className="font-medium text-[var(--color-ink)] mb-4 flex items-center gap-2">
            <TrendingDown size={18} />
            {t('weightGoalGraph')}
          </h2>
          <WeightChart weights={weightsForChart} goalKg={goal} />
        </section>
      )}

      {/* Activity grid - GitHub style */}
      <section className="p-4 sm:p-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
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

      <section className="p-4 sm:p-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
        <h2 className="font-medium text-[var(--color-ink)] mb-1 flex items-center gap-2">
          <Zap size={18} />
          {t('analyticsRollupTitle')}
        </h2>
        <p className="text-xs text-[var(--color-muted)] mb-4">{t('analyticsRollupSubtitle')}</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div className="p-3 rounded-lg bg-[var(--color-hover)]/60">
            <p className="text-[var(--color-muted)] text-xs">{t('analyticsTotalActivities')}</p>
            <p className="font-semibold text-[var(--color-ink)] tabular-nums">{analyticsTotals.activities}</p>
          </div>
          <div className="p-3 rounded-lg bg-[var(--color-hover)]/60">
            <p className="text-[var(--color-muted)] text-xs">{t('analyticsStrengthSessions')}</p>
            <p className="font-semibold text-[var(--color-ink)] tabular-nums">{analyticsTotals.strength}</p>
          </div>
          <div className="p-3 rounded-lg bg-[var(--color-hover)]/60">
            <p className="text-[var(--color-muted)] text-xs">{t('analyticsCardioSessions')}</p>
            <p className="font-semibold text-[var(--color-ink)] tabular-nums">{analyticsTotals.cardio}</p>
          </div>
          <div className="p-3 rounded-lg bg-[var(--color-hover)]/60">
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
    <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="flex items-center gap-2 text-[var(--color-muted)] mb-1">{icon}</div>
      <p className="text-xs text-[var(--color-muted)]">{label}</p>
      <p className="font-semibold text-[var(--color-ink)]">{value}</p>
    </div>
  );
}

function formatChartDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
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
  const { t } = useTranslation();
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
          .map((log) => `${formatChartDate(log.date)}: ${log.weight_kg} ${t('unitKg')}`)
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
              <title>{`${formatChartDate(log.date)} · ${log.weight_kg} kg`}</title>
            </circle>
          ))}

          {n > 0 ? (
            <g>
              <text x={toX(0)} y={H - 16} textAnchor="middle" fill={labelFill} style={{ fontSize: 11 }}>
                {formatChartDate(weights[0].date)}
              </text>
              {n > 2 ? (
                <text
                  x={toX(Math.floor((n - 1) / 2))}
                  y={H - 16}
                  textAnchor="middle"
                  fill={labelFill}
                  style={{ fontSize: 11 }}
                >
                  {formatChartDate(weights[Math.floor((n - 1) / 2)].date)}
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
                  {formatChartDate(weights[n - 1].date)}
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
  const { t } = useTranslation();
  const cols = 7;
  const rows = Math.ceil(days.length / cols);
  const totalCells = cols * rows;
  const paddedDays = [...Array(totalCells - days.length).fill(null), ...days];
  const activeCount = days.filter((d) => workoutDaysMap.has(d.toISOString().slice(0, 10))).length;

  return (
    <div
      className="contribution-grid overflow-x-auto"
      role="img"
      aria-label={t('activityDaysCount', { count: activeCount })}
    >
      <div
        className="inline-grid gap-[2px]"
        style={{
          gridTemplateColumns: `repeat(${cols}, var(--grid-cell, 16px))`,
          gridTemplateRows: `repeat(${rows}, var(--grid-cell, 16px))`,
        }}
      >
        {paddedDays.map((d, i) => {
          if (!d) return <div key={`empty-${i}`} />;
          const dateStr = d.toISOString().slice(0, 10);
          const icon = workoutDaysMap.get(dateStr);
          const isActive = workoutDaysMap.has(dateStr);
          return (
            <div
              key={dateStr}
              title={dateStr}
              className="rounded-sm flex items-center justify-center transition-colors"
              style={{
                width: 'var(--grid-cell, 16px)',
                height: 'var(--grid-cell, 16px)',
                backgroundColor: isActive
                  ? 'var(--color-chart-active)'
                  : 'var(--color-chart-rest)',
              }}
            >
              {isActive && (
                <WorkoutDayIcon
                  iconKey={icon ?? null}
                  size={10}
                  className="text-[var(--color-ink)] opacity-90"
                  fallbackToFirst
                />
              )}
            </div>
          );
        })}
      </div>
      <p className="text-xs text-[var(--color-muted)] mt-2">
        {t('last12Weeks')}
      </p>
    </div>
  );
}
