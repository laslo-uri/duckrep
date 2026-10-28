import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import {
  type AnalyticsIds,
  type ConsentChoice,
  applyConsent,
  ensureConsentDefaults,
  gaScriptUrl,
  getAnalyticsIds,
  gtmScriptUrl,
  hasAnalyticsIds,
  primeAnalytics,
  readStoredConsent,
  shouldLoadAnalytics,
  storeConsent,
} from '../lib/consent';

/** Fired by the footer link so the banner reopens and the choice can be changed. */
const OPEN_COOKIE_SETTINGS_EVENT = 'cookie-consent:open';

function openCookieSettings() {
  window.dispatchEvent(new Event(OPEN_COOKIE_SETTINGS_EVENT));
}

interface ConsentView {
  choice: ConsentChoice | null;
  open: boolean;
  /** True when the banner was reopened from the footer, so it should take focus. */
  reopened: boolean;
}

// A tiny external store: localStorage is read once, then kept in memory.
let view: ConsentView | null = null;
const listeners = new Set<() => void>();

function getView(): ConsentView {
  if (!view) {
    ensureConsentDefaults(window);
    const stored = readStoredConsent(window.localStorage);
    if (stored) applyConsent(window, stored);
    view = { choice: stored, open: !stored, reopened: false };
  }
  return view;
}

function setView(next: Partial<ConsentView>) {
  view = { ...getView(), ...next };
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const reopen = () => setView({ open: true, reopened: true });
  window.addEventListener(OPEN_COOKIE_SETTINGS_EVENT, reopen);
  return () => {
    listeners.delete(listener);
    window.removeEventListener(OPEN_COOKIE_SETTINGS_EVENT, reopen);
  };
}

function appendScript(doc: Document, src: string) {
  if (doc.querySelector(`script[src="${src}"]`)) return;
  const script = doc.createElement('script');
  script.async = true;
  script.src = src;
  doc.head.appendChild(script);
}

/** Primes the dataLayer and injects gtm.js / gtag.js as async tags. Idempotent. */
function loadAnalyticsScripts(doc: Document, ids: AnalyticsIds) {
  primeAnalytics(window, ids);
  if (ids.gtmId) appendScript(doc, gtmScriptUrl(ids.gtmId));
  if (ids.gaId) appendScript(doc, gaScriptUrl(ids.gaId));
}

/**
 * Consent banner + analytics loader. With no `VITE_GTM_ID` / `VITE_GA_ID` it renders
 * nothing at all. Consent Mode defaults (all denied) are pushed before any tag can
 * load; tags load only after an explicit accept.
 */
export function CookieConsent() {
  const ids = useMemo(() => getAnalyticsIds(), []);
  if (!hasAnalyticsIds(ids)) return null;
  return <ConsentBanner ids={ids} />;
}

const buttonBase =
  'dr-press inline-flex min-h-[44px] items-center justify-center rounded-lg px-4 text-sm font-medium transition-colors touch-manipulation';

function ConsentBanner({ ids }: { ids: AnalyticsIds }) {
  const { t } = useTranslation();
  const { choice, open, reopened } = useSyncExternalStore(subscribe, getView, getView);
  const acceptRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (shouldLoadAnalytics(choice, ids)) loadAnalyticsScripts(document, ids);
  }, [choice, ids]);

  useEffect(() => {
    if (open && reopened) acceptRef.current?.focus();
  }, [open, reopened]);

  useEffect(() => {
    if (!open || !choice) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setView({ open: false });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, choice]);

  const decide = useCallback((next: ConsentChoice) => {
    storeConsent(window.localStorage, next);
    applyConsent(window, next);
    setView({ choice: next, open: false });
  }, []);

  if (!open) return null;

  return (
    <section
      role="dialog"
      aria-labelledby="cookie-consent-title"
      aria-describedby="cookie-consent-text"
      className="fixed inset-x-0 bottom-0 z-[60] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4"
    >
      <div className="mx-auto flex max-w-screen-md flex-col gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-[var(--color-ink)] shadow-[var(--shadow-card)] sm:flex-row sm:items-center sm:gap-5">
        <div className="flex-1 text-sm">
          <h2 id="cookie-consent-title" className="font-semibold">
            {t('cookies.title')}
          </h2>
          <p id="cookie-consent-text" className="mt-1 text-[var(--color-muted)]">
            {t('cookies.text')}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => decide('denied')}
            className={`${buttonBase} border border-[var(--color-border)] hover:bg-[var(--color-hover)]`}
          >
            {t('cookies.decline')}
          </button>
          <button
            ref={acceptRef}
            type="button"
            onClick={() => decide('granted')}
            className={`${buttonBase} bg-[var(--color-accent)] text-[var(--color-on-accent)] hover:opacity-90`}
          >
            {t('cookies.accept')}
          </button>
        </div>
      </div>
    </section>
  );
}

/** Small footer link that reopens the banner. Hidden when analytics is not configured. */
export function CookieSettingsLink({ className }: { className?: string }) {
  const { t } = useTranslation();
  if (!hasAnalyticsIds(getAnalyticsIds())) return null;
  return (
    <button type="button" onClick={openCookieSettings} className={className}>
      {t('cookies.settings')}
    </button>
  );
}
