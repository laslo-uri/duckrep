import { describe, it, expect } from 'vitest';
import { parseActivityMedia, normalizeWorkoutRow } from './workoutNormalize';

describe('parseActivityMedia', () => {
  it('returns empty for non-array input', () => {
    expect(parseActivityMedia(null)).toEqual([]);
    expect(parseActivityMedia({})).toEqual([]);
  });

  it('keeps only https URLs', () => {
    expect(
      parseActivityMedia([
        { url: 'https://example.com/a.jpg' },
        { url: 'http://insecure.com' },
        { url: 'javascript:alert(1)' },
        { url: 'ftp://x.com' },
      ]),
    ).toEqual([{ url: 'https://example.com/a.jpg', caption: undefined }]);
  });

  it('preserves optional caption', () => {
    expect(parseActivityMedia([{ url: 'https://x.com', caption: 'warmup' }])).toEqual([
      { url: 'https://x.com', caption: 'warmup' },
    ]);
  });
});

describe('normalizeWorkoutRow', () => {
  it('defaults activity_type and parses media', () => {
    const row = normalizeWorkoutRow({
      id: 'w1',
      user_id: 'u1',
      date: '2026-01-01',
      activity_type: 'cardio',
      media: [{ url: 'https://img.test/1.png' }],
      workout_exercises: [{ id: 'e1', name: 'Squat', order_index: 0, circuit_group_id: 'cg1' }],
    });
    expect(row.activity_type).toBe('cardio');
    expect(row.media).toHaveLength(1);
    expect(row.workout_exercises?.[0].circuit_group_id).toBe('cg1');
  });
});
