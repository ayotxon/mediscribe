import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getReport, updateReport, deleteReport } from '../services/api.js'
import { getExamType } from '../data/examTypes.js'

// ── Echo cardiaque: table de mesures avec normes ──────────────────────────────
const ECHO_LEFT = [
  { key: 'ao_initiale_mm',  label: 'AO Initiale',  norme: '20-37 mm' },
  { key: 'sigmoides_mm',    label: 'Sigmoïdes',    norme: '15-26 mm' },
  { key: 'og_mm',           label: 'OG Systole',   norme: '19-40 mm' },
  { key: 'vg_diastole_mm',  label: 'VG Diastole',  norme: '36-56 mm' },
  { key: 'vg_systole_mm',   label: 'VG Systole',   norme: '25-37 mm' },
  { key: 'masse_g_m2',      label: 'Masse',        norme: '<95 g/m² F' },
  { key: 'fr_pct',          label: 'FR',           norme: '> 25 %' },
  { key: 'fe',              label: 'FE',           norme: '0,60-0,80' },
]
const ECHO_RIGHT = [
  { key: 'sv_diastole_mm',  label: 'SIV Diastole', norme: '6-11 mm' },
  { key: 'sv_systole_mm',   label: 'SIV Systole',  norme: '9-15 mm' },
  { key: 'pp_diastole_mm',  label: 'PP Diastole',  norme: '6-11 mm' },
  { key: 'pp_systole_mm',   label: 'PP Systole',   norme: '9-15 mm' },
]

function EditableField({ value, onChange, editMode, type = 'text', style = {} }) {
  if (!editMode) {
    return <span style={style}>{value ?? '—'}</span>
  }
  return (
    <input
      type={type}
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      style={{
        background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.4)',
        borderRadius: 4, padding: '1px 4px', fontSize: 'inherit',
        color: 'var(--text-primary)', width: '100%', minWidth: 40, maxWidth: 120,
        ...style
      }}
    />
  )
}

function EditableText({ value, onChange, editMode, rows = 3 }) {
  if (!editMode) return <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{value ?? '—'}</p>
  return (
    <textarea
      value={value ?? ''}
      rows={rows}
      onChange={e => onChange(e.target.value)}
      style={{
        width: '100%', background: 'rgba(59,130,246,0.08)',
        border: '1px solid rgba(59,130,246,0.4)', borderRadius: 4,
        padding: '4px 8px', fontSize: '0.9rem', color: 'var(--text-primary)',
        resize: 'vertical', fontFamily: 'inherit'
      }}
    />
  )
}

// ── Renderer echo cardiaque ───────────────────────────────────────────────────
function EchoCardiaqueReport({ report, data, editMode, onChange }) {
  const m = data.mesures || {}
  const p = data.patient || {}
  const doppler = data.doppler || {}
  const commentaires = data.commentaires || []

  function setMesure(key, val) { onChange({ ...data, mesures: { ...m, [key]: val } }) }
  function setPatient(key, val) { onChange({ ...data, patient: { ...p, [key]: val } }) }
  function setDoppler(key, val) { onChange({ ...data, doppler: { ...doppler, [key]: val } }) }
  function setCommentaire(i, val) {
    const arr = [...commentaires]; arr[i] = val
    onChange({ ...data, commentaires: arr })
  }
  function addCommentaire() { onChange({ ...data, commentaires: [...commentaires, ''] }) }
  function removeCommentaire(i) {
    onChange({ ...data, commentaires: commentaires.filter((_, j) => j !== i) })
  }

  return (
    <div className="medical-report">
      {/* ── Titre ── */}
      <div className="report-title-block">
        <h2 className="report-main-title">ÉCHOGRAPHIE DOPPLER CARDIAQUE</h2>
      </div>

      {/* ── Infos patient ── */}
      <div className="report-patient-grid">
        <div className="rpg-row">
          <span className="rpg-label">Nom et prénoms :</span>
          <EditableField value={report.patient_name} onChange={() => {}} editMode={false} />
        </div>
        <div className="rpg-row">
          <span className="rpg-label">Poids :</span>
          <EditableField value={p.poids} onChange={v => setPatient('poids', v)} editMode={editMode} />
          <span className="rpg-label" style={{ marginLeft: 16 }}>Taille :</span>
          <EditableField value={p.taille} onChange={v => setPatient('taille', v)} editMode={editMode} />
        </div>
        <div className="rpg-row">
          <span className="rpg-label">Adressé par :</span>
          <EditableField value={p.medecin_referent} onChange={v => setPatient('medecin_referent', v)} editMode={editMode} />
        </div>
        <div className="rpg-row">
          <span className="rpg-label">Âge :</span>
          <EditableField value={p.age} onChange={v => setPatient('age', v)} editMode={editMode} />
          <span className="rpg-label" style={{ marginLeft: 16 }}>Sexe :</span>
          <EditableField value={p.sexe} onChange={v => setPatient('sexe', v)} editMode={editMode} />
          <span className="rpg-label" style={{ marginLeft: 16 }}>SC :</span>
          <EditableField value={p.sc} onChange={v => setPatient('sc', v)} editMode={editMode} />
          <span className="rpg-label" style={{ marginLeft: 16 }}>Date :</span>
          <span>{new Date(report.created_at).toLocaleDateString('fr-FR')}</span>
        </div>
      </div>

      {/* ── Renseignements cliniques ── */}
      <div className="report-meta-row">
        <div className="report-meta-item">
          <span className="rpg-label">Renseignements Cliniques :</span>
          <EditableField value={data.indication || report.indication} onChange={v => onChange({ ...data, indication: v })} editMode={editMode} />
        </div>
        <div className="report-meta-item">
          <span className="rpg-label">Échoquantité :</span>
          <EditableField value={data.echogenicite} onChange={v => onChange({ ...data, echogenicite: v })} editMode={editMode} />
        </div>
      </div>

      {/* ── Table mesures ── */}
      <table className="mesures-table">
        <thead>
          <tr>
            <th>Paramètres mesurés</th>
            <th>Normes adultes</th>
            <th>Paramètres mesurés</th>
            <th>Normes adultes</th>
          </tr>
        </thead>
        <tbody>
          {ECHO_LEFT.map((row, i) => {
            const right = ECHO_RIGHT[i]
            return (
              <tr key={row.key}>
                <td>
                  <span className="param-label">{row.label} : </span>
                  <EditableField value={m[row.key]} onChange={v => setMesure(row.key, v)} editMode={editMode} />
                </td>
                <td className="norme-cell">{row.norme}</td>
                {right ? (
                  <>
                    <td>
                      <span className="param-label">{right.label} : </span>
                      <EditableField value={m[right.key]} onChange={v => setMesure(right.key, v)} editMode={editMode} />
                    </td>
                    <td className="norme-cell">{right.norme}</td>
                  </>
                ) : i === ECHO_LEFT.length - 4 ? (
                  <td colSpan={2} rowSpan={4} className="autres-cell">
                    <div><strong>Autres</strong></div>
                    {[
                      { key: 'e_a_ratio',  label: 'E/A' },
                      { key: 'e_eprime',   label: "E/E'" },
                      { key: 'vog_ml',     label: 'VOG (ml)' },
                      { key: 'vtd_ml',     label: 'VTD (ml)' },
                      { key: 'tapse_mm',   label: 'TAPSE (mm)' },
                    ].map(f => (
                      <div key={f.key} style={{ marginTop: 4 }}>
                        <span className="param-label">{f.label} = </span>
                        <EditableField value={m[f.key]} onChange={v => setMesure(f.key, v)} editMode={editMode} />
                      </div>
                    ))}
                  </td>
                ) : null}
              </tr>
            )
          })}
        </tbody>
      </table>

      {/* ── Commentaires ── */}
      <div className="report-section-numbered">
        <div className="section-num-title">1. COMMENTAIRES : BD-TM-Péricarde, Cavités, Valves, Parois, Cinétique</div>
        <ul className="commentaires-list">
          {commentaires.map((c, i) => (
            <li key={i}>
              {editMode ? (
                <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                  <EditableText value={c} onChange={v => setCommentaire(i, v)} editMode={editMode} rows={1} />
                  <button onClick={() => removeCommentaire(i)} className="btn-icon-danger" title="Supprimer">✕</button>
                </div>
              ) : c}
            </li>
          ))}
        </ul>
        {editMode && (
          <button className="btn-add-item" onClick={addCommentaire}>+ Ajouter un commentaire</button>
        )}
      </div>

      {/* ── Doppler ── */}
      <div className="report-section-numbered">
        <div className="section-num-title">2. DOPPLER :</div>
        {Object.entries({ mitrale: 'Mitrale', aorte: 'Aorte', pulmonaire: 'Pulmonaire', tricuspide: 'Tricuspide' }).map(([k, label]) => (
          <div key={k} className="doppler-row">
            <span className="doppler-label">- {label} :</span>
            <EditableText value={doppler[k]} onChange={v => setDoppler(k, v)} editMode={editMode} rows={1} />
          </div>
        ))}
      </div>

      {/* ── Conclusion ── */}
      <div className="report-section-numbered">
        <div className="section-num-title">3. CONCLUSION :</div>
        {(data.conclusion ? (Array.isArray(data.conclusion) ? data.conclusion : [data.conclusion]) : []).map((c, i) => (
          <div key={i} style={{ marginLeft: 8 }}>• <EditableText value={c} onChange={v => {
            const arr = Array.isArray(data.conclusion) ? [...data.conclusion] : [data.conclusion]
            arr[i] = v; onChange({ ...data, conclusion: arr })
          }} editMode={editMode} rows={2} /></div>
        ))}
        {!Array.isArray(data.conclusion) && !data.conclusion && editMode && (
          <EditableText value="" onChange={v => onChange({ ...data, conclusion: v })} editMode={editMode} rows={3} />
        )}
      </div>

      {/* ── Signature ── */}
      <div className="report-signature">
        <span>Dr {p.medecin_referent || '___________________'}</span>
      </div>
    </div>
  )
}

// ── Renderer générique pour les autres types d'examens ────────────────────────
function GenericReport({ report, data, editMode, onChange }) {
  function renderValue(value, path, depth = 0) {
    if (value === null || value === undefined) {
      return editMode
        ? <input style={inputStyle} value="" onChange={e => setPath(path, e.target.value)} placeholder="—" />
        : <span style={{ color: 'var(--text-muted)' }}>—</span>
    }
    if (Array.isArray(value)) {
      return (
        <div>
          {value.map((item, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 4 }}>
              <span style={{ color: 'var(--text-muted)' }}>•</span>
              {editMode
                ? <textarea rows={1} style={{ ...inputStyle, flex: 1 }} value={item} onChange={e => {
                    const arr = [...value]; arr[i] = e.target.value; setPath(path, arr)
                  }} />
                : <span>{item}</span>
              }
            </div>
          ))}
          {editMode && <button className="btn-add-item" onClick={() => setPath(path, [...value, ''])}>+ Ajouter</button>}
        </div>
      )
    }
    if (typeof value === 'object') {
      return (
        <div style={depth > 0 ? { paddingLeft: 12, borderLeft: '2px solid var(--border)', marginTop: 4 } : {}}>
          {Object.entries(value).map(([k, v]) => (
            <div key={k} className="generic-field-row">
              <span className="generic-field-label">{k.replace(/_/g, ' ')}</span>
              {renderValue(v, [...path, k], depth + 1)}
            </div>
          ))}
        </div>
      )
    }
    return editMode
      ? <input style={inputStyle} value={value} onChange={e => setPath(path, e.target.value)} />
      : <span>{String(value)}</span>
  }

  const inputStyle = {
    background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.4)',
    borderRadius: 4, padding: '2px 6px', fontSize: 'inherit', color: 'var(--text-primary)', width: '100%'
  }

  function setPath(pathArr, val) {
    const clone = JSON.parse(JSON.stringify(data))
    let obj = clone
    for (let i = 0; i < pathArr.length - 1; i++) obj = obj[pathArr[i]]
    obj[pathArr[pathArr.length - 1]] = val
    onChange(clone)
  }

  const { patient, indication, conclusion, ...rest } = data

  return (
    <div className="medical-report">
      {/* Patient header */}
      <div className="report-patient-grid">
        <div className="rpg-row">
          <span className="rpg-label">Patient :</span> {report.patient_name || '—'}
        </div>
        {indication && <div className="rpg-row"><span className="rpg-label">Indication :</span> {indication}</div>}
        <div className="rpg-row"><span className="rpg-label">Date :</span> {new Date(report.created_at).toLocaleDateString('fr-FR')}</div>
      </div>

      {/* Body sections */}
      {Object.entries(rest).map(([section, sectionData]) => {
        if (!sectionData && !editMode) return null
        const hasContent = sectionData && (typeof sectionData !== 'object' || Object.values(sectionData).some(v => v !== null))
        if (!hasContent && !editMode) return null
        return (
          <div key={section} className="report-section-numbered">
            <div className="section-num-title">{section.replace(/_/g, ' ').toUpperCase()}</div>
            {renderValue(sectionData, [section])}
          </div>
        )
      })}

      {conclusion && (
        <div className="report-section-numbered">
          <div className="section-num-title">CONCLUSION</div>
          {editMode
            ? <textarea rows={4} style={inputStyle} value={typeof conclusion === 'string' ? conclusion : JSON.stringify(conclusion)} onChange={e => onChange({ ...data, conclusion: e.target.value })} />
            : <p style={{ margin: 0, fontStyle: 'italic' }}>{typeof conclusion === 'string' ? conclusion : JSON.stringify(conclusion)}</p>
          }
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ReportPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [report, setReport]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [editData, setEditData] = useState(null)
  const [saving, setSaving]   = useState(false)
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
    } finally {
      setSaving(false)
    }
  }

  function handleCancelEdit() {
    setEditData(report.structured || {})
    setEditMode(false)
  }

  async function handleDelete() {
    if (!confirm('Supprimer ce rapport définitivement ?')) return
    setDeleting(true)
    try { await deleteReport(id); navigate('/') }
    catch { setDeleting(false) }
  }

  function handlePrint() {
    window.print()
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

  const examType = getExamType(report.exam_type)

  return (
    <div className="page report-page-wrapper">
      {/* ── Toolbar (masquée à l'impression) ── */}
      <div className="report-toolbar no-print">
        <button className="btn-back" onClick={() => navigate('/')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 18, height: 18 }}>
            <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12,19 5,12 12,5" />
          </svg>
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600 }}>{report.patient_name || 'Patient'}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{examType.name}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {!editMode ? (
            <>
              <button className="btn btn-secondary btn-sm" onClick={() => setEditMode(true)}>
                ✏️ Modifier
              </button>
              <button className="btn btn-primary btn-sm" onClick={handlePrint}>
                🖨️ PDF
              </button>
              <button onClick={handleDelete} disabled={deleting} className="btn-icon-danger" style={{ padding: '6px 8px' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 18, height: 18 }}>
                  <polyline points="3,6 5,6 21,6"/><path d="M19,6l-1,14H6L5,6"/><path d="M9,6V4h6v2"/>
                </svg>
              </button>
            </>
          ) : (
            <>
              <button className="btn btn-secondary btn-sm" onClick={handleCancelEdit}>Annuler</button>
              <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
                {saving ? 'Enregistrement…' : '💾 Enregistrer'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Contenu du rapport ── */}
      <div className="page-content report-content">
        {report.exam_type === 'echo_cardiaque' ? (
          <EchoCardiaqueReport
            report={report}
            data={editData}
            editMode={editMode}
            onChange={setEditData}
          />
        ) : (
          <GenericReport
            report={report}
            data={editData}
            editMode={editMode}
            onChange={setEditData}
          />
        )}

        {/* Transcription brute (repliable, masquée à l'impression) */}
        {report.transcript && (
          <div style={{ marginTop: 16 }} className="no-print">
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
