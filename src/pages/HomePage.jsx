import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { getReports } from '../services/api.js'
import { getExamType } from '../data/examTypes.js'

export default function HomePage() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getReports()
      .then(data => setReports(data?.reports || []))
      .catch(() => setReports([]))
      .finally(() => setLoading(false))
  }, [])

  function formatDate(iso) {
    if (!iso) return ''
    return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  return (
    <div className="page">
      <header className="page-header">
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: '1.1rem', fontWeight: 700 }}>MediScribe</h1>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
            Dr {user?.email?.split('@')[0]}
          </p>
        </div>
        <button
          onClick={signOut}
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem' }}
        >
          Déco.
        </button>
      </header>

      <div className="page-content">

        {/* CTA principal */}
        <button
          className="btn btn-primary"
          onClick={() => navigate('/read')}
          style={{ marginBottom: 24, fontSize: '1rem', padding: '16px' }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 20, height: 20 }}>
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          </svg>
          Nouveau rapport
        </button>

        {/* Rapports récents */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h2 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Rapports récents
          </h2>
          {reports.length > 0 && (
            <Link to="/history" style={{ fontSize: '0.8rem', color: 'var(--accent)', textDecoration: 'none' }}>
              Voir tout
            </Link>
          )}
        </div>

        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
            <div className="spinner" />
          </div>
        )}

        {!loading && reports.length === 0 && (
          <div className="empty-state animate-fade-in">
            <div className="empty-state-icon">📋</div>
            <p>Aucun rapport pour l'instant.<br />Dictez votre premier résultat.</p>
          </div>
        )}

        {!loading && reports.slice(0, 10).map(r => {
          const examType = getExamType(r.exam_type)
          return (
            <Link key={r.id} to={`/report/${r.id}`} className="report-item animate-fade-in">
              <div
                className="report-item-icon"
                style={{ background: `${examType.color}20` }}
              >
                {examType.icon}
              </div>
              <div className="report-item-body">
                <div className="report-item-title">
                  {r.patient_name || 'Patient inconnu'}
                </div>
                <div className="report-item-meta">
                  {examType.name} · {formatDate(r.created_at)}
                </div>
              </div>
              <svg className="report-item-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16 }}>
                <polyline points="9,18 15,12 9,6" />
              </svg>
            </Link>
          )
        })}
      </div>

      <nav className="bottom-nav">
        <button className="nav-item active">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg>
          Accueil
        </button>
        <button className="nav-item" onClick={() => navigate('/read')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/></svg>
          Dicter
        </button>
        <button className="nav-item" onClick={() => navigate('/history')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 8v4l3 3"/><circle cx="12" cy="12" r="10"/></svg>
          Historique
        </button>
      </nav>
    </div>
  )
}
