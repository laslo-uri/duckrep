import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

export function RestTimer({
  until,
  totalMs,
  onExpire,
  onAdd,
}: {
  until: number;
  totalMs: number;
  onExpire: () => void;
  onAdd: () => void;
}) {
  const { t } = useTranslation();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => {
      const next = Date.now();
      if (next >= until) {
        onExpire();
        return;
      }
      setNow(next);
    }, 250);
    return () => window.clearInterval(id);
  }, [until, onExpire]);

  const left = Math.max(0, until - now);
  const sec = Math.ceil(left / 1000);
  const label = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
  const pct = totalMs > 0 ? Math.max(0, Math.min(100, (left / totalMs) * 100)) : 0;

  return (
    <div
      className="fixed z-40 inset-x-3 md:inset-x-auto md:right-6 md:w-[22rem] bottom-[calc(7rem+env(safe-area-inset-bottom))] md:bottom-6"
      role="timer"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="yp-live rounded-xl bg-[var(--color-accent)] text-[var(--color-on-accent)] shadow-[var(--shadow-card)] px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="yp-label !text-[var(--color-on-accent)] opacity-70">{t('restTitle')}</p>
            <p className="font-serif text-4xl tabular-nums leading-none mt-1">{label}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onAdd}
              className="yp-press px-3 min-h-[44px] rounded-lg bg-black/10 text-sm font-medium touch-manipulation"
            >
              {t('restAdd15')}
            </button>
            <button
              type="button"
              onClick={onExpire}
              className="yp-press px-3 min-h-[44px] rounded-lg bg-[var(--color-on-accent)] text-[var(--color-accent)] text-sm font-semibold touch-manipulation"
            >
              {t('restSkip')}
            </button>
          </div>
        </div>
        <div className="mt-3 h-1.5 rounded-full bg-black/15 overflow-hidden" aria-hidden>
          <div className="h-full bg-[var(--color-on-accent)] transition-[width] duration-200 rounded-full" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}
