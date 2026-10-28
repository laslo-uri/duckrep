import { useState } from 'react';
import { useMutationError } from '../hooks/useMutationError';
import { MutationAlert } from '../components/MutationAlert';
import { QueryState } from '../components/QueryState';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, Calendar, Dumbbell, Sun, Moon } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useLocalUser } from '../contexts/LocalUserContext';
import { BirthCalendar } from '../components/BirthCalendar';
import { CookieSettingsLink } from '../components/CookieConsent';
import { FamilySky } from '../components/FamilySky';
import { BackToRootsware } from '../components/BackToRootsware';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { UnitInput } from '../components/UnitInput';
import { DuckrepMark } from '../components/DuckrepLogo';
import { getProfileDisplayName, setProfileDisplayName, todayIso, upsertBodyWeightLog, upsertUserStats } from '../lib/db';
import { APP_VERSION } from '../lib/appVersion';
import { dailyQuote } from '../lib/dailyQuote';
import { parseOptionalFloat } from '../utils/numbers';

const DOORS = [
  { to: '/journal', key: 'myJournal', icon: Calendar },
  { to: '/stats', key: 'yourStats', icon: Activity },
  { to: '/exercises', key: 'exercises', icon: Dumbbell },
] as const;

const PLACEHOLDER_NAME = 'You';

function isIntroduced(name: string | null | undefined) {
  const trimmed = name?.trim() ?? '';
  return trimmed.length > 0 && trimmed !== PLACEHOLDER_NAME;
}

function Ridge() {
  return (
    <div className="dr-ridge relative h-full w-full">
      <svg viewBox="0 0 1440 400" preserveAspectRatio="xMidYMax meet" className="absolute inset-0 h-full w-full" aria-hidden>
        <defs>
          <linearGradient id="ridgeLeft" x1="200" y1="175" x2="250" y2="400" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#71717a" />
            <stop offset="1" stopColor="#3f3f46" />
          </linearGradient>
          <linearGradient id="ridgeMainL" x1="560" y1="48" x2="500" y2="400" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#a1a1aa" />
            <stop offset="1" stopColor="#52525b" />
          </linearGradient>
          <linearGradient id="ridgeMainR" x1="860" y1="48" x2="980" y2="400" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#52525b" />
            <stop offset="1" stopColor="#27272a" />
          </linearGradient>
          <linearGradient id="ridgeRight" x1="1040" y1="145" x2="1140" y2="400" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#e88818" />
            <stop offset="1" stopColor="#d63a08" />
          </linearGradient>
        </defs>
        <g className="dr-lobby-ridge">
          <path fill="url(#ridgeLeft)" d="M340 175 L90 400 L340 400 Z" />
          <path fill="#27272a" d="M340 175 L520 400 L340 400 Z" />
          <path fill="#d4d4d8" opacity="0.85" d="M340 175 L292 236 L352 220 Z" />
          <path fill="url(#ridgeRight)" d="M1120 145 L940 400 L1120 400 Z" />
          <path fill="#9a2d06" d="M1120 145 L1360 400 L1120 400 Z" />
          <path fill="#fdba74" opacity="0.85" d="M1120 145 L1076 206 L1134 190 Z" />
          <path fill="url(#ridgeMainL)" d="M720 48 L430 400 L720 400 Z" />
          <path fill="url(#ridgeMainR)" d="M720 48 L1040 400 L720 400 Z" />
          <path fill="#d4d4d8" opacity="0.35" d="M720 48 L600 210 L720 268 Z" />
          <path fill="#18181b" opacity="0.45" d="M720 48 L850 190 L720 268 Z" />
          <path fill="#fafafa" d="M720 48 L650 140 L720 112 L800 132 Z" />
          <path className="dr-ridge-line" pathLength="100" d="M250 310 L470 214 L640 262 L1120 145" />
          <g className="dr-lobby-dot">
            <circle cx="1120" cy="145" r="26" fill="#f06a20" opacity="0.22" />
            <circle className="dr-summit" cx="1120" cy="145" r="10" fill="#f06a20" />
          </g>
        </g>
      </svg>
    </div>
  );
}

function DailyQuote() {
  const { t } = useTranslation();
  const quote = dailyQuote();

  return (
    <figure className="dr-enter mt-6 w-full max-w-sm text-left">
      <p className="dr-label">{t('lobbyDailyQuote')}</p>
      <blockquote className="mt-2 text-sm sm:text-base leading-relaxed text-[var(--color-ink)] text-balance">
        “{quote.text}”
      </blockquote>
      <figcaption className="mt-2 text-xs text-[var(--color-muted)]">{quote.author}</figcaption>
    </figure>
  );
}

const STEPS = 3
const fieldClass =
  'mt-1 w-full px-3 py-2 min-h-[48px] text-base rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none'

function inRange(value: string, min: number, max: number) {
  if (!value.trim()) return true
  const number = parseOptionalFloat(value)
  return number != null && number >= min && number <= max
}

export function LobbyPage() {
  const { t } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const { user } = useLocalUser();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [step, setStep] = useState(0);
  const [birthDate, setBirthDate] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [goalKg, setGoalKg] = useState('');
  const [measureError, setMeasureError] = useState(false);
  const { mutationError, clearError, onMutationError } = useMutationError();

  const { data: displayName, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['profile', user.id],
    queryFn: () => getProfileDisplayName(user.id),
  });

  const introduced = isIntroduced(displayName);
  const greetingName = displayName?.trim() ?? '';

  const saveIntro = useMutation({
    mutationFn: async () => {
      const trimmed = name.trim();
      await setProfileDisplayName(user.id, trimmed);
      const height = parseOptionalFloat(heightCm);
      const weight = parseOptionalFloat(weightKg);
      const goal = parseOptionalFloat(goalKg);
      await upsertUserStats(user.id, {
        birth_date: birthDate.trim() ? birthDate.trim() : null,
        height_cm: height != null && height >= 100 && height <= 250 ? height : null,
        goal_weight_kg: goal != null && goal >= 30 && goal <= 300 ? goal : null,
      });
      if (weight != null && weight >= 30 && weight <= 300) {
        await upsertBodyWeightLog(user.id, todayIso(), weight);
      }
    },
    onSuccess: () => {
      clearError();
      queryClient.invalidateQueries({ queryKey: ['profile', user.id] });
      queryClient.invalidateQueries({ queryKey: ['user-stats', user.id] });
      queryClient.invalidateQueries({ queryKey: ['body-weight-logs', user.id] });
    },
    onError: onMutationError,
  });

  const measurementsOk =
    inRange(heightCm, 100, 250) && inRange(weightKg, 30, 300) && inRange(goalKg, 30, 300);

  const goNext = () => {
    if (step === 0) {
      if (!name.trim()) return;
      setStep(1);
      return;
    }
    if (step === 1) {
      if (!measurementsOk) {
        setMeasureError(true);
        return;
      }
      setMeasureError(false);
      setStep(2);
      return;
    }
    if (!name.trim() || saveIntro.isPending) return;
    clearError();
    saveIntro.mutate();
  };

  return (
    <div className="relative h-[var(--app-dvh)] overflow-hidden bg-[var(--color-paper)] text-[var(--color-ink)] flex flex-col">
      <FamilySky />

      <div className="absolute top-0 inset-x-0 z-20 flex justify-end items-center gap-1 px-4 sm:px-8 h-14">
        <BackToRootsware className="mr-auto text-[var(--color-muted)]" />
        <button
          type="button"
          onClick={toggleTheme}
          className="dr-press p-2.5 min-w-[44px] min-h-[44px] rounded-lg hover:bg-[var(--color-hover)] text-[var(--color-muted)] hover:text-[var(--color-ink)]"
          aria-label={theme === 'dark' ? t('lightMode') : t('darkMode')}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <LanguageSwitcher />
      </div>

      <main
        id="main-content"
        className="relative z-10 flex-1 min-h-0 overflow-y-auto pb-[calc(var(--dr-ridge-h)+1.75rem+env(safe-area-inset-bottom,0px))]"
      >
        <div className="min-h-full flex flex-col items-center px-4 sm:px-8 py-8 text-center">
          <div className="my-auto flex w-full max-w-xl flex-col items-center">
          <div className="dr-lockup flex flex-col items-center">
            <DuckrepMark size={!introduced && step > 0 ? 56 : 88} animateIn className="dr-enter" />
            <p className="dr-enter dr-label mt-5">{t('lobbyEyebrow')}</p>
            {introduced && (
              <h1 className="dr-enter dr-lobby-title dr-lobby-hello mt-3 font-serif font-semibold tracking-tight text-balance">
                {t('lobbyHello', { name: greetingName })}
              </h1>
            )}
          </div>

          {isError && (
            <div className="mt-8 w-full max-w-md text-left">
              <QueryState
                isLoading={false}
                isError
                error={error}
                refetch={() => void refetch()}
              >
                {null}
              </QueryState>
            </div>
          )}

          {!isLoading && !isError && introduced && (
            <>
              <p className="dr-enter mt-4 max-w-md text-base sm:text-lg text-[var(--color-muted)] text-balance">
                {t('lobbyTagline')}
              </p>
              <DailyQuote />
              <nav className="mt-8 grid grid-cols-3 gap-3 w-full max-w-xl">
                {DOORS.map((door, i) => {
                  const Icon = door.icon;
                  return (
                    <Link
                      key={door.to}
                      to={door.to}
                      className="dr-door dr-enter flex flex-col items-center justify-center gap-2 min-h-[96px] rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/80 px-3 py-4 text-[var(--color-muted)]"
                      style={{ animationDelay: `${140 + i * 70}ms` }}
                    >
                      <Icon size={22} aria-hidden />
                      <span className="text-sm font-medium text-balance leading-tight">{t(door.key)}</span>
                    </Link>
                  );
                })}
              </nav>
            </>
          )}

          {!isLoading && !isError && !introduced && (
            <form
              key={step}
              className="dr-enter mt-6 w-full max-w-sm text-left"
              onSubmit={(event) => {
                event.preventDefault();
                goNext();
              }}
            >
              <MutationAlert message={mutationError} onDismiss={clearError} />
              <p className="dr-label text-center">{t('lobbyStepProgress', { current: step + 1, total: STEPS })}</p>
              {step === 0 && (
                <>
                  <h1 className="mt-3 text-center font-serif text-3xl font-semibold tracking-tight text-balance text-[var(--color-ink)]">
                    {t('lobbyStepNameTitle')}
                  </h1>
                  <label className="mt-6 block">
                    <span className="dr-label">{t('lobbyName')}</span>
                    <input
                      type="text"
                      required
                      autoFocus
                      autoComplete="name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder={t('lobbyNamePlaceholder')}
                      className={fieldClass}
                    />
                  </label>
                </>
              )}
              {step === 1 && (
                <>
                  <h1 className="mt-3 text-center font-serif text-3xl font-semibold tracking-tight text-balance text-[var(--color-ink)]">
                    {t('lobbyStepBodyTitle')}
                  </h1>
                  <p className="mt-2 text-center text-sm text-[var(--color-muted)] text-balance">{t('lobbyStepBodyHint')}</p>
                  <label className="mt-5 block">
                    <span className="dr-label">{t('heightCm')}</span>
                    <UnitInput
                      className="mt-1"
                      value={heightCm}
                      unit={t('unitCm')}
                      placeholder="175"
                      onChange={(value) => {
                        setHeightCm(value);
                        setMeasureError(false);
                      }}
                    />
                  </label>
                  <label className="mt-3 block">
                    <span className="dr-label">{t('currentWeightKg')}</span>
                    <UnitInput
                      className="mt-1"
                      value={weightKg}
                      unit={t('unitKg')}
                      placeholder="72.5"
                      onChange={(value) => {
                        setWeightKg(value);
                        setMeasureError(false);
                      }}
                    />
                  </label>
                  <label className="mt-3 block">
                    <span className="dr-label">{t('goalWeightKg')}</span>
                    <UnitInput
                      className="mt-1"
                      value={goalKg}
                      unit={t('unitKg')}
                      placeholder="70"
                      onChange={(value) => {
                        setGoalKg(value);
                        setMeasureError(false);
                      }}
                    />
                  </label>
                  {measureError && (
                    <p className="mt-3 text-sm text-balance text-[var(--color-ink)]">{t('lobbyMeasureInvalid')}</p>
                  )}
                </>
              )}
              {step === 2 && (
                <>
                  <h1 className="mt-3 text-center font-serif text-3xl font-semibold tracking-tight text-balance text-[var(--color-ink)]">
                    {t('lobbyStepBirthTitle')}
                  </h1>
                  <p className="mt-2 text-center text-sm text-[var(--color-muted)] text-balance">{t('lobbyStepBirthHint')}</p>
                  <BirthCalendar className="mt-4" value={birthDate} onChange={setBirthDate} />
                </>
              )}
              <div className="mt-5 flex gap-2">
                {step > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setMeasureError(false);
                      setStep((current) => current - 1);
                    }}
                    className="dr-press inline-flex min-h-[48px] items-center justify-center rounded-xl border border-[var(--color-border)] px-4 text-sm font-medium text-[var(--color-muted)]"
                  >
                    {t('lobbyBack')}
                  </button>
                )}
                {step > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setMeasureError(false);
                      if (step === 1) setStep(2);
                      else goNext();
                    }}
                    className="dr-press inline-flex min-h-[48px] items-center justify-center rounded-xl px-4 text-sm font-medium text-[var(--color-muted)]"
                  >
                    {t('lobbySkip')}
                  </button>
                )}
                <button
                  type="submit"
                  disabled={saveIntro.isPending || (step === 0 && !name.trim())}
                  className="dr-press inline-flex min-h-[48px] flex-1 items-center justify-center rounded-xl bg-[var(--color-accent)] px-6 font-semibold text-[var(--color-on-accent)] disabled:opacity-50"
                >
                  {step === STEPS - 1 ? t('lobbyDone') : t('lobbyContinue')}
                </button>
              </div>
            </form>
          )}
          </div>
        </div>
      </main>

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[5]">
        <div className="dr-ridge-slot">
          <Ridge />
        </div>
        <footer className="pointer-events-auto flex h-[calc(1.75rem+env(safe-area-inset-bottom,0px))] items-center justify-center bg-[var(--color-paper)] pb-[env(safe-area-inset-bottom,0px)] text-[11px] leading-none text-[var(--color-muted)]">
          {t('appVersion', { version: APP_VERSION })}
          <CookieSettingsLink className="ml-3 inline-flex min-h-[28px] items-center underline-offset-2 hover:text-[var(--color-ink)] hover:underline" />
        </footer>
      </div>
    </div>
  );
}
