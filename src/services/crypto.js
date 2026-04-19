/**
 * WebCrypto helpers for at-rest PHI encryption.
 *
 * Threat model: someone gets physical access to the doctor's device and
 * inspects IndexedDB. Audio chunks, patient names, transcripts, and structured
 * reports must be unreadable without the doctor's password.
 *
 * Design:
 *   - Key  = PBKDF2(password, salt=SHA-256(email), 250k iters, SHA-256) → AES-GCM-256
 *   - IV   = 12 random bytes, unique per operation
 *   - AEAD = AES-GCM provides built-in authentication → wrong key throws,
 *            which we use as a canary check on unlock.
 *
 * Keys live in RAM only — never written to disk or cookies. On reload the
 * user must re-enter their password to unlock stored data.
 */

const PBKDF2_ITERATIONS = 250_000
const KEY_LENGTH_BITS   = 256
const IV_BYTES          = 12

// ── Key derivation ────────────────────────────────────────────────────────────

async function importPassword(password) {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  )
}

async function saltForEmail(email) {
  const bytes = new TextEncoder().encode(email.toLowerCase().trim())
  const hash  = await crypto.subtle.digest('SHA-256', bytes)
  return new Uint8Array(hash)
}

export async function deriveKey(password, email) {
  const pwKey = await importPassword(password)
  const salt  = await saltForEmail(email)
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    pwKey,
    { name: 'AES-GCM', length: KEY_LENGTH_BITS },
    false,
    ['encrypt', 'decrypt']
  )
}

// ── Primitives ────────────────────────────────────────────────────────────────

function randomIV() {
  return crypto.getRandomValues(new Uint8Array(IV_BYTES))
}

export async function encryptBytes(key, bytes) {
  const iv = randomIV()
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes)
  return { iv, ct: new Uint8Array(ct) }
}

export async function decryptBytes(key, { iv, ct }) {
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct)
  return new Uint8Array(pt)
}

// ── Text ──────────────────────────────────────────────────────────────────────

export async function encryptString(key, plaintext) {
  return encryptBytes(key, new TextEncoder().encode(plaintext))
}

export async function decryptString(key, enc) {
  const bytes = await decryptBytes(key, enc)
  return new TextDecoder().decode(bytes)
}

// ── JSON convenience ──────────────────────────────────────────────────────────

export async function encryptJSON(key, obj) {
  return encryptString(key, JSON.stringify(obj))
}

export async function decryptJSON(key, enc) {
  return JSON.parse(await decryptString(key, enc))
}

// ── Blobs ─────────────────────────────────────────────────────────────────────

export async function encryptBlob(key, blob) {
  const buf = await blob.arrayBuffer()
  const { iv, ct } = await encryptBytes(key, new Uint8Array(buf))
  // Store ciphertext as a Blob so IDB keeps its streaming-friendly storage path
  return { iv, ct: new Blob([ct]) }
}

export async function decryptBlob(key, { iv, ct }, mimeType) {
  const buf = await ct.arrayBuffer()
  const pt  = await decryptBytes(key, { iv, ct: new Uint8Array(buf) })
  return new Blob([pt], { type: mimeType })
}

// ── Canary (password verification without network round-trip) ─────────────────
//
// After the first successful signIn we encrypt a random 32-byte token and keep
// the ciphertext in localStorage. On unlock, we derive the candidate key and
// try to decrypt the canary — AES-GCM throws on wrong key, so a clean decrypt
// means the password was correct. The token itself is never used elsewhere.

const CANARY_KEY = 'mediscribe_canary_v1'

function toB64(bytes) {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s)
}
function fromB64(b64) {
  const s = atob(b64)
  const out = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i)
  return out
}

export async function createCanary(key) {
  const token = crypto.getRandomValues(new Uint8Array(32))
  const { iv, ct } = await encryptBytes(key, token)
  localStorage.setItem(CANARY_KEY, JSON.stringify({ iv: toB64(iv), ct: toB64(ct) }))
}

export async function verifyKey(key) {
  const raw = localStorage.getItem(CANARY_KEY)
  if (!raw) return 'missing'   // caller should treat as first-time → createCanary
  try {
    const { iv, ct } = JSON.parse(raw)
    await decryptBytes(key, { iv: fromB64(iv), ct: fromB64(ct) })
    return 'ok'
  } catch {
    return 'wrong-password'
  }
}

export function clearCanary() {
  localStorage.removeItem(CANARY_KEY)
}
