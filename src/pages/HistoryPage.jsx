import { useState, useEffect, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { getReports } from '../services/api.js'
import { getExamType, EXAM_TYPE_LIST } from '../data/examTypes.js'
import { countPending } from '../services/pendingQueue.js'

export default function HistoryPage() {
  const navigate = useNavigate()
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [examFilter, setExamFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    getReports()
      .then(data => setReports(data?.reports || []))
      .catch(() => setReports([]))
      .finally(() => setLoading(false))
    countPending().then(setPendingCount).catch(() => setPendingCount(0))
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const from = dateFrom ? new Date(dateFrom + 'T00:00:00') : null
    const to   = dateTo   ? new Date(dateTo   + 'T23:59:59') : null

    return reports.filter(r => {
      if (q) {
        const name = r.patient_name?.toLowerCase() || ''
        const exam = getExamType(r.exam_type).name.toLowerCase()
        if (!name.includes(q) && !exam.includes(q)) return false
      }
      if (examFilter && r.exam_type !== examFilter) return false
      if (from || to) {
        const d = new Date(r.created_at)
        if (from && d < from) return false
        if (to   && d > to)   return false
      }
      return true
    })
  }, [reports, search, examFilter, dateFrom, dateTo])

  const activeFilterCount = (examFilter ? 1 : 0) + (dateFrom ? 1 : 0) + (dateTo ? 1 : 0)

  function clearFilters() {
    setExamFilter(''); setDateFrom(''); setDateTo('')
  }

  function formatDate(iso) {
    if (!iso) return ''
    return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  return (
    <div className="page">
      <header className="app-header no-print">
        <div className="app-header-left">
          <button className="btn-back" onClick={() => navigate('/')} aria-label="Retour">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 18, height: 18 }}>
              <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12,19 5,12 12,5"/>
            </svg>
          </button>
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
        <div className="form-group" style={{ marginBottom: 12 }}>
          <div style={{ position: 'relative' }}>
            <svg style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: 'var(--text-muted)', pointerEvents: 'none' }}
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              className="form-input"
              style={{ paddingLeft: 42, paddingRight: 120 }}
              placeholder="Rechercher un patient ou un examen…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShowFilters(s => !s)}
              style={{
                position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 12px', borderRadius: 'var(--radius-sm)',
                background: showFilters || activeFilterCount ? 'rgba(212,165,116,0.12)' : 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                color: showFilters || activeFilterCount ? 'var(--accent-gold)' : 'var(--text-secondary)',
                fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
                fontFamily: 'var(--font-sans)'
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}>
                <polygon points="22,3 2,3 10,12.46 10,19 14,21 14,12.46"/>
              </svg>
              Filtres
              {activeFilterCount > 0 && (
                <span style={{
                  background: 'var(--accent-gold)', color: 'var(--primary-900)',
                  borderRadius: 999, padding: '0 6px', fontSize: '0.68rem', fontWeight: 700
                }}>{activeFilterCount}</span>
              )}
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="animate-fade-in" style={{
            background: 'var(--bg-card)', border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)', padding: 14, marginBottom: 16
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
              <div>
                <label className="form-label" style={{ fontSize: '0.72rem', marginBottom: 4 }}>Type d'examen</label>
                <select
                  className="form-input"
                  value={examFilter}
                  onChange={e => setExamFilter(e.target.value)}
                  style={{ padding: '9px 12px', fontSize: '0.88rem' }}
                >
                  <option value="">Tous</option>
                  {EXAM_TYPE_LIST.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label" style={{ fontSize: '0.72rem', marginBottom: 4 }}>Du</label>
                <input
                  type="date"
                  className="form-input"
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                  style={{ padding: '9px 12px', fontSize: '0.88rem' }}
                />
              </div>
              <div>
                <label className="form-label" style={{ fontSize: '0.72rem', marginBottom: 4 }}>Au</label>
                <input
                  type="date"
                  className="form-input"
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                  style={{ padding: '9px 12px', fontSize: '0.88rem' }}
                />
              </div>
            </div>
            {activeFilterCount > 0 && (
              <button
                onClick={clearFilters}
                style={{
                  marginTop: 10, background: 'none', border: 'none',
                  color: 'var(--text-muted)', fontSize: '0.8rem', cursor: 'pointer',
                  fontFamily: 'var(--font-sans)', padding: '4px 0'
                }}
              >
                Réinitialiser les filtres
              </button>
            )}
          </div>
        )}

        {!loading && (
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginBottom: 10, fontSize: '0.78rem', color: 'var(--text-muted)'
          }}>
            <span>{filtered.length} résultat{filtered.length > 1 ? 's' : ''}</span>
            {(search || activeFilterCount > 0) && filtered.length !== reports.length && (
              <span>sur {reports.length}</span>
            )}
          </div>
        )}

        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
            <div className="spinner" />
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <p>{search || activeFilterCount > 0
              ? 'Aucun résultat pour cette recherche.'
              : 'Aucun rapport enregistré.'}</p>
            {(search || activeFilterCount > 0) && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => { setSearch(''); clearFilters() }}
              >
                Réinitialiser
              </button>
            )}
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
