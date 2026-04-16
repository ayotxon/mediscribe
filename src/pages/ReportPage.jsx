import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getReport, updateReport, deleteReport } from '../services/api.js'
import { getExamType } from '../data/examTypes.js'
import { useAuth } from '../context/AuthContext.jsx'

// ── Helpers ───────────────────────────────────────────────────────────────────
function humanLabel(key) {
  return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}
function isBlank(v) {
  if (v === null || v === undefined) return true
  if (typeof v === 'string' && v.trim() === '') return true
  if (Array.isArray(v) && v.length === 0) return true
  if (typeof v === 'object' && !Array.isArray(v) && Object.values(v).every(isBlank)) return true
  return false
}
function formatDate(iso) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
}

// ── Editable field ────────────────────────────────────────────────────────────
function EField({ value, onChange, editMode, multi = false, placeholder = '—' }) {
  const display = isBlank(value) ? placeholder : String(value)
  if (!editMode) return <span className={isBlank(value) ? 'val-empty' : ''}>{display}</span>
  if (multi) {
    return <textarea className="doc-input doc-textarea" value={value ?? ''} rows={2}
      onChange={e => onChange(e.target.value)} placeholder={placeholder} />
  }
  return <input className="doc-input" value={value ?? ''} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
}

// ── Measurement table ─────────────────────────────────────────────────────────
function MesuresTable({ data, editMode, onChange }) {
  if (isBlank(data)) return null
  const entries = Object.entries(data).filter(([, v]) => !isBlank(v) || editMode)
  if (!entries.length) return null
  const mid = Math.ceil(entries.length / 2)
  const left = entries.slice(0, mid), right = entries.slice(mid)
  function set(k, v) { onChange({ ...data, [k]: v }) }
  return (
    <table className="doc-mesures-table">
      <thead>
        <tr>
          <th className="col-param">Paramètre</th>
          <th className="col-val">Valeur</th>
          <th className="col-param">Paramètre</th>
          <th className="col-val">Valeur</th>
        </tr>
      </thead>
      <tbody>
        {left.map(([k, v], i) => {
          const [rk, rv] = right[i] || []
          return (
            <tr key={k}>
              <td className="col-param">{humanLabel(k)}</td>
              <td className="col-val"><EField value={v} onChange={val => set(k, val)} editMode={editMode} /></td>
              {rk
                ? <><td className="col-param">{humanLabel(rk)}</td><td className="col-val"><EField value={rv} onChange={val => set(rk, val)} editMode={editMode} /></td></>
                : <td colSpan={2} />}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

// ── Array section (bullet list) ───────────────────────────────────────────────
function ArraySection({ items, editMode, onChange }) {
  const arr = items || []
  if (!editMode && arr.length === 0) return <p className="val-empty">—</p>
  return (
    <div>
      {arr.map((item, i) => (
        <div key={i} className="doc-bullet-row">
          <span className="doc-bullet">•</span>
          {editMode
            ? <div style={{ flex: 1, display: 'flex', gap: 6 }}>
                <textarea className="doc-input doc-textarea" value={item} rows={1}
                  onChange={e => { const a = [...arr]; a[i] = e.target.value; onChange(a) }}
                  style={{ flex: 1 }} />
                <button className="doc-remove-btn" onClick={() => onChange(arr.filter((_, j) => j !== i))}>✕</button>
              </div>
            : <span>{item}</span>}
        </div>
      ))}
      {editMode && <button className="doc-add-btn" onClick={() => onChange([...arr, ''])}>+ Ajouter</button>}
    </div>
  )
}

// ── Nested object ─────────────────────────────────────────────────────────────
function ObjSection({ data, editMode, onChange, depth = 0 }) {
  if (isBlank(data)) return <span className="val-empty">—</span>
  const entries = Object.entries(data).filter(([, v]) => !isBlank(v) || editMode)
  function set(k, v) { onChange({ ...data, [k]: v }) }
  return (
    <div className={depth > 0 ? 'doc-nested' : ''}>
      {entries.map(([k, v]) => (
        <div key={k} className="doc-obj-row">
          <span className="doc-obj-label">{humanLabel(k)}</span>
          <div className="doc-obj-val">
            {Array.isArray(v)
              ? <ArraySection items={v} editMode={editMode} onChange={val => set(k, val)} />
              : typeof v === 'object' && v !== null
              ? <ObjSection data={v} editMode={editMode} onChange={val => set(k, val)} depth={depth + 1} />
              : <EField value={v} onChange={val => set(k, val)} editMode={editMode} multi={String(v ?? '').length > 60} />}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── The medical document itself ───────────────────────────────────────────────
const SECTION_ORDER = [
  'patient','indication','echogenicite','qualite_technique',
  'mesures','biometrie','hematologie','biochimie',
  'doppler','analyse','organes','resultats','serologies',
  'activite_de_fond','conditions_enregistrement','technique','grossesse',
  'anomalies','commentaires','observations_generales','organisation','reactivite',
  'autres','interpretation','conclusion'
]

function MedicalDocument({ report, data, editMode, onChange, doctorName }) {
  const examType = getExamType(report.exam_type)
  function set(k, v) { onChange({ ...(data || {}), [k]: v }) }

  const entries = Object.entries(data || {})
  const ordered = [
    ...SECTION_ORDER.map(k => entries.find(([key]) => key === k)).filter(Boolean),
    ...entries.filter(([k]) => !SECTION_ORDER.includes(k))
  ]

  // Section counter for numbered display
  let sectionNum = 0

  return (
    <div className="doc-paper" id="print-area">

      {/* ── Document header ── */}
      <div className="doc-header">
        <div className="doc-header-left">
          <div className="doc-doctor-name">{doctorName || 'Dr ___________________'}</div>
          <div className="doc-doctor-subtitle">{examType.name}</div>
        </div>
        <div className="doc-header-right">
          <div className="doc-date-label">Date</div>
          <div className="doc-date-value">{formatDate(report.created_at)}</div>
        </div>
      </div>

      {/* ── Exam title ── */}
      <div className="doc-exam-title">
        <span className="doc-exam-icon">{examType.icon}</span>
        {examType.name.toUpperCase()}
      </div>

      {/* ── Patient block ── */}
      <div className="doc-patient-block">
        <div className="doc-patient-header">Informations Patient</div>
        <div className="doc-patient-grid">
          <div className="doc-patient-field">
            <span className="doc-field-label">Nom & Prénoms</span>
            <span className="doc-field-value">{report.patient_name || '—'}</span>
          </div>
          {data.patient && Object.entries(data.patient)
            .filter(([, v]) => !isBlank(v) || editMode)
            .map(([k, v]) => (
              <div key={k} className="doc-patient-field">
                <span className="doc-field-label">{humanLabel(k)}</span>
                <EField value={v} onChange={val => set('patient', { ...data.patient, [k]: val })} editMode={editMode} />
              </div>
            ))}
        </div>
        {/* Indication */}
        {(!isBlank(data.indication) || editMode) && (
          <div className="doc-indication">
            <span className="doc-field-label">Indication clinique :</span>
            <EField value={data.indication} onChange={v => set('indication', v)} editMode={editMode} multi />
          </div>
        )}
        {(!isBlank(data.echogenicite) || editMode) && (
          <div className="doc-indication" style={{ marginTop: 4 }}>
            <span className="doc-field-label">Qualité d'examen :</span>
            <EField value={data.echogenicite || data.qualite_technique} onChange={v => set('echogenicite', v)} editMode={editMode} />
          </div>
        )}
      </div>

      {/* ── Dynamic sections ── */}
      {ordered.map(([key, value]) => {
        if (['patient','indication','echogenicite','qualite_technique'].includes(key)) return null
        if (isBlank(value) && !editMode) return null

        const isConclusion = key === 'conclusion'
        const isMesures    = key === 'mesures' && typeof value === 'object' && !Array.isArray(value)
        const isArr        = Array.isArray(value)
        const isObj        = typeof value === 'object' && !Array.isArray(value) && value !== null
        sectionNum++

        return (
          <div key={key} className={`doc-section ${isConclusion ? 'doc-section-conclusion' : ''}`}>
            <div className="doc-section-header">
              <span className="doc-section-num">{sectionNum}</span>
              <span className="doc-section-title">{humanLabel(key)}</span>
            </div>
            <div className="doc-section-body">
              {isMesures
                ? <MesuresTable data={value} editMode={editMode} onChange={v => set(key, v)} />
                : isArr
                ? <ArraySection items={value} editMode={editMode} onChange={v => set(key, v)} />
                : isConclusion
                ? <div className="doc-conclusion-text">
                    {editMode
                      ? <textarea className="doc-input doc-textarea" rows={4} style={{ width: '100%' }}
                          value={Array.isArray(value) ? value.join('\n') : (value ?? '')}
                          onChange={e => set(key, e.target.value)} />
                      : <p>{Array.isArray(value) ? value.join('\n') : value}</p>}
                  </div>
                : isObj
                ? <ObjSection data={value} editMode={editMode} onChange={v => set(key, v)} />
                : <div className="doc-plain-value">
                    <EField value={value} onChange={v => set(key, v)} editMode={editMode}
                      multi={String(value ?? '').length > 80} />
                  </div>
              }
            </div>
          </div>
        )
      })}

      {/* ── Signature ── */}
      <div className="doc-footer">
        <div className="doc-footer-left">
          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Généré par MediScribe</div>
        </div>
        <div className="doc-signature">
          <div className="doc-signature-line" />
          <div className="doc-signature-name">{doctorName || 'Dr ___________________'}</div>
          <div className="doc-signature-label">Signature & Cachet</div>
        </div>
      </div>

    </div>
  )
}

// ── Page shell ────────────────────────────────────────────────────────────────
export default function ReportPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [report, setReport]     = useState(null)
  const [loading, setLoading]   = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [editData, setEditData] = useState({})
  const [saving, setSaving]     = useState(false)
  const [showTranscript, setShowTranscript] = useState(false)

  useEffect(() => {
    getReport(id)
      .then(d => { setReport(d); setEditData(d.structured || {}) })
      .catch(() => setReport(null))
      .finally(() => setLoading(false))
  }, [id])

  const doctorName = (() => {
    const p = user?.profile
    if (!p) return ''
    const parts = [p.first_name, p.last_name].filter(Boolean)
    return parts.length ? `Dr ${parts.join(' ')}` : (p.email ? `Dr ${p.email.split('@')[0]}` : '')
  })()

  async function handleSave() {
    setSaving(true)
    try {
      await updateReport(id, { structured: editData })
      setReport(r => ({ ...r, structured: editData }))
      setEditMode(false)
    } finally { setSaving(false) }
  }

  async function handleDelete() {
    if (!confirm('Supprimer ce rapport ?')) return
    try { await deleteReport(id); navigate('/') } catch { /* noop */ }
  }

  if (loading) return <div className="page" style={{ justifyContent: 'center', alignItems: 'center' }}><div className="spinner" /></div>
  if (!report) return (
    <div className="page" style={{ justifyContent: 'center', padding: 24 }}>
      <div className="empty-state">
        <div className="empty-state-icon">🔍</div><p>Rapport introuvable</p>
        <button className="btn btn-secondary" onClick={() => navigate('/')}>Retour</button>
      </div>
    </div>
  )

  return (
    <div className="page report-page-wrapper">

      {/* ── Toolbar (hidden on print) ── */}
      <div className="report-toolbar no-print">
        <button className="btn-back" onClick={() => navigate('/')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 18, height: 18 }}>
            <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12,19 5,12 12,5"/>
          </svg>
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600 }}>{report.patient_name || 'Rapport'}</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{getExamType(report.exam_type).name}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {!editMode ? (
            <>
              <button className="btn btn-secondary btn-sm" onClick={() => setEditMode(true)}>✏️ Modifier</button>
              <button className="btn btn-primary btn-sm" onClick={() => window.print()}>🖨️ Imprimer / PDF</button>
              <button onClick={handleDelete} className="btn-icon-danger" style={{ padding: '6px 8px' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 18, height: 18 }}>
                  <polyline points="3,6 5,6 21,6"/><path d="M19,6l-1,14H6L5,6"/><path d="M9,6V4h6v2"/>
                </svg>
              </button>
            </>
          ) : (
            <>
              <button className="btn btn-secondary btn-sm" onClick={() => { setEditData(report.structured || {}); setEditMode(false) }}>Annuler</button>
              <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
                {saving ? 'Enregistrement…' : '💾 Enregistrer'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Document ── */}
      <div className="report-content doc-page-bg">
        <MedicalDocument
          report={report}
          data={editData}
          editMode={editMode}
          onChange={setEditData}
          doctorName={doctorName}
        />

        {report.transcript && (
          <div className="doc-transcript-wrap no-print">
            <button onClick={() => setShowTranscript(s => !s)} className="doc-transcript-toggle">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 13, height: 13 }}>
                <polyline points={showTranscript ? '18,15 12,9 6,15' : '6,9 12,15 18,9'}/>
              </svg>
              {showTranscript ? 'Masquer' : 'Afficher'} la transcription brute
            </button>
            {showTranscript && <div className="doc-transcript-body">{report.transcript}</div>}
          </div>
        )}
        <div style={{ height: 48 }} />
      </div>
    </div>
  )
}
