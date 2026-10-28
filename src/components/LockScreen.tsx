import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Lock, ShieldCheck } from 'lucide-react';
import { builtInPassphrase, MIN_PASSPHRASE, setup, unlock, type VaultState } from '../lib/vault/vault';
import { DuckrepMark, DuckrepWordmark } from './DuckrepLogo';
import { FamilySky } from './FamilySky';
import { BackToRootsware } from './BackToRootsware';

/** Shown until the vault is unlocked. First run creates the passphrase (or takes the built-in one). */
export function LockScreen({ state, onUnlocked }: { state: Exclude<VaultState, 'unlocked'>; onUnlocked: () => void }) {
  const { t, i18n } = useTranslation();
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

  const langs = ['en', 'sr', 'hu'] as const;
  const nextLang = langs[(langs.indexOf(i18n.language.slice(0, 2) as (typeof langs)[number]) + 1) % langs.length];

  return (
    <div className="relative flex min-h-[var(--app-dvh)] flex-col bg-[var(--color-paper)] text-[var(--color-ink)]">
      <FamilySky />
      <main id="main-content" className="relative z-10 flex flex-1 items-center justify-center p-6">
        <div className="gate">
          <form onSubmit={(e) => void submit(e)} aria-labelledby="lock-title" className="gate-card fg-enter dr-card">
            <div className="gate-head">
              <span className="family-mark">
                <span className="family-mark__tile">
                  <DuckrepMark size={48} />
                </span>
              </span>
              <div className="fg-enter fg-1 min-w-0 text-left">
                <h1 id="lock-title" className="gate-title">
                  <DuckrepWordmark />
                </h1>
                <p className="gate-status">{creating ? t('lockCreateTitle') : t('lockLocked')}</p>
              </div>
            </div>

            {state === 'unset' && builtIn ? (
              <p className="gate-note" role="status">
                {error ?? t('lockBuiltIn')}
              </p>
            ) : (
              <>
                <label htmlFor="lock-pass">{creating ? t('lockNewPassphrase') : t('lockPassphrase')}</label>
                <input id="lock-pass" type="password" value={pass} onChange={(e) => setPass(e.target.value)} autoFocus autoComplete={creating ? 'new-password' : 'current-password'} className="dr-input" />
                {creating && (
                  <>
                    <label htmlFor="lock-confirm">{t('lockRepeat')}</label>
                    <input id="lock-confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" className="dr-input" />
                    <p className="gate-hint">
                      <ShieldCheck size={14} aria-hidden />
                      {t('lockCreateHint', { min: MIN_PASSPHRASE })}
                    </p>
                  </>
                )}
                {error && (
                  <p className="gate-error text-[var(--color-error)]" role="alert">
                    {error}
                  </p>
                )}
                <button type="submit" disabled={busy || pass.length === 0 || (creating && pass.length < MIN_PASSPHRASE)} className="dr-btn dr-btn-primary">
                  <Lock size={14} aria-hidden />
                  {busy ? t('lockWorking') : creating ? t('lockCreate') : t('lockUnlock')}
                </button>
              </>
            )}
          </form>
          <div className="gate-foot fg-enter fg-3">
            <BackToRootsware />
            <button type="button" className="rw-back gate-lang" onClick={() => void i18n.changeLanguage(nextLang)} aria-label={t('switchLanguage', { lang: nextLang.toUpperCase() })} title={t('switchLanguage', { lang: nextLang.toUpperCase() })}>
              {i18n.language.slice(0, 2).toUpperCase()}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
