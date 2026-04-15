// In production, use relative paths so Vercel rewrites proxy to Railway (no CORS).
// In dev, point directly to the local backend.
const API_URL = import.meta.env.DEV
  ? (import.meta.env.VITE_API_URL || 'http://localhost:3001')
  : ''

let authToken = null
export function setAuthToken(token) { authToken = token }

function headers(extra = {}) {
  const h = { 'Content-Type': 'application/json', ...extra }
  if (authToken) h['Authorization'] = `Bearer ${authToken}`
  return h
}

async function call(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { ...headers(), ...options.headers }
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`)
  return data
}

// ── Transcription (réutilise le backend ConsultScribe) ──────────────────────
export async function transcribeAudio(audioBlob) {
  const form = new FormData()
  form.append('audio', audioBlob, 'recording.webm')

  const res = await fetch(`${API_URL}/api/transcribe`, {
    method: 'POST',
    body: form,
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : {}
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Erreur de transcription')
  return data
}

// ── Structuration spécialisée par type d'examen ─────────────────────────────
export async function structureExam(transcript, examTypeId) {
  return call('/api/exam/structure', {
    method: 'POST',
    body: JSON.stringify({ transcript, examTypeId })
  })
}

// ── CRUD rapports d'examens ──────────────────────────────────────────────────
export async function saveReport(report) {
  return call('/api/exam/reports', {
    method: 'POST',
    body: JSON.stringify(report)
  })
}

export async function getReports(page = 0) {
  return call(`/api/exam/reports?page=${page}`)
}

export async function getReport(id) {
  return call(`/api/exam/reports/${id}`)
}

export async function updateReport(id, data) {
  return call(`/api/exam/reports/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data)
  })
}

export async function deleteReport(id) {
  return call(`/api/exam/reports/${id}`, { method: 'DELETE' })
}
