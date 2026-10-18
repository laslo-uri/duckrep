import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CONSENT_STORAGE_KEY, readGtagCall } from '../lib/consent';

type ConsentModule = typeof import('./CookieConsent');

async function loadFresh(env: Record<string, string>): Promise<ConsentModule> {
  vi.resetModules();
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
  return import('./CookieConsent');
}

function consentCalls() {
  return (window.dataLayer ?? [])
    .map(readGtagCall)
    .filter((call): call is unknown[] => Array.isArray(call) && call[0] === 'consent');
}

describe('CookieConsent', () => {
  beforeEach(() => {
    localStorage.clear();
    delete window.dataLayer;
    delete window.gtag;
    delete (window as { __consentDefaultsSet?: boolean }).__consentDefaultsSet;
    delete (window as { __analyticsPrimed?: boolean }).__analyticsPrimed;
    document.head.querySelectorAll('script[src*="googletagmanager"]').forEach((el) => el.remove());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('renders nothing without analytics IDs', async () => {
    const { CookieConsent, CookieSettingsLink } = await loadFresh({ VITE_GTM_ID: '', VITE_GA_ID: '' });
    render(
      <>
        <CookieConsent />
        <CookieSettingsLink />
      </>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(window.dataLayer).toBeUndefined();
  });

  it('shows the banner, pushes denied defaults first and loads GTM only after accepting', async () => {
    const { CookieConsent } = await loadFresh({ VITE_GTM_ID: 'GTM-TEST123' });
    render(<CookieConsent />);

    const dialog = screen.getByRole('dialog', { name: 'Cookies' });
    expect(dialog).toHaveAccessibleDescription(/anonymous visit statistics/);
    expect(consentCalls().map((call) => call[1])).toEqual(['default']);
    expect(document.head.querySelector('script[src*="googletagmanager"]')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Accept' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(localStorage.getItem(CONSENT_STORAGE_KEY)).toBe('granted');
    expect(consentCalls().map((call) => call[1])).toEqual(['default', 'update']);
    const script = document.head.querySelector<HTMLScriptElement>('script[src*="gtm.js?id=GTM-TEST123"]');
    expect(script).not.toBeNull();
    expect(script?.async).toBe(true);
    expect((window.dataLayer ?? []).some((e) => (e as { event?: string }).event === 'gtm.js')).toBe(true);
  });

  it('stores denied and loads nothing on decline', async () => {
    const { CookieConsent } = await loadFresh({ VITE_GA_ID: 'G-TEST123' });
    render(<CookieConsent />);
    await userEvent.click(screen.getByRole('button', { name: 'Decline' }));
    expect(localStorage.getItem(CONSENT_STORAGE_KEY)).toBe('denied');
    expect(document.head.querySelector('script[src*="googletagmanager"]')).toBeNull();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('respects a stored choice and reopens from the footer link with focus on Accept', async () => {
    localStorage.setItem(CONSENT_STORAGE_KEY, 'denied');
    const { CookieConsent, CookieSettingsLink } = await loadFresh({ VITE_GTM_ID: 'GTM-TEST123' });
    render(
      <>
        <CookieConsent />
        <CookieSettingsLink />
      </>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(consentCalls().map((call) => call[1])).toEqual(['default', 'update']);

    await userEvent.click(screen.getByRole('button', { name: 'Cookies' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Accept' })).toHaveFocus();

    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
