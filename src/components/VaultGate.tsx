import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { initDb, lockJournal } from '../lib/db';
import { vaultState, type VaultState } from '../lib/vault/vault';
import { watchIdle } from '../lib/vault/autoLock';
import { LockScreen } from './LockScreen';

/** Keeps the journal behind the lock screen; opens the database once the vault is unlocked. */
export function VaultGate({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [state, setState] = useState<VaultState | 'loading'>('loading');
  const [bootError, setBootError] = useState<string | null>(null);

  useEffect(() => {
    vaultState()
      .then(setState)
      .catch((err: unknown) => setBootError(err instanceof Error ? err.message : String(err)));
  }, []);

  const onUnlocked = useCallback(() => {
    setState('unlocked');
    initDb().catch((err: unknown) => {
      console.error('[duckrep] could not open the journal', err);
      setBootError(err instanceof Error ? err.message : String(err));
    });
  }, []);

  useEffect(() => {
    if (state !== 'unlocked') return;
    return watchIdle(() => void lockJournal());
  }, [state]);

  if (bootError) {
    return (
      <div role="alert" className="mx-auto my-12 max-w-lg px-6 text-[var(--color-ink)]">
        <h1 className="text-xl font-semibold">{t('bootFailedTitle')}</h1>
        <p className="mt-3 text-[var(--color-muted)]">{t('bootFailedHint')}</p>
        <pre className="mt-4 whitespace-pre-wrap break-words rounded-lg bg-[var(--color-surface)] p-3 text-xs">{bootError}</pre>
      </div>
    );
  }
  if (state === 'loading') {
    return (
      <div className="dr-boot" role="status" aria-label={t('loading')}>
        <div className="dr-boot-spinner" />
      </div>
    );
  }
  if (state !== 'unlocked') return <LockScreen state={state} onUnlocked={onUnlocked} />;
  return children;
}
