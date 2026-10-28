import nacl from 'tweetnacl'

/**
 * Encryption at rest, same scheme as Stashbird and Hawkdone. The key is derived from the passphrase with PBKDF2-SHA256
 * (WebCrypto, slow on purpose) and never stored; the journal database is sealed with XSalsa20-Poly1305
 * (tweetnacl secretbox) as one blob before it is written to IndexedDB or to the desktop file.
 */

export const KEY_BYTES = nacl.secretbox.keyLength
export const PBKDF2_ITERATIONS = 310_000

const enc = new TextEncoder()
const dec = new TextDecoder()

/** tweetnacl checks `instanceof Uint8Array`; bytes from another realm (jsdom's TextEncoder in tests) fail that. */
const own = (bytes: Uint8Array): Uint8Array => (bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes))

export function randomBytes(n: number): Uint8Array {
  return nacl.randomBytes(n)
}

export function toBase64(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}

export function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export async function deriveKey(passphrase: string, salt: Uint8Array): Promise<Uint8Array> {
  const material = await crypto.subtle.importKey('raw', enc.encode(passphrase.normalize('NFKC')), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS }, material, KEY_BYTES * 8)
  return new Uint8Array(bits)
}

/** nonce ‖ box, as bytes */
export function sealBytes(key: Uint8Array, plain: Uint8Array): Uint8Array {
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength)
  const box = nacl.secretbox(own(plain), nonce, own(key))
  const out = new Uint8Array(nonce.length + box.length)
  out.set(nonce, 0)
  out.set(box, nonce.length)
  return out
}

export function openBytes(key: Uint8Array, sealed: Uint8Array): Uint8Array {
  const nonce = sealed.subarray(0, nacl.secretbox.nonceLength)
  const box = sealed.subarray(nacl.secretbox.nonceLength)
  const plain = nacl.secretbox.open(own(box), own(nonce), own(key))
  if (!plain) throw new Error('Wrong passphrase or damaged data.')
  return plain
}

export function sealJson(key: Uint8Array, value: unknown): string {
  return toBase64(sealBytes(key, enc.encode(JSON.stringify(value))))
}

export function openJson<T>(key: Uint8Array, sealed: string): T {
  return JSON.parse(dec.decode(openBytes(key, fromBase64(sealed)))) as T
}
