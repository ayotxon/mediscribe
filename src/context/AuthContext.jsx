/**
 * Auth + crypto context.
 *
 * - signIn derives an AES-GCM key from the password and seeds a canary in
 *   localStorage so the password can be verified later without a round-trip.
 * - On cookie-only restore (page reload), the user is authenticated but the
 *   key is missing → the app is "locked" and must be unlocked via UnlockPage
 *   before IDB-backed data can be read or written.
 * - The key lives in RAM only. It is handed to audioStorage through a setter
 *   so the crypto concern stays out of IDB plumbing.
 */

import { createContext, useContext, useEffect, useRef, useState } from 'react'
import {
  deriveKey, createCanary, verifyKey, clearCanary
} from '../services/crypto.js'
import { setEncryptionKey } from '../services/audioStorage.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [locked, setLocked]   = useState(false)   // cookie valid but no key
  const refreshTokenRef       = useRef(null)       // memory only, never persisted

  useEffect(() => { checkSession() }, [])

  async function checkSession() {
    try {
      let data = await fetchSession()
      // Access cookie may have expired since the last visit — try a refresh
      // (which falls back to the httpOnly refresh cookie when the in-memory
      // ref is gone) and re-check before giving up. Without this, every
      // reload after the access cookie's TTL bounces the user to /login.
      if (!data?.authenticated && await tryRefresh()) {
        data = await fetchSession()
      }
      if (data?.authenticated) {
        setUser(data.user)
        // Cookie said yes, but we lost the in-memory key on reload.
        // Flip to "locked" if there is any canary (i.e. PHI likely exists
        // on this device). If no canary, this is a first visit — user will
        // re-enter password via the normal login flow when they try to act.
        const hasCanary = !!localStorage.getItem('mediscribe_canary_v1')
        setLocked(hasCanary)
        return
      }
    } catch { /* network error → unauthenticated */ }
    finally { setLoading(false) }
    setUser(null)
  }

  async function fetchSession() {
    const res = await fetch('/api/auth/cookie/session', { credentials: 'include' })
    if (!res.ok) return null
    return res.json().catch(() => null)
  }

  // Cookie-aware refresh — works even after a reload (refreshTokenRef is null).
  // Backend is expected to accept the httpOnly refresh cookie when the body
  // field is absent. Returns true on success, no state side effects.
  async function tryRefresh() {
    try {
      const body = refreshTokenRef.current
        ? JSON.stringify({ refreshToken: refreshTokenRef.current })
        : '{}'
      const res = await fetch('/api/auth/cookie/refresh', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body
      })
      if (!res.ok) return false
      const data = await res.json().catch(() => ({}))
      if (data?.refreshToken) refreshTokenRef.current = data.refreshToken
      return true
    } catch {
      return false
    }
  }

  // ── Sign in (establishes both auth session AND crypto key) ──────────────────
  async function signIn(email, password) {
    const res = await fetch('/api/auth/cookie/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Identifiants invalides')

    refreshTokenRef.current = data.refreshToken

    // Derive AES key from the same password the user just proved they know.
    const key = await deriveKey(password, email)
    const state = await verifyKey(key)
    if (state === 'missing') {
      // First login on this device (or canary was cleared) → seed one
      await createCanary(key)
    } else if (state === 'wrong-password') {
      // Canary was created with a different password (password was rotated
      // server-side). Old encrypted data on this device is now unreadable —
      // wipe the canary so the new password becomes authoritative.
      clearCanary()
      await createCanary(key)
    }
    setEncryptionKey(key)
    setUser(data.user)
    setLocked(false)
    return data
  }

  // ── Unlock (cookie-authenticated, needs password to re-derive key) ──────────
  async function unlock(password) {
    if (!user?.email) throw new Error('Session expirée — reconnectez-vous')
    const key = await deriveKey(password, user.email)
    const state = await verifyKey(key)
    if (state === 'wrong-password') throw new Error('Mot de passe incorrect')
    if (state === 'missing') await createCanary(key)   // no prior canary → seed now
    setEncryptionKey(key)
    setLocked(false)
  }

  // Used by api.js when an authenticated request hits 401 TOKEN_EXPIRED.
  // Clears auth state on hard failure so ProtectedRoute bounces to /login.
  async function refreshAccessToken() {
    const ok = await tryRefresh()
    if (!ok) {
      refreshTokenRef.current = null
      setUser(null)
    }
    return ok
  }

  async function signOut() {
    try {
      await fetch('/api/auth/cookie/logout', { method: 'POST', credentials: 'include' })
    } catch { /* ignore */ }
    refreshTokenRef.current = null
    setEncryptionKey(null)
    setUser(null)
    setLocked(false)
  }

  return (
    <AuthContext.Provider value={{
      user, loading, locked,
      signIn, signOut, unlock, refreshAccessToken
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
