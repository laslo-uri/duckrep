import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Lock, Moon, ShieldCheck, Sun } from 'lucide-react';
import { builtInPassphrase, MIN_PASSPHRASE, setup, unlock, type VaultState } from '../lib/vault/vault';
import { useTheme } from '../contexts/ThemeContext';
import { DuckrepMark, DuckrepWordmark } from './DuckrepLogo';
import { LanguageSwitcher } from './LanguageSwitcher';

/** Shown until the vault is unlocked. First run creates the passphrase (or takes the built-in one). */
export function LockScreen({ state, onUnlocked }: { state: Exclude<VaultState, 'unlocked'>; onUnlocked: () => void }) {
  const { t } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const [pass, setPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const builtIn = builtInPassphrase();

  // first run with a built-in passphrase: set it up without asking
  useEffect(() => {
    if (state !== 'unset' || !builtIn) return;
    setup(builtIn)
      .then(onUnlocked)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, [state, builtIn, onUnlocked]);

  const creating = state === 'unset' && !builtIn;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(undefined);
    setBusy(true);
    try {
      if (creating) {
        if (pass !== confirm) throw new Error(t('lockMismatch'));
        await setup(pass);
      } else {
        await unlock(pass);
      }
      setPass('');
      setConfirm('');
      onUnlocked();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message === 'Wrong passphrase.' ? t('lockWrong') : message);
    } finally {
      setBusy(false);
    }
  };

  const field =
    'dr-field mt-1 block w-full min-h-[44px] px-4 py-2.5 text-base outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]';

  return (
    <div className="relative flex min-h-[100dvh] flex-col bg-[var(--color-paper)] text-[var(--color-ink)]">
      <div className="absolute top-0 inset-x-0 z-20 flex justify-end items-center gap-1 px-4 sm:px-8 h-14">
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
      <div className="dr-lobby-glow dr-lobby-glow-a" aria-hidden />
      <div className="dr-lobby-glow dr-lobby-glow-b" aria-hidden />
      <main id="main-content" className="relative z-10 flex flex-1 items-center justify-center px-4 py-16">
        <form
          onSubmit={(e) => void submit(e)}
          aria-labelledby="lock-title"
          className="dr-card dr-enter w-full max-w-sm p-6 sm:p-7"
        >
          <div className="dr-lockup mb-6 flex items-center gap-4">
            <DuckrepMark size={60} animateIn className="rounded-2xl" />
            <div className="min-w-0 text-left">
              <h1 id="lock-title" className="font-serif text-2xl">
                <DuckrepWordmark />
              </h1>
              <p className="text-sm text-[var(--color-muted)]">{creating ? t('lockCreateTitle') : t('lockLocked')}</p>
            </div>
          </div>

          {state === 'unset' && builtIn ? (
            <p className="text-sm text-[var(--color-muted)]" role="status">
              {error ?? t('lockBuiltIn')}
            </p>
          ) : (
            <>
              <label htmlFor="lock-pass" className="dr-label">
                {creating ? t('lockNewPassphrase') : t('lockPassphrase')}
              </label>
              <input
                id="lock-pass"
                type="password"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                autoFocus
                autoComplete={creating ? 'new-password' : 'current-password'}
                className={field}
              />
              {creating && (
                <>
                  <label htmlFor="lock-confirm" className="dr-label mt-4 block">
                    {t('lockRepeat')}
                  </label>
                  <input
                    id="lock-confirm"
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    autoComplete="new-password"
                    className={field}
                  />
                  <p className="mt-3 flex gap-2 text-xs leading-relaxed text-[var(--color-muted)]">
                    <ShieldCheck size={14} className="mt-0.5 shrink-0 text-[var(--color-accent)]" aria-hidden />
                    {t('lockCreateHint', { min: MIN_PASSPHRASE })}
                  </p>
                </>
              )}
              {error && (
                <p className="mt-3 text-sm text-[var(--color-error)]" role="alert">
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={busy || pass.length === 0 || (creating && pass.length < MIN_PASSPHRASE)}
                className="dr-press mt-5 flex w-full min-h-[44px] items-center justify-center gap-2 rounded-xl bg-[var(--color-accent)] px-4 py-2.5 font-medium text-[var(--color-on-accent)] disabled:opacity-50"
              >
                <Lock size={16} aria-hidden />
                {busy ? t('lockWorking') : creating ? t('lockCreate') : t('lockUnlock')}
              </button>
            </>
          )}
        </form>
      </main>
    </div>
  );
}
