/**
 * Session-aware pending queue.
 *
 * The pipeline is: recording → ready → transcribed → structured → completed.
 * Each intermediate result is persisted to IndexedDB, so retries skip whatever
 * already succeeded — the doctor never re-dictates and we never re-bill Whisper
 * for audio we already have a transcript for.
 */

import { transcribeAudio, structureExam, saveReport } from './api.js'
import { EXAM_TYPES } from '../data/examTypes.js'
import {
  createSession, getSession, getSessionRaw, listSessionsRaw, updateSession,
  incrementAttempts, deleteSession,
  appendChunk, getSessionBlob, hasChunks,
  hasEncryptionKey, LockedError,
  migrateLegacyQueue
} from './audioStorage.js'

// Reorder dict-shaped sections to the canonical key order declared in the
// exam type's layout (e.g. doppler → mitrale, aorte, pulmonaire, tricuspide).
// Runs once at structure time so the saved report is canonical; user reorders
// after that are preserved as-is in the JSON object's key order.
function normalizeStructured(examTypeId, structured) {
  const examType = EXAM_TYPES?.[examTypeId]
  if (!examType?.layout || !structured || typeof structured !== 'object') return structured
  const out = { ...structured }
  for (const section of examType.layout) {
    if (!section.keyOrder || !section.dataKey) continue
    const cur = out[section.dataKey]
    if (!cur || typeof cur !== 'object' || Array.isArray(cur)) continue
    const ordered = {}
    for (const k of section.keyOrder) ordered[k] = (k in cur) ? cur[k] : null
    for (const [k, v] of Object.entries(cur)) {
      if (!section.keyOrder.includes(k)) ordered[k] = v
    }
    out[section.dataKey] = ordered
  }
  return out
}

// Bake the dictating doctor's identity into the saved report so the
// "Adressé par" line and the signature stay attached to the report even if
// another user logs in and opens it. Only fills missing fields.
function attachDoctorIdentity(structured, doctorProfile) {
  if (!structured || typeof structured !== 'object' || !doctorProfile) return structured
  const out = { ...structured }
  const parts = [doctorProfile.first_name, doctorProfile.last_name].filter(Boolean)
  const drName = parts.length
    ? `Dr ${parts.join(' ')}`
    : (doctorProfile.email ? `Dr ${doctorProfile.email.split('@')[0]}` : null)
  if (!drName) return out
  if (out.referred_by == null || out.referred_by === '') {
    out.referred_by = drName
  }
  if (out.signature == null || out.signature === '') {
    const sigLines = [
      drName,
      doctorProfile.specialty || null,
      doctorProfile.rpps
        ? `RPPS : ${doctorProfile.rpps}`
        : (doctorProfile.ordre ? `N° Ordre : ${doctorProfile.ordre}` : null)
    ].filter(Boolean)
    out.signature = sigLines.join('\n')
  }
  return out
}

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
    structured = normalizeStructured(session.meta.examTypeId, res.structured)
    structured = attachDoctorIdentity(structured, session.meta.doctorProfile)
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

  // Archive: keep the audio in IDB, link it to the saved report so the
  // doctor can replay the dictation later for verification. The session
  // disappears from the pending queue (state !== 'completed' filter) but
  // the chunks are preserved for getAudioBlobForReport.
  await updateSession(sessionId, { state: 'completed', reportId: report.id })
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
  const all = await listSessionsRaw()   // raw = no decryption, works while locked
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
 * Shape exposed to the UI. Decryption is best-effort so a locked app still
 * renders a pending-count banner; items whose meta couldn't be decrypted come
 * back with `locked: true` and no patient data.
 */
async function toListItem(raw) {
  const base = {
    id:       raw.id,
    savedAt:  raw.createdAt,
    attempts: raw.attempts || 0,
    state:    raw.state,
    encrypted: !!raw.encrypted,
    locked:   false,
    meta:     null
  }
  if (!raw.encrypted) { base.meta = raw.meta; return base }
  if (!hasEncryptionKey()) { base.locked = true; return base }
  try {
    const s = await getSession(raw.id)   // decrypts
    base.meta = s?.meta || null
  } catch {
    base.locked = true
  }
  return base
}

export async function getPending() {
  const all = await listSessionsRaw()
  const visible = all
    .filter(s => s.state !== 'recording' && s.state !== 'completed')
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  return Promise.all(visible.map(toListItem))
}

export async function countPending() {
  const list = await getPending()
  return list.length
}

export async function removePendingItem(id) {
  await deleteSession(id)
}

export async function clearPending() {
  const all = await listSessionsRaw()
  for (const s of all) {
    if (s.state === 'recording') continue
    await deleteSession(s.id)
  }
}

/**
 * Reads the audio back as a Blob — used by the UI to offer a manual download
 * for sessions that have exceeded MAX_ATTEMPTS. Requires the encryption key.
 */
export async function exportSessionBlob(sessionId) {
  return getSessionBlob(sessionId)
}

export { LockedError }

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
  // Don't churn the queue while locked — we'd just fail every decrypt.
  if (!hasEncryptionKey() && (await countPending()) > 0) {
    // At least one item is likely encrypted; bail until unlocked.
    const any = await listSessionsRaw()
    if (any.some(s => s.encrypted)) return
  }
  _retrying = true
  try {
    const pending = await getPending()
    for (const item of pending) {
      if (item.attempts >= MAX_ATTEMPTS) continue  // surfaced in UI, not silent-dropped
      if (item.locked) continue                     // skip until unlock
      try {
        await processSession(item.id, { onProgress: _onProgress, onComplete: _onComplete })
      } catch (err) {
        if (err instanceof LockedError) break        // no point retrying others
        await incrementAttempts(item.id)
        if (isNetworkError(err)) break               // wait for next online event
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
