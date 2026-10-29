import { describe, expect, it } from 'vitest';
import { fold, rankPalette, type PaletteItem } from './commandPalette';

const noop = () => {};
const item = (id: string, group: PaletteItem['group'], label: string, keywords?: string): PaletteItem => ({ id, group, label, keywords, run: noop });

const items = [
  item('new', 'actions', 'New activity', 'start workout'),
  item('stats', 'actions', 'Go to Stats'),
  item('lock', 'actions', 'Lock now'),
  { ...item('squat', 'exercises', 'Squat'), names: ['Squat', 'Čučanj', 'Guggolás'] },
  { ...item('bw', 'exercises', 'Bodyweight Squat'), names: ['Bodyweight Squat', 'Čučanj bez tega'] },
  item('front', 'exercises', 'Front Barbell Squat'),
  item('sumo', 'exercises', 'Sumo Squat'),
  item('mon', 'activities', 'Leg day'),
];

describe('command palette ranking', () => {
  it('folds case and diacritics', () => {
    expect(fold('Čučanj Đak Fekvenyomás')).toBe('cucanj dak fekvenyomas');
  });

  it('finds Serbian names typed without diacritics, and keywords in other languages', () => {
    expect(rankPalette(items, 'cucanj').map((i) => i.id)).toEqual(['squat', 'bw']);
    expect(rankPalette(items, 'guggolas').map((i) => i.id)).toEqual(['squat']);
    expect(rankPalette(items, 'squat').map((i) => i.id)).toEqual(['squat', 'sumo', 'bw', 'front']);
  });

  it('puts label starts before word starts before anything else', () => {
    expect(rankPalette(items, 'st').map((i) => i.id)).toEqual(['stats', 'new']);
  });

  it('lists actions first with nothing typed', () => {
    expect(rankPalette(items, '').map((i) => i.group)).toEqual([
      'actions', 'actions', 'actions', 'exercises', 'exercises', 'exercises', 'exercises', 'activities',
    ]);
  });
});
