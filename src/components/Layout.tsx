import { Link, Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Calendar, Dumbbell, Activity, Sun, Moon, Settings } from 'lucide-react';
import { useLocalUser } from '../contexts/LocalUserContext';
import { useTheme } from '../contexts/ThemeContext';
import { LanguageSwitcher } from './LanguageSwitcher';
import { YouPeakLogo } from './YouPeakLogo';
import { getProfileDisplayName } from '../lib/db';

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
    { to: '/', icon: Calendar, label: t('myJournal') },
    { to: '/stats', icon: Activity, label: t('yourStats') },
    { to: '/exercises', icon: Dumbbell, label: t('exercises') },
  ];

  return (
    <div className="min-h-[100dvh] w-full min-w-0 flex flex-col">
      <header className="sticky top-0 z-50 w-full min-w-0 border-b border-[var(--color-border)] bg-[var(--color-paper)]/95 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-3">
          <Link to="/" className="truncate min-w-0 flex items-center">
            <YouPeakLogo size={32} className="sm:text-lg" />
          </Link>
          <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0 min-w-0">
            <span
              className="max-[400px]:hidden text-sm text-[var(--color-muted)] truncate max-w-[80px] sm:max-w-[120px]"
              title={displayName ?? user.displayName}
            >
              {displayName ?? user.displayName}
            </span>
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2.5 min-w-[44px] min-h-[44px] rounded-lg hover:bg-[var(--color-hover)] text-[var(--color-muted)] hover:text-[var(--color-ink)] transition-colors touch-manipulation"
              title={theme === 'dark' ? t('lightMode') : t('darkMode')}
              aria-label={theme === 'dark' ? t('lightMode') : t('darkMode')}
            >
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <LanguageSwitcher />
            <Link
              to="/settings"
              className="p-2.5 min-w-[44px] min-h-[44px] rounded-lg hover:bg-[var(--color-hover)] text-[var(--color-muted)] hover:text-[var(--color-ink)] transition-colors touch-manipulation flex items-center justify-center"
              title={t('settings')}
              aria-label={t('settings')}
            >
              <Settings size={20} />
            </Link>
          </div>
        </div>
        <nav className="max-w-4xl mx-auto px-4 sm:px-6 flex gap-1 pb-3 overflow-x-auto overflow-y-hidden -webkit-overflow-scrolling-touch [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {nav.map(({ to, icon: Icon, label }) => (
            <Link
              key={to}
              to={to}
              aria-current={location.pathname === to ? 'page' : undefined}
              className={`flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0 touch-manipulation ${
                location.pathname === to
                  ? 'bg-[var(--color-ink)] text-[var(--color-paper)]'
                  : 'text-[var(--color-muted)] hover:text-[var(--color-ink)] hover:bg-[var(--color-hover)] active:bg-[var(--color-active)]'
              }`}
            >
              <Icon size={18} className="flex-shrink-0" />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
      </header>
      <main id="main-content" className="flex-1 w-full min-w-0 max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  );
}
