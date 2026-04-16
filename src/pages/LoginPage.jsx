import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

export default function LoginPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await signIn(email, password)
      navigate(location.state?.from || '/', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page" style={{ justifyContent: 'center', padding: '24px' }}>
      <div className="animate-fade-in" style={{ width: '100%', maxWidth: 360, margin: '0 auto' }}>

        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontSize: '3rem', marginBottom: 12 }}>🩺</div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: 6 }}>MediScribe</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Dictée intelligente de résultats médicaux
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              className="form-input"
              type="email"
              placeholder="docteur@exemple.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Mot de passe</label>
            <input
              className="form-input"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          {error && (
            <div style={{
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 'var(--radius-sm)', padding: '10px 14px',
              fontSize: '0.85rem', color: '#f87171', marginBottom: 16
            }}>
              {error}
            </div>
          )}

          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 24, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Même compte que ConsultScribe
        </p>
      </div>
    </div>
  )
}
