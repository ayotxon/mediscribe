/**
 * IndexedDB storage for recording sessions.
 *
 * Audio chunks are streamed to disk as they arrive from MediaRecorder —
 * so if the tab crashes mid-recording we keep whatever made it through.
 *
 * Schema:
 *   sessions { id, state, mimeType, meta, createdAt, attempts,
 *              transcript?, structured? }
 *   chunks   { [sessionId, seq] → Blob }
 *
 * State machine (why we store transcript/structured intermediates):
 *   recording → ready → transcribed → structured → (deleted on save)
 *                               ↑          ↑
 *            retry re-enters at whichever step has no result yet,
 *            so the doctor never re-dictates and we never re-bill
 *            Whisper for audio we already transcribed.
 */

const DB_NAME      = 'mediscribe'
const DB_VERSION   = 1
const STORE_SESS   = 'sessions'
const STORE_CHUNKS = 'chunks'

let _dbPromise = null

function openDB() {
  if (_dbPromise) return _dbPromise
  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_SESS)) {
        db.createObjectStore(STORE_SESS, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(STORE_CHUNKS)) {
        db.createObjectStore(STORE_CHUNKS, { keyPath: ['sessionId', 'seq'] })
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

// ── Sessions ──────────────────────────────────────────────────────────────────

export async function createSession(meta, mimeType) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const session = {
    id,
    state: 'recording',
    mimeType,
    meta,
    createdAt: new Date().toISOString(),
    attempts: 0,
    transcript: null,
    structured: null
  }
  const t = await tx(STORE_SESS, 'readwrite')
  await promisify(t.objectStore(STORE_SESS).put(session))
  return id
}

export async function getSession(sessionId) {
  const t = await tx(STORE_SESS)
  return promisify(t.objectStore(STORE_SESS).get(sessionId))
}

export async function listSessions() {
  const t = await tx(STORE_SESS)
  return promisify(t.objectStore(STORE_SESS).getAll())
}

export async function updateSession(sessionId, updates) {
  const t = await tx(STORE_SESS, 'readwrite')
  const store = t.objectStore(STORE_SESS)
  const session = await promisify(store.get(sessionId))
  if (!session) return null
  Object.assign(session, updates)
  await promisify(store.put(session))
  return session
}

export async function incrementAttempts(sessionId) {
  const session = await getSession(sessionId)
  if (!session) return
  await updateSession(sessionId, { attempts: (session.attempts || 0) + 1 })
}

export async function deleteSession(sessionId) {
  // Chunks first — orphaned chunks waste space if we die mid-delete,
  // but an orphaned session with no chunks would mis-report size
  const t1 = await tx(STORE_CHUNKS, 'readwrite')
  const range = IDBKeyRange.bound([sessionId, 0], [sessionId, Number.MAX_SAFE_INTEGER])
  await new Promise((resolve, reject) => {
    const req = t1.objectStore(STORE_CHUNKS).openCursor(range)
    req.onsuccess = () => {
      const cur = req.result
      if (cur) { cur.delete(); cur.continue() } else resolve()
    }
    req.onerror = () => reject(req.error)
  })
  const t2 = await tx(STORE_SESS, 'readwrite')
  await promisify(t2.objectStore(STORE_SESS).delete(sessionId))
}

// ── Chunks ────────────────────────────────────────────────────────────────────

export async function appendChunk(sessionId, blob, seq) {
  const t = await tx(STORE_CHUNKS, 'readwrite')
  await promisify(t.objectStore(STORE_CHUNKS).put({ sessionId, seq, blob }))
}

export async function getSessionBlob(sessionId) {
  const session = await getSession(sessionId)
  if (!session) return null
  const t = await tx(STORE_CHUNKS)
  const range = IDBKeyRange.bound([sessionId, 0], [sessionId, Number.MAX_SAFE_INTEGER])
  const parts = await new Promise((resolve, reject) => {
    const out = []
    const req = t.objectStore(STORE_CHUNKS).openCursor(range)
    req.onsuccess = () => {
      const cur = req.result
      if (cur) { out.push(cur.value.blob); cur.continue() } else resolve(out)
    }
    req.onerror = () => reject(req.error)
  })
  if (parts.length === 0) return null
  return new Blob(parts, { type: session.mimeType })
}

export async function hasChunks(sessionId) {
  const t = await tx(STORE_CHUNKS)
  const range = IDBKeyRange.bound([sessionId, 0], [sessionId, Number.MAX_SAFE_INTEGER])
  const req = t.objectStore(STORE_CHUNKS).openCursor(range)
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result !== null)
    req.onerror   = () => reject(req.error)
  })
}

// ── Storage estimate ──────────────────────────────────────────────────────────

export async function getStorageEstimate() {
  if (!navigator.storage?.estimate) return null
  try { return await navigator.storage.estimate() } catch { return null }
}

// ── One-shot migration from the old base64/localStorage queue ─────────────────

const OLD_KEY = 'mediscribe_pending_queue'

export async function migrateLegacyQueue() {
  let legacy
  try { legacy = JSON.parse(localStorage.getItem(OLD_KEY) || '[]') } catch { return 0 }
  if (!legacy.length) return 0

  let migrated = 0
  for (const entry of legacy) {
    try {
      const res = await fetch(`data:${entry.mimeType};base64,${entry.blobBase64}`)
      const blob = await res.blob()
      const id = await createSession(entry.meta, entry.mimeType || 'audio/webm')
      await appendChunk(id, blob, 0)
      await updateSession(id, { state: 'ready', attempts: entry.attempts || 0 })
      migrated++
    } catch {
      // Skip corrupt entries — they'd never have succeeded anyway
    }
  }
  localStorage.removeItem(OLD_KEY)
  return migrated
}
