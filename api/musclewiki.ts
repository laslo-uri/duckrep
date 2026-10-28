/**
 * MuscleWiki proxy (Vercel function, also mounted by the Vite dev and preview servers).
 *
 * MuscleWiki's terms forbid shipping the API key in a client app, and the API sends no CORS
 * headers, so the app calls `/api/musclewiki?path=/exercises?...` and this adds the key from
 * the server-only env var MUSCLEWIKI_API_KEY. Only read endpoints are allowed; video streams are
 * passed through with MuscleWiki's own headers (Cache-Control: no-store) and never stored.
 */
const UPSTREAM = 'https://api.musclewiki.com';

const ALLOWED_PATH =
  /^\/(?:health|categories|muscles|filters|search|exercises(?:\/\d+(?:\/videos)?)?|stream\/videos\/branded\/[\w.-]+\.mp4)$/;

/** Origins of the desktop (Tauri) and phone (Capacitor) shells that may call a deployed proxy. */
const NATIVE_ORIGINS = new Set([
  'tauri://localhost',
  'http://tauri.localhost',
  'https://tauri.localhost',
  'capacitor://localhost',
  'https://localhost',
  'http://localhost',
]);

const PASS_HEADERS = [
  'content-type',
  'content-length',
  'content-range',
  'accept-ranges',
  'cache-control',
  'etag',
  'last-modified',
];

function json(status: number, body: Record<string, string>, extra?: Headers): Response {
  const headers = new Headers(extra);
  headers.set('content-type', 'application/json; charset=utf-8');
  headers.set('cache-control', 'no-store');
  return new Response(JSON.stringify(body), { status, headers });
}

/** Same host, a native shell, or no Origin at all (same-origin GETs and <video> often send none). */
function allowedOrigin(request: Request): { ok: boolean; cors: string | null } {
  const origin = request.headers.get('origin');
  if (!origin) return { ok: true, cors: null };
  if (NATIVE_ORIGINS.has(origin)) return { ok: true, cors: origin };
  try {
    return { ok: new URL(origin).host === new URL(request.url).host, cors: null };
  } catch {
    return { ok: false, cors: null };
  }
}

export async function handleMuscleWiki(request: Request, key: string | undefined): Promise<Response> {
  const { ok, cors } = allowedOrigin(request);
  const base = new Headers();
  base.set('vary', 'Origin');
  if (cors) base.set('access-control-allow-origin', cors);
  if (!ok) return json(403, { error: 'origin' }, base);
  if (request.method !== 'GET' && request.method !== 'HEAD') return json(405, { error: 'method' }, base);

  const target = new URL(request.url).searchParams.get('path') ?? '';
  let upstream: URL;
  try {
    upstream = new URL(target, UPSTREAM);
  } catch {
    return json(400, { error: 'path' }, base);
  }
  if (!target.startsWith('/') || upstream.origin !== UPSTREAM || !ALLOWED_PATH.test(upstream.pathname)) {
    return json(400, { error: 'path' }, base);
  }
  if (!key?.trim()) return json(503, { error: 'not_configured' }, base);

  const headers = new Headers({ 'X-API-Key': key.trim(), Accept: 'application/json' });
  const range = request.headers.get('range');
  if (range) headers.set('range', range);

  let response: Response;
  try {
    response = await fetch(upstream, { method: request.method, headers });
  } catch {
    return json(502, { error: 'upstream' }, base);
  }
  const out = new Headers(base);
  for (const name of PASS_HEADERS) {
    const value = response.headers.get(name);
    if (value) out.set(name, value);
  }
  if (!out.has('cache-control')) out.set('cache-control', 'private, no-store');
  return new Response(response.body, { status: response.status, headers: out });
}

export function GET(request: Request): Promise<Response> {
  return handleMuscleWiki(request, process.env.MUSCLEWIKI_API_KEY);
}

export function HEAD(request: Request): Promise<Response> {
  return handleMuscleWiki(request, process.env.MUSCLEWIKI_API_KEY);
}
