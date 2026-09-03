/**
 * Unified user preferences store — same JSON file for Tauri desktop and localhost web.
 *
 * Load order: Tauri invoke → GET /api/user-store → localStorage blob fallback.
 * Writes always update the in-memory cache, mirror to localStorage, then persist to backend.
 */

/** @typedef {'tauri' | 'api' | 'local'} UserStoreBackend */

/** @type {{ appId: string, apiPath: string, keyPrefixes: string[], filePath?: string } | null} */
let config = null;

/** @type {Record<string, string>} */
let cache = {};

/** @type {UserStoreBackend} */
let backend = 'local';

/** @type {boolean} */
let ready = false;

/** @type {Promise<void> | null} */
let initPromise = null;

/**
 * @param {string} appId
 */
function localBlobKey(appId) {
  return `__user_store__:${appId}`;
}

/**
 * @returns {Promise<boolean>}
 */
async function detectTauri() {
  if (typeof window === 'undefined') return false;
  const w = window;
  return Boolean(w.__TAURI_INTERNALS__ || w.__TAURI__?.core);
}

/**
 * @param {string} cmd
 * @param {Record<string, unknown>} [args]
 * @returns {Promise<unknown>}
 */
async function tauriInvoke(cmd, args = {}) {
  const w = window;
  if (w.__TAURI_INTERNALS__?.invoke) {
    return w.__TAURI_INTERNALS__.invoke(cmd, args);
  }
  if (w.__TAURI__?.core?.invoke) {
    return w.__TAURI__.core.invoke(cmd, args);
  }
  throw new Error('Tauri invoke unavailable');
}

/**
 * @returns {Promise<Record<string, string>>}
 */
async function loadFromBackend() {
  if (await detectTauri()) {
    const data = await tauriInvoke('user_store_load');
    backend = 'tauri';
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      /** @type {Record<string, string>} */
      const out = {};
      for (const [k, v] of Object.entries(data)) {
        if (typeof v === 'string') out[k] = v;
      }
      return out;
    }
    return {};
  }

  if (!config) return {};

  try {
    const res = await fetch(config.apiPath, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      backend = 'api';
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        /** @type {Record<string, string>} */
        const out = {};
        for (const [k, v] of Object.entries(data)) {
          if (typeof v === 'string') out[k] = v;
        }
        return out;
      }
      return {};
    }
  } catch {
    void 0;
  }

  backend = 'local';
  try {
    const raw = localStorage.getItem(localBlobKey(config.appId));
    if (!raw) return {};
    const data = JSON.parse(raw);
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

/**
 * Mirror cache into localStorage for sync boot paths and legacy key compatibility.
 */
function mirrorCacheToLocalStorage() {
  if (typeof localStorage === 'undefined') return;
  try {
    if (config) {
      localStorage.setItem(localBlobKey(config.appId), JSON.stringify(cache));
    }
    for (const [key, value] of Object.entries(cache)) {
      localStorage.setItem(key, value);
    }
  } catch {
    void 0;
  }
}

/**
 * Import legacy per-key localStorage entries into cache (file wins on conflict).
 * @param {string[]} prefixes
 */
function migrateLegacyKeys(prefixes) {
  if (typeof localStorage === 'undefined') return;
  for (const prefix of prefixes) {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(prefix)) continue;
      if (key.startsWith('__user_store__')) continue;
      if (!(key in cache)) {
        const val = localStorage.getItem(key);
        if (val !== null) cache[key] = val;
      }
    }
  }
}

/**
 * @returns {Promise<void>}
 */
async function persistCache() {
  mirrorCacheToLocalStorage();

  if (backend === 'tauri') {
    await tauriInvoke('user_store_save', { data: cache });
    return;
  }

  if (backend === 'api' && config) {
    try {
      await fetch(config.apiPath, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cache),
      });
    } catch {
      void 0;
    }
    return;
  }

  if (config && typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(localBlobKey(config.appId), JSON.stringify(cache));
    } catch {
      void 0;
    }
  }
}

/**
 * @param {{ appId: string, keyPrefixes?: string[], apiPath?: string }} options
 * @returns {Promise<void>}
 */
export async function initUserStore(options) {
  if (ready) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    config = {
      appId: options.appId,
      apiPath: options.apiPath ?? '/api/user-store',
      keyPrefixes: options.keyPrefixes ?? [],
    };
    cache = await loadFromBackend();
    migrateLegacyKeys(config.keyPrefixes);
    mirrorCacheToLocalStorage();
    await persistCache();
    ready = true;
  })();

  return initPromise;
}

/** @returns {boolean} */
export function isUserStoreReady() {
  return ready;
}

/**
 * @param {string} key
 * @returns {string | null}
 */
export function getItemSync(key) {
  if (key in cache) return cache[key];
  if (typeof localStorage === 'undefined') return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * @param {string} key
 * @returns {Promise<string | null>}
 */
export async function getItem(key) {
  if (!ready && initPromise) await initPromise;
  return getItemSync(key);
}

/**
 * @param {string} key
 * @param {string} value
 * @returns {Promise<void>}
 */
export async function setItem(key, value) {
  if (!ready && initPromise) await initPromise;
  cache[key] = value;
  mirrorCacheToLocalStorage();
  await persistCache();
}

/**
 * @param {string} key
 * @returns {Promise<void>}
 */
export async function removeItem(key) {
  if (!ready && initPromise) await initPromise;
  delete cache[key];
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(key);
    } catch {
      void 0;
    }
  }
  await persistCache();
}

/** @returns {UserStoreBackend} */
export function getUserStoreBackend() {
  return backend;
}
