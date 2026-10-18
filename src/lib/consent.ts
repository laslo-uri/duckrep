/**
 * Cookie consent + analytics gating (Google Consent Mode v2).
 *
 * Nothing here touches the DOM, so it is unit-tested without a browser.
 * The banner, the footer link and the script tags live in `components/CookieConsent.tsx`.
 */

export const CONSENT_STORAGE_KEY = 'cookie-consent';

export type ConsentChoice = 'granted' | 'denied';

export interface AnalyticsIds {
  gtmId: string | null;
  gaId: string | null;
}

export interface ConsentStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface DataLayerWindow {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface Window extends DataLayerWindow {}
}

const GTM_ID_PATTERN = /^GTM-[A-Z0-9]+$/;
const GA_ID_PATTERN = /^G-[A-Z0-9]+$/;

function normalizeId(value: string | undefined, pattern: RegExp): string | null {
  const trimmed = value?.trim() ?? '';
  return pattern.test(trimmed) ? trimmed : null;
}

/** Reads the public analytics IDs (`VITE_GTM_ID`, `VITE_GA_ID`). Both are optional; malformed values are ignored. */
export function getAnalyticsIds(
  env: { gtmId?: string; gaId?: string } = {
    gtmId: import.meta.env.VITE_GTM_ID,
    gaId: import.meta.env.VITE_GA_ID,
  },
): AnalyticsIds {
  return {
    gtmId: normalizeId(env.gtmId, GTM_ID_PATTERN),
    gaId: normalizeId(env.gaId, GA_ID_PATTERN),
  };
}

export function hasAnalyticsIds(ids: AnalyticsIds): boolean {
  return Boolean(ids.gtmId || ids.gaId);
}

export function gtmScriptUrl(gtmId: string): string {
  return `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(gtmId)}`;
}

export function gaScriptUrl(gaId: string): string {
  return `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}`;
}

export function readStoredConsent(storage: ConsentStorage | null | undefined): ConsentChoice | null {
  try {
    const value = storage?.getItem(CONSENT_STORAGE_KEY);
    return value === 'granted' || value === 'denied' ? value : null;
  } catch {
    return null;
  }
}

export function storeConsent(storage: ConsentStorage | null | undefined, choice: ConsentChoice): void {
  try {
    storage?.setItem(CONSENT_STORAGE_KEY, choice);
  } catch {
    // Private mode or blocked storage: the choice simply is not remembered.
  }
}

/** Scripts load only when an ID is configured and the visitor accepted. */
export function shouldLoadAnalytics(choice: ConsentChoice | null, ids: AnalyticsIds): boolean {
  return choice === 'granted' && hasAnalyticsIds(ids);
}

function consentState(value: ConsentChoice) {
  return {
    ad_storage: value,
    ad_user_data: value,
    ad_personalization: value,
    analytics_storage: value,
  };
}

/**
 * Creates `dataLayer` and `gtag` if missing and pushes the Consent Mode defaults
 * (everything denied). Idempotent, so it is safe to call before every other push.
 */
export function ensureConsentDefaults(win: DataLayerWindow): void {
  win.dataLayer = win.dataLayer ?? [];
  if (!win.gtag) {
    const dataLayer = win.dataLayer;
    // Google's snippet pushes the `arguments` object, not an array.
    win.gtag = function gtag() {
      // eslint-disable-next-line prefer-rest-params
      dataLayer.push(arguments);
    };
  }
  const marked = win as DataLayerWindow & { __consentDefaultsSet?: boolean };
  if (marked.__consentDefaultsSet) return;
  marked.__consentDefaultsSet = true;
  win.gtag('consent', 'default', consentState('denied'));
}

/** Pushes a Consent Mode v2 update for the visitor's choice. */
export function applyConsent(win: DataLayerWindow, choice: ConsentChoice): void {
  ensureConsentDefaults(win);
  win.gtag?.('consent', 'update', consentState(choice));
}

/** Pushes the bootstrap events the GTM / gtag.js scripts expect before they load. Runs once. */
export function primeAnalytics(win: DataLayerWindow, ids: AnalyticsIds): void {
  ensureConsentDefaults(win);
  const marked = win as DataLayerWindow & { __analyticsPrimed?: boolean };
  if (marked.__analyticsPrimed) return;
  marked.__analyticsPrimed = true;
  if (ids.gtmId) {
    win.dataLayer?.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
  }
  if (ids.gaId) {
    win.gtag?.('js', new Date());
    win.gtag?.('config', ids.gaId);
  }
}

/** Reads a push made through `gtag(...)` back as a plain array (for tests and debugging). */
export function readGtagCall(entry: unknown): unknown[] | null {
  if (Array.isArray(entry)) return entry;
  if (entry && typeof entry === 'object' && 'length' in entry) {
    return Array.from(entry as ArrayLike<unknown>);
  }
  return null;
}
