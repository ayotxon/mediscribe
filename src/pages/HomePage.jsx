import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { getReports } from '../services/api.js'
import { getExamType } from '../data/examTypes.js'
import { getPending, countPending, retryPending, removePendingItem, clearPending } from '../services/pendingQueue.js'

export default function HomePage() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)
  const [pendingItems, setPendingItems] = useState([])
  const [showPendingDetail, setShowPendingDetail] = useState(false)
  const [retrying, setRetrying] = useState(false)

  async function refreshPending() {
    const items = await getPending()
    setPendingItems(items)
    setPendingCount(items.length)
  }

  useEffect(() => {
    getReports()
      .then(data => setReports(data?.reports || []))
      .catch(() => setReports([]))
      .finally(() => setLoading(false))
    refreshPending()

    // Refresh the pending list when the tab regains focus — the queue may
    // have processed items in the background while the user was away.
    function onFocus() { refreshPending() }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  async function handleRetry() {
    setRetrying(true)
    await retryPending()
    await refreshPending()
    getReports().then(data => setReports(data?.reports || [])).catch(() => {})
    setRetrying(false)
  }

  async function handleDeleteItem(id) {
    await removePendingItem(id)
    await refreshPending()
  }

  async function handleClearAll() {
    await clearPending()
    await refreshPending()
    setShowPendingDetail(false)
  }

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
    return d.toDateString() === new Date().toDateString()
  }).length

  return (
    <div className="page">

      {/* ── Sticky header ── */}
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

        {/* ── Greeting ── */}
        <div className="dashboard-greeting animate-fade-in">
          <h1 className="greeting-title">Bonjour, Dr {doctorName || '…'}</h1>
          <p className="greeting-sub">
            {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
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

        {/* ── Pending queue ── */}
        {pendingCount > 0 && (
          <div className="animate-fade-in" style={{ marginBottom: 16 }}>
            <div className="pending-banner" style={{ borderRadius: showPendingDetail ? '12px 12px 0 0' : undefined }}>
              <div className="pending-banner-icon">📥</div>
              <div className="pending-banner-text">
                <span className="pending-banner-title">
                  {pendingCount} enregistrement{pendingCount > 1 ? 's' : ''} hors-ligne
                </span>
                <span className="pending-banner-sub">En attente de connexion pour traitement</span>
              </div>
              <button
                className="pending-banner-btn"
                onClick={() => setShowPendingDetail(v => !v)}
                style={{ marginRight: 6 }}
              >
                {showPendingDetail ? 'Masquer' : 'Gérer'}
              </button>
              <button className="pending-banner-btn" onClick={handleRetry} disabled={retrying}>
                {retrying
                  ? <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                  : 'Réessayer'}
              </button>
            </div>

            {showPendingDetail && (
              <div style={{
                background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.25)',
                borderTop: 'none', borderRadius: '0 0 12px 12px', overflow: 'hidden'
              }}>
                {pendingItems.map(item => {
                  const examType = getExamType(item.meta?.examTypeId)
                  const savedDate = new Date(item.savedAt).toLocaleDateString('fr-FR', {
                    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                  })
                  return (
                    <div key={item.id} style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '11px 14px', borderBottom: '1px solid rgba(245,158,11,0.15)'
                    }}>
                      <span style={{ fontSize: '1.3rem', flexShrink: 0 }}>{examType.icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>
                          {item.meta?.patientName || 'Patient inconnu'}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 1 }}>
                          {examType.name} · {savedDate}
                          {item.attempts > 0 && ` · ${item.attempts} tentative${item.attempts > 1 ? 's' : ''}`}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteItem(item.id)}
                        title="Supprimer"
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: 'var(--error)', padding: 6, borderRadius: 6,
                          display: 'flex', alignItems: 'center', flexShrink: 0
                        }}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16 }}>
                          <polyline points="3,6 5,6 21,6"/>
                          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                          <path d="M10 11v6M14 11v6"/>
                          <path d="M9 6V4h6v2"/>
                        </svg>
                      </button>
                    </div>
                  )
                })}
                <button
                  onClick={handleClearAll}
                  style={{
                    width: '100%', padding: '10px 14px', background: 'none', border: 'none',
                    color: 'var(--error)', fontSize: '0.82rem', fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'var(--font-sans)', textAlign: 'center'
                  }}
                >
                  Tout supprimer
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Recent reports ── */}
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
            <div className="empty-state-icon">🎙️</div>
            <p>Aucun rapport pour l'instant.</p>
            <button className="btn btn-primary" onClick={() => navigate('/read')}>
              Dicter un examen
            </button>
          </div>
        )}

        {!loading && reports.length > 0 && (
          <div className="reports-card animate-fade-in">
            {reports.slice(0, 8).map(r => {
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
        )}

      </div>

      {/* ── Bottom nav with FAB ── */}
      <nav className="bottom-nav no-print">
        <button className="nav-item active">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9,22 9,12 15,12 15,22"/>
          </svg>
          Accueil
        </button>

        <div className="nav-fab-wrap">
          <button className="nav-fab" onClick={() => navigate('/read')} aria-label="Nouveau rapport">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
            </svg>
            {pendingCount > 0 && (
              <span className="nav-fab-badge">{pendingCount > 9 ? '9+' : pendingCount}</span>
            )}
          </button>
          <span className="nav-fab-label">Dicter</span>
        </div>

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
