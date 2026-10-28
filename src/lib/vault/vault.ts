import { deriveKey, fromBase64, openBytes, openJson, randomBytes, sealBytes, sealJson, toBase64 } from './crypto';
import { defaultStorage, type VaultRecord, type VaultStorage } from './storage';

/**
 * The vault: passphrase → key, lock state, first-time setup and passphrase change. Same rules as
 * Stashbird and Hawkdone: the passphrase is never stored, the key lives only in memory until the
 * app is locked (or the auto-lock timer fires), and there is no recovery of a lost passphrase.
 *
 * Unlike those apps (Dexie rows sealed one by one) the journal is one SQLite file, so the whole
 * file is sealed as one blob each time it is saved (src/lib/db/client.ts).
 */

const VERIFY = 'duckrep-vault-v1';
export const MIN_PASSPHRASE = 10;

export type VaultState = 'unset' | 'locked' | 'unlocked';

export type JournalSource = {
  /** plaintext SQLite bytes, or null for a fresh journal */
  bytes: Uint8Array | null;
  /** true when the bytes came from the unencrypted YouPeak database */
  legacy: boolean;
};

let storage: VaultStorage | null = null;
let key: Uint8Array | null = null;
let header: Pick<VaultRecord, 'salt' | 'verifier'> | null = null;
/** Saves and passphrase changes run one after another, so an older save never lands last. */
let queue: Promise<unknown> = Promise.resolve();

function store(): VaultStorage {
  storage ??= defaultStorage();
  return storage;
}

/** Tests swap in an in-memory store. Also forgets the key. */
export function setVaultStorage(next: VaultStorage): void {
  storage = next;
  key = null;
  header = null;
  queue = Promise.resolve();
}

function enqueue<T>(job: () => Promise<T>): Promise<T> {
  const run = queue.then(job, job);
  queue = run.catch(() => undefined);
  return run;
}

export async function vaultState(): Promise<VaultState> {
  if (key) return 'unlocked';
  return (await store().read()) ? 'locked' : 'unset';
}

/** The passphrase baked in at build time (VITE_DUCKREP_PASSWORD in .env), used only for first-time setup. */
export function builtInPassphrase(): string {
  const env = import.meta.env as Record<string, string | undefined>;
  return env.VITE_DUCKREP_PASSWORD?.trim() ?? '';
}

let setupInFlight: Promise<void> | undefined;

export function setup(passphrase: string): Promise<void> {
  // React StrictMode and double clicks must not run two setups against the same store
  if (!setupInFlight) {
    setupInFlight = doSetup(passphrase).finally(() => {
      setupInFlight = undefined;
    });
  }
  return setupInFlight;
}

async function doSetup(passphrase: string): Promise<void> {
  if (passphrase.length < MIN_PASSPHRASE) throw new Error(`Use at least ${MIN_PASSPHRASE} characters.`);
  if (await store().read()) throw new Error('A passphrase is already set.');
  const salt = randomBytes(16);
  const nextKey = await deriveKey(passphrase, salt);
  const next = { salt: toBase64(salt), verifier: sealJson(nextKey, VERIFY) };
  // data stays empty until the database opens and saves itself sealed (it may pull in the YouPeak journal first)
  await store().write({ v: 1, ...next, data: null });
  header = next;
  key = nextKey;
}

async function checkPassphrase(passphrase: string, record: Pick<VaultRecord, 'salt' | 'verifier'>): Promise<Uint8Array> {
  const candidate = await deriveKey(passphrase, fromBase64(record.salt));
  try {
    if (openJson<string>(candidate, record.verifier) !== VERIFY) throw new Error('bad');
  } catch {
    throw new Error('Wrong passphrase.');
  }
  return candidate;
}

export async function unlock(passphrase: string): Promise<void> {
  const record = await store().read();
  if (!record) throw new Error('No passphrase is set yet.');
  key = await checkPassphrase(passphrase, record);
  header = { salt: record.salt, verifier: record.verifier };
}

/** Forgets the key. The caller saves pending changes first and reloads the page (src/lib/db/client.ts). */
export function lock(): void {
  key = null;
  header = null;
}

/** YouPeak's desktop database was in WAL mode; sql.js reads only rollback-journal files (header bytes 18–19). */
function withoutWal(bytes: Uint8Array): Uint8Array {
  if (bytes[18] !== 2 && bytes[19] !== 2) return bytes;
  const copy = bytes.slice();
  copy[18] = 1;
  copy[19] = 1;
  return copy;
}

/** The journal to open: the sealed one, or the old plaintext YouPeak database on the first unlock. */
export async function loadJournal(): Promise<JournalSource> {
  if (!key) throw new Error('The journal is locked.');
  const record = await store().read();
  if (record?.data) return { bytes: openBytes(key, record.data), legacy: false };
  const legacy = await store().readLegacy();
  return legacy ? { bytes: withoutWal(legacy), legacy: true } : { bytes: null, legacy: false };
}

export function saveJournal(bytes: Uint8Array): Promise<void> {
  return enqueue(async () => {
    if (!key || !header) throw new Error('The journal is locked.');
    await store().write({ v: 1, ...header, data: sealBytes(key, bytes) });
  });
}

/** Removes the plaintext YouPeak database once its contents are saved sealed. */
export function retireLegacyJournal(): Promise<void> {
  return enqueue(() => store().removeLegacy());
}

/** Re-seals the journal under a new passphrase in one write; the old key stays if anything fails. */
export function changePassphrase(current: string, next: string, bytes: Uint8Array): Promise<void> {
  return enqueue(async () => {
    if (next.length < MIN_PASSPHRASE) throw new Error(`Use at least ${MIN_PASSPHRASE} characters.`);
    const record = await store().read();
    if (!record) throw new Error('No passphrase is set yet.');
    await checkPassphrase(current, record);
    const salt = randomBytes(16);
    const nextKey = await deriveKey(next, salt);
    const nextHeader = { salt: toBase64(salt), verifier: sealJson(nextKey, VERIFY) };
    await store().write({ v: 1, ...nextHeader, data: sealBytes(nextKey, bytes) });
    key = nextKey;
    header = nextHeader;
  });
}
