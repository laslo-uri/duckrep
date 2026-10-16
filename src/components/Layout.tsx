import { Link, Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Calendar, Dumbbell, Activity, Apple, Sun, Moon, Settings } from 'lucide-react';
import { useLocalUser } from '../contexts/LocalUserContext';
import { useTheme } from '../contexts/ThemeContext';
import { LanguageSwitcher } from './LanguageSwitcher';
import { Footer } from './Footer';
import { YouPeakLogo } from './YouPeakLogo';
import { getProfileDisplayName } from '../lib/db';

function isNavActive(to: string, pathname: string) {
  if (to === '/journal') return pathname === '/journal' || pathname.startsWith('/activity');
  return pathname === to || pathname.startsWith(`${to}/`);
}

export function Layout() {
  const { t } = useTranslation();
  const { user } = useLocalUser();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();

  const { data: displayName } = useQuery({
    queryKey: ['profile', user.id],
    queryFn: () => getProfileDisplayName(user.id),
  });

  const nav = [
    { to: '/journal', icon: Calendar, label: t('myJournal') },
    { to: '/stats', icon: Activity, label: t('yourStats') },
    { to: '/exercises', icon: Dumbbell, label: t('exercises') },
    { to: '/food', icon: Apple, label: t('food') },
  ];

  return (
    <div className="min-h-[100dvh] w-full min-w-0 flex flex-col">
      {/* ── Header: one thin row on all sizes ── */}
      <header className="sticky top-0 z-50 w-full min-w-0 border-b border-[var(--color-border)] bg-[var(--color-paper)]/90 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 sm:px-8 h-14 flex items-center gap-3 sm:gap-4">
          <Link to="/" className="min-w-0 flex items-center min-h-[44px] yp-press">
            <YouPeakLogo size={30} />
          </Link>

          {/* Desktop inline nav */}
          <nav className="hidden md:flex items-center gap-1 min-w-0">
            {nav.map(({ to, icon: Icon, label }) => {
              const active = isNavActive(to, location.pathname);
              return (
                <Link
                  key={to}
                  to={to}
                  aria-current={active ? 'page' : undefined}
                  title={label}
                  className={`yp-press inline-flex items-center gap-2 px-2.5 xl:px-3 py-2 min-h-10 rounded-lg text-sm font-medium ${
                    active
                      ? 'bg-[var(--color-accent)] text-[var(--color-on-accent)]'
                      : 'text-[var(--color-muted)] hover:text-[var(--color-ink)] hover:bg-[var(--color-hover)]'
                  }`}
                >
                  <Icon size={16} aria-hidden />
                  <span className="hidden xl:inline">{label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Tools cluster */}
          <div className="ml-auto flex items-center gap-0.5 sm:gap-1 flex-shrink-0 min-w-0">
            <Link
              to="/settings#profile"
              className="hidden lg:inline-block truncate max-w-[140px] mr-1 py-3 text-sm text-[var(--color-muted)] hover:text-[var(--color-ink)]"
              title={t('profileTitle')}
            >
              {displayName ?? user.displayName}
            </Link>
            <button
              type="button"
              onClick={toggleTheme}
              className="yp-press p-2.5 min-w-[44px] min-h-[44px] rounded-lg hover:bg-[var(--color-hover)] text-[var(--color-muted)] hover:text-[var(--color-ink)] touch-manipulation"
              title={theme === 'dark' ? t('lightMode') : t('darkMode')}
              aria-label={theme === 'dark' ? t('lightMode') : t('darkMode')}
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <LanguageSwitcher />
            <Link
              to="/settings"
              aria-current={location.pathname === '/settings' ? 'page' : undefined}
              className={`yp-press p-2.5 min-w-[44px] min-h-[44px] rounded-lg hover:bg-[var(--color-hover)] touch-manipulation flex items-center justify-center ${
                location.pathname === '/settings'
                  ? 'text-[var(--color-ink)] bg-[var(--color-hover)]'
                  : 'text-[var(--color-muted)] hover:text-[var(--color-ink)]'
              }`}
              title={t('settings')}
              aria-label={t('settings')}
            >
              <Settings size={18} />
            </Link>
          </div>
        </div>
      </header>

      {/* ── Main content with route animation ── */}
      <main
        id="main-content"
        className="flex-1 w-full min-w-0 max-w-5xl mx-auto px-4 sm:px-8 pt-5 sm:pt-8 pb-4 md:pb-8 overflow-x-clip"
      >
        <div key={location.pathname} className="yp-enter">
          <Outlet />
        </div>
      </main>

      <Footer />

      {/* ── Mobile: floating pill tab bar ── */}
      <nav className="md:hidden fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pointer-events-none">
        <div className="pointer-events-auto flex w-full max-w-sm gap-1 rounded-xl bg-[var(--color-surface)]/90 backdrop-blur-md p-1.5 shadow-[var(--shadow-card)] border border-[var(--color-border)]">
          {nav.map(({ to, icon: Icon, label }) => {
            const active = isNavActive(to, location.pathname);
            return (
              <Link
                key={to}
                to={to}
                aria-current={active ? 'page' : undefined}
                className={`yp-press flex flex-1 min-w-0 flex-col items-center justify-center gap-0.5 min-h-[52px] rounded-lg text-[10px] min-[380px]:text-[11px] leading-tight font-medium touch-manipulation ${
                  active
                    ? 'bg-[var(--color-accent)] text-[var(--color-on-accent)]'
                    : 'text-[var(--color-muted)]'
                }`}
              >
                <Icon size={18} strokeWidth={active ? 2.4 : 2} />
                <span className="max-w-full px-0.5 text-center whitespace-normal leading-none line-clamp-2">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
