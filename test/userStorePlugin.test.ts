import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { userStorePlugin } from '../user-store/vite-plugin.js';

type Handler = (req: unknown, res: unknown, next: () => void) => void;

function middleware(): Handler {
  let handler: Handler | undefined;
  const hook = userStorePlugin({ appId: 'com.test.app' }).configureServer as unknown as (server: unknown) => void;
  hook({ middlewares: { use: (fn: Handler) => (handler = fn) } });
  return handler as Handler;
}

function call(method: string, headers: Record<string, string>, body = '') {
  return new Promise<{ status: number; body: string; headers: Record<string, string> }>((resolve) => {
    const req = Object.assign(Readable.from(body ? [Buffer.from(body)] : []), { method, url: '/api/user-store', headers: { host: 'localhost:5173', ...headers } });
    const out = { status: 0, body: '', headers: {} as Record<string, string> };
    const res = {
      statusCode: 0,
      setHeader: (name: string, value: string) => (out.headers[name.toLowerCase()] = value),
      end(text: string) {
        resolve({ ...out, status: this.statusCode, body: text });
      },
    };
    middleware()(req, res, () => resolve({ ...out, status: 404 }));
  });
}

describe('user-store dev middleware', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'user-store-test-'));
    process.env.USER_STORE_DIR = dir;
  });

  afterEach(() => {
    delete process.env.USER_STORE_DIR;
    rmSync(dir, { recursive: true, force: true });
  });

  it('serves pages from the same dev server, in the folder USER_STORE_DIR names', async () => {
    const put = await call('PUT', { origin: 'http://localhost:5173' }, JSON.stringify({ 'duckrep-theme': 'dark' }));
    expect(put.status).toBe(200);
    expect(JSON.parse(readFileSync(join(dir, 'com.test.app', 'user-store.json'), 'utf8'))).toEqual({ 'duckrep-theme': 'dark' });
    const get = await call('GET', {});
    expect(JSON.parse(get.body)).toEqual({ 'duckrep-theme': 'dark' });
    expect(get.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('refuses other websites, for reading and for writing', async () => {
    expect((await call('GET', { origin: 'https://evil.example' })).status).toBe(403);
    expect((await call('PUT', { origin: 'https://evil.example' }, '{}')).status).toBe(403);
    expect((await call('OPTIONS', { origin: 'https://evil.example' })).status).toBe(403);
    expect((await call('GET', { 'sec-fetch-site': 'cross-site' })).status).toBe(403);
  });

  it('refuses a body over the limit', async () => {
    const response = await call('PUT', {}, JSON.stringify({ big: 'x'.repeat(1_100_000) }));
    expect(response.status).toBe(413);
  });
});
