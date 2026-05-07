/**
 * IndexedDB storage for recording sessions — with transparent PHI encryption.
 *
 * Audio chunks stream straight to disk as MediaRecorder emits them, so a tab
 * crash mid-recording never costs more than the last sub-second of audio.
 *
 * Encryption (opt-in per session, gated on an AES-GCM key supplied by the
 * auth layer through setEncryptionKey):
 *   - sessions flagged `encrypted: true` persist meta/transcript/structured as
 *     { iv, ct } AES-GCM records
 *   - chunks carry an `iv` field when encrypted; its absence means plaintext
 *   - when the key is missing (cookie-only restore → "locked" state) we still
 *     expose IDs/state/timestamps so the UI can surface a locked queue, but
 *     any call that needs plaintext throws LockedError
 *
 * Schema:
 *   sessions { id, state, mimeType, meta|encMeta, createdAt, attempts,
 *              transcript|encTranscript?, structured|encStructured?,
 *              encrypted }
 *   chunks   { [sessionId, seq] → { blob, iv? } }
 */

import {
  encryptJSON, decryptJSON,
  encryptBlob, decryptBlob
} from './crypto.js'

const DB_NAME     = 'mediscribe'
const DB_VERSION  = 1
const STORE_SESS  = 'sessions'
const STORE_CHUNK = 'chunks'

let _dbPromise = null
let _key       = null   // AES-GCM CryptoKey, set by auth layer

// ── Key injection ─────────────────────────────────────────────────────────────

export function setEncryptionKey(key) { _key = key }
export function hasEncryptionKey()    { return _key !== null }

export class LockedError extends Error {
  constructor(msg = 'Données chiffrées — déverrouillez la session') {
    super(msg); this.name = 'LockedError'
  }
}

function requireKey() {
  if (!_key) throw new LockedError()
  return _key
}

// ── DB bootstrap ──────────────────────────────────────────────────────────────

function openDB() {
  if (_dbPromise) return _dbPromise
  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_SESS)) {
        db.createObjectStore(STORE_SESS, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(STORE_CHUNK)) {
        db.createObjectStore(STORE_CHUNK, { keyPath: ['sessionId', 'seq'] })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror   = () => reject(req.error)
    req.onblocked = () => reject(new Error('IndexedDB ouverte dans un autre onglet'))
  })
  return _dbPromise
}

function promisify(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror   = () => reject(req.error)
  })
}

async function tx(stores, mode = 'readonly') {
  const db = await openDB()
  return db.transaction(stores, mode)
}

// ── Session (de)serialization with encryption ────────────────────────────────

async function decryptSessionIfNeeded(record) {
  if (!record) return null
  if (!record.encrypted) return record  // legacy / pre-encryption record
  const key = requireKey()
  const out = { ...record }
  if (record.encMeta)       out.meta       = await decryptJSON(key, record.encMeta)
  if (record.encTranscript) out.transcript = (await decryptJSON(key, record.encTranscript))?.v ?? null
  if (record.encStructured) out.structured = await decryptJSON(key, record.encStructured)
  delete out.encMeta; delete out.encTranscript; delete out.encStructured
  return out
}

async function encryptSessionFields(record) {
  if (!_key) {
    // Persist plaintext when no key is available (should only happen for
    // boot-time recovery bookkeeping where fields aren't rewritten anyway)
    return { ...record, encrypted: false }
  }
  const key = _key
  const out = {
    id:         record.id,
    state:      record.state,
    mimeType:   record.mimeType,
    createdAt:  record.createdAt,
    attempts:   record.attempts || 0,
    encrypted:  true,
    encMeta:    record.meta       ? await encryptJSON(key, record.meta)            : null,
    // Wrap text in { v: ... } so JSON.parse always yields an object; keeps
    // the decrypt path uniform whether the original was a string or null.
    encTranscript: record.transcript ? await encryptJSON(key, { v: record.transcript }) : null,
    encStructured: record.structured ? await encryptJSON(key, record.structured)        : null
  }
  return out
}

// ── Sessions API ──────────────────────────────────────────────────────────────

export async function createSession(meta, mimeType) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const plain = {
    id,
    state: 'recording',
    mimeType,
    meta,
    createdAt: new Date().toISOString(),
    attempts: 0,
    transcript: null,
    structured: null
  }
  const record = await encryptSessionFields(plain)
  const t = await tx(STORE_SESS, 'readwrite')
  await promisify(t.objectStore(STORE_SESS).put(record))
  return id
}

export async function getSession(sessionId) {
  const t = await tx(STORE_SESS)
  const raw = await promisify(t.objectStore(STORE_SESS).get(sessionId))
  return decryptSessionIfNeeded(raw)
}

/**
 * Raw session fetch — returns the stored record WITHOUT decrypting.
 * Use this for bookkeeping (state flips, attempt counters, listing) that
 * must work while the app is locked.
 */
export async function getSessionRaw(sessionId) {
  const t = await tx(STORE_SESS)
  return promisify(t.objectStore(STORE_SESS).get(sessionId))
}

export async function listSessionsRaw() {
  const t = await tx(STORE_SESS)
  return promisify(t.objectStore(STORE_SESS).getAll())
}

/**
 * Updates a subset of session fields. Re-encrypts only if the caller is
 * setting plaintext-level fields (transcript/structured/meta).
 */
export async function updateSession(sessionId, updates) {
  const raw = await getSessionRaw(sessionId)
  if (!raw) return null

  // Cheap path: bookkeeping fields only — don't touch encrypted payloads.
  // reportId is non-PHI (server-issued UUID) and stays unencrypted so we can
  // look the session up by report later without needing the unlock key.
  const bookkeepingOnly =
    Object.keys(updates).every(k => k === 'state' || k === 'attempts' || k === 'mimeType' || k === 'reportId')
  if (bookkeepingOnly) {
    const merged = { ...raw, ...updates }
    const t = await tx(STORE_SESS, 'readwrite')
    await promisify(t.objectStore(STORE_SESS).put(merged))
    return merged
  }

  // Payload path: decrypt, merge, re-encrypt
  const plain = await decryptSessionIfNeeded(raw) || {}
  const merged = { ...plain, ...updates }
  const rec = await encryptSessionFields(merged)
  const t = await tx(STORE_SESS, 'readwrite')
  await promisify(t.objectStore(STORE_SESS).put(rec))
  return merged
}

export async function incrementAttempts(sessionId) {
  const raw = await getSessionRaw(sessionId)
  if (!raw) return
  await updateSession(sessionId, { attempts: (raw.attempts || 0) + 1 })
}

export async function deleteSession(sessionId) {
  const t1 = await tx(STORE_CHUNK, 'readwrite')
  const range = IDBKeyRange.bound([sessionId, 0], [sessionId, Number.MAX_SAFE_INTEGER])
  await new Promise((resolve, reject) => {
    const req = t1.objectStore(STORE_CHUNK).openCursor(range)
    req.onsuccess = () => {
      const cur = req.result
      if (cur) { cur.delete(); cur.continue() } else resolve()
    }
    req.onerror = () => reject(req.error)
  })
  const t2 = await tx(STORE_SESS, 'readwrite')
  await promisify(t2.objectStore(STORE_SESS).delete(sessionId))
}

// ── Chunks API ────────────────────────────────────────────────────────────────

export async function appendChunk(sessionId, blob, seq) {
  let record
  if (_key) {
    const { iv, ct } = await encryptBlob(_key, blob)
    record = { sessionId, seq, blob: ct, iv }
  } else {
    record = { sessionId, seq, blob }
  }
  const t = await tx(STORE_CHUNK, 'readwrite')
  await promisify(t.objectStore(STORE_CHUNK).put(record))
}

export async function getSessionBlob(sessionId) {
  const raw = await getSessionRaw(sessionId)
  if (!raw) return null
  const t = await tx(STORE_CHUNK)
  const range = IDBKeyRange.bound([sessionId, 0], [sessionId, Number.MAX_SAFE_INTEGER])
  const records = await new Promise((resolve, reject) => {
    const out = []
    const req = t.objectStore(STORE_CHUNK).openCursor(range)
    req.onsuccess = () => {
      const cur = req.result
      if (cur) { out.push(cur.value); cur.continue() } else resolve(out)
    }
    req.onerror = () => reject(req.error)
  })
  if (records.length === 0) return null

  const parts = []
  for (const r of records) {
    if (r.iv) {
      // Encrypted chunk → need the key
      const key = requireKey()
      const b = await decryptBlob(key, { iv: r.iv, ct: r.blob }, raw.mimeType)
      parts.push(b)
    } else {
      parts.push(r.blob)
    }
  }
  return new Blob(parts, { type: raw.mimeType })
}

export async function hasChunks(sessionId) {
  const t = await tx(STORE_CHUNK)
  const range = IDBKeyRange.bound([sessionId, 0], [sessionId, Number.MAX_SAFE_INTEGER])
  const req = t.objectStore(STORE_CHUNK).openCursor(range)
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result !== null)
    req.onerror   = () => reject(req.error)
  })
}

// ── Archived sessions lookup (audio kept for verification after save) ────────

export async function getSessionByReportId(reportId) {
  if (!reportId) return null
  const all = await listSessionsRaw()
  return all.find(s => s.reportId === reportId) || null
}

export async function getAudioBlobForReport(reportId) {
  const session = await getSessionByReportId(reportId)
  if (!session) return null
  return getSessionBlob(session.id)
}

export async function deleteAudioForReport(reportId) {
  const session = await getSessionByReportId(reportId)
  if (!session) return false
  await deleteSession(session.id)
  return true
}

// ── Storage estimate ──────────────────────────────────────────────────────────

export async function getStorageEstimate() {
  if (!navigator.storage?.estimate) return null
  try { return await navigator.storage.estimate() } catch { return null }
}

// ── Legacy queue migration (plaintext base64 → IDB) ───────────────────────────

const OLD_KEY = 'mediscribe_pending_queue'

export async function migrateLegacyQueue() {
  let legacy
  try { legacy = JSON.parse(localStorage.getItem(OLD_KEY) || '[]') } catch { return 0 }
  if (!legacy.length) return 0

  let migrated = 0
  for (const entry of legacy) {
    try {
      const res  = await fetch(`data:${entry.mimeType};base64,${entry.blobBase64}`)
      const blob = await res.blob()
      const id   = await createSession(entry.meta, entry.mimeType || 'audio/webm')
      await appendChunk(id, blob, 0)
      await updateSession(id, { state: 'ready', attempts: entry.attempts || 0 })
      migrated++
    } catch { /* skip corrupt entries */ }
  }
  localStorage.removeItem(OLD_KEY)
  return migrated
}
