import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

/**
 * Shown when the user's cookie session is still valid but the in-memory
 * AES key was lost (page reload). We already know who they are — we just
 * need the password to re-derive the key and decrypt their stored PHI.
 */
export default function UnlockPage() {
  const { user, locked, unlock, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await unlock(password)
      navigate(location.state?.from || '/', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // If the user isn't even logged in, or has already been unlocked, bounce
  if (!user) { navigate('/login', { replace: true }); return null }
  if (!locked) { navigate('/', { replace: true }); return null }

  const displayName = user.profile?.first_name
    ? `Dr ${user.profile.first_name}${user.profile.last_name ? ' ' + user.profile.last_name : ''}`
    : user.email

  return (
    <div className="page" style={{ justifyContent: 'center', padding: 24 }}>
      <div className="animate-fade-in" style={{ width: '100%', maxWidth: 360, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontSize: '3rem', marginBottom: 12 }}>🔒</div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: 6 }}>Session verrouillée</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.5 }}>
            Les enregistrements stockés sur cet appareil sont chiffrés.<br/>
            Entrez votre mot de passe pour les déverrouiller.
          </p>
        </div>

        <div style={{
          background: 'rgba(59,130,246,0.08)',
          border: '1px solid rgba(59,130,246,0.2)',
          borderRadius: 'var(--radius-sm)',
          padding: '10px 14px',
          fontSize: '0.82rem',
          color: 'var(--text-secondary)',
          marginBottom: 16
        }}>
          Connecté en tant que <strong>{displayName}</strong>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Mot de passe</label>
            <input
              className="form-input"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              autoFocus
              required
            />
          </div>

          {error && (
            <div style={{
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 'var(--radius-sm)',
              padding: '10px 14px',
              fontSize: '0.85rem',
              color: '#f87171',
              marginBottom: 16
            }}>
              {error}
            </div>
          )}

          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? 'Déverrouillage…' : 'Déverrouiller'}
          </button>
        </form>

        <button
          className="btn btn-ghost"
          style={{ marginTop: 16, width: '100%', fontSize: '0.82rem', color: 'var(--text-muted)' }}
          onClick={signOut}
        >
          Me déconnecter
        </button>
      </div>
    </div>
  )
}
