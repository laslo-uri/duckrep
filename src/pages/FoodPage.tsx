import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';
import {
  addFoodEntry,
  deleteFoodEntry,
  getUserStats,
  listFoodEntries,
  todayIso,
  upsertUserStats,
} from '../lib/db';
import { useLocalUser } from '../contexts/LocalUserContext';
import { useMutationError } from '../hooks/useMutationError';
import { MutationAlert } from '../components/MutationAlert';
import { FoodSearch } from '../components/FoodSearch';
import { QueryState } from '../components/QueryState';
import { parseOptionalFloat } from '../utils/numbers';
import { appLocale } from '../lib/locale';
import type { FoodEntry } from '../types';

function shiftDate(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Daily total calorie ring — traced in Glacier Mint while within the goal. */
function CalorieRing({
  total,
  goal,
  label,
  statusText,
}: {
  total: number;
  goal: number | null;
  label: string;
  statusText: string | null;
}) {
  const R = 52;
  const C = 2 * Math.PI * R;
  const pct = goal && goal > 0 ? Math.min(total / goal, 1) : 0;
  const over = goal != null && goal > 0 && total > goal;
  const stroke = over ? 'var(--color-error)' : goal ? 'var(--color-mint)' : 'var(--color-accent)';

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-36 h-36">
        <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
          <circle
            cx="60"
            cy="60"
            r={R}
            fill="none"
            stroke="color-mix(in srgb, var(--color-ink) 10%, var(--color-surface))"
            strokeWidth="9"
          />
          <circle
            cx="60"
            cy="60"
            r={R}
            fill="none"
            stroke={stroke}
            strokeWidth="9"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - (goal ? pct : 0))}
            className="transition-[stroke-dashoffset,stroke] duration-700"
            style={!over && goal && pct >= 1 ? { filter: 'drop-shadow(0 0 6px var(--color-mint))' } : undefined}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-serif text-3xl font-semibold text-[var(--color-ink)] tabular-nums">
            {Math.round(total)}
          </span>
          <span className="text-xs text-[var(--color-muted)] tabular-nums">
            {goal ? `/ ${Math.round(goal)} kcal` : 'kcal'}
          </span>
        </div>
      </div>
      <p className="yp-label mt-2">{label}</p>
      {statusText && (
        <p className={`text-xs font-semibold mt-0.5 ${over ? 'text-[var(--color-error)]' : 'text-[var(--color-mint)]'}`}>
          {statusText}
        </p>
      )}
    </div>
  );
}

/** Macro progress bar. Protein = Arctic Blue, Carbs = Frost White (ink), Fat = Subzero Gray. */
function MacroBar({
  label,
  value,
  goal,
  color,
}: {
  label: string;
  value: number;
  goal: number | null;
  color: string;
}) {
  const pct = goal && goal > 0 ? Math.min(value / goal, 1) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-[var(--color-ink)]">{label}</span>
        <span className="text-xs text-[var(--color-muted)] tabular-nums">
          {Math.round(value)}{goal ? ` / ${Math.round(goal)}` : ''} g
        </span>
      </div>
      <div className="mt-1.5 h-2 rounded-sm bg-[color-mix(in_srgb,var(--color-ink)_10%,var(--color-surface))] overflow-hidden">
        <div
          className="h-full rounded-sm transition-[width] duration-500"
          style={{ width: goal ? `${pct * 100}%` : value > 0 ? '100%' : '0%', background: color }}
        />
      </div>
    </div>
  );
}

export function FoodPage() {
  const { t, i18n } = useTranslation();
  const locale = appLocale(i18n.language);
  const { user } = useLocalUser();
  const queryClient = useQueryClient();
  const { mutationError, clearError, onMutationError } = useMutationError();
  const [date, setDate] = useState(() => todayIso());

  const [name, setName] = useState('');
  const [kcal, setKcal] = useState('');
  const [kcalError, setKcalError] = useState(false);
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');

  const [goalsOpen, setGoalsOpen] = useState(false);
  const [goalDraft, setGoalDraft] = useState<{ kcal: string; p: string; c: string; f: string } | null>(null);

  const { data: entries = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['food-entries', user.id, date],
    queryFn: () => listFoodEntries(user.id, date),
  });

  const { data: stats } = useQuery({
    queryKey: ['user-stats', user.id],
    queryFn: () => getUserStats(user.id),
  });

  const addMutation = useMutation({
    mutationFn: (calories: number) =>
      addFoodEntry(user.id, {
        date,
        name: name.trim(),
        calories,
        protein_g: parseOptionalFloat(protein),
        carbs_g: parseOptionalFloat(carbs),
        fat_g: parseOptionalFloat(fat),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['food-entries', user.id, date] });
      setName('');
      setKcal('');
      setKcalError(false);
      setProtein('');
      setCarbs('');
      setFat('');
    },
    onError: onMutationError,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteFoodEntry(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['food-entries', user.id, date] }),
    onError: onMutationError,
  });

  const saveGoalsMutation = useMutation({
    mutationFn: () =>
      upsertUserStats(user.id, {
        calorie_goal: parseOptionalFloat(goalDraft?.kcal ?? ''),
        protein_goal_g: parseOptionalFloat(goalDraft?.p ?? ''),
        carbs_goal_g: parseOptionalFloat(goalDraft?.c ?? ''),
        fat_goal_g: parseOptionalFloat(goalDraft?.f ?? ''),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-stats', user.id] });
      setGoalsOpen(false);
      setGoalDraft(null);
    },
    onError: onMutationError,
  });

  const totals = entries.reduce(
    (acc, e) => ({
      kcal: acc.kcal + e.calories,
      protein: acc.protein + (e.protein_g ?? 0),
      carbs: acc.carbs + (e.carbs_g ?? 0),
      fat: acc.fat + (e.fat_g ?? 0),
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );

  const calorieGoal = stats?.calorie_goal ?? null;
  const within = calorieGoal != null && calorieGoal > 0 && totals.kcal <= calorieGoal;
  const over = calorieGoal != null && calorieGoal > 0 && totals.kcal > calorieGoal;
  const isToday = date === todayIso();

  const dateLabel = isToday
    ? t('today')
    : new Date(date + 'T00:00:00').toLocaleDateString(locale, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      });

  const fieldClass =
    'w-full px-3 py-2 min-h-[44px] text-sm rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]';

  const openGoals = () => {
    setGoalDraft({
      kcal: stats?.calorie_goal != null ? String(stats.calorie_goal) : '',
      p: stats?.protein_goal_g != null ? String(stats.protein_goal_g) : '',
      c: stats?.carbs_goal_g != null ? String(stats.carbs_goal_g) : '',
      f: stats?.fat_goal_g != null ? String(stats.fat_goal_g) : '',
    });
    setGoalsOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-semibold text-[var(--color-ink)] tracking-tight text-balance">
            {t('food')}
          </h1>
          <p className="text-sm text-[var(--color-muted)] mt-1">{t('foodTagline')}</p>
        </div>

        {/* Date navigation */}
        <div className="flex items-center gap-1 min-w-0 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setDate((d) => shiftDate(d, -1))}
            className="yp-press p-2.5 min-w-[44px] min-h-[44px] rounded-lg hover:bg-[var(--color-hover)] text-[var(--color-muted)] hover:text-[var(--color-ink)] flex items-center justify-center touch-manipulation"
            aria-label={t('prevDay')}
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm font-medium text-[var(--color-ink)] min-w-0 flex-1 sm:flex-none sm:max-w-[16rem] text-center text-balance">
            {dateLabel}
          </span>
          <button
            type="button"
            onClick={() => setDate((d) => shiftDate(d, 1))}
            disabled={isToday}
            className="yp-press p-2.5 min-w-[44px] min-h-[44px] rounded-lg hover:bg-[var(--color-hover)] text-[var(--color-muted)] hover:text-[var(--color-ink)] flex items-center justify-center touch-manipulation disabled:opacity-30"
            aria-label={t('nextDay')}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <MutationAlert message={mutationError} onDismiss={clearError} />

      {/* Daily total + macros */}
      <section className="yp-card p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-10">
          <CalorieRing
            total={totals.kcal}
            goal={calorieGoal}
            label={t('dailyTotal')}
            statusText={within ? t('withinGoal') : over ? t('overGoal') : null}
          />
          <div className="flex-1 w-full space-y-4">
            <MacroBar
              label={t('protein')}
              value={totals.protein}
              goal={stats?.protein_goal_g ?? null}
              color="var(--color-accent)"
            />
            <MacroBar
              label={t('carbs')}
              value={totals.carbs}
              goal={stats?.carbs_goal_g ?? null}
              color="var(--color-ink)"
            />
            <MacroBar
              label={t('fat')}
              value={totals.fat}
              goal={stats?.fat_goal_g ?? null}
              color="var(--color-muted)"
            />
            <div className="pt-1">
              {goalsOpen && goalDraft ? (
                <div className="yp-enter grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(
                    [
                      ['kcal', t('caloriesLabel')],
                      ['p', t('protein')],
                      ['c', t('carbs')],
                      ['f', t('fat')],
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key} className="block min-w-0">
                      <span className="yp-label">{label}</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={goalDraft[key]}
                        onChange={(e) => setGoalDraft({ ...goalDraft, [key]: e.target.value })}
                        className={`${fieldClass} mt-1`}
                      />
                    </label>
                  ))}
                  <div className="col-span-2 sm:col-span-4 flex gap-2">
                    <button
                      type="button"
                      onClick={() => saveGoalsMutation.mutate()}
                      disabled={saveGoalsMutation.isPending}
                      className="yp-press px-4 py-2 min-h-[44px] rounded-xl bg-[var(--color-accent)] text-[var(--color-on-accent)] text-sm font-semibold touch-manipulation disabled:opacity-50"
                    >
                      {t('save')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setGoalsOpen(false);
                        setGoalDraft(null);
                      }}
                      className="yp-press px-4 py-2 min-h-[44px] rounded-xl border border-[var(--color-border)] text-sm font-medium hover:bg-[var(--color-hover)] touch-manipulation"
                    >
                      {t('cancel')}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={openGoals}
                  className="inline-flex items-center text-xs font-medium text-[var(--color-accent)] hover:underline min-h-[44px] touch-manipulation"
                >
                  {t('nutritionGoals')}
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Add entry */}
      <section className="yp-card p-5 sm:p-6">
        <FoodSearch
          onApply={(fields) => {
            setName(fields.name);
            setKcal(fields.kcal);
            setProtein(fields.protein);
            setCarbs(fields.carbs);
            setFat(fields.fat);
            setKcalError(false);
          }}
        />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            const calories = parseOptionalFloat(kcal);
            if (calories == null || calories < 0) {
              setKcalError(true);
              return;
            }
            setKcalError(false);
            clearError();
            addMutation.mutate(calories);
          }}
        >
          <div className="grid grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(4.5rem,5.5rem)_minmax(4rem,4.75rem)_minmax(4rem,4.75rem)_minmax(4rem,4.75rem)_auto] gap-2 items-end">
            <label className="col-span-2 lg:col-span-1 block min-w-0">
              <span className="yp-label">{t('foodName')}</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('foodNamePlaceholder')}
                className={`${fieldClass} mt-1`}
              />
            </label>
            {(
              [
                [kcal, setKcal, 'kcal'],
                [protein, setProtein, `${t('protein')} g`],
                [carbs, setCarbs, `${t('carbs')} g`],
                [fat, setFat, `${t('fat')} g`],
              ] as const
            ).map(([value, setter, label], i) => (
              <label key={i} className="block min-w-0">
                <span className="yp-label">{label}</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={value}
                  onChange={(e) => {
                    setter(e.target.value);
                    if (setter === setKcal) setKcalError(false);
                  }}
                  aria-invalid={setter === setKcal && kcalError ? true : undefined}
                  className={`${fieldClass} mt-1 tabular-nums`}
                />
              </label>
            ))}
            <button
              type="submit"
              disabled={addMutation.isPending || !name.trim()}
              className="yp-press col-span-2 lg:col-span-1 flex items-center justify-center gap-1.5 px-4 py-2 min-h-[44px] rounded-xl bg-[var(--color-accent)] text-[var(--color-on-accent)] text-sm font-semibold touch-manipulation disabled:opacity-50"
            >
              <Plus size={16} />
              {t('addFood')}
            </button>
          </div>
          {kcalError ? (
            <p className="mt-2 text-sm text-[var(--color-error)]" role="alert">
              {t('foodCaloriesInvalid')}
            </p>
          ) : null}
        </form>
      </section>

      {/* Entries */}
      <QueryState
        isLoading={isLoading}
        isError={isError}
        error={error}
        refetch={() => void refetch()}
        isEmpty={!isLoading && !isError && entries.length === 0}
        empty={
          <div className="yp-card flex flex-col items-center text-center px-5 py-12 sm:px-8 sm:py-14">
            <p className="font-serif text-xl text-[var(--color-ink)] text-balance">{t('noFoodYet')}</p>
            <p className="text-sm text-[var(--color-muted)] mt-2 text-balance">{t('noFoodHint')}</p>
          </div>
        }
      >
        <ul className="space-y-2">
          {entries.map((entry: FoodEntry, index) => (
            <li
              key={entry.id}
              className="yp-stagger yp-card flex items-center gap-3 px-4 py-3"
              style={{ ['--i' as string]: Math.min(index, 5) }}
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium text-[var(--color-ink)] truncate">{entry.name}</p>
                <p className="text-xs text-[var(--color-muted)] tabular-nums mt-0.5">
                  {Math.round(entry.calories)} kcal
                  {entry.protein_g != null && ` · ${t('proteinShort')} ${Math.round(entry.protein_g)} g`}
                  {entry.carbs_g != null && ` · ${t('carbsShort')} ${Math.round(entry.carbs_g)} g`}
                  {entry.fat_g != null && ` · ${t('fatShort')} ${Math.round(entry.fat_g)} g`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => deleteMutation.mutate(entry.id)}
                disabled={deleteMutation.isPending}
                className="yp-press shrink-0 p-2.5 min-w-[44px] min-h-[44px] rounded-lg text-[var(--color-muted)] hover:text-[var(--color-error)] hover:bg-[var(--color-error-bg)] flex items-center justify-center touch-manipulation disabled:opacity-50"
                aria-label={t('deleteEntry')}
              >
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      </QueryState>
    </div>
  );
}
