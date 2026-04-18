/**
 * Pending queue — stores offline recordings in localStorage,
 * retries when connection is restored.
 *
 * Each entry: { id, blobBase64, mimeType, meta, savedAt, attempts }
 * meta: { examTypeId, patientName, patientId, indication, userId, prompt }
 */

import { transcribeAudio, structureExam, saveReport } from './api.js'

const KEY = 'mediscribe_pending_queue'
const MAX_ATTEMPTS = 3  // entries that fail 3+ times are skipped (not blocking)

// ── Storage helpers ───────────────────────────────────────────────────────────

function load() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]') } catch { return [] }
}

// Returns true if saved successfully, false if storage is full
function save(queue) {
  try {
    localStorage.setItem(KEY, JSON.stringify(queue))
    return true
  } catch {
    return false
  }
}

export function getPending() {
  return load()
}

export function countPending() {
  return load().length
}

/** Convert Blob → base64 string */
async function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

/** Convert base64 → Blob — uses fetch() trick to avoid blocking the main thread */
async function base64ToBlob(b64, mimeType) {
  const res = await fetch(`data:${mimeType};base64,${b64}`)
  return res.blob()
}

/**
 * Enqueue a recording for later processing.
 * Throws if localStorage is full so the caller can surface the error instead
 * of silently losing the audio.
 */
export async function enqueuePending(blob, meta) {
  const queue = load()
  const b64 = await blobToBase64(blob)
  queue.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    blobBase64: b64,
    mimeType: blob.type || 'audio/webm',
    meta,
    savedAt: new Date().toISOString(),
    attempts: 0
  })
  const ok = save(queue)
  if (!ok) {
    throw new Error('Stockage local plein — libérez de l\'espace ou supprimez d\'anciens enregistrements')
  }
}

export function removePendingItem(id) {
  save(load().filter(e => e.id !== id))
}

export function clearPending() {
  save([])
}

function incrementAttempts(id) {
  const queue = load()
  const entry = queue.find(e => e.id === id)
  if (entry) { entry.attempts++; save(queue) }
}

// ── Retry logic ───────────────────────────────────────────────────────────────

let _retrying = false
let _onProgress = null  // (id, status) => void
let _onComplete = null  // (id, reportId) => void

export function setQueueCallbacks(onProgress, onComplete) {
  _onProgress = onProgress
  _onComplete = onComplete
}

export async function retryPending() {
  if (_retrying) return
  const queue = load()
  if (queue.length === 0) return

  _retrying = true

  for (const entry of queue) {
    // Skip permanently failed entries instead of blocking the whole queue
    if (entry.attempts >= MAX_ATTEMPTS) continue

    try {
      _onProgress?.(entry.id, 'transcribing')
      const blob = await base64ToBlob(entry.blobBase64, entry.mimeType)
      const { text } = await transcribeAudio(blob)

      _onProgress?.(entry.id, 'structuring')
      const { structured } = await structureExam(text, entry.meta.examTypeId, entry.meta.prompt)

      _onProgress?.(entry.id, 'saving')
      const report = await saveReport({
        exam_type:    entry.meta.examTypeId,
        patient_name: entry.meta.patientName || null,
        patient_id:   entry.meta.patientId || null,
        indication:   entry.meta.indication || null,
        transcript:   text,
        structured,
        user_id:      entry.meta.userId
      })

      removePendingItem(entry.id)
      _onComplete?.(entry.id, report.id)
    } catch (err) {
      incrementAttempts(entry.id)
      // If it's a network error, stop and wait for next online event
      // If it's another type of error, continue to the next entry
      const isNetwork = !navigator.onLine ||
        (err instanceof TypeError && (
          err.message.includes('Failed to fetch') ||
          err.message.includes('Load failed') ||
          err.message.includes('Délai dépassé')
        ))
      if (isNetwork) break
      // Non-network error (API error, bad data): skip this entry, try next
    }
  }

  _retrying = false
}

// ── Online watcher ────────────────────────────────────────────────────────────

let _watcherActive = false

export function startOnlineWatcher() {
  if (_watcherActive) return
  _watcherActive = true

  window.addEventListener('online', () => {
    if (countPending() > 0) retryPending()
  })

  // Try once on startup if already online with pending items
  if (navigator.onLine && countPending() > 0) {
    setTimeout(retryPending, 2000)
  }
}
