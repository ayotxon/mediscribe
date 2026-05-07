import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getReport, updateReport, deleteReport } from '../services/api.js'
import { getExamType } from '../data/examTypes.js'
import { useAuth } from '../context/AuthContext.jsx'

// ── Label overrides ───────────────────────────────────────────────────────────
const LABELS = {
  ao_initiale_mm:'AO Initiale', sigmoides_mm:'Sigmoïdes', og_mm:'OG Systole',
  vg_diastole_mm:'VG Diastole', vg_systole_mm:'VG Systole', masse_g_m2:'Masse',
  hr_ratio:'h/r', sv_diastole_mm:'SIV Diastole', sv_systole_mm:'SIV Systole',
  pp_diastole_mm:'PP Diastole', pp_systole_mm:'PP Systole',
  vd_diastole_mm:'VD Diastole', fr_pct:'FR', fe:'FE',
  e_a_ratio:'E/A', e_eprime:"E/E'", vog_ml:'VOG', vod_ml:'VOD', vtd_ml:'VOD', tapse_mm:'TAPSE',
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
  vaisseaux:'Vaisseaux', ganglions:'Ganglions',
  structures_osseuses:'Structures osseuses', autres_structures:'Autres structures',
  taille_mm:'Taille', echostructure:'Échostructure', observations:'Observations',
  paroi_mm:'Paroi', lithiase:'Lithiase', vbp_mm:'VBP', calibre_mm:'Calibre',
  date_prelevement:'Date prélèvement',
  type_incidence:'Type / Incidence', qualite_technique:'Qualité technique',
  type_examen:"Type d'examen", technique:'Technique',
  carotide_commune:'Artère Carotide Commune',
  carotide_interne:'Artère Carotide Interne',
  carotide_externe:'Artère Carotide Externe',
  droite:'Droite', gauche:'Gauche',
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
  return new Date(iso).toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric' })
}
function formatDateShort(iso) {
  return new Date(iso).toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric' })
}
// ISO → "yyyy-mm-dd" using LOCAL date components so the input picker doesn't
// drift one day in negative-UTC timezones (e.g. WAT/CET dates becoming UTC).
function isoToDateInput(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
// "yyyy-mm-dd" → ISO string anchored at noon local time so the calendar day
// is preserved across any timezone the report is later opened in.
function dateInputToIso(s) {
  if (!s) return null
  const [y, m, d] = s.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d, 12, 0, 0).toISOString()
}

// ── Inline editable field ─────────────────────────────────────────────────────
function EF({ val, onChange, editMode, multi = false, w = '110px', light = false }) {
  const cls = `med-input${light ? ' med-input-light' : ''}`
  if (!editMode) return <strong style={light ? { fontWeight: 400 } : {}}>{val ?? '—'}</strong>
  if (multi) return <textarea className={cls} style={{ width: '100%', minHeight: '40px', resize: 'vertical', display: 'block' }} rows={2} value={val ?? ''} onChange={e => onChange(e.target.value)} />
  return <input className={cls} style={{ width: w }} value={val ?? ''} onChange={e => onChange(e.target.value)} />
}

// ── Reorder controls (↑ / ↓) for editable lists ───────────────────────────────
// Order matters in medical reports — testers asked for the ability to bump an
// item up/down without deleting and re-adding it.
function ReorderControls({ index, length, onMove }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
      <button
        type="button"
        className="med-btn-move"
        title="Monter"
        disabled={index === 0}
        onClick={() => onMove(index, index - 1)}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: 12, height: 12 }}>
          <polyline points="18,15 12,9 6,15"/>
        </svg>
      </button>
      <button
        type="button"
        className="med-btn-move"
        title="Descendre"
        disabled={index === length - 1}
        onClick={() => onMove(index, index + 1)}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: 12, height: 12 }}>
          <polyline points="6,9 12,15 18,9"/>
        </svg>
      </button>
    </div>
  )
}

function moveItem(arr, from, to) {
  if (to < 0 || to >= arr.length) return arr
  const next = [...arr]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

// ── Doctor letterhead ─────────────────────────────────────────────────────────
function DoctorLetterhead({ profile, createdAt, fallbackEmail }) {
  const p = profile || {}
  const parts = [p.first_name, p.last_name].filter(Boolean)
  const email = p.email || fallbackEmail || null
  const hasAnything = parts.length || email || p.specialty || p.specialite

  if (!hasAnything) return null

  const name = parts.length
    ? `Dr ${parts.join(' ')}`
    : email ? `Dr ${email.split('@')[0]}` : null
  const city = p.city || p.ville || null
  const dateStr = formatDate(createdAt)

  return (
    <div className="med-letterhead">
      <div className="med-letterhead-left">
        {name && <div className="med-doctor-name">{name}</div>}
        <div className="med-doctor-info">
          {(p.specialty || p.specialite) && <div>{p.specialty || p.specialite}</div>}
          {(p.address || p.adresse) && <div>{p.address || p.adresse}</div>}
          {(p.phone || p.telephone) && <div>Tél : {p.phone || p.telephone}</div>}
          {email && <div>Email : {email}</div>}
          {(p.rpps || p.ordre) && (
            <div style={{ marginTop: 2, fontSize: '11px', color: '#555' }}>
              {p.rpps ? `RPPS : ${p.rpps}` : `N° Ordre : ${p.ordre}`}
            </div>
          )}
        </div>
      </div>
      <div className="med-letterhead-right">
        {city && <div>{city},</div>}
        <div>le {dateStr}</div>
      </div>
    </div>
  )
}

// ── Patient header block ──────────────────────────────────────────────────────
function PatientHeader({ report, data, editMode, onChange, doctorName, showEchogenicite, effectiveDate }) {
  const p = data?.patient || {}
  function sp(k, v) { onChange('patient', { ...p, [k]: v }) }

  return (
    <div style={{ borderBottom: '1px solid #000', paddingBottom: '8px', marginBottom: '12px' }}>
      {/* Row 1 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginBottom: '3px', alignItems: 'baseline' }}>
        <span>
          Nom et prénoms :{' '}
          {editMode
            ? <input className="med-input" style={{ width: '160px' }} value={report.patient_name || p.nom || ''} onChange={e => sp('nom', e.target.value)} />
            : <strong>{report.patient_name || p.nom || '___________________'}</strong>}
        </span>
        {(!isBlank(p.poids) || editMode) && (
          <span>Poids :{' '}<EF val={p.poids} onChange={v => sp('poids', v)} editMode={editMode} w="60px" />
            {!editMode && p.poids ? ' kgs' : ''}
          </span>
        )}
        {(!isBlank(p.taille) || editMode) && (
          <span>Taille :{' '}<EF val={p.taille} onChange={v => sp('taille', v)} editMode={editMode} w="60px" />
            {!editMode && p.taille ? ' m' : ''}
          </span>
        )}
      </div>

      {/* Row 2 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginBottom: '4px', alignItems: 'baseline' }}>
        <span>Adressé par :{' '}
          {editMode
            ? <input className="med-input" style={{ width: '180px' }}
                value={data?.referred_by ?? doctorName ?? ''}
                onChange={e => onChange('referred_by', e.target.value)} />
            : <strong>{data?.referred_by || doctorName || 'Dr ___________________'}</strong>}
        </span>
        {(!isBlank(p.age) || editMode) && (
          <span>Age :{' '}<EF val={p.age} onChange={v => sp('age', v)} editMode={editMode} w="50px" />
            {!editMode && p.age ? ' ans' : ''}
          </span>
        )}
        {(!isBlank(p.sexe) || editMode) && (
          <span>Sexe :{' '}<EF val={p.sexe} onChange={v => sp('sexe', v)} editMode={editMode} w="40px" /></span>
        )}
        {(!isBlank(p.sc) || editMode) && (
          <span>SC :{' '}<EF val={p.sc} onChange={v => sp('sc', v)} editMode={editMode} w="50px" /></span>
        )}
        <span>Date :{' '}
          {editMode
            ? <input type="date" className="med-input" style={{ width: '150px' }}
                value={isoToDateInput(effectiveDate)}
                onChange={e => onChange('report_date', dateInputToIso(e.target.value))} />
            : <strong>{formatDateShort(effectiveDate)}</strong>}
        </span>
      </div>

      {/* Indication */}
      {(!isBlank(data?.indication) || editMode) && (
        <div style={{ marginBottom: '4px' }}>
          Renseignements Cliniques :{' '}
          {editMode
            ? <textarea className="med-input" style={{ fontWeight: 700, width: '70%', marginLeft: 4, resize: 'vertical', verticalAlign: 'middle', minHeight: '34px' }}
                rows={2} value={data?.indication ?? ''} onChange={e => onChange('indication', e.target.value)} />
            : <strong>{data?.indication}</strong>}
        </div>
      )}

      {/* Echogénicité */}
      {showEchogenicite && (editMode || data?.echogenicite) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: editMode ? '24px' : '8px', marginTop: '2px' }}>
          <span style={{ textDecoration: 'underline' }}>Echogénicité{editMode ? '' : ' :'}</span>
          {editMode
            ? ['Bonne', 'Moyenne', 'Médiocre'].map(opt => (
                <span key={opt}
                  onClick={() => onChange('echogenicite', opt)}
                  style={{
                    fontWeight: data?.echogenicite === opt ? 700 : 400,
                    textDecoration: data?.echogenicite === opt ? 'underline' : 'none',
                    cursor: 'pointer',
                    padding: '0 8px',
                    borderRadius: data?.echogenicite === opt ? '3px' : '0',
                    background: data?.echogenicite === opt ? '#dbeafe' : 'none',
                  }}>
                  {opt}
                </span>
              ))
            : <strong>{data?.echogenicite}</strong>}
        </div>
      )}
    </div>
  )
}

// ── Cell item — standalone component (NOT nested) to avoid closure/remount bugs ─
// Each (label/prefix + value) atom is wrapped in `whiteSpace: nowrap` so the
// label and its value never split across two lines (e.g. "E/E' = 10" stays
// glued together, even on narrow viewports). The cell itself can still wrap
// between atoms.
function CellItem({ item, data, editMode, onSet }) {
  if (!item) return null

  if (item.composite) {
    const hasAny = item.items.some(ci => !isBlank(data?.[ci.key]))
    if (!editMode && !hasAny && !item.label) return null
    return (
      <span>
        {item.label
          ? <span style={{ whiteSpace: 'nowrap', marginRight: 8 }}>{item.label} :&nbsp;</span>
          : null}
        {item.items.map((ci, i) => {
          const v = data?.[ci.key]
          if (!editMode && isBlank(v)) return null
          // Strip leading whitespace separators from prefixes — we use
          // marginRight on each atom for spacing instead.
          const prefix = (ci.prefix || '').replace(/^\s+/, '')
          return (
            <span key={i} style={{ display: 'inline-block', whiteSpace: 'nowrap', marginRight: 10 }}>
              {prefix}
              {editMode
                ? <input className="med-input" style={{ width: '72px' }} value={v ?? ''}
                    onChange={e => onSet(ci.key, e.target.value)} />
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
    <span style={{ whiteSpace: 'nowrap' }}>
      {item.label ? `${item.label} :  ` : ''}
      {editMode
        ? <input className="med-input" style={{ width: '92px' }} value={v ?? ''}
            onChange={e => onSet(item.key, e.target.value)} />
        : isBlank(v) ? '' : <>
            <strong>{v}</strong>
            {item.suffix ? <span>{item.suffix}</span> : null}
          </>}
    </span>
  )
}

// ── Measurements table (4 columns, print-safe) ────────────────────────────────
function MeasurementsTable({ section, data, editMode, onChange }) {
  const rows = section.rows || []
  const safeData = data || {}
  function onSet(k, v) { onChange({ ...safeData, [k]: v }) }

  // Keys explicitly covered by defined rows
  const coveredKeys = new Set(
    rows.flatMap(row => row.flatMap(item => {
      if (!item) return []
      if (item.composite) return item.items.map(ci => ci.key)
      return [item.key]
    }))
  )

  // Any key in data not covered → show as extra rows so no value is lost
  const orphanPairs = []
  const orphanEntries = Object.entries(safeData).filter(([k, v]) => !coveredKeys.has(k) && !isBlank(v))
  for (let i = 0; i < orphanEntries.length; i += 2) {
    orphanPairs.push([orphanEntries[i], orphanEntries[i + 1] || null])
  }

  return (
    <div className="med-table-wrap">
      <table className="med-measurements-table">
        <thead>
          <tr>
            <th className="med-td-param">Paramètres mesurés</th>
            <th className="med-td-norm">Normes adultes</th>
            <th className="med-td-param">Paramètres mesurés</th>
            <th className="med-td-norm">Normes adultes</th>
          </tr>
        </thead>
        <tbody>
          {/* Defined layout rows */}
          {rows.map((row, ri) => {
            const [left, right] = row
            return (
              <tr key={ri}>
                <td className="med-td-param">
                  <CellItem item={left} data={safeData} editMode={editMode} onSet={onSet} />
                </td>
                <td className="med-td-norm">{left?.normal || ''}</td>
                <td className="med-td-param">
                  <CellItem item={right} data={safeData} editMode={editMode} onSet={onSet} />
                </td>
                <td className="med-td-norm">{right?.normal || ''}</td>
              </tr>
            )
          })}
          {/* Orphan rows: keys from backend not in defined layout */}
          {orphanPairs.map(([left, right], ri) => (
            <tr key={`orphan-${ri}`}>
              <td className="med-td-param">
                {left && <span>{hl(left[0])} :  <strong>{left[1]}</strong></span>}
              </td>
              <td className="med-td-norm" />
              <td className="med-td-param">
                {right && <span>{hl(right[0])} :  <strong>{right[1]}</strong></span>}
              </td>
              <td className="med-td-norm" />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Section header ────────────────────────────────────────────────────────────
function SecHeader({ num, label, subtitle }) {
  return (
    <div className="med-section-header">
      {num}.{' '}
      <span className="underline" style={{ textDecoration: 'underline' }}>{label}</span>
      {subtitle
        ? <span style={{ fontWeight: 400 }}> : {subtitle}</span>
        : ' :'}
    </div>
  )
}

// ── section_list ──────────────────────────────────────────────────────────────
function SectionList({ num, section, items, editMode, onChange }) {
  const arr = Array.isArray(items) ? items : (items && !isBlank(items) ? [String(items)] : [])
  if (isBlank(arr) && !editMode) return null
  return (
    <div className="med-section">
      <SecHeader num={num} label={section.label} subtitle={section.subtitle} />
      <div className="med-bullets">
        {arr.map((item, i) => (
          <div key={i} className="med-bullet">
            {editMode ? (
              <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                <span style={{ paddingTop: 6 }}>-&nbsp;</span>
                <textarea className="med-input med-input-light" style={{ flex: 1, minWidth: 0, resize: 'vertical', minHeight: '38px', fontWeight: 400 }}
                  rows={2} value={item}
                  onChange={e => { const a = [...arr]; a[i] = e.target.value; onChange(a) }} />
                <ReorderControls index={i} length={arr.length} onMove={(from, to) => onChange(moveItem(arr, from, to))} />
                <button className="med-btn-remove" title="Supprimer" onClick={() => onChange(arr.filter((_, j) => j !== i))}>✕</button>
              </div>
            ) : <span>- {item}</span>}
          </div>
        ))}
        {editMode && <button className="med-btn-add" onClick={() => onChange([...arr, ''])}>+ Ajouter</button>}
      </div>
    </div>
  )
}

// Reorder dict keys by rebuilding the object — JS preserves string-key
// insertion order, which is the order Object.entries (and our renderer) uses.
function reorderDictKeys(data, fromIdx, toIdx) {
  const entries = Object.entries(data || {})
  if (toIdx < 0 || toIdx >= entries.length) return data
  const [item] = entries.splice(fromIdx, 1)
  entries.splice(toIdx, 0, item)
  return Object.fromEntries(entries)
}

// ── section_dict ──────────────────────────────────────────────────────────────
function SectionDict({ num, section, data, editMode, onChange }) {
  if (isBlank(data) && !editMode) return null
  let entries = Object.entries(data || {}).filter(([, v]) => !isBlank(v) || editMode)
  if (!entries.length && !editMode) return null
  // Enforce canonical key order at render time — sections that declare
  // `keyOrder` (e.g. doppler: mitrale → aorte → pulmonaire → tricuspide)
  // are ALWAYS displayed in that order, regardless of what the LLM emitted
  // or how the keys are arranged in the saved JSON.
  if (Array.isArray(section.keyOrder) && section.keyOrder.length) {
    const orderIdx = (k) => {
      const i = section.keyOrder.indexOf(k)
      return i === -1 ? Number.MAX_SAFE_INTEGER : i
    }
    entries = [...entries].sort((a, b) => orderIdx(a[0]) - orderIdx(b[0]))
  }
  function set(k, v) { onChange({ ...(data || {}), [k]: v }) }
  function removeKey(k) {
    const next = { ...(data || {}) }
    delete next[k]
    onChange(next)
  }

  function renderVal(key, val) {
    if (Array.isArray(val)) {
      if (isBlank(val) && !editMode) return null
      return (
        <div>
          <div style={{ marginLeft: 20 }}>- <strong>{hl(key)} :</strong></div>
          {val.map((v, i) => (
            <div key={i} style={{ marginLeft: 40 }}>
              {editMode ? (
                <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                  <span style={{ paddingTop: 6 }}>-&nbsp;</span>
                  <textarea className="med-input med-input-light" style={{ flex: 1, minWidth: 0, resize: 'vertical', minHeight: '34px', fontWeight: 400 }}
                    rows={1} value={v ?? ''}
                    onChange={e => { const a = [...val]; a[i] = e.target.value; set(key, a) }} />
                  <ReorderControls index={i} length={val.length} onMove={(from, to) => set(key, moveItem(val, from, to))} />
                  <button className="med-btn-remove" title="Supprimer" onClick={() => set(key, val.filter((_, j) => j !== i))}>✕</button>
                </div>
              ) : <span>- {v}</span>}
            </div>
          ))}
          {editMode && (
            <button className="med-btn-add" style={{ marginLeft: 40 }} onClick={() => set(key, [...val, ''])}>
              + Ajouter
            </button>
          )}
        </div>
      )
    }
    if (typeof val === 'object' && val !== null) {
      const sub = Object.entries(val).filter(([, v]) => !isBlank(v) || editMode)
      if (!sub.length && !editMode) return null
      return (
        <div>
          <div style={{ marginLeft: 20 }}>- <strong>{hl(key)} :</strong></div>
          {sub.map(([k, v]) => (
            <div key={k} style={{ marginLeft: 40, display: 'flex', alignItems: 'center', gap: 6, marginBottom: editMode ? 4 : 0, flexWrap: 'wrap' }}>
              <span style={{ flexShrink: 0 }}>- {hl(k)} :</span>
              {editMode
                ? <input className="med-input med-input-light" style={{ flex: 1, minWidth: '140px' }} value={v ?? ''} onChange={e => set(key, { ...val, [k]: e.target.value })} />
                : <span>{v}</span>}
            </div>
          ))}
        </div>
      )
    }
    return (
      <div style={{ marginLeft: 20, display: 'flex', alignItems: 'center', gap: 6, marginBottom: editMode ? 4 : 0, flexWrap: 'wrap' }}>
        <span style={{ flexShrink: 0 }}>- <strong>{hl(key)} :</strong></span>
        {editMode
          ? <input className="med-input med-input-light" style={{ flex: 1, minWidth: '200px' }} value={val ?? ''} onChange={e => set(key, e.target.value)} />
          : <span>{val}</span>}
      </div>
    )
  }

  return (
    <div className="med-section">
      <SecHeader num={num} label={section.label} />
      {entries.map(([k, v], idx) => (
        <div key={k} style={editMode ? { display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 4 } : undefined}>
          <div style={editMode ? { flex: 1, minWidth: 0 } : undefined}>{renderVal(k, v)}</div>
          {editMode && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4, paddingTop: 2, flexShrink: 0 }}>
              {!section.keyOrder && (
                <ReorderControls
                  index={idx}
                  length={entries.length}
                  onMove={(from, to) => onChange(reorderDictKeys(data, from, to))}
                />
              )}
              <button className="med-btn-remove" title="Supprimer" onClick={() => removeKey(k)}>✕</button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── section_conclusion ────────────────────────────────────────────────────────
function SectionConclusion({ num, section, value, editMode, onChange }) {
  const items = Array.isArray(value) ? value : (value && !isBlank(value) ? [String(value)] : [])
  if (isBlank(items) && !editMode) return null
  return (
    <div className="med-section">
      <SecHeader num={num} label={section.label} />
      <div className="med-bullets">
        {items.map((item, i) => (
          <div key={i} className="med-bullet-conclusion">
            {editMode ? (
              <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                <span style={{ paddingTop: 6 }}>•&nbsp;</span>
                <textarea className="med-input" style={{ flex: 1, minWidth: 0, resize: 'vertical', minHeight: '48px', fontStyle: 'italic', fontWeight: 700 }}
                  rows={2} value={item}
                  onChange={e => { const a = [...items]; a[i] = e.target.value; onChange(a) }} />
                <ReorderControls index={i} length={items.length} onMove={(from, to) => onChange(moveItem(items, from, to))} />
                <button className="med-btn-remove" title="Supprimer" onClick={() => onChange(items.filter((_, j) => j !== i))}>✕</button>
              </div>
            ) : <span>• {item}</span>}
          </div>
        ))}
        {editMode && <button className="med-btn-add" onClick={() => onChange([...items, ''])}>+ Ajouter</button>}
      </div>
    </div>
  )
}

// ── section_text ──────────────────────────────────────────────────────────────
function SectionText({ num, section, value, editMode, onChange }) {
  if (isBlank(value) && !editMode) return null
  const lineCount = typeof value === 'string' ? Math.max(2, value.split('\n').length) : 2
  return (
    <div className="med-section">
      <SecHeader num={num} label={section.label} />
      <div style={{ marginLeft: 20, whiteSpace: 'pre-wrap' }}>
        {editMode
          ? <textarea className="med-input med-input-light" style={{ width: '100%', minHeight: '60px', resize: 'vertical', fontWeight: 400 }} rows={lineCount} value={value ?? ''} onChange={e => onChange(e.target.value)} />
          : value}
      </div>
    </div>
  )
}

// ── section_biology ───────────────────────────────────────────────────────────
function SectionBiology({ num, section, data, editMode, onChange }) {
  const visibleRows = (section.rows || []).filter(r => !isBlank(data?.[r.key]) || editMode)
  if (!visibleRows.length && !editMode) return null
  function set(k, v) { onChange({ ...(data || {}), [k]: v }) }
  return (
    <div className="med-section">
      <SecHeader num={num} label={section.label} />
      <table style={{ marginLeft: 20, borderCollapse: 'collapse', fontSize: 'inherit', width: 'calc(100% - 20px)' }}>
        <tbody>
          {visibleRows.map(row => {
            const v = data?.[row.key]
            return (
              <tr key={row.key}>
                <td style={{ padding: '2px 12px 2px 0', whiteSpace: 'nowrap', width: '38%' }}>- {row.label} :</td>
                <td style={{ padding: '2px 12px 2px 0', width: '28%' }}>
                  {editMode
                    ? <input className="med-input" style={{ width: '100px' }} value={v ?? ''} onChange={e => set(row.key, e.target.value)} />
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

// ── Medical document orchestrator ─────────────────────────────────────────────
function MedicalDocument({ report, data, editMode, onChange, profile, userEmail }) {
  const examType = getExamType(report.exam_type)
  const safeData = data || {}
  const layout = examType.layout || []

  // Doctor display name — fallback chain: profile name → profile email → user email → placeholder
  const parts = [profile?.first_name, profile?.last_name].filter(Boolean)
  const resolvedEmail = profile?.email || userEmail || null
  const doctorName = parts.length
    ? `Dr ${parts.join(' ')}`
    : resolvedEmail ? `Dr ${resolvedEmail.split('@')[0]}` : ''

  function set(key, val) { onChange({ ...safeData, [key]: val }) }

  // Keys handled by the patient block / signature block (never shown as extra)
  const PATIENT_KEYS = new Set(['patient', 'indication', 'echogenicite', 'qualite_technique', 'referred_by', 'signature', 'report_date'])

  // Effective document date — the user-edited override wins over the
  // server-side created_at so retro-dated reports are supported.
  const effectiveDate = safeData.report_date || report.created_at
  // Keys covered by the layout
  const layoutDataKeys = new Set(layout.map(s => s.dataKey))

  let secNum = 0
  const RENDERERS = {
    measurements_table: (s, i) => (
      <MeasurementsTable key={i} section={s}
        data={safeData[s.dataKey]} editMode={editMode}
        onChange={v => set(s.dataKey, v)} />
    ),
    section_list: (s, i) => { secNum++; return <SectionList key={i} num={secNum} section={s} items={safeData[s.dataKey]} editMode={editMode} onChange={v => set(s.dataKey, v)} /> },
    section_dict: (s, i) => { secNum++; return <SectionDict key={i} num={secNum} section={s} data={safeData[s.dataKey]} editMode={editMode} onChange={v => set(s.dataKey, v)} /> },
    section_conclusion: (s, i) => { secNum++; return <SectionConclusion key={i} num={secNum} section={s} value={safeData[s.dataKey]} editMode={editMode} onChange={v => set(s.dataKey, v)} /> },
    section_text: (s, i) => { secNum++; return <SectionText key={i} num={secNum} section={s} value={safeData[s.dataKey]} editMode={editMode} onChange={v => set(s.dataKey, v)} /> },
    section_biology: (s, i) => { secNum++; return <SectionBiology key={i} num={secNum} section={s} data={safeData[s.dataKey]} editMode={editMode} onChange={v => set(s.dataKey, v)} /> },
  }

  return (
    <div id="print-area" className="med-doc">

      {/* ── Doctor letterhead ── */}
      <DoctorLetterhead profile={profile} createdAt={effectiveDate} fallbackEmail={userEmail} />

      {/* ── Exam title ── */}
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
        effectiveDate={effectiveDate}
      />

      {/* ── Dynamic layout sections ── */}
      {layout.map((section, i) => {
        const renderer = RENDERERS[section.type]
        return renderer ? renderer(section, i) : null
      })}

      {/* ── Fallback: show any top-level data keys not covered by layout ── */}
      {(() => {
        const extras = Object.entries(safeData).filter(([k, v]) =>
          !PATIENT_KEYS.has(k) && !layoutDataKeys.has(k) && !isBlank(v)
        )
        if (!extras.length) return null
        secNum++
        return (
          <div className="med-section" key="extras">
            <div className="med-section-header">
              {secNum}.{' '}
              <span style={{ textDecoration: 'underline' }}>DONNÉES COMPLÉMENTAIRES</span> :
            </div>
            {extras.map(([k, v]) => (
              <div key={k} style={{ marginLeft: 20, marginBottom: 2 }}>
                {typeof v === 'object' && !Array.isArray(v)
                  ? Object.entries(v || {}).filter(([, sv]) => !isBlank(sv)).map(([sk, sv]) => (
                      <div key={sk}>- <strong>{hl(k)} / {hl(sk)} :</strong> <strong>{String(sv)}</strong></div>
                    ))
                  : Array.isArray(v)
                  ? v.filter(x => !isBlank(x)).map((x, i) => <div key={i}>- <strong>{hl(k)} :</strong> {x}</div>)
                  : <div>- <strong>{hl(k)} :</strong> <strong>{String(v)}</strong></div>
                }
              </div>
            ))}
          </div>
        )
      })()}

      {/* ── Signature (editable) ── */}
      {(() => {
        const defaultSignature = [
          doctorName || 'Dr ___________________',
          profile?.specialty || profile?.specialite || null,
          profile?.rpps ? `RPPS : ${profile.rpps}` : (profile?.ordre ? `N° Ordre : ${profile.ordre}` : null)
        ].filter(Boolean).join('\n')
        const sigVal = (typeof safeData.signature === 'string')
          ? safeData.signature
          : defaultSignature
        return (
          <div style={{ marginTop: 40, display: 'flex', justifyContent: 'flex-end' }}>
            <div style={{ textAlign: 'center', minWidth: 220 }}>
              <div style={{ height: 48, borderBottom: '1px solid #000', marginBottom: 6 }} />
              {editMode ? (
                <textarea
                  className="med-input"
                  style={{ width: '100%', textAlign: 'center', fontWeight: 700, fontSize: '13px', resize: 'vertical', minHeight: '64px', lineHeight: 1.4 }}
                  rows={3}
                  value={sigVal}
                  onChange={e => set('signature', e.target.value)}
                />
              ) : (
                <div style={{ whiteSpace: 'pre-line', fontWeight: 700, fontSize: '13px', lineHeight: 1.4 }}>
                  {sigVal}
                </div>
              )}
              <div style={{ fontSize: '11px', color: '#888', marginTop: 4 }}>
                Signature &amp; Cachet
              </div>
            </div>
          </div>
        )
      })()}

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
      .then(d => {
        setReport(d)
        // structured may arrive as a JSON string from some backends
        const raw = d.structured
        let parsed = {}
        if (raw && typeof raw === 'string') {
          try { parsed = JSON.parse(raw) } catch { parsed = {} }
        } else if (raw && typeof raw === 'object') {
          parsed = raw
        }
        // Backwards-compat: legacy reports stored the right-atrium volume
        // under "vtd_ml" (a misnomer carried over from VTD). The cardiac
        // layout now uses "vod_ml". Alias old data forward so the value
        // shows up under the new key without losing the original.
        if (parsed?.mesures && typeof parsed.mesures === 'object') {
          if (parsed.mesures.vtd_ml != null && parsed.mesures.vod_ml == null) {
            parsed.mesures.vod_ml = parsed.mesures.vtd_ml
            delete parsed.mesures.vtd_ml
          }
        }
        setEditData(parsed)
      })
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
    try { await deleteReport(id); navigate('/') } catch { /* noop */ }
  }

  function toggleTranscript() {
    setShowTranscript(s => {
      const next = !s
      if (next) {
        // Defer the scroll so the panel is in the DOM before we measure it
        setTimeout(() => {
          document.getElementById('doc-transcript-panel')
            ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }, 60)
      }
      return next
    })
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
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {report.patient_name || 'Rapport'}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{getExamType(report.exam_type).name}</div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
          {!editMode ? (
            <>
              {report.transcript && (
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={toggleTranscript}
                  title="Voir la transcription brute"
                  aria-pressed={showTranscript}
                  style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 15, height: 15 }}>
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                    <line x1="12" y1="19" x2="12" y2="23"/>
                    <line x1="8" y1="23" x2="16" y2="23"/>
                  </svg>
                  <span>Audio</span>
                </button>
              )}
              <button className="btn btn-secondary btn-sm" onClick={() => setEditMode(true)}>✏️</button>
              <button className="btn btn-primary btn-sm" onClick={() => window.print()}>🖨️ PDF</button>
              <button onClick={handleDelete} className="btn-icon-danger" style={{ padding: '6px 8px' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16 }}>
                  <polyline points="3,6 5,6 21,6"/><path d="M19,6l-1,14H6L5,6"/><path d="M9,6V4h6v2"/>
                </svg>
              </button>
            </>
          ) : (
            <>
              <button className="btn btn-secondary btn-sm" onClick={() => { setEditData(report.structured || {}); setEditMode(false) }}>Annuler</button>
              <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
                {saving ? '…' : '💾 Enregistrer'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Document ── */}
      <div className="report-content" style={{ background: '#e8edf4' }}>
        <MedicalDocument
          report={report}
          data={editData}
          editMode={editMode}
          onChange={setEditData}
          profile={user?.profile || null}
          userEmail={user?.email || null}
        />

        {report.transcript && (
          <div id="doc-transcript-panel" className="doc-transcript-wrap no-print">
            <button onClick={toggleTranscript} className="doc-transcript-toggle" aria-expanded={showTranscript}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}>
                <polyline points={showTranscript ? '18,15 12,9 6,15' : '6,9 12,15 18,9'}/>
              </svg>
              <strong style={{ color: 'var(--text-primary)' }}>
                {showTranscript ? 'Masquer' : 'Afficher'} la transcription
              </strong>
              <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>
                — texte brut de la dictée
              </span>
            </button>
            {showTranscript && (
              <div className="doc-transcript-body">
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  gap: 12, marginBottom: 10, paddingBottom: 8,
                  borderBottom: '1px solid var(--border-color, #e2e8f0)'
                }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Transcription brute
                  </div>
                  <button
                    onClick={() => navigator.clipboard?.writeText(report.transcript).catch(() => {})}
                    className="btn btn-secondary btn-sm"
                    title="Copier la transcription"
                    style={{ fontSize: '0.72rem', padding: '4px 10px' }}
                  >
                    Copier
                  </button>
                </div>
                <div style={{ whiteSpace: 'pre-wrap' }}>{report.transcript}</div>
              </div>
            )}
          </div>
        )}
        <div style={{ height: 48 }} />
      </div>
    </div>
  )
}
