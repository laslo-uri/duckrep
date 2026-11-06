import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleMuscleWiki } from '../api/musclewiki.ts';

const call = (path: string, init?: RequestInit) =>
  new Request(`https://duckrep.example/api/musclewiki?path=${encodeURIComponent(path)}`, init);

afterEach(() => vi.unstubAllGlobals());

describe('MuscleWiki proxy', () => {
  it('says when the server has no key', async () => {
    const response = await handleMuscleWiki(call('/muscles'), undefined);
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'not_configured' });
  });

  it('only forwards the read endpoints', async () => {
    for (const path of ['/media/token', '/routines', 'https://evil.example/x', '//evil.example/muscles', '/stream/images/bodymaps/1']) {
      expect((await handleMuscleWiki(call(path), 'mw_key')).status).toBe(400);
    }
  });

  it('refuses other websites but lets the desktop shell in', async () => {
    const foreign = await handleMuscleWiki(call('/muscles', { headers: { origin: 'https://evil.example' } }), 'mw_key');
    expect(foreign.status).toBe(403);

    const fetchMock = vi.fn(async () => new Response('[]', { headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    const tauri = await handleMuscleWiki(call('/muscles', { headers: { origin: 'http://tauri.localhost' } }), 'mw_key');
    expect(tauri.status).toBe(200);
    expect(tauri.headers.get('access-control-allow-origin')).toBe('http://tauri.localhost');
  });

  it('refuses a cross-site <video> or <img>, which sends no Origin', async () => {
    const fetchMock = vi.fn(async () => new Response('bytes', { headers: { 'content-type': 'video/mp4' } }));
    vi.stubGlobal('fetch', fetchMock);
    const path = '/stream/videos/branded/male-curl.mp4';
    const embed = await handleMuscleWiki(call(path, { headers: { 'sec-fetch-site': 'cross-site' } }), 'mw_key');
    expect(embed.status).toBe(403);
    const other = await handleMuscleWiki(call(path, { headers: { 'sec-fetch-site': 'cross-site', referer: 'https://evil.example/' } }), 'mw_key');
    expect(other.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();

    const shell = await handleMuscleWiki(call(path, { headers: { 'sec-fetch-site': 'cross-site', referer: 'http://tauri.localhost/' } }), 'mw_key');
    expect(shell.status).toBe(200);
    const own = await handleMuscleWiki(call(path, { headers: { 'sec-fetch-site': 'same-origin' } }), 'mw_key');
    expect(own.status).toBe(200);
  });

  it('refuses an oversized path', async () => {
    const response = await handleMuscleWiki(call(`/search?q=${'a'.repeat(600)}`), 'mw_key');
    expect(response.status).toBe(400);
  });

  it('limits one address per minute and spends no upstream call over it', async () => {
    const fetchMock = vi.fn(async () => new Response('[]', { headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    const headers = { 'x-forwarded-for': '203.0.113.7, 10.0.0.1' };
    for (let i = 0; i < 120; i += 1) {
      expect((await handleMuscleWiki(call('/muscles', { headers }), 'mw_key')).status).toBe(200);
    }
    const blocked = await handleMuscleWiki(call('/muscles', { headers }), 'mw_key');
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('retry-after')).toBe('60');
    expect(fetchMock).toHaveBeenCalledTimes(120);

    const next = await handleMuscleWiki(call('/muscles', { headers: { 'x-forwarded-for': '203.0.113.8' } }), 'mw_key');
    expect(next.status).toBe(200);
  });

  it('adds the key server-side and passes the video headers through', async () => {
    const fetchMock = vi.fn<(url: URL, init?: RequestInit) => Promise<Response>>(async () =>
      new Response('bytes', {
        status: 206,
        headers: { 'content-type': 'video/mp4', 'cache-control': 'no-store', 'content-range': 'bytes 0-4/5', 'set-cookie': 'x=1' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const response = await handleMuscleWiki(call('/stream/videos/branded/male-curl.mp4', { headers: { range: 'bytes=0-' } }), 'mw_key');
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('https://api.musclewiki.com/stream/videos/branded/male-curl.mp4');
    expect(new Headers(init?.headers).get('x-api-key')).toBe('mw_key');
    expect(new Headers(init?.headers).get('range')).toBe('bytes=0-');
    expect(response.status).toBe(206);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('set-cookie')).toBeNull();
  });
});
