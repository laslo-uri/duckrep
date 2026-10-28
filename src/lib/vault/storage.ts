import { isTauri } from '../db/utils';

/**
 * Where the sealed journal lives. One record holds everything (salt, passphrase verifier and the
 * sealed SQLite bytes), so a write is atomic: a crash leaves either the old vault or the new one.
 *
 * - Browser and phone shell: IndexedDB `duckrep-db`, store `vault`, key `journal`.
 * - Desktop: `journal.vault` in the app config folder (%APPDATA%\com.duckrep.app), written by
 *   the `vault_*` commands in src-tauri/src/lib.rs (temp file + rename).
 *
 * The legacy source is the plaintext database YouPeak kept before the vault existed: IndexedDB
 * `youpeak-db` (or the older localStorage dump) in the browser, `youpeak.db` on the desktop (the
 * Tauri shell copies it over from com.youpeak.app). It is read once, sealed, and then removed.
 */

export interface VaultRecord {
  v: 1;
  /** base64 PBKDF2 salt */
  salt: string;
  /** a sealed constant, used to check a passphrase without storing it */
  verifier: string;
  /** sealed SQLite bytes; null until the first save */
  data: Uint8Array | null;
}

export interface VaultStorage {
  read(): Promise<VaultRecord | null>;
  write(record: VaultRecord): Promise<void>;
  readLegacy(): Promise<Uint8Array | null>;
  removeLegacy(): Promise<void>;
}

const IDB_NAME = 'duckrep-db';
const IDB_STORE = 'vault';
const IDB_KEY = 'journal';
const LEGACY_IDB_NAME = 'youpeak-db';
const LEGACY_IDB_STORE = 'sqlite';
const LEGACY_IDB_KEY = 'dump';
const LEGACY_LOCALSTORAGE_KEY = 'youpeak-sqlite';

function requestResult<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'));
  });
}

function openVaultIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(IDB_STORE)) req.result.createObjectStore(IDB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'));
  });
}

/** Opens the YouPeak database only if it exists (an upgrade from version 0 means it did not). */
function openLegacyIdb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    let created = false;
    const req = indexedDB.open(LEGACY_IDB_NAME);
    req.onupgradeneeded = (event) => {
      if (event.oldVersion === 0) {
        created = true;
        req.transaction?.abort();
      }
    };
    req.onsuccess = () => {
      if (created) {
        req.result.close();
        resolve(null);
      } else {
        resolve(req.result);
      }
    };
    req.onerror = () => resolve(null);
  });
}

function toBytes(value: unknown): Uint8Array | null {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  return null;
}

export const browserStorage: VaultStorage = {
  async read() {
    const db = await openVaultIdb();
    try {
      const value = await requestResult(db.transaction(IDB_STORE, 'readonly').objectStore(IDB_STORE).get(IDB_KEY));
      if (!value || typeof value !== 'object') return null;
      const rec = value as Partial<VaultRecord>;
      if (typeof rec.salt !== 'string' || typeof rec.verifier !== 'string') return null;
      return { v: 1, salt: rec.salt, verifier: rec.verifier, data: toBytes(rec.data) };
    } finally {
      db.close();
    }
  },

  async write(record) {
    const db = await openVaultIdb();
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, 'readwrite');
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error('IndexedDB write failed'));
        tx.onabort = () => reject(tx.error ?? new Error('IndexedDB write aborted (storage full?)'));
        tx.objectStore(IDB_STORE).put(record, IDB_KEY);
      });
    } finally {
      db.close();
    }
  },

  async readLegacy() {
    const db = await openLegacyIdb();
    if (db) {
      try {
        if (db.objectStoreNames.contains(LEGACY_IDB_STORE)) {
          const value = await requestResult(
            db.transaction(LEGACY_IDB_STORE, 'readonly').objectStore(LEGACY_IDB_STORE).get(LEGACY_IDB_KEY),
          );
          const bytes = toBytes(value);
          if (bytes) return bytes;
        }
      } finally {
        db.close();
      }
    }
    try {
      const saved = localStorage.getItem(LEGACY_LOCALSTORAGE_KEY);
      return saved ? new Uint8Array(JSON.parse(saved) as number[]) : null;
    } catch {
      return null;
    }
  },

  async removeLegacy() {
    try {
      localStorage.removeItem(LEGACY_LOCALSTORAGE_KEY);
    } catch {
      /* private mode */
    }
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase(LEGACY_IDB_NAME);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    });
  },
};

const VAULT_FILE = 'journal.vault';
const LEGACY_FILE = 'youpeak.db';
const MAGIC = [0x44, 0x52, 0x56, 0x31]; // "DRV1"

/** Desktop file layout: "DRV1", u32 LE header length, header JSON {v, salt, verifier}, sealed bytes. */
export function encodeVaultFile(record: VaultRecord): Uint8Array {
  const header = new TextEncoder().encode(JSON.stringify({ v: record.v, salt: record.salt, verifier: record.verifier }));
  const data = record.data ?? new Uint8Array(0);
  const out = new Uint8Array(8 + header.length + data.length);
  out.set(MAGIC, 0);
  new DataView(out.buffer).setUint32(4, header.length, true);
  out.set(header, 8);
  out.set(data, 8 + header.length);
  return out;
}

export function decodeVaultFile(bytes: Uint8Array): VaultRecord | null {
  if (bytes.length < 8 || MAGIC.some((b, i) => bytes[i] !== b)) return null;
  const headerLength = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(4, true);
  if (8 + headerLength > bytes.length) return null;
  const header = JSON.parse(new TextDecoder().decode(bytes.subarray(8, 8 + headerLength))) as Partial<VaultRecord>;
  if (typeof header.salt !== 'string' || typeof header.verifier !== 'string') return null;
  const data = bytes.subarray(8 + headerLength);
  return { v: 1, salt: header.salt, verifier: header.verifier, data: data.length ? data.slice() : null };
}

async function readDesktopFile(name: string): Promise<Uint8Array | null> {
  const { invoke } = await import('@tauri-apps/api/core');
  // raw responses arrive as an ArrayBuffer; the postMessage fallback of the IPC sends a number array
  const result = await invoke<ArrayBuffer | number[]>('vault_read', { name });
  const bytes = result instanceof ArrayBuffer ? new Uint8Array(result) : Uint8Array.from(result);
  return bytes.length ? bytes : null;
}

export const desktopStorage: VaultStorage = {
  async read() {
    const bytes = await readDesktopFile(VAULT_FILE);
    return bytes ? decodeVaultFile(bytes) : null;
  },

  async write(record) {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('vault_write', encodeVaultFile(record), { headers: { 'x-vault-file': VAULT_FILE } });
  },

  readLegacy: () => readDesktopFile(LEGACY_FILE),

  async removeLegacy() {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('vault_remove', { name: LEGACY_FILE });
  },
};

export function defaultStorage(): VaultStorage {
  return isTauri() ? desktopStorage : browserStorage;
}
