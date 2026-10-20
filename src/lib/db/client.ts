import { SCHEMA_SQL } from './schema';
import { runMigrations } from './migrations';
import { seedGlobalExercisesIfEmpty, syncGlobalExercises } from './seedSync';
import { DB_NAME, LOCAL_USER_ID, SQLJS_STORAGE_KEY } from './constants';
import { isTauri, toTauriParams } from './utils';
import type { DbClient } from './dbClient';

export type { DbClient } from './dbClient';

const IDB_NAME = 'youpeak-db';
const IDB_STORE = 'sqlite';
const IDB_KEY = 'dump';

let client: DbClient | null = null;
let initPromise: Promise<DbClient> | null = null;
/** Live sql.js Database (browser only) — used for backup export. */
let sqlJsDb: import('sql.js').Database | null = null;

function runSchema(client: DbClient): Promise<void> {
  const statements = SCHEMA_SQL.split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return statements.reduce(
    (chain, sql) => chain.then(() => client.execute(sql)),
    Promise.resolve(),
  );
}

async function seedIfEmpty(client: DbClient): Promise<void> {
  const existing = await client.select<{ c: number }>(
    'SELECT COUNT(*) as c FROM profiles WHERE id = ?',
    [LOCAL_USER_ID],
  );
  if ((existing[0]?.c ?? 0) > 0) return;

  await client.execute('INSERT INTO profiles (id, display_name) VALUES (?, ?)', [
    LOCAL_USER_ID,
    null,
  ]);

  await seedGlobalExercisesIfEmpty(client);
}

async function initDbClient(client: DbClient): Promise<void> {
  await runSchema(client);
  await runMigrations(client);
  await seedIfEmpty(client);
  await syncGlobalExercises(client);
}

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'));
  });
}

async function loadSqlJsBytes(): Promise<Uint8Array | null> {
  try {
    const db = await openIdb();
    const bytes = await new Promise<Uint8Array | null>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.get(IDB_KEY);
      req.onsuccess = () => {
        const v = req.result;
        if (v instanceof ArrayBuffer) resolve(new Uint8Array(v));
        else if (v instanceof Uint8Array) resolve(v);
        else resolve(null);
      };
      req.onerror = () => reject(req.error ?? new Error('IndexedDB read failed'));
    });
    db.close();
    if (bytes) return bytes;
  } catch {
    /* fall through to localStorage migration */
  }

  const saved = localStorage.getItem(SQLJS_STORAGE_KEY);
  if (!saved) return null;
  try {
    const bytes = new Uint8Array(JSON.parse(saved) as number[]);
    // Migrate to IndexedDB once; keep localStorage until next successful IDB write.
    return bytes;
  } catch {
    return null;
  }
}

async function saveSqlJsBytes(data: Uint8Array): Promise<void> {
  const copy = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  try {
    const db = await openIdb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB write failed'));
      tx.objectStore(IDB_STORE).put(copy, IDB_KEY);
    });
    db.close();
    // Clear legacy localStorage dump after a successful IDB write.
    try {
      localStorage.removeItem(SQLJS_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    return;
  } catch (err) {
    // Quota / private mode: fall back to localStorage (may fail for large DBs).
    try {
      localStorage.setItem(SQLJS_STORAGE_KEY, JSON.stringify(Array.from(data)));
    } catch {
      console.error('[you-peak] Failed to persist database (quota?). Export a backup from Settings.', err);
    }
  }
}

async function createTauriClient(): Promise<DbClient> {
  const { default: Database } = await import('@tauri-apps/plugin-sql');
  const db = await Database.load(DB_NAME);

  const tauriClient: DbClient = {
    async select<T>(sql: string, params: unknown[] = []): Promise<T[]> {
      const rows = await db.select<T>(toTauriParams(sql), params);
      return rows as unknown as T[];
    },
    async execute(sql: string, params: unknown[] = []): Promise<void> {
      await db.execute(toTauriParams(sql), params);
    },
  };

  await initDbClient(tauriClient);
  return tauriClient;
}

async function createSqlJsClient(): Promise<DbClient> {
  const initSqlJs = (await import('sql.js')).default;
  const wasmUrl = (await import('sql.js/dist/sql-wasm.wasm?url')).default;
  const SQL = await initSqlJs({ locateFile: () => wasmUrl });

  let db: import('sql.js').Database;
  const saved = await loadSqlJsBytes();
  if (saved) {
    db = new SQL.Database(saved);
  } else {
    db = new SQL.Database();
  }
  sqlJsDb = db;

  let persistTimer: ReturnType<typeof setTimeout> | null = null;
  const persist = () => {
    const data = db.export();
    void saveSqlJsBytes(data);
  };
  const schedulePersist = () => {
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(persist, 100);
  };

  const sqlJsClient: DbClient = {
    async select<T>(sql: string, params: unknown[] = []): Promise<T[]> {
      const stmt = db.prepare(sql);
      stmt.bind(params as import('sql.js').BindParams);
      const rows: T[] = [];
      while (stmt.step()) {
        rows.push(stmt.getAsObject() as T);
      }
      stmt.free();
      return rows;
    },
    async execute(sql: string, params: unknown[] = []): Promise<void> {
      db.run(sql, params as import('sql.js').BindParams);
      schedulePersist();
    },
  };

  await initDbClient(sqlJsClient);
  return sqlJsClient;
}

let openGate: Promise<void> = Promise.resolve();

/** Hold the database open until `gate` settles (main.tsx: until the first paint). */
export function deferDbOpen(gate: Promise<void>): void {
  openGate = gate;
}

export async function getDb(): Promise<DbClient> {
  if (client) return client;
  if (!initPromise) {
    initPromise = openGate.then(() => (isTauri() ? createTauriClient() : createSqlJsClient())).then((c) => {
      client = c;
      return c;
    });
  }
  return initPromise;
}

export async function initDb(): Promise<void> {
  await getDb();
}

/** Export raw sql.js bytes (browser) for backup download. */
export async function exportSqlJsDump(): Promise<Uint8Array | null> {
  if (isTauri()) return null;
  await getDb();
  if (sqlJsDb) {
    const data = sqlJsDb.export();
    void saveSqlJsBytes(data);
    return data;
  }
  return loadSqlJsBytes();
}

/** Test helper — in-memory db without persistence. */
export async function createMemoryDb(): Promise<DbClient> {
  const initSqlJs = (await import('sql.js')).default;
  const wasmUrl = (await import('sql.js/dist/sql-wasm.wasm?url')).default;
  const SQL = await initSqlJs({ locateFile: () => wasmUrl });
  const db = new SQL.Database();

  const memClient: DbClient = {
    async select<T>(sql: string, params: unknown[] = []): Promise<T[]> {
      const stmt = db.prepare(sql);
      stmt.bind(params as import('sql.js').BindParams);
      const rows: T[] = [];
      while (stmt.step()) {
        rows.push(stmt.getAsObject() as T);
      }
      stmt.free();
      return rows;
    },
    async execute(sql: string, params: unknown[] = []): Promise<void> {
      db.run(sql, params as import('sql.js').BindParams);
    },
  };

  await initDbClient(memClient);
  return memClient;
}

export { localDateKey, newId, nowIso, todayIso } from './utils';
