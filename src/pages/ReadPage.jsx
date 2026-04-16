import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { EXAM_TYPE_LIST } from '../data/examTypes.js'
import { transcribeAudio, structureExam, saveReport, getPatients, createPatient } from '../services/api.js'
import { enqueuePending } from '../services/pendingQueue.js'
import { useAuth } from '../context/AuthContext.jsx'

const STEP = {
  SETUP:        'setup',
  READY:        'ready',
  RECORDING:    'recording',
  TRANSCRIBING: 'transcribing',
  STRUCTURING:  'structuring',
  SAVING:       'saving',
  DONE:         'done',
  QUEUED:       'queued',  // saved locally, will retry
  ERROR:        'error'
}

export default function ReadPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const dropdownRef = useRef(null)
  const searchTimeoutRef = useRef(null)

  const [step, setStep] = useState(STEP.SETUP)
  const [selectedType, setSelectedType] = useState(null)
  const [indication, setIndication] = useState('')
  const [error, setError] = useState(null)
  const [duration, setDuration] = useState(0)
  const [reportId, setReportId] = useState(null)

  // Patient search
  const [patientQuery, setPatientQuery] = useState('')
  const [selectedPatient, setSelectedPatient] = useState(null)
  const [patients, setPatients] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [showNewPatientForm, setShowNewPatientForm] = useState(false)
  const [newPatient, setNewPatient] = useState({ first_name: '', last_name: '', date_of_birth: '', sex: '' })
  const [creatingPatient, setCreatingPatient] = useState(false)

  const mediaRecorderRef = useRef(null)
  const audioChunksRef   = useRef([])
  const streamRef        = useRef(null)
  const timerRef         = useRef(null)

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    return () => {
      clearInterval(timerRef.current)
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [])

  const searchPatientsApi = useCallback(async (query) => {
    if (!query || query.length < 2) { setPatients([]); return }
    setIsSearching(true)
    try {
      const res = await getPatients(query, 5)
      setPatients(res.patients || res || [])
    } catch {
      setPatients([])
    } finally {
      setIsSearching(false)
    }
  }, [])

  function handlePatientQueryChange(e) {
    const query = e.target.value
    setPatientQuery(query)
    setSelectedPatient(null)
    setShowDropdown(true)
    clearTimeout(searchTimeoutRef.current)
    searchTimeoutRef.current = setTimeout(() => searchPatientsApi(query), 300)
  }

  function selectPatient(p) {
    setSelectedPatient(p)
    setPatientQuery(`${p.first_name} ${p.last_name}`)
    setShowDropdown(false)
    setShowNewPatientForm(false)
  }

  async function handleCreatePatient() {
    if (!newPatient.first_name || !newPatient.last_name) return
    setCreatingPatient(true)
    try {
      const created = await createPatient(newPatient)
      selectPatient(created)
      setNewPatient({ first_name: '', last_name: '', date_of_birth: '', sex: '' })
    } catch (err) {
      setError(err.message)
    } finally {
      setCreatingPatient(false)
    }
  }

  function formatDuration(s) {
    const m = Math.floor(s / 60), sec = s % 60
    return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      audioChunksRef.current = []
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
      const recorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = recorder
      recorder.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
      recorder.start(1000)
      setDuration(0)
      setStep(STEP.RECORDING)
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000)
    } catch (err) {
      setError('Impossible d\'accéder au microphone: ' + err.message)
      setStep(STEP.ERROR)
    }
  }

  async function stopRecording() {
    clearInterval(timerRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    const recorder = mediaRecorderRef.current
    if (!recorder || recorder.state === 'inactive') return
    await new Promise(resolve => { recorder.onstop = resolve; recorder.stop() })
    const blob = new Blob(audioChunksRef.current, { type: audioChunksRef.current[0]?.type || 'audio/webm' })
    await processAudio(blob)
  }

  async function processAudio(blob) {
    const patientName = selectedPatient
      ? `${selectedPatient.first_name} ${selectedPatient.last_name}`
      : patientQuery || null

    const meta = {
      examTypeId:  selectedType.id,
      patientName,
      patientId:   selectedPatient?.id || null,
      indication:  indication || null,
      userId:      user?.id
    }

    // If offline, queue immediately without trying
    if (!navigator.onLine) {
      await enqueuePending(blob, meta)
      setStep(STEP.QUEUED)
      return
    }

    try {
      setStep(STEP.TRANSCRIBING)
      const { text } = await transcribeAudio(blob)

      setStep(STEP.STRUCTURING)
      const { structured } = await structureExam(text, selectedType.id)

      setStep(STEP.SAVING)
      const report = await saveReport({
        exam_type:    selectedType.id,
        patient_name: patientName,
        patient_id:   selectedPatient?.id || null,
        indication:   indication || null,
        transcript:   text,
        structured,
        user_id:      user?.id
      })
      setReportId(report.id)
      setStep(STEP.DONE)
    } catch (err) {
      // Save locally and retry later instead of losing the recording
      try {
        await enqueuePending(blob, meta)
        setStep(STEP.QUEUED)
      } catch {
        setError(err.message)
        setStep(STEP.ERROR)
      }
    }
  }

  // ── QUEUED ───────────────────────────────────────────────────────────────────
  if (step === STEP.QUEUED) {
    return (
      <div className="page" style={{ justifyContent: 'center', padding: 24 }}>
        <div className="animate-fade-in" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3.5rem', marginBottom: 16 }}>📥</div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 8 }}>
            Enregistrement sauvegardé
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 8, fontSize: '0.9rem' }}>
            L'audio a été enregistré localement.
          </p>
          <p style={{ color: 'var(--text-muted)', marginBottom: 32, fontSize: '0.82rem' }}>
            Le traitement reprendra automatiquement dès que la connexion sera rétablie.
          </p>
          <button className="btn btn-primary" style={{ marginBottom: 12 }}
            onClick={() => navigate('/')}>
            Retour à l'accueil
          </button>
          <button className="btn btn-secondary"
            onClick={() => { setStep(STEP.SETUP) }}>
            Nouveau rapport
          </button>
        </div>
      </div>
    )
  }

  // ── DONE ────────────────────────────────────────────────────────────────────
  if (step === STEP.DONE) {
    return (
      <div className="page" style={{ justifyContent: 'center', padding: 24 }}>
        <div className="animate-fade-in" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '4rem', marginBottom: 16 }}>✅</div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: 8 }}>Rapport créé</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 32 }}>
            {selectedType?.name} — {selectedPatient
              ? `${selectedPatient.first_name} ${selectedPatient.last_name}`
              : patientQuery || 'Patient'}
          </p>
          <button className="btn btn-primary" style={{ marginBottom: 12 }}
            onClick={() => navigate(`/report/${reportId}`)}>
            Voir le rapport
          </button>
          <button className="btn btn-secondary" onClick={() => navigate('/')}>
            Retour à l'accueil
          </button>
        </div>
      </div>
    )
  }

  // ── PROCESSING ──────────────────────────────────────────────────────────────
  if ([STEP.TRANSCRIBING, STEP.STRUCTURING, STEP.SAVING].includes(step)) {
    const steps = [
      { id: STEP.TRANSCRIBING, label: 'Transcription audio…',      icon: '🎙️' },
      { id: STEP.STRUCTURING,  label: 'Structuration du rapport…', icon: '🧠' },
      { id: STEP.SAVING,       label: 'Sauvegarde…',               icon: '💾' }
    ]
    const currentIdx = steps.findIndex(s => s.id === step)
    return (
      <div className="page" style={{ justifyContent: 'center', padding: 24 }}>
        <div className="animate-fade-in" style={{ width: '100%', maxWidth: 360, margin: '0 auto' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 24, textAlign: 'center' }}>
            Traitement en cours…
          </h2>
          <div className="steps-list">
            {steps.map((s, i) => (
              <div key={s.id} className={`step-row ${i < currentIdx ? 'done' : i === currentIdx ? 'active' : 'pending'}`}>
                <span className="step-dot">
                  {i < currentIdx
                    ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ width: 14, height: 14 }}><polyline points="20,6 9,17 4,12"/></svg>
                    : i === currentIdx
                    ? <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                    : null}
                </span>
                <span>{s.icon} {s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ── ERROR ────────────────────────────────────────────────────────────────────
  if (step === STEP.ERROR) {
    return (
      <div className="page" style={{ justifyContent: 'center', padding: 24 }}>
        <div className="animate-fade-in" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: 16 }}>❌</div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 8 }}>Erreur</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 32, fontSize: '0.9rem' }}>{error}</p>
          <button className="btn btn-primary" onClick={() => { setStep(STEP.SETUP); setError(null) }}>
            Réessayer
          </button>
        </div>
      </div>
    )
  }

  // ── MAIN FORM ────────────────────────────────────────────────────────────────
  return (
    <div className="page">
      <header className="page-header no-print">
        <button className="btn-back" onClick={() => navigate('/')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 18, height: 18 }}>
            <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12,19 5,12 12,5"/>
          </svg>
        </button>
        <h1 className="page-title">
          {step === STEP.SETUP ? 'Nouveau rapport'
           : step === STEP.READY ? selectedType?.name
           : 'Enregistrement'}
        </h1>
      </header>

      <div className="page-content">

        {/* ── SETUP ── */}
        {step === STEP.SETUP && (
          <div className="animate-fade-in">

            {/* Patient search */}
            <div className="patient-search" ref={dropdownRef}>
              <label className="search-label">
                Patient <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optionnel)</span>
              </label>

              {selectedPatient ? (
                <div className="selected-patient-pill">
                  <div className="selected-patient-avatar">
                    {selectedPatient.first_name[0]}{selectedPatient.last_name[0]}
                  </div>
                  <div className="selected-patient-info">
                    <span className="selected-patient-name">
                      {selectedPatient.first_name} {selectedPatient.last_name}
                    </span>
                    {selectedPatient.date_of_birth && (
                      <span className="selected-patient-dob">
                        {new Date(selectedPatient.date_of_birth).toLocaleDateString('fr-FR')}
                      </span>
                    )}
                  </div>
                  <button className="selected-patient-clear" onClick={() => {
                    setSelectedPatient(null); setPatientQuery(''); setPatients([])
                  }}>✕</button>
                </div>
              ) : (
                <div className="search-input-wrapper">
                  <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                  <input
                    type="text"
                    className="search-input"
                    value={patientQuery}
                    onChange={handlePatientQueryChange}
                    onFocus={() => setShowDropdown(true)}
                    placeholder="Rechercher ou créer un patient…"
                  />
                  {isSearching && <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2, position: 'absolute', right: 12 }} />}
                </div>
              )}

              {/* Dropdown */}
              {showDropdown && !selectedPatient && (
                <div className="patient-dropdown">
                  {patients.map(p => (
                    <div key={p.id} className="dropdown-item" onClick={() => selectPatient(p)}>
                      <div className="dropdown-avatar">
                        {p.first_name[0]}{p.last_name[0]}
                      </div>
                      <div className="dropdown-info">
                        <span className="dropdown-name">{p.first_name} {p.last_name}</span>
                        {p.date_of_birth && (
                          <span className="dropdown-dob">
                            {new Date(p.date_of_birth).toLocaleDateString('fr-FR')}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}

                  {patientQuery && patients.length === 0 && !isSearching && (
                    <div className="dropdown-empty">Aucun patient trouvé</div>
                  )}

                  {/* Create new patient option */}
                  {!showNewPatientForm && (
                    <div className="dropdown-create" onClick={() => setShowNewPatientForm(true)}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16 }}>
                        <circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 1 0-16 0"/>
                        <line x1="19" y1="8" x2="23" y2="8"/><line x1="21" y1="6" x2="21" y2="10"/>
                      </svg>
                      Créer un nouveau patient
                    </div>
                  )}

                  {/* Inline new patient form */}
                  {showNewPatientForm && (
                    <div className="new-patient-form">
                      <div className="new-patient-form-title">Nouveau patient</div>
                      <div className="form-row">
                        <input
                          className="form-input-half"
                          placeholder="Prénom *"
                          value={newPatient.first_name}
                          onChange={e => setNewPatient(p => ({ ...p, first_name: e.target.value }))}
                        />
                        <input
                          className="form-input-half"
                          placeholder="Nom *"
                          value={newPatient.last_name}
                          onChange={e => setNewPatient(p => ({ ...p, last_name: e.target.value }))}
                        />
                      </div>
                      <div className="form-row">
                        <input
                          className="form-input-half"
                          type="date"
                          placeholder="Date de naissance"
                          value={newPatient.date_of_birth}
                          onChange={e => setNewPatient(p => ({ ...p, date_of_birth: e.target.value }))}
                        />
                        <select
                          className="form-input-half"
                          value={newPatient.sex}
                          onChange={e => setNewPatient(p => ({ ...p, sex: e.target.value }))}
                        >
                          <option value="">Sexe</option>
                          <option value="M">Masculin</option>
                          <option value="F">Féminin</option>
                        </select>
                      </div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={handleCreatePatient}
                          disabled={creatingPatient || !newPatient.first_name || !newPatient.last_name}
                        >
                          {creatingPatient ? 'Création…' : 'Créer'}
                        </button>
                        <button className="btn btn-secondary btn-sm" onClick={() => setShowNewPatientForm(false)}>
                          Annuler
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Indication */}
            <div className="form-group" style={{ marginTop: 20 }}>
              <label className="form-label">Indication clinique</label>
              <textarea
                className="form-textarea"
                placeholder="Ex : HTA, suivi post-op, douleur thoracique…"
                value={indication}
                onChange={e => setIndication(e.target.value)}
                rows={2}
              />
            </div>

            {/* Exam type */}
            <label className="form-label" style={{ display: 'block', margin: '20px 0 10px' }}>
              Type d'examen <span style={{ color: 'var(--heart-red)' }}>*</span>
            </label>
            <div className="exam-grid">
              {EXAM_TYPE_LIST.map(type => (
                <button
                  key={type.id}
                  className={`exam-card ${selectedType?.id === type.id ? 'selected' : ''}`}
                  onClick={() => setSelectedType(type)}
                  style={selectedType?.id === type.id ? { borderColor: type.color, background: `${type.color}15` } : {}}
                >
                  <span className="exam-card-icon">{type.icon}</span>
                  <span className="exam-card-name">{type.shortName}</span>
                  <span className="exam-card-desc">{type.description}</span>
                </button>
              ))}
            </div>

            {selectedType && (
              <button className="btn btn-primary" style={{ marginTop: 24 }} onClick={() => setStep(STEP.READY)}>
                Continuer
              </button>
            )}
          </div>
        )}

        {/* ── READY ── */}
        {step === STEP.READY && (
          <div className="animate-fade-in">
            <div className="card" style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: '2rem' }}>{selectedType.icon}</span>
              <div>
                <div style={{ fontWeight: 600 }}>{selectedType.name}</div>
                {selectedPatient && (
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    {selectedPatient.first_name} {selectedPatient.last_name}
                  </div>
                )}
                {!selectedPatient && patientQuery && (
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{patientQuery}</div>
                )}
                {indication && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 2 }}>{indication}</div>}
              </div>
            </div>

            <div style={{
              background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)',
              borderRadius: 'var(--radius)', padding: 16, marginBottom: 24,
              fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6
            }}>
              💡 Lisez le résultat de l'examen à voix haute, clairement et à vitesse normale.
              Mentionnez toutes les valeurs mesurées.
            </div>

            <div className="record-area">
              <button className="record-btn idle" onClick={startRecording}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                </svg>
              </button>
              <p className="record-hint">Appuyez pour démarrer</p>
            </div>

            <button className="btn btn-secondary" onClick={() => setStep(STEP.SETUP)}>
              Modifier
            </button>
          </div>
        )}

        {/* ── RECORDING ── */}
        {step === STEP.RECORDING && (
          <div className="animate-fade-in">
            <div className="record-area">
              <div className="record-timer">{formatDuration(duration)}</div>
              <button className="record-btn recording" onClick={stopRecording}>
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="6" width="12" height="12" rx="2"/>
                </svg>
              </button>
              <p className="record-hint">
                Lisez le résultat…<br/>Appuyez sur Stop quand vous avez terminé
              </p>
            </div>

            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {selectedType?.icon} {selectedType?.name}
                {selectedPatient && ` · ${selectedPatient.first_name} ${selectedPatient.last_name}`}
                {!selectedPatient && patientQuery && ` · ${patientQuery}`}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
