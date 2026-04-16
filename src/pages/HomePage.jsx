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

  const doctorName = (() => {
    const p = user?.profile
    if (!p) return user?.email?.split('@')[0] || ''
    const parts = [p.first_name, p.last_name].filter(Boolean)
    return parts.length ? parts.join(' ') : (p.email?.split('@')[0] || '')
  })()

  const todayCount = reports.filter(r => {
    const d = new Date(r.created_at)
    const now = new Date()
    return d.toDateString() === now.toDateString()
  }).length

  return (
    <div className="page">

      {/* ── Header ── */}
      <header className="app-header no-print">
        <div className="app-header-left">
          <div className="app-logo">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="23"/>
              <line x1="8" y1="23" x2="16" y2="23"/>
            </svg>
          </div>
          <span className="app-name">MediScribe</span>
        </div>
        <div className="app-header-right">
          <div className="header-user">
            <div className="header-avatar">
              {doctorName ? doctorName[0].toUpperCase() : 'D'}
            </div>
            <span className="header-doctor">Dr {doctorName}</span>
          </div>
          <button className="header-signout" onClick={signOut} title="Déconnexion">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16 }}>
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16,17 21,12 16,7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        </div>
      </header>

      <div className="page-content">

        {/* ── Hero greeting ── */}
        <div className="dashboard-greeting animate-fade-in">
          <h1 className="greeting-title">
            Bonjour, Dr {doctorName || '…'} 👋
          </h1>
          <p className="greeting-sub">Prêt pour dicter vos résultats d'examens ?</p>
        </div>

        {/* ── Stats ── */}
        <div className="stats-row animate-fade-in">
          <div className="stat-card">
            <div className="stat-value">{todayCount}</div>
            <div className="stat-label">Aujourd'hui</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{reports.length}</div>
            <div className="stat-label">Total rapports</div>
          </div>
        </div>

        {/* ── Hero CTA ── */}
        <button className="hero-cta animate-fade-in" onClick={() => navigate('/read')}>
          <div className="hero-cta-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
            </svg>
          </div>
          <div className="hero-cta-text">
            <span className="hero-cta-title">Nouveau rapport</span>
            <span className="hero-cta-sub">Dicter un résultat d'examen</span>
          </div>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 20, height: 20, opacity: 0.7 }}>
            <polyline points="9,18 15,12 9,6"/>
          </svg>
        </button>

        {/* ── Rapports récents ── */}
        <div className="section-header animate-fade-in">
          <h2 className="section-title">Rapports récents</h2>
          {reports.length > 5 && (
            <Link to="/history" className="section-link">Voir tout</Link>
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

        <div className="reports-card animate-fade-in">
          {!loading && reports.slice(0, 8).map(r => {
            const examType = getExamType(r.exam_type)
            return (
              <Link key={r.id} to={`/report/${r.id}`} className="report-item">
                <div className="report-item-icon" style={{ background: `${examType.color}22` }}>
                  {examType.icon}
                </div>
                <div className="report-item-body">
                  <div className="report-item-title">{r.patient_name || 'Patient inconnu'}</div>
                  <div className="report-item-meta">{examType.name} · {formatDate(r.created_at)}</div>
                </div>
                <svg className="report-item-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 15, height: 15 }}>
                  <polyline points="9,18 15,12 9,6"/>
                </svg>
              </Link>
            )
          })}
        </div>

      </div>

      {/* ── Bottom nav ── */}
      <nav className="bottom-nav no-print">
        <button className="nav-item active">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9,22 9,12 15,12 15,22"/>
          </svg>
          Accueil
        </button>
        <button className="nav-item" onClick={() => navigate('/read')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
          </svg>
          Dicter
        </button>
        <button className="nav-item" onClick={() => navigate('/history')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 8v4l3 3"/>
            <circle cx="12" cy="12" r="10"/>
          </svg>
          Historique
        </button>
      </nav>

    </div>
  )
}
