import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { getReports } from '../services/api.js'
import { getExamType } from '../data/examTypes.js'
import { countPending } from '../services/pendingQueue.js'

export default function HistoryPage() {
  const navigate = useNavigate()
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    getReports()
      .then(data => setReports(data?.reports || []))
      .catch(() => setReports([]))
      .finally(() => setLoading(false))
    countPending().then(setPendingCount).catch(() => setPendingCount(0))
  }, [])

  const filtered = reports.filter(r => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      r.patient_name?.toLowerCase().includes(q) ||
      getExamType(r.exam_type).name.toLowerCase().includes(q)
    )
  })

  function formatDate(iso) {
    if (!iso) return ''
    return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  return (
    <div className="page">
      <header className="app-header no-print">
        <div className="app-header-left">
          <div className="app-logo">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 8v4l3 3"/>
              <circle cx="12" cy="12" r="10"/>
            </svg>
          </div>
          <span className="app-name">Historique</span>
        </div>
      </header>

      <div className="page-content">
        <div className="form-group" style={{ marginBottom: 16 }}>
          <div style={{ position: 'relative' }}>
            <svg style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: 'var(--text-muted)', pointerEvents: 'none' }}
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              className="form-input"
              style={{ paddingLeft: 42 }}
              placeholder="Rechercher un patient ou un examen…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
            <div className="spinner" />
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <p>{search ? 'Aucun résultat pour cette recherche.' : 'Aucun rapport enregistré.'}</p>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div className="reports-card">
            {filtered.map(r => {
              const examType = getExamType(r.exam_type)
              return (
                <Link key={r.id} to={`/report/${r.id}`} className="report-item animate-fade-in">
                  <div className="report-item-icon" style={{ background: `${examType.color}20` }}>
                    {examType.icon}
                  </div>
                  <div className="report-item-body">
                    <div className="report-item-title">{r.patient_name || 'Patient inconnu'}</div>
                    <div className="report-item-meta">{examType.name} · {formatDate(r.created_at)}</div>
                  </div>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                    style={{ width: 15, height: 15, color: 'var(--text-muted)', flexShrink: 0 }}>
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
        <button className="nav-item" onClick={() => navigate('/')}>
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

        <button className="nav-item active">
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
