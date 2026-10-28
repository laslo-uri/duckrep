import { SCHEMA_SQL } from './schema';
import { runMigrations } from './migrations';
import { seedGlobalExercisesIfEmpty, syncGlobalExercises } from './seedSync';
import { LOCAL_USER_ID } from './constants';
import type { DbClient } from './dbClient';
import { loadJournal, lock, retireLegacyJournal, saveJournal } from '../vault/vault';

export type { DbClient } from './dbClient';

let client: DbClient | null = null;
let initPromise: Promise<DbClient> | null = null;
/** Live sql.js Database — used for backup export and passphrase changes. */
let sqlJsDb: import('sql.js').Database | null = null;
let flushPending: () => Promise<void> = () => Promise.resolve();

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

async function createSqlJsClient(): Promise<DbClient> {
  const initSqlJs = (await import('sql.js')).default;
  const wasmUrl = (await import('sql.js/dist/sql-wasm.wasm?url')).default;
  const SQL = await initSqlJs({ locateFile: () => wasmUrl });

  // The sealed journal (or, on the first unlock, the plaintext YouPeak database it replaces).
  const source = await loadJournal();
  const db = source.bytes ? new SQL.Database(source.bytes) : new SQL.Database();
  sqlJsDb = db;

  // Save right after each change (a page closed a moment later must not lose it). Changes made
  // while a save is running are coalesced into one more save when it finishes.
  let saving: Promise<void> | null = null;
  let dirty = false;
  let inTransaction = false;
  const schedulePersist = () => {
    dirty = true;
    saving ??= (async () => {
      while (dirty && !inTransaction) {
        dirty = false;
        await saveJournal(db.export()).catch((err: unknown) => {
          console.error('[duckrep] Failed to save the journal (storage full?). Export a backup from Settings.', err);
        });
      }
      saving = null;
    })();
  };
  flushPending = () => saving ?? Promise.resolve();

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
      // inside BEGIN … COMMIT (journal import) nothing is exported; one save follows the commit
      if (/^\s*BEGIN\b/i.test(sql)) inTransaction = true;
      else if (/^\s*(COMMIT|END|ROLLBACK)\b/i.test(sql)) inTransaction = false;
      if (!inTransaction) schedulePersist();
    },
  };

  await initDbClient(sqlJsClient);
  if (source.legacy) {
    // Seal the YouPeak data right away, then drop the plaintext copy.
    await saveJournal(db.export());
    await retireLegacyJournal();
  }
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
    initPromise = openGate.then(createSqlJsClient).then((c) => {
      client = c;
      return c;
    });
  }
  return initPromise;
}

export async function initDb(): Promise<void> {
  await getDb();
}

/** Raw SQLite bytes (unencrypted) for the backup download and for re-sealing on a passphrase change. */
export async function exportSqlJsDump(): Promise<Uint8Array | null> {
  await getDb();
  return sqlJsDb ? sqlJsDb.export() : null;
}

/** Writes any change still waiting for the save timer. */
export function flushDb(): Promise<void> {
  return flushPending();
}

/** Saves, forgets the key and reloads, which drops the open database and every cached query. */
export async function lockJournal(): Promise<void> {
  await flushDb();
  lock();
  window.location.reload();
}

export { localDateKey, newId, nowIso, todayIso } from './utils';
