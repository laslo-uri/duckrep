import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Activity, Apple, Calendar, Dumbbell } from 'lucide-react';
import { YouPeakMark } from './YouPeakLogo';

const linkClass =
  'group inline-flex items-center gap-1.5 text-sm text-[var(--color-ink)] transition-colors hover:text-[var(--color-accent)]';
const iconClass = 'shrink-0 text-[var(--color-muted)] group-hover:text-[var(--color-accent)]';

export function Footer() {
  const { t } = useTranslation();
  const nav = [
    { to: '/journal', icon: Calendar, label: t('myJournal') },
    { to: '/exercises', icon: Dumbbell, label: t('exercises') },
    { to: '/stats', icon: Activity, label: t('yourStats') },
    { to: '/food', icon: Apple, label: t('food') },
  ];

  return (
    <footer className="border-t border-[var(--color-border)]">
      <div className="max-w-5xl mx-auto px-4 sm:px-8 py-8 pb-[calc(6.75rem+env(safe-area-inset-bottom))] md:pb-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-start gap-3">
            <YouPeakMark size={40} className="mt-0.5" />
            <div>
              <p className="font-serif text-sm font-semibold tracking-tight text-[var(--color-logo)]">
                {t('appName')}
              </p>
              <nav className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2" aria-label={t('footer.navLabel')}>
                {nav.map(({ to, icon: Icon, label }) => (
                  <Link key={to} to={to} className={linkClass}>
                    <Icon size={14} className={iconClass} aria-hidden />
                    {label}
                  </Link>
                ))}
              </nav>
            </div>
          </div>
          <p className="text-right text-xs sm:shrink-0">
            <span className="text-[var(--color-muted)]">
              {t('footer.madeBy')}{' '}
              <a
                href="https://laslouri.com"
                className="text-[var(--color-ink)] hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                laslouri.com
              </a>
            </span>
            <span className="mt-1 block text-[var(--color-muted)]">
              {t('footer.copyright', { year: new Date().getFullYear() })}
            </span>
          </p>
        </div>
      </div>
    </footer>
  );
}
