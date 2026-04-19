/**
 * Session-aware pending queue.
 *
 * The pipeline is: recording → ready → transcribed → structured → completed.
 * Each intermediate result is persisted to IndexedDB, so retries skip whatever
 * already succeeded — the doctor never re-dictates and we never re-bill Whisper
 * for audio we already have a transcript for.
 */

import { transcribeAudio, structureExam, saveReport } from './api.js'
import {
  createSession, getSession, listSessions, updateSession,
  incrementAttempts, deleteSession,
  appendChunk, getSessionBlob, hasChunks,
  migrateLegacyQueue
} from './audioStorage.js'

const MAX_ATTEMPTS = 3   // show-but-don't-retry threshold (never silent drop)

// ── Recording-side helpers ────────────────────────────────────────────────────

// Serialize chunk writes per session so stop() can await them before finalizing
const _pendingWrites = new Map()  // sessionId → Promise<void>

export async function createRecordingSession(meta, mimeType) {
  return createSession(meta, mimeType)
}

export function writeChunk(sessionId, blob, seq) {
  const prev = _pendingWrites.get(sessionId) || Promise.resolve()
  const next = prev.then(() => appendChunk(sessionId, blob, seq)).catch(() => {})
  _pendingWrites.set(sessionId, next)
  return next
}

export async function flushChunkWrites(sessionId) {
  const p = _pendingWrites.get(sessionId)
  if (p) await p
  _pendingWrites.delete(sessionId)
}

export async function finalizeRecording(sessionId) {
  await flushChunkWrites(sessionId)
  await updateSession(sessionId, { state: 'ready' })
}

export async function discardSession(sessionId) {
  _pendingWrites.delete(sessionId)
  await deleteSession(sessionId)
}

// ── Pipeline — state-aware, resumes at the first incomplete step ─────────────

/**
 * Runs a session through the remaining pipeline steps.
 * Throws on error — caller decides whether to leave the session for retry.
 */
export async function processSession(sessionId, cb = {}) {
  const session = await getSession(sessionId)
  if (!session) throw new Error('Session introuvable')
  if (session.state === 'recording') {
    // Orphaned recording: chunks exist but finalize never ran. Treat as ready.
    await updateSession(sessionId, { state: 'ready' })
  }

  let { transcript, structured } = session

  if (!transcript) {
    cb.onProgress?.(sessionId, 'transcribing')
    const blob = await getSessionBlob(sessionId)
    if (!blob) throw new Error('Audio introuvable pour cette session')
    const { text } = await transcribeAudio(blob)
    transcript = text
    await updateSession(sessionId, { transcript, state: 'transcribed' })
  }

  if (!structured) {
    cb.onProgress?.(sessionId, 'structuring')
    const res = await structureExam(transcript, session.meta.examTypeId, session.meta.prompt)
    structured = res.structured
    await updateSession(sessionId, { structured, state: 'structured' })
  }

  cb.onProgress?.(sessionId, 'saving')
  const report = await saveReport({
    exam_type:    session.meta.examTypeId,
    patient_name: session.meta.patientName || null,
    patient_id:   session.meta.patientId   || null,
    indication:   session.meta.indication  || null,
    transcript,
    structured,
    user_id:      session.meta.userId
  })

  await deleteSession(sessionId)
  cb.onComplete?.(sessionId, report.id)
  return report
}

// ── Boot-time recovery ───────────────────────────────────────────────────────

/**
 * Handles sessions left hanging from a previous tab/load:
 *   - 'recording' state with chunks → promote to 'ready' (audio survived)
 *   - 'recording' state with no chunks → delete (nothing to recover)
 * Returns the number of sessions recovered.
 */
export async function recoverOrphanedSessions() {
  await migrateLegacyQueue().catch(() => 0)
  const all = await listSessions()
  let recovered = 0
  for (const s of all) {
    if (s.state !== 'recording') continue
    if (await hasChunks(s.id)) {
      await updateSession(s.id, { state: 'ready' })
      recovered++
    } else {
      await deleteSession(s.id)
    }
  }
  return recovered
}

// ── Queue view (for HomePage) ────────────────────────────────────────────────

/**
 * Shape exposed to the UI — keeps HomePage agnostic of IDB internals.
 * `savedAt` mirrors the old field name so existing render code still works.
 */
function toListItem(s) {
  return {
    id:       s.id,
    meta:     s.meta,
    savedAt:  s.createdAt,
    attempts: s.attempts || 0,
    state:    s.state
  }
}

export async function getPending() {
  const all = await listSessions()
  return all
    .filter(s => s.state !== 'recording')  // hide actively recording sessions
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map(toListItem)
}

export async function countPending() {
  const list = await getPending()
  return list.length
}

export async function removePendingItem(id) {
  await deleteSession(id)
}

export async function clearPending() {
  const all = await listSessions()
  for (const s of all) {
    if (s.state === 'recording') continue  // don't wipe an in-progress recording
    await deleteSession(s.id)
  }
}

// ── Retry loop ────────────────────────────────────────────────────────────────

let _retrying = false
let _onProgress = null
let _onComplete = null

export function setQueueCallbacks(onProgress, onComplete) {
  _onProgress = onProgress
  _onComplete = onComplete
}

function isNetworkError(err) {
  if (!navigator.onLine) return true
  const msg = (err?.message || '').toLowerCase()
  return (
    msg.includes('failed to fetch') ||
    msg.includes('load failed')    ||
    msg.includes('délai dépassé')  ||
    msg.includes('network')
  )
}

export async function retryPending() {
  if (_retrying) return
  _retrying = true
  try {
    const pending = await getPending()
    for (const item of pending) {
      if (item.attempts >= MAX_ATTEMPTS) continue  // surfaced in UI, not silent-dropped
      try {
        await processSession(item.id, { onProgress: _onProgress, onComplete: _onComplete })
      } catch (err) {
        await incrementAttempts(item.id)
        if (isNetworkError(err)) break  // wait for next online event
        // Non-network error → skip this one, continue with the rest
      }
    }
  } finally {
    _retrying = false
  }
}

// ── Online watcher ────────────────────────────────────────────────────────────

let _watcherActive = false

export function startOnlineWatcher() {
  if (_watcherActive) return
  _watcherActive = true

  window.addEventListener('online', async () => {
    if ((await countPending()) > 0) retryPending()
  })

  // Delay startup retry so the app paints first
  setTimeout(async () => {
    if (navigator.onLine && (await countPending()) > 0) retryPending()
  }, 2000)
}
