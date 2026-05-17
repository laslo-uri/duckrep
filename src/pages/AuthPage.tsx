import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Sun, Moon } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { YouPeakLogo } from '../components/YouPeakLogo';
import { isSupabaseConfigured } from '../lib/supabase';
import { toUserFriendlyError } from '../lib/authErrors';

export function AuthPage() {
  const { t } = useTranslation();
  const { user, signIn, signUp } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const toEmail = (raw: string) => `${raw.trim()}@youpeak.app`;

  const switchMode = () => {
    setMode((m) => (m === 'signIn' ? 'signUp' : 'signIn'));
    setError(null);
    setSuccess(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);
    const trimmed = username.trim();
    const email = toEmail(trimmed);

    if (mode === 'signIn') {
      const { error } = await signIn(email, password);
      setLoading(false);
      if (error) setError(toUserFriendlyError(error.message, t));
    } else {
      const { error, needsConfirmation } = await signUp(email, password, trimmed);
      setLoading(false);
      if (error) {
        setError(toUserFriendlyError(error.message, t));
      } else if (needsConfirmation) {
        setSuccess(t('authSignUpSuccess'));
      }
    }
  };

  return (
    <div className="min-h-[100dvh] w-full flex flex-col items-center justify-center px-4 sm:px-6 py-8">
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 flex items-center gap-1">
        <button
          onClick={toggleTheme}
          className="p-2.5 min-w-[44px] min-h-[44px] rounded-lg hover:bg-[var(--color-hover)] text-[var(--color-muted)] hover:text-[var(--color-ink)] transition-colors touch-manipulation flex items-center justify-center"
          title={theme === 'dark' ? t('lightMode') : t('darkMode')}
        >
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </div>
      <div className="w-full max-w-sm">
        <div className="mb-8 sm:mb-10">
          <h1 className="flex flex-col items-center gap-2 text-center">
            <YouPeakLogo size={44} layout="stacked" className="text-xl sm:text-2xl" />
            <span className="text-[var(--color-muted)] text-sm font-normal">{t('tagline')}</span>
          </h1>
          {!isSupabaseConfigured && (
            <p
              className="mt-4 text-xs sm:text-sm text-[var(--color-error)] bg-[var(--color-error-bg)] border border-[var(--color-error)]/25 rounded-xl px-3 py-2.5 text-left"
              role="alert"
            >
              {t('authSupabaseNotConfigured')}
            </p>
          )}
          <p className="mt-6 text-[var(--color-ink)]/70 text-sm">
            {mode === 'signIn' ? t('authSignInPrompt') : t('authSignUpPrompt')}
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-[var(--color-ink)] mb-1.5">
              {t('username')}
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
              placeholder="laslo-uri"
              className="w-full px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink)] placeholder:text-[var(--color-muted)]/80 focus:outline-none focus:ring-2 focus:ring-[var(--color-ink)]/15 focus:border-[var(--color-ink)]/40 transition-colors duration-150"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-[var(--color-ink)] mb-1.5">
              {t('password')}
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
              className="w-full px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink)] placeholder:text-[var(--color-muted)]/80 focus:outline-none focus:ring-2 focus:ring-[var(--color-ink)]/15 focus:border-[var(--color-ink)]/40 transition-colors duration-150"
            />
          </div>
          {error && (
            <p className="text-sm text-[var(--color-error)]" role="alert">
              {error}
            </p>
          )}
          {success && (
            <p className="text-sm text-green-600 dark:text-green-400" role="status">
              {success}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 min-h-[48px] rounded-xl bg-[var(--color-ink)] text-[var(--color-paper)] font-medium hover:opacity-90 active:scale-[0.99] transition-all duration-150 disabled:opacity-50 disabled:active:scale-100 touch-manipulation"
          >
            {loading
              ? mode === 'signIn'
                ? t('signingIn')
                : t('creatingAccount')
              : mode === 'signIn'
                ? t('login')
                : t('signUp')}
          </button>
        </form>
        <p className="mt-6 text-center text-sm">
          <button
            type="button"
            onClick={switchMode}
            className="text-[var(--color-muted)] hover:text-[var(--color-ink)] transition-colors"
          >
            {mode === 'signIn' ? t('authSwitchToSignUp') : t('authSwitchToSignIn')}
          </button>
        </p>
      </div>
    </div>
  );
}
