import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { usePageTitle } from './usePageTitle';

describe('usePageTitle', () => {
  it('prefixes the app name with the page title', () => {
    renderHook(() => usePageTitle('My Journal'));
    expect(document.title).toBe('My Journal · Duckrep');
  });

  it('falls back to the app name for empty titles', () => {
    renderHook(() => usePageTitle('   '));
    expect(document.title).toBe('Duckrep');
    renderHook(() => usePageTitle(undefined));
    expect(document.title).toBe('Duckrep');
  });

  it('updates when the title changes', () => {
    const { rerender } = renderHook(({ title }) => usePageTitle(title), { initialProps: { title: 'Stats' } });
    expect(document.title).toBe('Stats · Duckrep');
    rerender({ title: 'Exercises' });
    expect(document.title).toBe('Exercises · Duckrep');
  });
});
