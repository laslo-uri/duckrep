import { describe, expect, it } from 'vitest';
import i18n from './index';

// Every literal t('key') in the app must exist in all three languages (a missing key shows raw on screen).
const sources = import.meta.glob(['../**/*.{ts,tsx}', '!../**/*.test.{ts,tsx}', '!../i18n/**'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const keys = new Set<string>();
for (const text of Object.values(sources)) {
  for (const match of text.matchAll(/\bt\(\s*'([A-Za-z0-9_.]+)'/g)) keys.add(match[1]);
}

describe('translations', () => {
  it('finds the keys used in the source', () => {
    expect(keys.size).toBeGreaterThan(200);
  });

  for (const lng of ['en', 'sr', 'hu']) {
    it(`${lng} has every key the app uses`, () => {
      const has = (key: string) => i18n.exists(key, { lng, fallbackLng: false });
      // Plural keys live as key_one / key_other.
      const missing = [...keys].filter((key) => !has(key) && !(has(`${key}_one`) && has(`${key}_other`)));
      expect(missing).toEqual([]);
    });
  }
});
