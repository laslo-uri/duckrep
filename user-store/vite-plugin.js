import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const MAX_BODY_BYTES = 1_000_000;

/**
 * Vite dev/preview middleware — reads/writes the same user-store.json as Tauri desktop.
 * Only pages served by this dev server may use it: any website open in the same browser could
 * otherwise read the preferences or switch off the auto-lock. USER_STORE_DIR replaces the app data
 * folder, so test runs leave the real desktop preferences alone.
 *
 * @param {{ appId: string }} options Tauri bundle identifier (e.g. com.lectory.app)
 */
export function userStorePlugin({ appId }) {
  if (!appId) throw new Error('userStorePlugin requires appId');

  function storePath() {
    const base = process.env.USER_STORE_DIR || process.env.APPDATA || path.join(os.homedir(), '.config');
    return path.join(base, appId, 'user-store.json');
  }

  function readStore() {
    const file = storePath();
    try {
      if (!fs.existsSync(file)) return {};
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
      /** @type {Record<string, string>} */
      const out = {};
      for (const [k, v] of Object.entries(data)) {
        if (typeof v === 'string') out[k] = v;
      }
      return out;
    } catch {
      return {};
    }
  }

  function writeStore(data) {
    const file = storePath();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
  }

  /** @param {import('connect').IncomingMessage} req @param {import('connect').ServerResponse} res @param {Record<string, string>} data */
  function sendJson(res, code, data) {
    const body = JSON.stringify(data);
    res.statusCode = code;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(body);
  }

  /** @param {import('connect').IncomingMessage} req */
  function fromThisServer(req) {
    if (req.headers['sec-fetch-site'] === 'cross-site') return false;
    const origin = req.headers.origin;
    if (!origin) return true;
    try {
      return new URL(origin).host === req.headers.host;
    } catch {
      return false;
    }
  }

  function middleware(req, res, next) {
    const url = (req.url || '').split('?')[0];
    if (url !== '/api/user-store') return next();

    if (!fromThisServer(req)) {
      sendJson(res, 403, { error: 'origin' });
      return;
    }

    if (req.method === 'GET') {
      sendJson(res, 200, readStore());
      return;
    }

    if (req.method === 'PUT') {
      const chunks = [];
      let size = 0;
      let tooLarge = false;
      req.on('data', (c) => {
        size += c.length;
        if (size > MAX_BODY_BYTES) tooLarge = true;
        else chunks.push(c);
      });
      req.on('end', () => {
        if (tooLarge) {
          sendJson(res, 413, { error: 'too large' });
          return;
        }
        try {
          const raw = Buffer.concat(chunks).toString('utf8') || '{}';
          const data = JSON.parse(raw);
          if (!data || typeof data !== 'object' || Array.isArray(data)) {
            sendJson(res, 400, { error: 'expected object' });
            return;
          }
          /** @type {Record<string, string>} */
          const out = {};
          for (const [k, v] of Object.entries(data)) {
            if (typeof v === 'string') out[k] = v;
          }
          writeStore(out);
          sendJson(res, 200, { ok: true });
        } catch {
          sendJson(res, 400, { error: 'invalid json' });
        }
      });
      return;
    }

    sendJson(res, 405, { error: 'method not allowed' });
  }

  return {
    name: 'user-store-api',
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}
