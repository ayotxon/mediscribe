import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getReport, updateReport, deleteReport } from '../services/api.js'
import { getExamType } from '../data/examTypes.js'

// ── Helpers ───────────────────────────────────────────────────────────────────
function humanLabel(key) {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

function isBlank(v) {
  if (v === null || v === undefined) return true
  if (typeof v === 'string' && v.trim() === '') return true
  if (Array.isArray(v) && v.length === 0) return true
  if (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0) return true
  return false
}

// ── Editable primitives ───────────────────────────────────────────────────────
function EField({ value, onChange, editMode, multiline = false }) {
  if (!editMode) return <span>{isBlank(value) ? '—' : String(value)}</span>
  if (multiline) {
    return (
      <textarea
        value={value ?? ''}
        rows={2}
        onChange={e => onChange(e.target.value)}
        className="edit-input edit-textarea"
      />
    )
  }
  return (
    <input
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      className="edit-input"
    />
  )
}

// ── Renders a measurements object as a 2-column table ─────────────────────────
// Keys and values come entirely from the structured JSON (no hardcoded schema)
function MesuresTable({ data, editMode, onChange }) {
  if (isBlank(data)) return null
  const entries = Object.entries(data).filter(([, v]) => !isBlank(v) || editMode)
  if (entries.length === 0) return null

  function set(key, val) { onChange({ ...data, [key]: val }) }

  // Split into two columns
  const mid = Math.ceil(entries.length / 2)
  const left = entries.slice(0, mid)
  const right = entries.slice(mid)

  return (
    <table className="mesures-table">
      <thead>
        <tr>
          <th colSpan={2}>Paramètres mesurés</th>
          <th colSpan={2}>Paramètres mesurés</th>
        </tr>
      </thead>
      <tbody>
        {left.map(([key, val], i) => {
          const [rKey, rVal] = right[i] || [null, null]
          return (
            <tr key={key}>
              <td className="param-label-cell">{humanLabel(key)}</td>
              <td><EField value={val} onChange={v => set(key, v)} editMode={editMode} /></td>
              {rKey ? (
                <>
                  <td className="param-label-cell">{humanLabel(rKey)}</td>
                  <td><EField value={rVal} onChange={v => set(rKey, v)} editMode={editMode} /></td>
                </>
              ) : <td colSpan={2} />}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

// ── Renders an array section (commentaires, anomalies…) ───────────────────────
function ArraySection({ items, editMode, onChange }) {
  if (!editMode && (!items || items.length === 0)) return <p style={{ color: 'var(--text-muted)' }}>—</p>
  const arr = items || []

  function set(i, v) { const a = [...arr]; a[i] = v; onChange(a) }
  function remove(i) { onChange(arr.filter((_, j) => j !== i)) }
  function add() { onChange([...arr, '']) }

  return (
    <div>
      <ul className="commentaires-list">
        {arr.map((item, i) => (
          <li key={i}>
            {editMode ? (
              <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                <textarea className="edit-input edit-textarea" value={item} rows={1}
                  onChange={e => set(i, e.target.value)} style={{ flex: 1 }} />
                <button onClick={() => remove(i)} className="btn-icon-danger" style={{ flexShrink: 0 }}>✕</button>
              </div>
            ) : item}
          </li>
        ))}
      </ul>
      {editMode && <button className="btn-add-item" onClick={add}>+ Ajouter</button>}
    </div>
  )
}

// ── Renders a nested object as labeled rows ───────────────────────────────────
function ObjectSection({ data, editMode, onChange, depth = 0 }) {
  if (isBlank(data)) return <span style={{ color: 'var(--text-muted)' }}>—</span>
  const entries = Object.entries(data).filter(([, v]) => !isBlank(v) || editMode)

  function set(key, val) { onChange({ ...data, [key]: val }) }

  return (
    <div style={depth > 0 ? { paddingLeft: 12, borderLeft: '2px solid var(--border)', marginTop: 4 } : {}}>
      {entries.map(([key, value]) => {
        const isObj = value !== null && typeof value === 'object' && !Array.isArray(value)
        const isArr = Array.isArray(value)
        return (
          <div key={key} className="generic-field-row">
            <span className="generic-field-label">{humanLabel(key)}</span>
            <div style={{ flex: 1 }}>
              {isArr
                ? <ArraySection items={value} editMode={editMode} onChange={v => set(key, v)} />
                : isObj
                ? <ObjectSection data={value} editMode={editMode} onChange={v => set(key, v)} depth={depth + 1} />
                : <EField value={value} onChange={v => set(key, v)} editMode={editMode} multiline={String(value).length > 60} />
              }
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Main report renderer (fully data-driven) ──────────────────────────────────
function ReportBody({ report, data, editMode, onChange }) {
  const examType = getExamType(report.exam_type)

  function set(key, val) { onChange({ ...data, [key]: val }) }

  // Known section order — unrecognised keys fall into "other"
  const SECTION_ORDER = ['patient', 'indication', 'echogenicite', 'mesures', 'doppler',
    'commentaires', 'anomalies', 'resultats', 'organes', 'biometrie', 'morphologie',
    'annexes', 'vitalite', 'analyse', 'hematologie', 'biochimie', 'serologies',
    'interpretation', 'activite_de_fond', 'conditions_enregistrement', 'organisation',
    'reactivite', 'technique', 'grossesse', 'autres', 'conclusion']

  const entries = Object.entries(data)
  const ordered = [
    ...SECTION_ORDER.map(k => entries.find(([key]) => key === k)).filter(Boolean),
    ...entries.filter(([k]) => !SECTION_ORDER.includes(k))
  ]

  return (
    <div className="medical-report">
      {/* Title */}
      <div className="report-title-block">
        <h2 className="report-main-title">{examType.name.toUpperCase()}</h2>
      </div>

      {/* Patient name + date always shown */}
      <div className="report-patient-grid">
        {report.patient_name && (
          <div className="rpg-row">
            <span className="rpg-label">Patient :</span>
            <span>{report.patient_name}</span>
          </div>
        )}
        <div className="rpg-row">
          <span className="rpg-label">Date :</span>
          <span>{new Date(report.created_at).toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric' })}</span>
        </div>
      </div>

      {/* Dynamic sections */}
      {ordered.map(([key, value]) => {
        const skip = (isBlank(value) && !editMode)
        if (skip) return null

        // ── Special: patient object → inline labeled rows ──
        if (key === 'patient' && typeof value === 'object' && !Array.isArray(value)) {
          const patEntries = Object.entries(value).filter(([, v]) => !isBlank(v) || editMode)
          if (patEntries.length === 0 && !editMode) return null
          return (
            <div key={key} className="report-patient-grid" style={{ marginTop: 0 }}>
              {patEntries.map(([pk, pv]) => (
                <div key={pk} className="rpg-row">
                  <span className="rpg-label">{humanLabel(pk)} :</span>
                  <EField value={pv} onChange={v => set('patient', { ...value, [pk]: v })} editMode={editMode} />
                </div>
              ))}
            </div>
          )
        }

        // ── Special: indication → highlighted banner ──
        if (key === 'indication') {
          return (
            <div key={key} className="indication-banner">
              <span className="rpg-label">Indication : </span>
              <EField value={value} onChange={v => set(key, v)} editMode={editMode} multiline />
            </div>
          )
        }

        // ── Special: mesures object → 2-column table ──
        if (key === 'mesures' && typeof value === 'object' && !Array.isArray(value)) {
          return (
            <div key={key} className="report-section-numbered">
              <div className="section-num-title">Mesures</div>
              <MesuresTable data={value} editMode={editMode} onChange={v => set(key, v)} />
            </div>
          )
        }

        // ── Special: commentaires / anomalies → bullet list ──
        if ((key === 'commentaires' || key === 'anomalies') && Array.isArray(value)) {
          return (
            <div key={key} className="report-section-numbered">
              <div className="section-num-title">{humanLabel(key)}</div>
              <ArraySection items={value} editMode={editMode} onChange={v => set(key, v)} />
            </div>
          )
        }

        // ── Special: conclusion → italic block ──
        if (key === 'conclusion') {
          const text = Array.isArray(value) ? value.join('\n') : value
          return (
            <div key={key} className="report-section-numbered">
              <div className="section-num-title">Conclusion</div>
              {editMode
                ? <textarea className="edit-input edit-textarea" value={text ?? ''} rows={4}
                    onChange={e => set(key, e.target.value)} style={{ width: '100%' }} />
                : <p style={{ margin: 0, fontStyle: 'italic', color: 'var(--text-secondary)' }}>{text}</p>
              }
            </div>
          )
        }

        // ── Generic: plain string/number ──
        if (typeof value !== 'object' || value === null) {
          return (
            <div key={key} className="report-section-numbered">
              <div className="section-num-title">{humanLabel(key)}</div>
              <EField value={value} onChange={v => set(key, v)} editMode={editMode} multiline={String(value ?? '').length > 60} />
            </div>
          )
        }

        // ── Generic: object or array ──
        return (
          <div key={key} className="report-section-numbered">
            <div className="section-num-title">{humanLabel(key)}</div>
            {Array.isArray(value)
              ? <ArraySection items={value} editMode={editMode} onChange={v => set(key, v)} />
              : <ObjectSection data={value} editMode={editMode} onChange={v => set(key, v)} />
            }
          </div>
        )
      })}

      <div className="report-signature">Dr ___________________</div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function ReportPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [report, setReport]     = useState(null)
  const [loading, setLoading]   = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [editData, setEditData] = useState(null)
  const [saving, setSaving]     = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showTranscript, setShowTranscript] = useState(false)

  useEffect(() => {
    getReport(id)
      .then(data => { setReport(data); setEditData(data.structured || {}) })
      .catch(() => setReport(null))
      .finally(() => setLoading(false))
  }, [id])

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
    setDeleting(true)
    try { await deleteReport(id); navigate('/') }
    catch { setDeleting(false) }
  }

  if (loading) return <div className="page" style={{ justifyContent: 'center', alignItems: 'center' }}><div className="spinner" /></div>
  if (!report) return (
    <div className="page" style={{ justifyContent: 'center', padding: 24 }}>
      <div className="empty-state">
        <div className="empty-state-icon">🔍</div>
        <p>Rapport introuvable</p>
        <button className="btn btn-secondary" onClick={() => navigate('/')}>Retour</button>
      </div>
    </div>
  )

  return (
    <div className="page report-page-wrapper">
      {/* Toolbar */}
      <div className="report-toolbar no-print">
        <button className="btn-back" onClick={() => navigate('/')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 18, height: 18 }}>
            <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12,19 5,12 12,5"/>
          </svg>
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600 }}>{report.patient_name || 'Rapport'}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{getExamType(report.exam_type).name}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {!editMode ? (
            <>
              <button className="btn btn-secondary btn-sm" onClick={() => setEditMode(true)}>✏️ Modifier</button>
              <button className="btn btn-primary btn-sm" onClick={() => window.print()}>🖨️ PDF</button>
              <button onClick={handleDelete} disabled={deleting} className="btn-icon-danger" style={{ padding: '6px 8px' }}>
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

      {/* Report */}
      <div className="page-content report-content">
        <ReportBody
          report={report}
          data={editData}
          editMode={editMode}
          onChange={setEditData}
        />

        {/* Raw transcript (collapsible, hidden on print) */}
        {report.transcript && (
          <div style={{ maxWidth: 800, margin: '0 auto', padding: '0 28px 16px' }} className="no-print">
            <button onClick={() => setShowTranscript(s => !s)}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}>
                <polyline points={showTranscript ? '18,15 12,9 6,15' : '6,9 12,15 18,9'}/>
              </svg>
              {showTranscript ? 'Masquer' : 'Voir'} la transcription brute
            </button>
            {showTranscript && (
              <div style={{ marginTop: 8, padding: 12, background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
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
