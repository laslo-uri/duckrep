import { Link, Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Calendar, Dumbbell, Activity, Globe, LogOut, Sun, Moon, Settings } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { LanguageSwitcher } from './LanguageSwitcher';
import { YouPeakLogo } from './YouPeakLogo';
import { supabase } from '../lib/supabase';

export function Layout() {
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();

  const { data: profile } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', user!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const displayName =
    profile?.display_name ||
    user?.email?.split('@')[0] ||
    user?.user_metadata?.username ||
    user?.email ||
    '';

  const nav = [
    { to: '/', icon: Calendar, label: t('myJournal') },
    { to: '/stats', icon: Activity, label: t('yourStats') },
    { to: '/exercises', icon: Dumbbell, label: t('exercises') },
    { to: '/feed', icon: Globe, label: t('publicFeed') },
  ];

  return (
    <div className="min-h-[100dvh] w-full min-w-0 flex flex-col">
      <header className="sticky top-0 z-50 w-full min-w-0 border-b border-[var(--color-border)] bg-[var(--color-paper)]/95 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-3">
          <Link to="/" className="truncate min-w-0 flex items-center">
            <YouPeakLogo size={32} className="sm:text-lg" />
          </Link>
          <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0 min-w-0">
            {user && displayName && (
              <span className="max-[400px]:hidden text-sm text-[var(--color-muted)] truncate max-w-[80px] sm:max-w-[120px]" title={displayName}>
                {displayName}
              </span>
            )}
            <button
              onClick={toggleTheme}
              className="p-2.5 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 sm:p-2 rounded-lg hover:bg-[var(--color-hover)] text-[var(--color-muted)] hover:text-[var(--color-ink)] transition-colors touch-manipulation"
              title={theme === 'dark' ? t('lightMode') : t('darkMode')}
            >
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <LanguageSwitcher />
            {user && (
              <Link
                to="/settings"
                className="p-2.5 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 sm:p-2 rounded-lg hover:bg-[var(--color-hover)] text-[var(--color-muted)] hover:text-[var(--color-ink)] transition-colors touch-manipulation flex items-center justify-center"
                title={t('accountSettings')}
              >
                <Settings size={20} />
              </Link>
            )}
            {user && (
              <button
                onClick={() => signOut()}
                className="p-2.5 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 sm:p-2 rounded-lg hover:bg-[var(--color-hover)] text-[var(--color-muted)] hover:text-[var(--color-ink)] transition-colors touch-manipulation"
                title={t('logout')}
              >
                <LogOut size={20} />
              </button>
            )}
          </div>
        </div>
        {user && (
          <nav className="max-w-4xl mx-auto px-4 sm:px-6 flex gap-1 pb-3 overflow-x-auto overflow-y-hidden -webkit-overflow-scrolling-touch [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {nav.map(({ to, icon: Icon, label }) => (
              <Link
                key={to}
                to={to}
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
        )}
      </header>
      <main className="flex-1 w-full min-w-0 max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  );
}
