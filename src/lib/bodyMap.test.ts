import { describe, expect, it } from 'vitest';
import { anatomyOf, matchesMuscles, muscleFromMuscleWiki, muscleWikiMuscles, type BodyMuscle } from './bodyMap';

const table = {
  'barbell-curl': 'biceps|barbell|beginner|strength|e',
  'hamstring-stretch': 'hamstrings|bodyweight|beginner|stretching|',
  'odd': 'wings|spaceship|godlike|juggling|',
};

describe('body map', () => {
  it('reads muscle and equipment from the offline table', () => {
    expect(anatomyOf({ source_slug: 'barbell-curl', muscle_group: 'biceps' }, table)).toEqual({
      muscle: 'biceps',
      equipment: 'barbell',
      type: 'strength',
      level: 'beginner',
      essential: true,
    });
    expect(anatomyOf({ source_slug: 'hamstring-stretch', muscle_group: 'legs' }, table).type).toBe('stretching');
  });

  it('falls back to the group for custom exercises and unknown values', () => {
    const none = { equipment: null, type: 'strength', level: null, essential: false };
    expect(anatomyOf({ source_slug: null, muscle_group: 'back' }, table)).toEqual({ muscle: 'lats', ...none });
    expect(anatomyOf({ source_slug: 'odd', muscle_group: 'other' }, table)).toEqual({ muscle: null, ...none });
  });

  it('filters by any selected muscle', () => {
    const curl = anatomyOf({ source_slug: 'barbell-curl', muscle_group: 'biceps' }, table);
    const none = new Set<BodyMuscle>();
    expect(matchesMuscles(curl, 'biceps', none)).toBe(true);
    expect(matchesMuscles(curl, 'biceps', new Set<BodyMuscle>(['biceps', 'chest']))).toBe(true);
    expect(matchesMuscles(curl, 'biceps', new Set<BodyMuscle>(['triceps']))).toBe(false);
  });

  it('maps regions to the names MuscleWiki returned', () => {
    const known = [{ name: 'Quads' }, { name: 'Groin' }, { name: 'Abdominals' }, { name: 'Obliques' }];
    expect(muscleWikiMuscles(['quads', 'adductors', 'abs'], known)).toBe('Quads,Groin,Abdominals,Obliques');
    expect(muscleWikiMuscles(['quads'], [])).toBe('quads');
    expect(muscleFromMuscleWiki('Traps (mid-back)')).toBe('midBack');
    expect(muscleFromMuscleWiki('Hands')).toBeNull();
  });
});
