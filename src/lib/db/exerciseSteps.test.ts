import { describe, expect, it } from 'vitest';
import { EXERCISE_GUIDE } from './exerciseGuide.generated';
import sr from './exerciseSteps.sr.json';
import hu from './exerciseSteps.hu.json';

describe('translated exercise steps', () => {
  for (const [lang, steps] of [['sr', sr], ['hu', hu]] as const) {
    it(`${lang}: same exercises and step counts as the English guide`, () => {
      const table = steps as Record<string, string[]>;
      expect(Object.keys(table).length).toBeGreaterThanOrEqual(90);
      for (const [slug, list] of Object.entries(table)) {
        expect(EXERCISE_GUIDE[slug], slug).toBeDefined();
        expect(list.length, slug).toBe(EXERCISE_GUIDE[slug].length);
        expect(list.every((step) => step.trim().length > 0), slug).toBe(true);
      }
    });
  }

  it('Serbian stays in Latin script', () => {
    expect(JSON.stringify(sr)).not.toMatch(/[Ѐ-ӿ]/);
  });
});
