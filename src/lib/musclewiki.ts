/**
 * MuscleWiki through Duckrep's own proxy (api/musclewiki.ts), which holds the key server-side.
 * Web uses the same origin; the desktop and phone shells need VITE_MUSCLEWIKI_PROXY (a deployed
 * Duckrep URL, not a secret). Without either, every call fails and the page stays on the library.
 */
const UPSTREAM = 'https://api.musclewiki.com';
const META_STORAGE = 'duckrep.musclewiki.meta';
const META_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/** status 0 = no proxy answered (offline, or a static host without the function). */
export class MuscleWikiError extends Error {
  status: number;

  constructor(status: number) {
    super(`MuscleWiki request failed (${status})`);
    this.name = 'MuscleWikiError';
    this.status = status;
  }
}

export type MwFacet = {
  name: string;
  label: string;
  count: number | null;
};

export type MwListItem = {
  id: number;
  name: string;
};

export type MwExercise = {
  id: number;
  name: string;
  primaryMuscles: string[];
  category: string | null;
  difficulty: string | null;
  steps: string[];
  videos: { url: string; gender: string }[];
};

export type MwGender = 'male' | 'female';

export type MuscleWikiMeta = MetaCache;

type MetaCache = {
  savedAt: number;
  categories: MwFacet[];
  muscles: MwFacet[];
};

function proxyBase(): string {
  const value = import.meta.env.VITE_MUSCLEWIKI_PROXY;
  return typeof value === 'string' ? value.trim().replace(/\/+$/, '') : '';
}

export function proxyUrl(path: string): string {
  return `${proxyBase()}/api/musclewiki?path=${encodeURIComponent(path)}`;
}

export function readMetaCache(raw: string | null, now: number): MetaCache | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<MetaCache>;
    if (typeof parsed.savedAt !== 'number' || now - parsed.savedAt > META_MAX_AGE_MS) return null;
    if (!Array.isArray(parsed.categories) || !Array.isArray(parsed.muscles)) return null;
    return {
      savedAt: parsed.savedAt,
      categories: parsed.categories.filter(isFacet),
      muscles: parsed.muscles.filter(isFacet),
    };
  } catch {
    return null;
  }
}

function isFacet(value: unknown): value is MwFacet {
  if (!value || typeof value !== 'object') return false;
  const row = value as MwFacet;
  return typeof row.name === 'string' && typeof row.label === 'string';
}

export function normalizeFacets(payload: unknown): MwFacet[] {
  const list = facetList(payload);
  const facets: MwFacet[] = [];
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const name = stringField(row.name) || stringField(row.slug);
    if (!name) continue;
    const label = stringField(row.display_name) || stringField(row.label) || name;
    const count = typeof row.count === 'number' ? row.count : null;
    facets.push({ name, label, count });
  }
  return facets;
}

function facetList(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  const row = payload as Record<string, unknown>;
  for (const key of ['results', 'categories', 'muscles', 'data']) {
    if (Array.isArray(row[key])) return row[key] as unknown[];
  }
  return [];
}

export function normalizeExercisePage(payload: unknown): { total: number; results: MwListItem[] } {
  if (!payload || typeof payload !== 'object') return { total: 0, results: [] };
  const row = payload as Record<string, unknown>;
  const raw = Array.isArray(row.results)
    ? row.results
    : Array.isArray(row.exercises)
      ? row.exercises
      : [];
  const results: MwListItem[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const exercise = item as Record<string, unknown>;
    const id = typeof exercise.id === 'number' ? exercise.id : Number(exercise.id);
    const name = stringField(exercise.name);
    if (!Number.isInteger(id) || !name) continue;
    results.push({ id, name });
  }
  const total = typeof row.total === 'number' ? row.total : results.length;
  return { total, results };
}

export function normalizeExercise(payload: unknown): MwExercise | null {
  if (!payload || typeof payload !== 'object') return null;
  const row = payload as Record<string, unknown>;
  const id = typeof row.id === 'number' ? row.id : Number(row.id);
  const name = stringField(row.name);
  if (!Number.isInteger(id) || !name) return null;
  return {
    id,
    name,
    primaryMuscles: stringList(row.primary_muscles),
    category: stringField(row.category) || null,
    difficulty: stringField(row.difficulty) || null,
    steps: stringList(row.steps),
    videos: normalizeVideos(row.videos),
  };
}

function normalizeVideos(value: unknown): { url: string; gender: string }[] {
  if (!Array.isArray(value)) return [];
  const videos: { url: string; gender: string }[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const raw = stringField(row.url) || stringField(row.src);
    const url = streamPath(raw);
    if (!url) continue;
    videos.push({ url, gender: stringField(row.gender).toLowerCase() });
  }
  return videos;
}

/** MuscleWiki stream path (`/stream/...`) of a video URL, or null for anything else. */
export function streamPath(raw: string): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw, UPSTREAM);
    if (url.origin !== UPSTREAM || !url.pathname.startsWith('/stream/')) return null;
    return url.pathname;
  } catch {
    return null;
  }
}

export function pickVideoUrl(videos: { url: string; gender: string }[], gender: MwGender): string | null {
  const match = videos.find((video) => video.gender === gender)
    ?? videos.find((video) => !video.gender)
    ?? videos[0];
  return match ? proxyUrl(match.url) : null;
}

function stringField(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map((item) => item.trim());
}

async function mwGet(path: string, signal?: AbortSignal): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(proxyUrl(path), { signal, headers: { Accept: 'application/json' } });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new MuscleWikiError(0);
  }
  // A static host answers the SPA's index.html instead of the function.
  const json = (response.headers.get('content-type') ?? '').includes('json');
  if (!response.ok) throw new MuscleWikiError(json ? response.status : 0);
  if (!json) throw new MuscleWikiError(0);
  return response.json();
}

export async function getMuscleWikiMeta(signal?: AbortSignal): Promise<MetaCache> {
  const cached = readMetaCache(safeGet(META_STORAGE), Date.now());
  if (cached) return cached;
  const [categories, muscles] = await Promise.all([mwGet('/categories', signal), mwGet('/muscles', signal)]);
  const meta: MetaCache = {
    savedAt: Date.now(),
    categories: normalizeFacets(categories),
    muscles: normalizeFacets(muscles),
  };
  try {
    localStorage.setItem(META_STORAGE, JSON.stringify(meta));
  } catch {
    /* cache is optional */
  }
  return meta;
}

export async function listMuscleWikiExercises(
  params: { limit: number; offset: number; category?: string; muscles?: string; search?: string },
  signal?: AbortSignal,
): Promise<{ total: number; results: MwListItem[] }> {
  const query = new URLSearchParams();
  query.set('limit', String(params.limit));
  query.set('offset', String(params.offset));
  if (params.category) query.set('category', params.category);
  if (params.muscles) query.set('muscles', params.muscles);
  const term = params.search?.trim() ?? '';
  if (term.length >= 2) query.set('q', term);
  return normalizeExercisePage(await mwGet(`${term.length >= 2 ? '/search' : '/exercises'}?${query}`, signal));
}

export async function getMuscleWikiExercise(id: number, gender: MwGender, signal?: AbortSignal): Promise<MwExercise | null> {
  return normalizeExercise(await mwGet(`/exercises/${id}?gender=${gender}`, signal));
}

function safeGet(storageKey: string): string | null {
  try {
    return localStorage.getItem(storageKey);
  } catch {
    return null;
  }
}
