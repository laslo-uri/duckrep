import { describe, expect, it } from 'vitest';
import {
  CONSENT_STORAGE_KEY,
  applyConsent,
  ensureConsentDefaults,
  gaScriptUrl,
  getAnalyticsIds,
  gtmScriptUrl,
  hasAnalyticsIds,
  primeAnalytics,
  readGtagCall,
  readStoredConsent,
  shouldLoadAnalytics,
  storeConsent,
} from './consent';

function memoryStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
  };
}

function consentCalls(dataLayer: unknown[]) {
  return dataLayer
    .map(readGtagCall)
    .filter((call): call is unknown[] => Array.isArray(call) && call[0] === 'consent');
}

describe('analytics IDs', () => {
  it('has no IDs when the env vars are unset', () => {
    const ids = getAnalyticsIds({});
    expect(ids).toEqual({ gtmId: null, gaId: null });
    expect(hasAnalyticsIds(ids)).toBe(false);
  });

  it('accepts well-formed IDs and ignores malformed ones', () => {
    expect(getAnalyticsIds({ gtmId: ' GTM-ABC123 ', gaId: 'G-XYZ789' })).toEqual({
      gtmId: 'GTM-ABC123',
      gaId: 'G-XYZ789',
    });
    expect(getAnalyticsIds({ gtmId: '<script>', gaId: 'UA-1' })).toEqual({ gtmId: null, gaId: null });
  });

  it('builds the Google script URLs', () => {
    expect(gtmScriptUrl('GTM-ABC123')).toBe('https://www.googletagmanager.com/gtm.js?id=GTM-ABC123');
    expect(gaScriptUrl('G-XYZ789')).toBe('https://www.googletagmanager.com/gtag/js?id=G-XYZ789');
  });
});

describe('stored choice', () => {
  it('returns null when nothing is stored or the value is unknown', () => {
    expect(readStoredConsent(memoryStorage())).toBeNull();
    expect(readStoredConsent(memoryStorage({ [CONSENT_STORAGE_KEY]: 'maybe' }))).toBeNull();
    expect(readStoredConsent(null)).toBeNull();
  });

  it("round-trips the visitor's choice", () => {
    const storage = memoryStorage();
    storeConsent(storage, 'granted');
    expect(readStoredConsent(storage)).toBe('granted');
    storeConsent(storage, 'denied');
    expect(readStoredConsent(storage)).toBe('denied');
  });

  it('survives a storage that throws', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(() => storeConsent(broken, 'granted')).not.toThrow();
    expect(readStoredConsent(broken)).toBeNull();
  });
});

describe('consent mode', () => {
  it('pushes denied defaults once', () => {
    const win: { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void } = {};
    ensureConsentDefaults(win);
    ensureConsentDefaults(win);
    const calls = consentCalls(win.dataLayer ?? []);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual([
      'consent',
      'default',
      {
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
        analytics_storage: 'denied',
      },
    ]);
  });

  it('sends a consent update after the defaults', () => {
    const win: { dataLayer?: unknown[] } = {};
    applyConsent(win, 'granted');
    const calls = consentCalls(win.dataLayer ?? []);
    expect(calls.map((call) => call[1])).toEqual(['default', 'update']);
    expect(calls[1][2]).toEqual({
      ad_storage: 'granted',
      ad_user_data: 'granted',
      ad_personalization: 'granted',
      analytics_storage: 'granted',
    });
  });

  it('primes GTM and gtag once before their scripts load', () => {
    const win: { dataLayer?: unknown[] } = {};
    primeAnalytics(win, { gtmId: 'GTM-ABC123', gaId: 'G-XYZ789' });
    primeAnalytics(win, { gtmId: 'GTM-ABC123', gaId: 'G-XYZ789' });
    const layer = win.dataLayer ?? [];
    expect(layer.filter((entry) => (entry as { event?: string }).event === 'gtm.js')).toHaveLength(1);
    const configs = layer.map(readGtagCall).filter((call) => call?.[0] === 'config');
    expect(configs).toHaveLength(1);
    expect(configs[0]?.[1]).toBe('G-XYZ789');
  });
});

describe('shouldLoadAnalytics', () => {
  const ids = { gtmId: 'GTM-ABC123', gaId: null };

  it('never loads without an ID, even after accepting', () => {
    expect(shouldLoadAnalytics('granted', { gtmId: null, gaId: null })).toBe(false);
  });

  it('never loads without an explicit accept', () => {
    expect(shouldLoadAnalytics(null, ids)).toBe(false);
    expect(shouldLoadAnalytics('denied', ids)).toBe(false);
  });

  it('loads once accepted and configured', () => {
    expect(shouldLoadAnalytics('granted', ids)).toBe(true);
  });
});
