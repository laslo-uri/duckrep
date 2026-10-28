import { beforeEach, describe, expect, it } from 'vitest';
import { decodeVaultFile, encodeVaultFile, type VaultRecord, type VaultStorage } from './storage';
import {
  changePassphrase,
  loadJournal,
  lock,
  retireLegacyJournal,
  saveJournal,
  setVaultStorage,
  setup,
  unlock,
  vaultState,
} from './vault';

function memoryStorage(legacy: Uint8Array | null = null) {
  const box: { record: VaultRecord | null; legacy: Uint8Array | null } = { record: null, legacy };
  const storage: VaultStorage = {
    read: async () => box.record,
    write: async (record) => {
      box.record = record;
    },
    readLegacy: async () => box.legacy,
    removeLegacy: async () => {
      box.legacy = null;
    },
  };
  return { box, storage };
}

const PASS = 'correct horse battery';
// tweetnacl hands back Node-realm arrays, so byte checks compare plain arrays.
const journal = new TextEncoder().encode('SQLite format 3\u0000 pretend journal bytes');

describe('vault', () => {
  let mem: ReturnType<typeof memoryStorage>;

  beforeEach(() => {
    mem = memoryStorage();
    setVaultStorage(mem.storage);
  });

  it('goes unset → unlocked → locked → unlocked', async () => {
    expect(await vaultState()).toBe('unset');
    await setup(PASS);
    expect(await vaultState()).toBe('unlocked');
    lock();
    expect(await vaultState()).toBe('locked');
    await unlock(PASS);
    expect(await vaultState()).toBe('unlocked');
  });

  it('refuses short and wrong passphrases', async () => {
    await expect(setup('short')).rejects.toThrow(/at least 10/);
    await setup(PASS);
    lock();
    await expect(unlock('not the passphrase')).rejects.toThrow('Wrong passphrase.');
    await expect(loadJournal()).rejects.toThrow(/locked/);
  });

  it('stores the journal sealed and reads it back', async () => {
    await setup(PASS);
    await saveJournal(journal);
    const stored = mem.box.record?.data;
    expect(stored).toBeInstanceOf(Uint8Array);
    expect(new TextDecoder().decode(stored!)).not.toContain('pretend journal');
    lock();
    await unlock(PASS);
    const source = await loadJournal();
    expect(source.legacy).toBe(false);
    expect(Array.from(source.bytes!)).toEqual(Array.from(journal));
  });

  it('takes over the plaintext YouPeak database and clears its WAL flag', async () => {
    const legacy = new Uint8Array(100);
    legacy.set(new TextEncoder().encode('SQLite format 3\u0000'));
    legacy[18] = 2;
    legacy[19] = 2;
    mem = memoryStorage(legacy);
    setVaultStorage(mem.storage);
    await setup(PASS);
    const source = await loadJournal();
    expect(source.legacy).toBe(true);
    expect([source.bytes![18], source.bytes![19]]).toEqual([1, 1]);
    await saveJournal(source.bytes!);
    await retireLegacyJournal();
    expect(mem.box.legacy).toBeNull();
    expect((await loadJournal()).legacy).toBe(false);
  });

  it('re-seals under a new passphrase', async () => {
    await setup(PASS);
    await saveJournal(journal);
    await expect(changePassphrase('wrong one!!', 'brand new passphrase', journal)).rejects.toThrow('Wrong passphrase.');
    await changePassphrase(PASS, 'brand new passphrase', journal);
    lock();
    await expect(unlock(PASS)).rejects.toThrow('Wrong passphrase.');
    await unlock('brand new passphrase');
    expect(Array.from((await loadJournal()).bytes!)).toEqual(Array.from(journal));
  });
});

describe('desktop vault file', () => {
  it('round-trips header and data', () => {
    const record: VaultRecord = { v: 1, salt: 'c2FsdA==', verifier: 'dmVy', data: new Uint8Array([1, 2, 3]) };
    expect(decodeVaultFile(encodeVaultFile(record))).toEqual(record);
    expect(decodeVaultFile(encodeVaultFile({ ...record, data: null }))).toEqual({ ...record, data: null });
    expect(decodeVaultFile(new Uint8Array([1, 2, 3]))).toBeNull();
  });
});
