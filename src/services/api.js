/**
 * MediScribe API service
 *
 * All requests use relative paths — Vercel rewrites /api/* to Railway.
 * Auth is handled via httpOnly cookies (credentials: 'include').
 *
 * Fixes applied:
 * - Singleton refresh promise (non-atomic 401 cascade)
 * - FormData rebuilt on retry (consumed stream bug)
 * - AbortController timeout on all requests
 * - Correct audio filename extension
 */

let _refreshFn = null
export function setRefreshFn(fn) { _refreshFn = fn }

// Singleton in-flight refresh — prevents multiple concurrent 401s from
// each triggering their own refresh (rotated token = only first succeeds)
let _refreshPromise = null
async function doRefresh() {
  if (!_refreshFn) return false
  if (!_refreshPromise) {
    _refreshPromise = _refreshFn().finally(() => { _refreshPromise = null })
  }
  return _refreshPromise
}

const BASE = import.meta.env.DEV
  ? (import.meta.env.VITE_API_URL || 'http://localhost:3001')
  : ''

// Wrap a fetch promise with a hard timeout via AbortController
function withTimeout(fetchFn, ms) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  return fetchFn(controller.signal).finally(() => clearTimeout(timer))
}

async function req(path, options = {}, timeoutMs = 30_000) {
  const res = await withTimeout(
    signal => fetch(`${BASE}${path}`, { ...options, credentials: 'include', signal,
      headers: { 'Content-Type': 'application/json', ...options.headers }
    }),
    timeoutMs
  ).catch(err => {
    if (err.name === 'AbortError') throw new Error('Délai dépassé — vérifiez votre connexion')
    throw err
  })

  if (res.status === 401) {
    const body = await res.json().catch(() => ({}))
    // Try a refresh on any 401 — the access cookie may be expired (TOKEN_EXPIRED)
    // OR missing entirely ("Token manquant" after a long idle). The httpOnly
    // refresh cookie often outlives the access cookie, so refreshing recovers
    // the session silently instead of bouncing the user to /login.
    const ok = await doRefresh()
    if (ok) {
      const retry = await withTimeout(
        signal => fetch(`${BASE}${path}`, { ...options, credentials: 'include', signal,
          headers: { 'Content-Type': 'application/json', ...options.headers }
        }),
        timeoutMs
      ).catch(err => {
        if (err.name === 'AbortError') throw new Error('Délai dépassé — vérifiez votre connexion')
        throw err
      })
      if (!retry.ok) {
        const err = await retry.json().catch(() => ({}))
        throw new Error(err.error || `Erreur ${retry.status}`)
      }
      return retry.json()
    }
    throw new Error(body.error || 'Non autorisé')
  }

  const data = await res.json()
  if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`)
  return data
}

// ── Transcription ─────────────────────────────────────────────────────────────
export async function transcribeAudio(audioBlob) {
  // Use correct extension so backend MIME detection works on all platforms
  const ext = audioBlob.type.includes('mp4') ? 'mp4' : 'webm'

  // FormData must be rebuilt for each fetch attempt — body stream is consumed
  // after the first call and cannot be re-read
  function buildForm() {
    const form = new FormData()
    form.append('audio', audioBlob, `recording.${ext}`)
    form.append('language', 'fr')
    // Tells the backend this is a single-speaker medical dictation so it
    // SKIPS the Claude dialogue post-process that adds "Médecin :" labels
    // and silently drops unfamiliar words as [inaudible].
    form.append('mode', 'dictation')
    return form
  }

  const res = await withTimeout(
    signal => fetch(`${BASE}/api/transcribe`, {
      method: 'POST', credentials: 'include', signal, body: buildForm()
    }),
    120_000  // transcription can take time for long recordings
  ).catch(err => {
    if (err.name === 'AbortError') throw new Error('Transcription trop longue — réessayez avec un enregistrement plus court')
    throw err
  })

  if (res.status === 401) {
    const body = await res.json().catch(() => ({}))
    // Same as req(): refresh on any 401, not just TOKEN_EXPIRED — the access
    // cookie might be missing rather than expired, and the refresh cookie can
    // still recover the session.
    const ok = await doRefresh()
    if (ok) {
      const retry = await withTimeout(
        signal => fetch(`${BASE}/api/transcribe`, {
          method: 'POST', credentials: 'include', signal,
          body: buildForm()  // new FormData — blob can be read multiple times
        }),
        120_000
      ).catch(err => {
        if (err.name === 'AbortError') throw new Error('Délai dépassé — vérifiez votre connexion')
        throw err
      })
      if (!retry.ok) {
        const err = await retry.json().catch(() => ({}))
        throw new Error(err.error || 'Erreur de transcription')
      }
      return retry.json()
    }
    throw new Error(body.error || 'Non autorisé')
  }

  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Erreur de transcription')
  return data
}

// ── Structuration ─────────────────────────────────────────────────────────────
export async function structureExam(transcript, examTypeId, prompt) {
  return req('/api/exam/structure', {
    method: 'POST',
    body: JSON.stringify({ transcript, examTypeId, prompt, model: 'claude-opus-4-7', language: 'fr' })
  }, 90_000)  // AI structuring can take up to 90s
}

// ── CRUD rapports ─────────────────────────────────────────────────────────────
export async function saveReport(report) {
  return req('/api/exam/reports', { method: 'POST', body: JSON.stringify(report) })
}

export async function getReports(page = 0) {
  return req(`/api/exam/reports?page=${page}`)
}

export async function getReport(id) {
  return req(`/api/exam/reports/${id}`)
}

export async function updateReport(id, data) {
  return req(`/api/exam/reports/${id}`, { method: 'PATCH', body: JSON.stringify(data) })
}

export async function deleteReport(id) {
  return req(`/api/exam/reports/${id}`, { method: 'DELETE' })
}

// ── Patients ──────────────────────────────────────────────────────────────────
export async function getPatients(search = '', limit = 5) {
  const params = new URLSearchParams({ limit })
  if (search) params.set('search', search)
  return req(`/api/patients?${params}`)
}

export async function createPatient(data) {
  return req('/api/patients', { method: 'POST', body: JSON.stringify(data) })
}
