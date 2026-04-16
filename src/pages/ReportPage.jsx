import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getReport, updateReport, deleteReport } from '../services/api.js'
import { getExamType } from '../data/examTypes.js'
import { useAuth } from '../context/AuthContext.jsx'

// ── Helpers ───────────────────────────────────────────────────────────────────
const LABELS = {
  ao_initiale_mm:'AO Initiale', sigmoides_mm:'Sigmoïdes', og_mm:'OG Systole',
  vg_diastole_mm:'VG Diastole', vg_systole_mm:'VG Systole', masse_g_m2:'Masse',
  hr_ratio:'h/r', sv_diastole_mm:'SIV Diastole', sv_systole_mm:'SIV Systole',
  pp_diastole_mm:'PP Diastole', pp_systole_mm:'PP Systole',
  vd_diastole_mm:'VD Diastole', fr_pct:'FR', fe:'FE',
  e_a_ratio:'E/A', e_eprime:"E/E'", vog_ml:'VOG', vtd_ml:'VOD', tapse_mm:'TAPSE',
  mitrale:'Mitrale', aorte:'Aorte', pulmonaire:'Pulmonaire', tricuspide:'Tricuspide',
  foie:'Foie', vesicule:'Vésicule', voies_biliaires:'Voies Biliaires',
  rate:'Rate', pancreas:'Pancréas', rein_droit:'Rein Droit', rein_gauche:'Rein Gauche',
  epanchement:'Épanchement',
  bip_mm:'BIP', dfo_mm:'DFO', pc_mm:'PC', pa_mm:'PA', lf_mm:'LF',
  poids_estime_g:'Poids estimé', age_gestationnel_bio_sa:'AG biométrique',
  rythme_cardiaque_bpm:'Rythme cardiaque', mouvements:'Mouvements',
  terme_sa:'Terme (SA)', gestite:'Geste', parite:'Parité',
  nombre_foetus:'Nbre fœtus', presentation:'Présentation',
  crane:'Crâne', face:'Face', colonne:'Colonne', thorax:'Thorax',
  coeur:'Cœur', abdomen:'Abdomen', membres:'Membres', sexe:'Sexe',
  placenta:'Placenta', localisation:'Localisation', aspect:'Aspect',
  liquide_amniotique:'Liquide amniotique', cordon:'Cordon', col_mm:'Col',
  gb_g_l:'GB', gr_t_l:'GR', hb_g_dl:'Hb', hte_pct:'Hte', vgm_fl:'VGM',
  ccmh_pct:'CCMH', plaquettes_g_l:'Plaquettes', formule:'Formule',
  glycemie_g_l:'Glycémie', hba1c_pct:'HbA1c', creatinine_mg_l:'Créatinine',
  uree_g_l:'Urée', clairance_ml_min:'Clairance', sodium_meq_l:'Sodium',
  potassium_meq_l:'Potassium', chlore_meq_l:'Chlore', proteines_g_l:'Protéines',
  albumine_g_l:'Albumine', cholesterol_g_l:'Cholestérol', hdl_g_l:'HDL',
  ldl_g_l:'LDL', tg_g_l:'TG', got_ui_l:'GOT (ASAT)', gpt_ui_l:'GPT (ALAT)',
  ggt_ui_l:'GGT', pal_ui_l:'PAL', bilirubine_totale_mg_l:'Bili totale',
  bilirubine_directe_mg_l:'Bili directe', crp_mg_l:'CRP', vs_mm_h:'VS',
  ferritine_ng_ml:'Ferritine', tsa_mUI_ml:'TSH',
  frequence_hz:'Fréquence (Hz)', amplitude_uv:'Amplitude (µV)',
  rythme:'Rythme', symetrie:'Symétrie', duree_min:'Durée (min)',
  etat_vigilance:'État de vigilance', manoeuvres:'Manœuvres',
  type:'Type', caracteristiques:'Caractéristiques',
  injection:'Injection', coupes_mm:'Coupes (mm)', reconstructions:'Reconstructions',
  injection_gadolinium:'Injection gadolinium',
  index_cardiothoracique:'Index cardiothoracique',
  poumons:'Poumons', plevre:'Plèvre', mediastin:'Médiastin',
  diaphragme:'Diaphragme', parenchyme:'Parenchyme', osseux:'Osseux',
  parties_molles:'Parties molles', autres:'Autres',
  signal_normal:'Signal normal', anomalies_signal:'Anomalies signal',
  structures_observees:'Structures observées', mesures:'Mesures',
  parenchyme_r:'Parenchyme', vaisseaux:'Vaisseaux', ganglions:'Ganglions',
  structures_osseuses:'Structures osseuses', autres_structures:'Autres structures',
  taille_mm:'Taille', echostructure:'Échostructure', observations:'Observations',
  paroi_mm:'Paroi', lithiase:'Lithiase', vbp_mm:'VBP', calibre_mm:'Calibre',
  date_prelevement:'Date prélèvement',
  type_incidence:'Type / Incidence', qualite_technique:'Qualité technique',
  type_examen:'Type d\'examen', technique:'Technique',
}
function hl(key) {
  return LABELS[key] || key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}
function isBlank(v) {
  if (v === null || v === undefined) return true
  if (typeof v === 'string' && v.trim() === '') return true
  if (Array.isArray(v) && v.length === 0) return true
  if (typeof v === 'object' && !Array.isArray(v) && Object.values(v).every(isBlank)) return true
  return false
}
function formatDate(iso) {
  return new Date(iso).toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric' })
}

// ── Shared styles ─────────────────────────────────────────────────────────────
const DOC = {
  fontFamily: '"Times New Roman", Georgia, serif',
  fontSize: '13px',
  color: '#000',
  background: '#fff',
  padding: '32px 36px',
  maxWidth: '760px',
  margin: '0 auto',
  lineHeight: 1.6,
  boxShadow: '0 2px 16px rgba(0,0,0,0.12)',
  borderRadius: '2px',
}
const inlineInput = {
  border: '1px solid #93c5fd',
  borderRadius: '2px',
  padding: '1px 5px',
  fontSize: '13px',
  fontFamily: 'inherit',
  fontWeight: 700,
  background: '#eff6ff',
  outline: 'none',
  minWidth: '60px',
}
const textareaInput = {
  ...inlineInput,
  resize: 'none',
  width: '100%',
  display: 'block',
}
const removeBtn = {
  border: 'none', background: 'none', cursor: 'pointer',
  color: '#ef4444', fontSize: '12px', padding: '0 3px', lineHeight: 1,
}
const addBtn = {
  border: '1px dashed #93c5fd', background: 'none', cursor: 'pointer',
  color: '#2563eb', fontSize: '12px', padding: '2px 10px',
  marginTop: '4px', marginLeft: '20px', borderRadius: '2px', fontFamily: 'inherit',
}

// ── Inline editable field ─────────────────────────────────────────────────────
function EF({ val, onChange, editMode, multi = false, w = '80px' }) {
  if (!editMode) return <strong>{val ?? '—'}</strong>
  if (multi) return <textarea style={{ ...textareaInput, fontWeight: 400 }} rows={2} value={val ?? ''} onChange={e => onChange(e.target.value)} />
  return <input style={{ ...inlineInput, width: w }} value={val ?? ''} onChange={e => onChange(e.target.value)} />
}

// ── Patient header block ──────────────────────────────────────────────────────
function PatientHeader({ report, data, editMode, onChange, doctorName, showEchogenicite }) {
  const p = data?.patient || {}
  function sp(key, val) { onChange('patient', { ...p, [key]: val }) }

  return (
    <div style={{ borderBottom: '1.5px solid #000', paddingBottom: '8px', marginBottom: '12px' }}>

      {/* Row 1: Nom | Poids | Taille */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', marginBottom: '3px', alignItems: 'baseline' }}>
        <span>
          Nom et prénoms :{' '}
          {editMode
            ? <input style={{ ...inlineInput, width: '160px' }} value={report.patient_name || p.nom || ''} onChange={e => sp('nom', e.target.value)} />
            : <strong>{report.patient_name || p.nom || '___________________'}</strong>}
        </span>
        <span>Poids :{' '}<EF val={p.poids} onChange={v => sp('poids', v)} editMode={editMode} />{p.poids && !editMode ? ' kgs' : ''}</span>
        <span>Taille :{' '}<EF val={p.taille} onChange={v => sp('taille', v)} editMode={editMode} />{p.taille && !editMode ? ' m' : ''}</span>
      </div>

      {/* Row 2: Adressé par | Age | Sexe | SC | Date */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', marginBottom: '4px', alignItems: 'baseline' }}>
        <span>Adressé par : <strong>{doctorName || 'Dr ___________________'}</strong></span>
        <span>Age :{' '}<EF val={p.age} onChange={v => sp('age', v)} editMode={editMode} />{p.age && !editMode ? ' ans' : ''}</span>
        <span>Sexe :{' '}<EF val={p.sexe} onChange={v => sp('sexe', v)} editMode={editMode} w="40px" /></span>
        {(p.sc || editMode) && <span>SC :{' '}<EF val={p.sc} onChange={v => sp('sc', v)} editMode={editMode} w="50px" /></span>}
        <span>Date : <strong>{formatDate(report.created_at)}</strong></span>
      </div>

      {/* Indication */}
      {(!isBlank(data?.indication) || editMode) && (
        <div style={{ marginBottom: '4px' }}>
          Renseignements Cliniques :{' '}
          {editMode
            ? <textarea style={{ ...inlineInput, fontWeight: 700, width: '70%', marginLeft: 4, resize: 'none', verticalAlign: 'middle' }}
                rows={1} value={data?.indication ?? ''} onChange={e => onChange('indication', e.target.value)} />
            : <strong>{data?.indication}</strong>}
        </div>
      )}

      {/* Echogénicité */}
      {showEchogenicite && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px', marginTop: '2px' }}>
          <span style={{ textDecoration: 'underline' }}>Echogénicité</span>
          {['Bonne', 'Moyenne', 'Médiocre'].map(opt => (
            <span
              key={opt}
              onClick={editMode ? () => onChange('echogenicite', opt) : undefined}
              style={{
                fontWeight: data?.echogenicite === opt ? 700 : 400,
                textDecoration: data?.echogenicite === opt ? 'underline' : 'none',
                cursor: editMode ? 'pointer' : 'default',
                padding: editMode ? '0 6px' : '0',
                borderRadius: editMode && data?.echogenicite === opt ? '3px' : '0',
                background: editMode && data?.echogenicite === opt ? '#dbeafe' : 'none',
              }}>
              {opt}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Measurements table (4 columns) ───────────────────────────────────────────
function MeasurementsTable({ section, data, editMode, onChange }) {
  const rows = section.rows || []
  function setK(key, val) { onChange({ ...(data || {}), [key]: val }) }

  function CellContent({ item }) {
    if (!item) return null

    if (item.composite) {
      const hasAny = item.items.some(ci => !isBlank(data?.[ci.key]))
      if (!editMode && !hasAny) return <span style={{ color: '#999' }}>—</span>
      return (
        <span>
          {item.label ? <>{item.label} : </> : null}
          {item.items.map((ci, i) => {
            const v = data?.[ci.key]
            if (!editMode && isBlank(v)) return null
            return (
              <span key={i}>
                {ci.prefix}
                {editMode
                  ? <input style={{ ...inlineInput, width: '55px' }} value={v ?? ''} onChange={e => setK(ci.key, e.target.value)} />
                  : <strong>{v}</strong>}
                {ci.suffix || ''}
              </span>
            )
          })}
        </span>
      )
    }

    const v = data?.[item.key]
    return (
      <span>
        {item.label ? `${item.label} :  ` : ''}
        {editMode
          ? <input style={{ ...inlineInput, width: '70px' }} value={v ?? ''} onChange={e => setK(item.key, e.target.value)} />
          : isBlank(v) ? '' : <strong>{v}</strong>}
      </span>
    )
  }

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', margin: '8px 0 14px', fontSize: '13px' }}>
      <thead>
        <tr>
          <th style={{ border: '1px solid #555', padding: '4px 10px', background: '#f0f0f0', width: '32%' }}>Paramètres mesurés</th>
          <th style={{ border: '1px solid #555', padding: '4px 10px', background: '#f0f0f0', width: '18%', textAlign: 'center' }}>Normes adultes</th>
          <th style={{ border: '1px solid #555', padding: '4px 10px', background: '#f0f0f0', width: '32%' }}>Paramètres mesurés</th>
          <th style={{ border: '1px solid #555', padding: '4px 10px', background: '#f0f0f0', width: '18%', textAlign: 'center' }}>Normes adultes</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, ri) => {
          const [left, right] = row
          return (
            <tr key={ri}>
              <td style={{ border: '1px solid #555', padding: '3px 10px' }}><CellContent item={left} /></td>
              <td style={{ border: '1px solid #555', padding: '3px 10px', color: '#444', whiteSpace: 'pre-wrap', textAlign: 'center', fontSize: '12px' }}>
                {left?.normal || ''}
              </td>
              <td style={{ border: '1px solid #555', padding: '3px 10px' }}><CellContent item={right} /></td>
              <td style={{ border: '1px solid #555', padding: '3px 10px', color: '#444', whiteSpace: 'pre-wrap', textAlign: 'center', fontSize: '12px' }}>
                {right?.normal || ''}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

// ── Section header ────────────────────────────────────────────────────────────
function SecHeader({ num, label, subtitle }) {
  return (
    <div style={{ fontWeight: 700, marginBottom: '6px', marginTop: '14px', fontSize: '13px' }}>
      {num}.{' '}
      <span style={{ textDecoration: 'underline' }}>{label}</span>
      {subtitle && (
        <span style={{ fontWeight: 400 }}> : {subtitle}</span>
      )}
      {!subtitle && ' :'}
    </div>
  )
}

// ── section_list (dash bullets from array) ────────────────────────────────────
function SectionList({ num, section, items, editMode, onChange }) {
  const arr = Array.isArray(items) ? items : (items && !isBlank(items) ? [String(items)] : [])
  if (isBlank(arr) && !editMode) return null
  return (
    <div>
      <SecHeader num={num} label={section.label} subtitle={section.subtitle} />
      {arr.map((item, i) => (
        <div key={i} style={{ marginLeft: '20px', marginBottom: '2px' }}>
          {editMode ? (
            <div style={{ display: 'flex', gap: '4px', alignItems: 'flex-start' }}>
              <span>- </span>
              <textarea style={{ ...textareaInput, fontWeight: 400, flex: 1, minHeight: '22px' }}
                rows={1} value={item}
                onChange={e => { const a = [...arr]; a[i] = e.target.value; onChange(a) }} />
              <button style={removeBtn} onClick={() => onChange(arr.filter((_, j) => j !== i))}>✕</button>
            </div>
          ) : (
            <span>- {item}</span>
          )}
        </div>
      ))}
      {editMode && <button style={addBtn} onClick={() => onChange([...arr, ''])}>+ Ajouter</button>}
    </div>
  )
}

// ── section_dict (object → "Label : valeur") ──────────────────────────────────
function SectionDict({ num, section, data, editMode, onChange }) {
  if (isBlank(data) && !editMode) return null
  const entries = Object.entries(data || {}).filter(([, v]) => !isBlank(v) || editMode)
  if (!entries.length && !editMode) return null

  function set(key, val) { onChange({ ...(data || {}), [key]: val }) }

  function renderValue(key, val) {
    if (Array.isArray(val)) {
      if (isBlank(val) && !editMode) return null
      return (
        <div>
          <span style={{ marginLeft: '20px' }}>
            - <strong>{hl(key)} :</strong>
          </span>
          {val.map((v, i) => (
            <div key={i} style={{ marginLeft: '40px' }}>- {v}</div>
          ))}
        </div>
      )
    }
    if (typeof val === 'object' && val !== null) {
      const subEntries = Object.entries(val).filter(([, v]) => !isBlank(v) || editMode)
      if (!subEntries.length && !editMode) return null
      return (
        <div>
          <div style={{ marginLeft: '20px' }}>- <strong>{hl(key)} :</strong></div>
          {subEntries.map(([k, v]) => (
            <div key={k} style={{ marginLeft: '40px' }}>
              - {hl(k)} :{' '}
              {editMode
                ? <input style={{ ...inlineInput, fontWeight: 400, width: '120px' }} value={v ?? ''} onChange={e => set(key, { ...val, [k]: e.target.value })} />
                : v}
            </div>
          ))}
        </div>
      )
    }
    return (
      <div style={{ marginLeft: '20px' }}>
        - <strong>{hl(key)} :</strong>{' '}
        {editMode
          ? <input style={{ ...inlineInput, fontWeight: 400, width: '180px' }} value={val ?? ''} onChange={e => set(key, e.target.value)} />
          : val}
      </div>
    )
  }

  return (
    <div>
      <SecHeader num={num} label={section.label} />
      {entries.map(([key, val]) => (
        <div key={key}>{renderValue(key, val)}</div>
      ))}
    </div>
  )
}

// ── section_conclusion (italic bold bullets) ──────────────────────────────────
function SectionConclusion({ num, section, value, editMode, onChange }) {
  const items = Array.isArray(value)
    ? value
    : (value && !isBlank(value) ? [String(value)] : [])
  if (isBlank(items) && !editMode) return null
  return (
    <div>
      <SecHeader num={num} label={section.label} />
      {items.map((item, i) => (
        <div key={i} style={{ marginLeft: '20px', marginBottom: '5px', fontStyle: 'italic', fontWeight: 700 }}>
          {editMode ? (
            <div style={{ display: 'flex', gap: '4px', alignItems: 'flex-start' }}>
              <span>•</span>
              <textarea style={{ ...textareaInput, fontStyle: 'italic', fontWeight: 700, flex: 1, minHeight: '28px' }}
                rows={2} value={item}
                onChange={e => { const a = [...items]; a[i] = e.target.value; onChange(a) }} />
              <button style={removeBtn} onClick={() => onChange(items.filter((_, j) => j !== i))}>✕</button>
            </div>
          ) : (
            <span>• {item}</span>
          )}
        </div>
      ))}
      {editMode && <button style={addBtn} onClick={() => onChange([...items, ''])}>+ Ajouter</button>}
    </div>
  )
}

// ── section_text (plain paragraph) ───────────────────────────────────────────
function SectionText({ num, section, value, editMode, onChange }) {
  if (isBlank(value) && !editMode) return null
  return (
    <div>
      <SecHeader num={num} label={section.label} />
      <div style={{ marginLeft: '20px' }}>
        {editMode
          ? <textarea style={{ ...textareaInput, fontWeight: 400, minHeight: '40px' }} rows={2} value={value ?? ''} onChange={e => onChange(e.target.value)} />
          : value}
      </div>
    </div>
  )
}

// ── section_biology (lab values with normal ranges) ──────────────────────────
function SectionBiology({ num, section, data, editMode, onChange }) {
  const rows = section.rows || []
  const visibleRows = rows.filter(r => !isBlank(data?.[r.key]) || editMode)
  if (!visibleRows.length && !editMode) return null
  function set(key, val) { onChange({ ...(data || {}), [key]: val }) }
  return (
    <div>
      <SecHeader num={num} label={section.label} />
      <table style={{ marginLeft: '20px', borderCollapse: 'collapse', fontSize: '13px', width: 'calc(100% - 20px)' }}>
        <tbody>
          {visibleRows.map(row => {
            const v = data?.[row.key]
            return (
              <tr key={row.key}>
                <td style={{ padding: '2px 12px 2px 0', whiteSpace: 'nowrap', width: '40%' }}>
                  - {row.label} :
                </td>
                <td style={{ padding: '2px 12px 2px 0', width: '30%' }}>
                  {editMode
                    ? <input style={{ ...inlineInput, width: '100px' }} value={v ?? ''} onChange={e => set(row.key, e.target.value)} />
                    : <strong>{isBlank(v) ? '—' : v}</strong>}
                </td>
                <td style={{ padding: '2px 0', color: '#555', fontSize: '12px' }}>
                  {row.normal ? `(N : ${row.normal})` : ''}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Medical document (layout-driven) ─────────────────────────────────────────
function MedicalDocument({ report, data, editMode, onChange, doctorName }) {
  const examType = getExamType(report.exam_type)
  const safeData = data || {}
  const layout = examType.layout || []

  function set(key, val) { onChange({ ...safeData, [key]: val }) }

  let secNum = 0

  const RENDERERS = {
    measurements_table: (s, i) => (
      <MeasurementsTable key={i} section={s} data={safeData[s.dataKey]} editMode={editMode} onChange={v => set(s.dataKey, v)} />
    ),
    section_list: (s, i) => {
      secNum++
      return <SectionList key={i} num={secNum} section={s} items={safeData[s.dataKey]} editMode={editMode} onChange={v => set(s.dataKey, v)} />
    },
    section_dict: (s, i) => {
      secNum++
      return <SectionDict key={i} num={secNum} section={s} data={safeData[s.dataKey]} editMode={editMode} onChange={v => set(s.dataKey, v)} />
    },
    section_conclusion: (s, i) => {
      secNum++
      return <SectionConclusion key={i} num={secNum} section={s} value={safeData[s.dataKey]} editMode={editMode} onChange={v => set(s.dataKey, v)} />
    },
    section_text: (s, i) => {
      secNum++
      return <SectionText key={i} num={secNum} section={s} value={safeData[s.dataKey]} editMode={editMode} onChange={v => set(s.dataKey, v)} />
    },
    section_biology: (s, i) => {
      secNum++
      return <SectionBiology key={i} num={secNum} section={s} data={safeData[s.dataKey]} editMode={editMode} onChange={v => set(s.dataKey, v)} />
    },
  }

  return (
    <div id="print-area" style={DOC}>

      {/* ── Title ── */}
      <div style={{ textAlign: 'center', fontWeight: 700, fontSize: '15px', textDecoration: 'underline', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '16px' }}>
        {examType.name}
      </div>

      {/* ── Patient header ── */}
      <PatientHeader
        report={report}
        data={safeData}
        editMode={editMode}
        onChange={set}
        doctorName={doctorName}
        showEchogenicite={examType.showEchogenicite}
      />

      {/* ── Layout sections ── */}
      {layout.map((section, i) => {
        const renderer = RENDERERS[section.type]
        return renderer ? renderer(section, i) : null
      })}

      {/* ── Signature ── */}
      <div style={{ marginTop: '32px', display: 'flex', justifyContent: 'flex-end', flexDirection: 'column', alignItems: 'flex-end' }}>
        <div style={{ fontWeight: 700 }}>{doctorName || 'Dr ___________________'}</div>
        <div style={{ width: '180px', borderTop: '1px solid #000', marginTop: '28px', paddingTop: '4px', textAlign: 'center', fontSize: '11px', color: '#555' }}>
          Signature &amp; Cachet
        </div>
        <div style={{ fontSize: '10px', color: '#aaa', marginTop: '8px' }}>Généré par MediScribe</div>
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
        <div className="empty-state-icon">🔍</div>
        <p>Rapport introuvable</p>
        <button className="btn btn-secondary" onClick={() => navigate('/')}>Retour</button>
      </div>
    </div>
  )

  return (
    <div className="page report-page-wrapper">

      {/* ── Toolbar ── */}
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
      <div className="report-content doc-page-bg" style={{ padding: '16px', background: 'var(--bg-secondary, #f1f5f9)' }}>
        <MedicalDocument
          report={report}
          data={editData}
          editMode={editMode}
          onChange={setEditData}
          doctorName={doctorName}
        />

        {report.transcript && (
          <div className="doc-transcript-wrap no-print" style={{ maxWidth: '760px', margin: '12px auto 0' }}>
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
