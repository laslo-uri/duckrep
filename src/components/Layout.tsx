import { useCallback, type ReactNode } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Calendar, Dumbbell, Activity, Sun, Moon, Settings, Plus } from 'lucide-react';
import { useLocalUser } from '../contexts/LocalUserContext';
import { useTheme } from '../contexts/ThemeContext';
import { LanguageSwitcher } from './LanguageSwitcher';
import { DuckrepMark, DuckrepWordmark } from './DuckrepLogo';
import { CookieSettingsLink } from './CookieConsent';
import { BackToRootsware } from './BackToRootsware';
import { MutationAlert } from './MutationAlert';
import { WorkoutDayIcon } from './WorkoutIconPicker';
import { getProfileDisplayName, listWorkoutDays } from '../lib/db';
import { APP_VERSION } from '../lib/appVersion';
import { appLocale } from '../lib/locale';
import { useStartActivity } from '../hooks/useStartActivity';
import { useGlobalShortcuts } from '../hooks/useGlobalShortcuts';
import { useMutationError } from '../hooks/useMutationError';

function isNavActive(to: string, pathname: string) {
  if (to === '/journal') return pathname === '/journal' || pathname.startsWith('/activity');
  return pathname === to || pathname.startsWith(`${to}/`);
}

function useNav() {
  const { t } = useTranslation();
  return [
    { to: '/journal', icon: Calendar, label: t('myJournal'), key: 'J' },
    { to: '/stats', icon: Activity, label: t('yourStats'), key: 'S' },
    { to: '/exercises', icon: Dumbbell, label: t('exercises'), key: 'E' },
  ];
}

/**
 * The page's title bar (44px, hairline below), as in Hawkdone. Holds the page h1 on the left and
 * page actions on the right; on phones it also carries the duck so the brand stays visible.
 */
export function PageHeader({
  title,
  meta,
  actions,
  children,
}: {
  title?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="sticky top-0 z-30 flex h-[var(--dr-header-h)] shrink-0 items-center gap-2 border-b border-[var(--color-border)] bg-[var(--color-paper)]/90 px-3 backdrop-blur-md md:px-4">
      <Link to="/" className="dr-tap dr-tap-w -ml-1 flex items-center justify-center md:hidden" aria-label="Duckrep">
        <DuckrepMark size={24} className="rounded-md" />
      </Link>
      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden whitespace-nowrap">
        {children ?? (
          <>
            <h1 className="truncate text-[14px] font-semibold text-[var(--color-ink)] md:text-[13px]">{title}</h1>
            {meta ? <span className="truncate text-[12px] text-[var(--color-faint)]">{meta}</span> : null}
          </>
        )}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-1">{actions}</div> : null}
    </div>
  );
}

function shortDate(date: string, locale: string) {
  return new Date(date + 'T00:00:00').toLocaleDateString(locale, { day: 'numeric', month: 'short' });
}

function Sidebar({ onNew, newPending }: { onNew: () => void; newPending: boolean }) {
  const { t, i18n } = useTranslation();
  const locale = appLocale(i18n.language);
  const { user } = useLocalUser();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const nav = useNav();

  const { data: displayName } = useQuery({
    queryKey: ['profile', user.id],
    queryFn: () => getProfileDisplayName(user.id),
  });
  const { data: days = [] } = useQuery({
    queryKey: ['workout-days', user.id],
    queryFn: () => listWorkoutDays(user.id),
  });
  const recent = days.slice(0, 6);

  return (
    <aside className="sticky top-0 hidden h-[var(--app-dvh)] w-14 shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-panel)] md:flex lg:w-56">
      <div className="flex h-11 shrink-0 items-center gap-2 px-3.5 lg:px-3">
        <Link to="/" className="dr-logo flex min-w-0 items-center gap-2 text-[14px] text-[var(--color-logo)]" title="Duckrep">
          <DuckrepMark size={22} className="rounded-md" />
          <DuckrepWordmark className="hidden lg:inline" />
        </Link>
      </div>

      <div className="px-2.5 pb-2 lg:px-3">
        <button
          type="button"
          onClick={onNew}
          disabled={newPending}
          className="dr-btn dr-btn-primary w-full px-0 lg:px-2.5"
          title={`${t('newWorkout')} (C)`}
          aria-label={t('newWorkout')}
        >
          <Plus size={14} aria-hidden />
          <span className="hidden lg:inline">{t('newWorkout')}</span>
          <kbd className="dr-kbd ml-auto hidden border-black/25 bg-black/10 text-current lg:inline">C</kbd>
        </button>
      </div>

      <nav aria-label={t('mainNav')} className="flex flex-1 flex-col overflow-y-auto px-2 pb-3">
        <div className="flex flex-col gap-px">
          {nav.map(({ to, icon: Icon, label, key }) => {
            const active = isNavActive(to, location.pathname);
            return (
              <Link
                key={to}
                to={to}
                aria-current={active ? 'page' : undefined}
                title={`${label} (G ${key})`}
                aria-label={label}
                className="dr-nav-item justify-center lg:justify-start"
              >
                <Icon size={15} aria-hidden className={active ? 'text-[var(--color-accent)]' : ''} />
                <span className="hidden truncate lg:inline">{label}</span>
              </Link>
            );
          })}
        </div>

        {recent.length > 0 && (
          <div className="mt-4 hidden lg:block">
            <p className="flex h-6 items-center px-2 text-[11px] font-medium uppercase tracking-wide text-[var(--color-faint)]">
              {t('recentActivities')}
            </p>
            <div className="mt-0.5 flex flex-col gap-px">
              {recent.map((day) => {
                const to = `/activity/${day.id}`;
                const live = Boolean(day.started_at && !day.ended_at);
                return (
                  <Link
                    key={day.id}
                    to={to}
                    aria-current={location.pathname === to ? 'page' : undefined}
                    className="dr-nav-item"
                  >
                    <WorkoutDayIcon iconKey={day.icon} size={13} className="shrink-0" fallbackToFirst />
                    <span className="min-w-0 flex-1 truncate">{day.title || shortDate(day.date, locale)}</span>
                    {live ? (
                      <span className="dr-live-dot shrink-0" aria-label={t('openSession')} />
                    ) : (
                      <span className="shrink-0 text-[11px] text-[var(--color-faint)]">{shortDate(day.date, locale)}</span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </nav>

      <div className="border-t border-[var(--color-border)] p-2">
        <BackToRootsware variant="sidebar" className="mb-1 hidden text-[var(--color-muted)] lg:inline-flex" />
        <Link
          to="/settings"
          aria-current={location.pathname === '/settings' ? 'page' : undefined}
          className="dr-nav-item justify-center lg:justify-start"
          title={`${t('settings')} (G ,)`}
          aria-label={t('settings')}
        >
          <Settings size={15} aria-hidden />
          <span className="hidden truncate lg:inline">{t('settings')}</span>
          <span className="ml-auto hidden max-w-[7rem] truncate text-[12px] text-[var(--color-faint)] lg:inline">
            {displayName ?? user.displayName}
          </span>
        </Link>
        <div className="mt-1 flex flex-col items-center gap-0.5 lg:flex-row lg:px-1">
          <button
            type="button"
            onClick={toggleTheme}
            className="dr-btn dr-btn-ghost dr-icon-btn"
            title={theme === 'dark' ? t('lightMode') : t('darkMode')}
            aria-label={theme === 'dark' ? t('lightMode') : t('darkMode')}
          >
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          </button>
          <LanguageSwitcher />
          <a
            href="https://laslouri.com"
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto hidden truncate text-[11px] text-[var(--color-faint)] hover:text-[var(--color-ink)] lg:inline"
            title={t('footer.madeBy') + ' laslouri.com'}
          >
            v{APP_VERSION}
          </a>
        </div>
        <CookieSettingsLink className="hidden px-2 pt-1 text-[11px] text-[var(--color-faint)] hover:text-[var(--color-ink)] lg:block" />
      </div>
    </aside>
  );
}

function TabBar() {
  const { t } = useTranslation();
  const location = useLocation();
  const items = [...useNav(), { to: '/settings', icon: Settings, label: t('settings'), key: ',' }];
  return (
    <nav
      aria-label={t('mainNav')}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--color-border)] bg-[var(--color-panel)]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
    >
      <div className="flex h-[var(--dr-tabbar-h)]">
        {items.map(({ to, icon: Icon, label }) => {
          const active = isNavActive(to, location.pathname);
          return (
            <Link
              key={to}
              to={to}
              aria-current={active ? 'page' : undefined}
              className={`relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium leading-none touch-manipulation ${
                active ? 'text-[var(--color-ink)]' : 'text-[var(--color-muted)]'
              }`}
            >
              {active && <span className="absolute inset-x-6 top-0 h-0.5 rounded-b bg-[var(--color-accent)]" aria-hidden />}
              <Icon size={19} strokeWidth={active ? 2.3 : 1.9} className={active ? 'text-[var(--color-accent)]' : ''} aria-hidden />
              <span className="max-w-full truncate px-1">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function Layout() {
  const { user } = useLocalUser();
  const location = useLocation();
  const { mutationError, clearError, onMutationError } = useMutationError();
  const start = useStartActivity(user.id, onMutationError);
  const { isPending, mutate } = start;
  const startNew = useCallback(() => {
    if (isPending) return;
    clearError();
    mutate();
  }, [isPending, mutate, clearError]);
  useGlobalShortcuts(startNew);

  return (
    <div className="flex min-h-[var(--app-dvh)] w-full min-w-0">
      <Sidebar onNew={startNew} newPending={isPending} />
      <main
        id="main-content"
        className="flex min-w-0 flex-1 flex-col pb-[calc(var(--dr-tabbar-h)+env(safe-area-inset-bottom))] md:pb-0"
      >
        {mutationError ? (
          <div className="px-3 pt-3 md:px-4">
            <MutationAlert message={mutationError} onDismiss={clearError} />
          </div>
        ) : null}
        <div key={location.pathname} className="dr-enter flex min-w-0 flex-1 flex-col">
          <Outlet context={{ startNew, newPending: isPending }} />
        </div>
      </main>
      <TabBar />
    </div>
  );
}

/** Standard padded body under a PageHeader. */
export function PageBody({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`min-w-0 flex-1 px-3 py-4 md:px-4 lg:px-6 ${className}`}>{children}</div>;
}
