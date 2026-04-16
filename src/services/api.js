/**
 * MediScribe API service
 *
 * All requests use relative paths — Vercel rewrites /api/* to Railway.
 * Auth is handled via httpOnly cookies (credentials: 'include').
 * No Authorization header, no VITE_API_URL needed.
 *
 * On TOKEN_EXPIRED (401 + canRefresh), the interceptor calls refreshFn()
 * and retries once automatically.
 */

// Injected by AuthContext so api.js doesn't need to import it (avoids circular deps)
let _refreshFn = null
export function setRefreshFn(fn) { _refreshFn = fn }

const BASE = import.meta.env.DEV
  ? (import.meta.env.VITE_API_URL || 'http://localhost:3001')
  : ''

async function req(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers }
  })

  // Auto-refresh on expired access token (cookie-based)
  if (res.status === 401) {
    const body = await res.json().catch(() => ({}))
    if (body.code === 'TOKEN_EXPIRED' && _refreshFn) {
      const ok = await _refreshFn()
      if (ok) {
        // Retry original request once with fresh cookie
        const retry = await fetch(`${BASE}${path}`, {
          ...options,
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', ...options.headers }
        })
        if (!retry.ok) {
          const err = await retry.json().catch(() => ({}))
          throw new Error(err.error || `Erreur ${retry.status}`)
        }
        return retry.json()
      }
    }
    throw new Error(body.error || 'Non autorisé')
  }

  const data = await res.json()
  if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`)
  return data
}

// ── Transcription ─────────────────────────────────────────────────────────────
export async function transcribeAudio(audioBlob) {
  const form = new FormData()
  form.append('audio', audioBlob, 'recording.webm')
  form.append('language', 'fr') // MediScribe is always French

  const res = await fetch(`${BASE}/api/transcribe`, {
    method: 'POST',
    credentials: 'include',
    body: form
    // No Content-Type header — browser sets multipart boundary automatically
  })

  if (res.status === 401) {
    const body = await res.json().catch(() => ({}))
    if (body.code === 'TOKEN_EXPIRED' && _refreshFn) {
      const ok = await _refreshFn()
      if (ok) {
        const retry = await fetch(`${BASE}/api/transcribe`, {
          method: 'POST',
          credentials: 'include',
          body: form
        })
        if (!retry.ok) {
          const err = await retry.json().catch(() => ({}))
          throw new Error(err.error || 'Erreur de transcription')
        }
        return retry.json()
      }
    }
    throw new Error(body.error || 'Non autorisé')
  }

  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Erreur de transcription')
  return data
}

// ── Structuration ─────────────────────────────────────────────────────────────
export async function structureExam(transcript, examTypeId) {
  return req('/api/exam/structure', {
    method: 'POST',
    body: JSON.stringify({ transcript, examTypeId })
  })
}

// ── CRUD rapports ─────────────────────────────────────────────────────────────
export async function saveReport(report) {
  return req('/api/exam/reports', {
    method: 'POST',
    body: JSON.stringify(report)
  })
}

export async function getReports(page = 0) {
  return req(`/api/exam/reports?page=${page}`)
}

export async function getReport(id) {
  return req(`/api/exam/reports/${id}`)
}

export async function updateReport(id, data) {
  return req(`/api/exam/reports/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data)
  })
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
