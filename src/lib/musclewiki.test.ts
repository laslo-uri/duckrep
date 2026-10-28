import { describe, expect, it } from 'vitest';
import {
  normalizeExercise,
  normalizeExercisePage,
  normalizeFacets,
  pickVideoUrl,
  readMetaCache,
  proxyUrl,
  streamPath,
} from './musclewiki';

describe('musclewiki parsing', () => {
  it('reads category and muscle lists', () => {
    expect(normalizeFacets([{ name: 'barbell', display_name: 'Barbell', count: 150 }])).toEqual([
      { name: 'barbell', label: 'Barbell', count: 150 },
    ]);
    expect(normalizeFacets({ muscles: [{ name: 'Biceps', count: 40 }] })).toEqual([
      { name: 'Biceps', label: 'Biceps', count: 40 },
    ]);
  });

  it('reads a page of exercises', () => {
    expect(normalizeExercisePage({ total: 2, results: [{ id: 1, name: 'Barbell Curl' }, { id: 'nope' }] })).toEqual({
      total: 2,
      results: [{ id: 1, name: 'Barbell Curl' }],
    });
  });

  it('keeps only MuscleWiki stream videos and prefers the chosen gender', () => {
    const exercise = normalizeExercise({
      id: 1,
      name: 'Barbell Curl',
      primary_muscles: ['Biceps'],
      steps: ['Curl the bar.'],
      videos: [
        { url: 'https://evil.example/video.mp4', gender: 'male' },
        { url: '/stream/videos/branded/female.mp4', gender: 'female' },
        { url: 'https://api.musclewiki.com/stream/videos/branded/male.mp4', gender: 'male' },
      ],
    });
    expect(exercise?.videos).toHaveLength(2);
    expect(pickVideoUrl(exercise?.videos ?? [], 'female')).toBe(proxyUrl('/stream/videos/branded/female.mp4'));
    expect(proxyUrl('/stream/videos/branded/female.mp4')).toBe('/api/musclewiki?path=%2Fstream%2Fvideos%2Fbranded%2Ffemale.mp4');
    expect(streamPath('https://api.musclewiki.com/exercises/1')).toBeNull();
    expect(streamPath('https://evil.example/stream/videos/x.mp4')).toBeNull();
  });

  it('drops a category cache older than 30 days', () => {
    const savedAt = Date.parse('2026-01-01T00:00:00Z');
    const raw = JSON.stringify({
      savedAt,
      categories: [{ name: 'barbell', label: 'Barbell', count: 1 }],
      muscles: [],
    });
    expect(readMetaCache(raw, savedAt + 29 * 24 * 60 * 60 * 1000)?.categories).toHaveLength(1);
    expect(readMetaCache(raw, savedAt + 31 * 24 * 60 * 60 * 1000)).toBeNull();
  });
});
