import { describe, expect, it } from 'vitest';
import { mapSourceMuscleToGroup } from './muscleGroupMap';

describe('mapSourceMuscleToGroup', () => {
  it('maps common primary muscles', () => {
    expect(mapSourceMuscleToGroup('chest')).toBe('chest');
    expect(mapSourceMuscleToGroup('abdominals')).toBe('abs');
    expect(mapSourceMuscleToGroup('quadriceps')).toBe('legs');
    expect(mapSourceMuscleToGroup('lats')).toBe('back');
  });

  it('falls back to other for unknown muscles', () => {
    expect(mapSourceMuscleToGroup('neck')).toBe('other');
    expect(mapSourceMuscleToGroup(null)).toBe('other');
  });
});
