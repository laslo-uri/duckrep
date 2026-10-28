import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyRound, Lock } from 'lucide-react';
import { exportSqlJsDump, flushDb, lockJournal } from '../lib/db';
import { changePassphrase, MIN_PASSPHRASE } from '../lib/vault/vault';
import { AUTO_LOCK_CHOICES, getAutoLockMinutes, setAutoLockMinutes } from '../lib/vault/autoLock';

/** Settings → Security: lock now, auto-lock delay, change the passphrase. */
export function SecuritySettings() {
  const { t } = useTranslation();
  const [minutes, setMinutes] = useState(getAutoLockMinutes);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (next !== repeat) {
      setMessage({ ok: false, text: t('lockMismatch') });
      return;
    }
    setBusy(true);
    try {
      await flushDb();
      const bytes = await exportSqlJsDump();
      if (!bytes) throw new Error(t('exportFailed'));
      await changePassphrase(current, next, bytes);
      setCurrent('');
      setNext('');
      setRepeat('');
      setMessage({ ok: true, text: t('securityChanged') });
    } catch (err) {
      const text = err instanceof Error ? err.message : String(err);
      setMessage({ ok: false, text: text === 'Wrong passphrase.' ? t('lockWrong') : text });
    } finally {
      setBusy(false);
    }
  }

  const field =
    'dr-input mt-1 block w-full max-w-sm';

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-[13px] font-semibold text-[var(--color-ink)]">{t('securityTitle')}</h2>
        <p className="mb-3 max-w-md text-[12px] text-[var(--color-muted)]">{t('securityHint')}</p>
        <div className="flex flex-wrap items-end gap-4">
          <button
            type="button"
            onClick={() => void lockJournal()}
            className="dr-btn dr-btn-primary"
          >
            <Lock size={16} aria-hidden />
            {t('securityLockNow')}
          </button>
          <label className="block text-sm">
            <span className="dr-label">{t('securityAutoLock')}</span>
            <select
              value={minutes}
              onChange={(e) => {
                const value = Number(e.target.value);
                setMinutes(value);
                void setAutoLockMinutes(value);
              }}
              className="dr-input mt-1 block"
            >
              {AUTO_LOCK_CHOICES.map((m) => (
                <option key={m} value={m}>
                  {m === 0 ? t('securityAutoLockNever') : t('securityAutoLockMinutes', { count: m })}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <form onSubmit={(e) => void submit(e)} className="border-t border-[var(--color-border)] pt-5">
        <h2 className="text-[13px] font-semibold text-[var(--color-ink)]">{t('securityChangeTitle')}</h2>
        <p className="mb-3 max-w-md text-[12px] text-[var(--color-muted)]">{t('securityChangeHint', { min: MIN_PASSPHRASE })}</p>
        <label htmlFor="sec-current" className="dr-label">{t('securityCurrent')}</label>
        <input id="sec-current" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} className={field} />
        <label htmlFor="sec-next" className="dr-label mt-3 block">{t('lockNewPassphrase')}</label>
        <input id="sec-next" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} className={field} />
        <label htmlFor="sec-repeat" className="dr-label mt-3 block">{t('lockRepeat')}</label>
        <input id="sec-repeat" type="password" autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} className={field} />
        {message && (
          <p className={`mt-3 text-sm ${message.ok ? 'text-[var(--color-success)]' : 'text-[var(--color-error)]'}`} role={message.ok ? 'status' : 'alert'}>
            {message.text}
          </p>
        )}
        <button
          type="submit"
          disabled={busy || !current || next.length < MIN_PASSPHRASE}
          className="dr-btn mt-4"
        >
          <KeyRound size={16} aria-hidden />
          {busy ? t('lockWorking') : t('securityChange')}
        </button>
      </form>
    </div>
  );
}
