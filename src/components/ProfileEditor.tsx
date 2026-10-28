import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BirthCalendar } from './BirthCalendar';
import { UnitInput } from './UnitInput';
import { useLocalUser } from '../contexts/LocalUserContext';
import { useMutationError } from '../hooks/useMutationError';
import { MutationAlert } from './MutationAlert';
import {
  getLatestBodyWeight,
  getProfileDisplayName,
  getUserStats,
  setProfileDisplayName,
  todayIso,
  upsertBodyWeightLog,
  upsertUserStats,
} from '../lib/db';
import { parseOptionalFloat } from '../utils/numbers';

const PLACEHOLDER_NAME = 'You';

function inRange(value: string, min: number, max: number) {
  if (!value.trim()) return true;
  const number = parseOptionalFloat(value.replace(',', '.'));
  return number != null && number >= min && number <= max;
}

export function ProfileEditor() {
  const { t } = useTranslation();
  const { user } = useLocalUser();
  const queryClient = useQueryClient();
  const { mutationError, clearError, onMutationError } = useMutationError();

  const profile = useQuery({
    queryKey: ['profile', user.id],
    queryFn: () => getProfileDisplayName(user.id),
  });
  const stats = useQuery({
    queryKey: ['user-stats', user.id],
    queryFn: () => getUserStats(user.id),
  });
  const weight = useQuery({
    queryKey: ['latest-body-weight', user.id],
    queryFn: () => getLatestBodyWeight(user.id),
  });

  if (profile.isLoading || stats.isLoading || weight.isLoading) {
    return <p className="text-sm text-[var(--color-muted)]">{t('loading')}</p>;
  }

  const initial = {
    name: profile.data?.trim() && profile.data.trim() !== PLACEHOLDER_NAME ? profile.data.trim() : '',
    birth: stats.data?.birth_date ? stats.data.birth_date.slice(0, 10) : '',
    height: stats.data?.height_cm != null ? String(stats.data.height_cm) : '',
    weight: weight.data != null ? String(weight.data) : '',
    goal: stats.data?.goal_weight_kg != null ? String(stats.data.goal_weight_kg) : '',
  };

  return (
    <ProfileForm
      key={`${initial.name}|${initial.birth}|${initial.height}|${initial.weight}|${initial.goal}`}
      initial={initial}
      pendingError={mutationError}
      onDismissError={clearError}
      onSave={async (draft) => {
        clearError();
        const trimmed = draft.name.trim();
        await setProfileDisplayName(user.id, trimmed);
        const height = parseOptionalFloat(draft.height.replace(',', '.'));
        const goal = parseOptionalFloat(draft.goal.replace(',', '.'));
        const current = parseOptionalFloat(draft.weight.replace(',', '.'));
        await upsertUserStats(user.id, {
          birth_date: draft.birth.trim() ? draft.birth.trim() : null,
          height_cm: height,
          goal_weight_kg: goal,
        });
        if (current != null) await upsertBodyWeightLog(user.id, todayIso(), current);
        queryClient.invalidateQueries({ queryKey: ['profile', user.id] });
        queryClient.invalidateQueries({ queryKey: ['user-stats', user.id] });
        queryClient.invalidateQueries({ queryKey: ['body-weight-logs', user.id] });
        queryClient.invalidateQueries({ queryKey: ['latest-body-weight', user.id] });
      }}
      onError={onMutationError}
    />
  );
}

function ProfileForm({
  initial,
  pendingError,
  onDismissError,
  onSave,
  onError,
}: {
  initial: { name: string; birth: string; height: string; weight: string; goal: string };
  pendingError: string | null;
  onDismissError: () => void;
  onSave: (draft: { name: string; birth: string; height: string; weight: string; goal: string }) => Promise<void>;
  onError: (error: Error) => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(initial.name);
  const [birth, setBirth] = useState(initial.birth);
  const [height, setHeight] = useState(initial.height);
  const [weight, setWeight] = useState(initial.weight);
  const [goal, setGoal] = useState(initial.goal);
  const [nameError, setNameError] = useState(false);
  const [measureError, setMeasureError] = useState(false);
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const savedTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (savedTimer.current != null) window.clearTimeout(savedTimer.current);
    };
  }, []);

  const measurementsOk = inRange(height, 100, 250) && inRange(weight, 30, 300) && inRange(goal, 30, 300);

  const markSaved = () => {
    setSaved(true);
    if (savedTimer.current != null) window.clearTimeout(savedTimer.current);
    savedTimer.current = window.setTimeout(() => setSaved(false), 1600);
  };

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        const trimmed = name.trim();
        if (!trimmed || trimmed === PLACEHOLDER_NAME) {
          setNameError(true);
          return;
        }
        if (!measurementsOk) {
          setMeasureError(true);
          return;
        }
        setNameError(false);
        setMeasureError(false);
        setPending(true);
        void onSave({ name, birth, height, weight, goal })
          .then(markSaved)
          .catch((error: unknown) => onError(error instanceof Error ? error : new Error('error')))
          .finally(() => setPending(false));
      }}
    >
      <MutationAlert message={pendingError} onDismiss={onDismissError} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)] lg:items-start">
        <div className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm text-[var(--color-muted)]">{t('lobbyName')}</span>
            <input
              type="text"
              autoComplete="name"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setNameError(false);
              }}
              className="w-full min-h-[48px] rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-base text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
            />
          </label>
          {nameError ? <p className="text-sm text-[var(--color-error)]">{t('profileNameRequired')}</p> : null}
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block min-w-0">
              <span className="mb-1 block text-sm text-[var(--color-muted)]">{t('heightCm')}</span>
              <UnitInput value={height} onChange={setHeight} unit={t('unitCm')} placeholder="175" />
            </label>
            <label className="block min-w-0">
              <span className="mb-1 block text-sm text-[var(--color-muted)]">{t('currentWeightKg')}</span>
              <UnitInput value={weight} onChange={setWeight} unit={t('unitKg')} placeholder="72.5" />
            </label>
            <label className="block min-w-0">
              <span className="mb-1 block text-sm text-[var(--color-muted)]">{t('goalWeightKg')}</span>
              <UnitInput value={goal} onChange={setGoal} unit={t('unitKg')} placeholder="70" />
            </label>
          </div>
          {measureError ? <p className="text-sm text-[var(--color-error)]">{t('lobbyMeasureInvalid')}</p> : null}
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={pending}
              className="dr-press min-h-[48px] rounded-xl bg-[var(--color-accent)] px-5 text-sm font-semibold text-[var(--color-on-accent)] disabled:opacity-50"
            >
              {t('save')}
            </button>
            {saved ? <p className="text-sm text-[var(--color-mint)]">{t('profileSaved')}</p> : null}
          </div>
        </div>
        <div>
          <p className="mb-1 text-sm text-[var(--color-muted)]">{t('birthDate')}</p>
          <BirthCalendar value={birth} onChange={setBirth} />
        </div>
      </div>
    </form>
  );
}
