import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { usePageTitle } from './usePageTitle';

describe('usePageTitle', () => {
  it('prefixes the app name with the page title', () => {
    renderHook(() => usePageTitle('My Journal'));
    expect(document.title).toBe('My Journal · YouPeak');
  });

  it('falls back to the app name for empty titles', () => {
    renderHook(() => usePageTitle('   '));
    expect(document.title).toBe('YouPeak');
    renderHook(() => usePageTitle(undefined));
    expect(document.title).toBe('YouPeak');
  });

  it('updates when the title changes', () => {
    const { rerender } = renderHook(({ title }) => usePageTitle(title), { initialProps: { title: 'Stats' } });
    expect(document.title).toBe('Stats · YouPeak');
    rerender({ title: 'Food' });
    expect(document.title).toBe('Food · YouPeak');
  });
});
