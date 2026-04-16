/**
 * Pending queue — stores failed/offline recordings in localStorage
 * and retries when connection is restored.
 *
 * Each entry: { id, blobBase64, mimeType, meta, savedAt, attempts }
 * meta: { examType, patientName, patientId, indication, userId }
 */

import { transcribeAudio, structureExam, saveReport } from './api.js'

const KEY = 'mediscribe_pending_queue'

// ── Storage helpers ───────────────────────────────────────────────────────────

function load() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]') } catch { return [] }
}

function save(queue) {
  try { localStorage.setItem(KEY, JSON.stringify(queue)) } catch { /* storage full */ }
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

/** Convert base64 → Blob */
function base64ToBlob(b64, mimeType) {
  const bytes = atob(b64)
  const buf = new Uint8Array(bytes.length)
  for (let i = 0; i < bytes.length; i++) buf[i] = bytes.charCodeAt(i)
  return new Blob([buf], { type: mimeType })
}

/** Enqueue a recording that failed to process */
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
  save(queue)
}

function removeFromQueue(id) {
  save(load().filter(e => e.id !== id))
}

function incrementAttempts(id) {
  const queue = load()
  const entry = queue.find(e => e.id === id)
  if (entry) { entry.attempts++; save(queue) }
}

// ── Retry logic ───────────────────────────────────────────────────────────────

let _retrying = false
let _onProgress = null   // (id, status) => void
let _onComplete = null   // (id, reportId) => void

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
    try {
      _onProgress?.(entry.id, 'transcribing')
      const blob = base64ToBlob(entry.blobBase64, entry.mimeType)
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

      removeFromQueue(entry.id)
      _onComplete?.(entry.id, report.id)
    } catch {
      incrementAttempts(entry.id)
      // Stop retrying this session — will try again next time
      break
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

  // Also try once on start if online and queue has items
  if (navigator.onLine && countPending() > 0) {
    setTimeout(retryPending, 2000)
  }
}
