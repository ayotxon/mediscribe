import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getReport, deleteReport } from '../services/api.js'
import { getExamType } from '../data/examTypes.js'

// Rendu générique d'un objet JSON structuré
function RenderValue({ value, depth = 0 }) {
  if (value === null || value === undefined) {
    return <span className="report-value null-val">—</span>
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="report-value null-val">—</span>
    return (
      <ul style={{ margin: 0, paddingLeft: 16, color: 'var(--text-primary)', fontSize: '0.9rem' }}>
        {value.map((item, i) => <li key={i}>{typeof item === 'object' ? JSON.stringify(item) : String(item)}</li>)}
      </ul>
    )
  }
  if (typeof value === 'object') {
    return <StructuredSection data={value} depth={depth + 1} />
  }
  return <span className="report-value">{String(value)}</span>
}

function StructuredSection({ data, depth = 0 }) {
  const entries = Object.entries(data).filter(([, v]) => v !== null && v !== undefined)
  if (entries.length === 0) return <span className="report-value null-val">—</span>

  return (
    <div style={depth > 0 ? { paddingLeft: 8, borderLeft: '2px solid var(--border)', marginTop: 4 } : {}}>
      {entries.map(([key, value]) => {
        const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
        if (typeof value === 'object' && !Array.isArray(value)) {
          return (
            <div key={key} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
              <StructuredSection data={value} depth={depth + 1} />
            </div>
          )
        }
        return (
          <div key={key} className="report-row">
            <span className="report-key">{label}</span>
            <RenderValue value={value} />
          </div>
        )
      })}
    </div>
  )
}

export default function ReportPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showTranscript, setShowTranscript] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    getReport(id)
      .then(data => setReport(data))
      .catch(() => setReport(null))
      .finally(() => setLoading(false))
  }, [id])

  async function handleDelete() {
    if (!confirm('Supprimer ce rapport ?')) return
    setDeleting(true)
    try {
      await deleteReport(id)
      navigate('/')
    } catch {
      setDeleting(false)
    }
  }

  function formatDate(iso) {
    if (!iso) return ''
    return new Date(iso).toLocaleString('fr-FR', {
      day: '2-digit', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    })
  }

  if (loading) return (
    <div className="page" style={{ justifyContent: 'center', alignItems: 'center' }}>
      <div className="spinner" />
    </div>
  )

  if (!report) return (
    <div className="page" style={{ justifyContent: 'center', padding: 24 }}>
      <div className="empty-state">
        <div className="empty-state-icon">🔍</div>
        <p>Rapport introuvable</p>
        <button className="btn btn-secondary" onClick={() => navigate('/')}>Retour</button>
      </div>
    </div>
  )

  const examType = getExamType(report.exam_type)
  const structured = report.structured || {}

  // Séparer patient + indication du reste
  const { patient, indication, conclusion, ...rest } = structured

  return (
    <div className="page">
      <header className="page-header">
        <button className="btn-back" onClick={() => navigate('/')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 18, height: 18 }}>
            <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12,19 5,12 12,5" />
          </svg>
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 className="page-title" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {report.patient_name || 'Patient'}
          </h1>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{examType.name}</p>
        </div>
        <button
          onClick={handleDelete}
          disabled={deleting}
          style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: 4 }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 20, height: 20 }}>
            <polyline points="3,6 5,6 21,6"/><path d="M19,6l-1,14H6L5,6"/><path d="M10,11v6"/><path d="M14,11v6"/><path d="M9,6V4h6v2"/>
          </svg>
        </button>
      </header>

      <div className="page-content animate-fade-in">

        {/* Header du rapport */}
        <div className="card" style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 'var(--radius-sm)',
            background: `${examType.color}20`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.6rem', flexShrink: 0
          }}>
            {examType.icon}
          </div>
          <div>
            <div style={{ fontWeight: 700 }}>{examType.name}</div>
            {report.patient_name && <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{report.patient_name}</div>}
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>{formatDate(report.created_at)}</div>
          </div>
        </div>

        {/* Indication */}
        {(report.indication || indication) && (
          <div style={{
            background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
            borderRadius: 'var(--radius)', padding: 12, marginBottom: 20,
            fontSize: '0.85rem', color: 'var(--text-secondary)'
          }}>
            <strong style={{ color: 'var(--warning)' }}>Indication : </strong>
            {report.indication || indication}
          </div>
        )}

        {/* Patient extrait */}
        {patient && Object.values(patient).some(v => v) && (
          <div className="report-section">
            <div className="report-section-title">Patient</div>
            <StructuredSection data={patient} />
          </div>
        )}

        {/* Corps du rapport (tout sauf patient, indication, conclusion) */}
        {Object.entries(rest).map(([section, data]) => {
          if (!data || (typeof data === 'object' && !Array.isArray(data) && Object.keys(data).length === 0)) return null
          const title = section.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
          return (
            <div key={section} className="report-section">
              <div className="report-section-title">{title}</div>
              {typeof data === 'object' && !Array.isArray(data)
                ? <StructuredSection data={data} />
                : <RenderValue value={data} />
              }
            </div>
          )
        })}

        {/* Conclusion */}
        {conclusion && (
          <div className="report-section">
            <div className="report-section-title">Conclusion</div>
            <div className="report-conclusion">{conclusion}</div>
          </div>
        )}

        {/* Transcription brute (repliable) */}
        {report.transcript && (
          <div style={{ marginTop: 8 }}>
            <button
              onClick={() => setShowTranscript(s => !s)}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}>
                <polyline points={showTranscript ? '18,15 12,9 6,15' : '6,9 12,15 18,9'} />
              </svg>
              {showTranscript ? 'Masquer' : 'Voir'} la transcription brute
            </button>
            {showTranscript && (
              <div style={{
                marginTop: 8, padding: 12, background: 'var(--bg-input)',
                borderRadius: 'var(--radius-sm)', fontSize: '0.82rem',
                color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap'
              }}>
                {report.transcript}
              </div>
            )}
          </div>
        )}

        <div style={{ height: 40 }} />
      </div>
    </div>
  )
}
