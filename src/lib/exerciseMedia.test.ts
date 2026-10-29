import { describe, expect, it } from 'vitest';
import { exercisePhotos, muscleWikiSearchUrl, videoSearchUrl } from './exerciseMedia';

describe('exercise media', () => {
  it('gives free-exercise-db exercises their start and end photo', () => {
    const start = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Squat/0.jpg';
    expect(exercisePhotos(start)).toEqual([start, start.replace('/0.jpg', '/1.jpg')]);
  });

  it('keeps other images single and drops unsafe ones', () => {
    expect(exercisePhotos('https://example.com/curl.png')).toEqual(['https://example.com/curl.png']);
    expect(exercisePhotos('http://example.com/curl.png')).toEqual([]);
    expect(exercisePhotos(null)).toEqual([]);
  });

  it('builds encoded search links', () => {
    expect(videoSearchUrl('Dips (Chest)')).toBe('https://www.youtube.com/results?search_query=Dips%20(Chest)%20exercise%20form');
    expect(muscleWikiSearchUrl('T-bar Row')).toBe('https://www.google.com/search?q=site%3Amusclewiki.com%20T-bar%20Row');
  });
});
