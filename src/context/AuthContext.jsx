/**
 * Auth context for MediScribe
 * Uses the same cookie-based auth system as ConsultScribe:
 * - Login  → POST /api/auth/cookie/login   → httpOnly cookies set by Railway via Vercel rewrite
 * - Check  → GET  /api/auth/cookie/session → validates cookies server-side
 * - Logout → POST /api/auth/cookie/logout  → clears cookies
 *
 * All /api/* calls go through Vercel rewrites (same-origin), so cookies are sent automatically.
 */

import { createContext, useContext, useEffect, useRef, useState } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)
  const refreshTokenRef       = useRef(null)  // stored in memory only (never localStorage)

  // ── Check existing session on mount ──────────────────────────────────────────
  useEffect(() => {
    checkSession()
  }, [])

  async function checkSession() {
    try {
      const res = await fetch('/api/auth/cookie/session', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        if (data.authenticated) {
          setUser(data.user)
          return
        }
      }
    } catch {
      // Network error — treat as unauthenticated
    } finally {
      setLoading(false)
    }
    setUser(null)
  }

  // ── Login ─────────────────────────────────────────────────────────────────────
  async function signIn(email, password) {
    const res = await fetch('/api/auth/cookie/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    })

    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Identifiants invalides')

    refreshTokenRef.current = data.refreshToken  // keep in memory
    setUser(data.user)
    return data
  }

  // ── Refresh access token ──────────────────────────────────────────────────────
  async function refreshAccessToken() {
    if (!refreshTokenRef.current) return false

    try {
      const res = await fetch('/api/auth/cookie/refresh', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: refreshTokenRef.current })
      })

      if (!res.ok) {
        refreshTokenRef.current = null
        setUser(null)
        return false
      }

      const data = await res.json()
      refreshTokenRef.current = data.refreshToken  // rotated token
      return true
    } catch {
      return false
    }
  }

  // ── Logout ────────────────────────────────────────────────────────────────────
  async function signOut() {
    try {
      await fetch('/api/auth/cookie/logout', { method: 'POST', credentials: 'include' })
    } catch { /* ignore */ }
    refreshTokenRef.current = null
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut, refreshAccessToken }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
