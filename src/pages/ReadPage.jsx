import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { EXAM_TYPE_LIST } from '../data/examTypes.js'
import { transcribeAudio, structureExam, saveReport, getPatients, createPatient } from '../services/api.js'
import { enqueuePending } from '../services/pendingQueue.js'
import { useAuth } from '../context/AuthContext.jsx'

function isNetworkError(err) {
  if (!navigator.onLine) return true
  if (err instanceof TypeError) {
    const msg = err.message.toLowerCase()
    return msg.includes('failed to fetch') || msg.includes('load failed') || msg.includes('network request failed')
  }
  return false
}

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
  // Saved after transcription so structuring can be retried without re-recording
  const [savedTranscript, setSavedTranscript] = useState(null)
  const [savedMeta, setSavedMeta] = useState(null)

  // Patient search
  const [patientQuery, setPatientQuery] = useState('')
  const [selectedPatient, setSelectedPatient] = useState(null)
  const [patients, setPatients] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [showPatientSheet, setShowPatientSheet] = useState(false)
  const [recentPatients, setRecentPatients] = useState([])
  const [loadingRecent, setLoadingRecent] = useState(false)
  const [showNewPatientForm, setShowNewPatientForm] = useState(false)
  const [newPatient, setNewPatient] = useState({ first_name: '', last_name: '', date_of_birth: '', sex: '' })
  const [creatingPatient, setCreatingPatient] = useState(false)

  const mediaRecorderRef = useRef(null)
  const audioChunksRef   = useRef([])
  const streamRef        = useRef(null)
  const timerRef         = useRef(null)
  const canvasRef        = useRef(null)
  const analyserRef      = useRef(null)
  const audioCtxRef      = useRef(null)
  const animFrameRef     = useRef(null)
  const processingRef    = useRef(false)  // prevents double-tap stop

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
      cancelAnimationFrame(animFrameRef.current)
      audioCtxRef.current?.close()
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

  function selectPatientFromSheet(p) {
    selectPatient(p)
    setShowPatientSheet(false)
    setPatientQuery('')
    setPatients([])
  }

  async function openPatientSheet() {
    setShowPatientSheet(true)
    setPatientQuery('')
    setPatients([])
    setShowNewPatientForm(false)
    if (recentPatients.length === 0 && !loadingRecent) {
      setLoadingRecent(true)
      try {
        const res = await getPatients('', 8)
        setRecentPatients(res.patients || res || [])
      } catch { /* no recent patients */ }
      setLoadingRecent(false)
    }
  }

  function closePatientSheet() {
    setShowPatientSheet(false)
    setPatientQuery('')
    setPatients([])
  }

  async function handleCreatePatient() {
    if (!newPatient.first_name || !newPatient.last_name) return
    setCreatingPatient(true)
    try {
      const created = await createPatient(newPatient)
      selectPatient(created)
      setNewPatient({ first_name: '', last_name: '', date_of_birth: '', sex: '' })
      setShowPatientSheet(false)
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

  function startWaveform(stream) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext
    if (!AudioCtx) return
    const audioCtx = new AudioCtx()
    const source = audioCtx.createMediaStreamSource(stream)
    const analyser = audioCtx.createAnalyser()
    analyser.fftSize = 64
    analyser.smoothingTimeConstant = 0.75
    source.connect(analyser)
    audioCtxRef.current = audioCtx
    analyserRef.current = analyser

    const bufferLength = analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)

    function draw() {
      animFrameRef.current = requestAnimationFrame(draw)
      const canvas = canvasRef.current
      if (!canvas) return
      analyser.getByteFrequencyData(dataArray)
      const ctx = canvas.getContext('2d')
      const W = canvas.width, H = canvas.height
      ctx.clearRect(0, 0, W, H)
      const total = bufferLength
      const barW = (W / total) * 0.7
      const gap = (W / total) * 0.3
      for (let i = 0; i < total; i++) {
        const amp = dataArray[i] / 255
        const bh = Math.max(3, amp * H * 0.85)
        const x = i * (barW + gap)
        const y = (H - bh) / 2
        const alpha = 0.25 + amp * 0.75
        ctx.fillStyle = `rgba(220,38,38,${alpha})`
        ctx.beginPath()
        ctx.roundRect(x, y, barW, bh, 2)
        ctx.fill()
      }
    }
    draw()
  }

  function stopWaveform() {
    cancelAnimationFrame(animFrameRef.current)
    audioCtxRef.current?.close()
    audioCtxRef.current = null
    analyserRef.current = null
    const canvas = canvasRef.current
    if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height)
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
      startWaveform(stream)
    } catch (err) {
      setError('Impossible d\'accéder au microphone: ' + err.message)
      setStep(STEP.ERROR)
    }
  }

  async function stopRecording() {
    // Guard against double-tap — a second call while processing is a no-op
    if (processingRef.current) return
    processingRef.current = true

    clearInterval(timerRef.current)
    stopWaveform()
    streamRef.current?.getTracks().forEach(t => t.stop())
    const recorder = mediaRecorderRef.current
    if (!recorder || recorder.state === 'inactive') {
      processingRef.current = false
      return
    }
    await new Promise(resolve => { recorder.onstop = resolve; recorder.stop() })
    const mimeType = audioChunksRef.current[0]?.type || 'audio/webm'
    const blob = new Blob(audioChunksRef.current, { type: mimeType })
    await processAudio(blob)
    processingRef.current = false
  }

  async function processAudio(blob) {
    const patientName = selectedPatient
      ? `${selectedPatient.first_name} ${selectedPatient.last_name}`
      : patientQuery || null

    const meta = {
      examTypeId:  selectedType.id,
      prompt:      selectedType.prompt,
      patientName,
      patientId:   selectedPatient?.id || null,
      indication:  indication || null,
      userId:      user?.id
    }

    // If offline, queue immediately without trying
    if (!navigator.onLine) {
      try {
        await enqueuePending(blob, meta)
        setStep(STEP.QUEUED)
      } catch (err) {
        setError(err.message)
        setStep(STEP.ERROR)
      }
      return
    }

    try {
      setStep(STEP.TRANSCRIBING)
      const { text } = await transcribeAudio(blob)

      // Save transcript immediately — if structuring fails we can retry
      // without asking the doctor to re-record
      setSavedTranscript(text)
      setSavedMeta(meta)

      await structureAndSave(text, meta)
    } catch (err) {
      if (isNetworkError(err)) {
        try {
          await enqueuePending(blob, meta)
          setStep(STEP.QUEUED)
        } catch (queueErr) {
          setError(queueErr.message)
          setStep(STEP.ERROR)
        }
      } else {
        setError(err.message || 'Erreur de transcription.')
        setStep(STEP.ERROR)
      }
    }
  }

  // Structuring + saving — can be called independently if transcription already succeeded
  async function structureAndSave(text, meta) {
    try {
      setStep(STEP.STRUCTURING)
      const { structured } = await structureExam(text, meta.examTypeId, meta.prompt)

      setStep(STEP.SAVING)
      const report = await saveReport({
        exam_type:    meta.examTypeId,
        patient_name: meta.patientName,
        patient_id:   meta.patientId || null,
        indication:   meta.indication || null,
        transcript:   text,
        structured,
        user_id:      meta.userId
      })
      setReportId(report.id)
      setStep(STEP.DONE)
    } catch (err) {
      if (isNetworkError(err)) {
        // We have the transcript — queue with it so no audio needed on retry
        // (pendingQueue will re-structure from saved text on next retry)
        setError('Connexion perdue après la transcription. Reconnectez-vous et réessayez depuis l\'accueil.')
        setStep(STEP.ERROR)
      } else {
        setError(err.message || 'Erreur lors de la structuration ou de la sauvegarde.')
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
          <p style={{ color: 'var(--text-secondary)', marginBottom: 24, fontSize: '0.9rem', lineHeight: 1.5 }}>{error}</p>

          {/* If transcription succeeded, offer to retry only the structuring */}
          {savedTranscript && savedMeta && (
            <button
              className="btn btn-primary"
              style={{ marginBottom: 12, width: '100%' }}
              onClick={() => { setError(null); structureAndSave(savedTranscript, savedMeta) }}
            >
              Réessayer la structuration
              <span style={{ display: 'block', fontSize: '0.72rem', fontWeight: 400, opacity: 0.8, marginTop: 2 }}>
                (sans ré-enregistrer)
              </span>
            </button>
          )}

          <button
            className="btn btn-secondary"
            style={{ width: '100%' }}
            onClick={() => { setStep(STEP.SETUP); setError(null); setSavedTranscript(null); setSavedMeta(null) }}
          >
            Recommencer depuis le début
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

            {/* Patient — bottom sheet trigger */}
            <div style={{ marginBottom: 20 }}>
              <label className="search-label">
                Patient <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optionnel)</span>
              </label>

              {selectedPatient ? (
                <div className="selected-patient-pill" style={{ cursor: 'pointer' }} onClick={openPatientSheet}>
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
                  <button className="selected-patient-clear" onClick={e => {
                    e.stopPropagation()
                    setSelectedPatient(null); setPatientQuery(''); setPatients([])
                  }}>✕</button>
                </div>
              ) : (
                <button className="patient-trigger" onClick={openPatientSheet}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                    style={{ width: 16, height: 16, flexShrink: 0 }}>
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                  <span style={{ flex: 1 }}>Rechercher ou créer un patient…</span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                    style={{ width: 16, height: 16, flexShrink: 0 }}>
                    <polyline points="6,9 12,15 18,9"/>
                  </svg>
                </button>
              )}
            </div>

            {/* Patient bottom sheet */}
            {showPatientSheet && (
              <div className="sheet-overlay" onClick={closePatientSheet}>
                <div className="patient-sheet" onClick={e => e.stopPropagation()}>
                  <div className="sheet-handle" />
                  <div className="sheet-title">Patient</div>
                  <div className="sheet-search-box">
                    <div className="search-input-wrapper">
                      <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                      </svg>
                      <input
                        type="text"
                        className="search-input"
                        autoFocus
                        value={patientQuery}
                        onChange={handlePatientQueryChange}
                        placeholder="Rechercher un patient…"
                      />
                      {isSearching && (
                        <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2, position: 'absolute', right: 12 }} />
                      )}
                    </div>
                  </div>

                  <div className="sheet-list">
                    {patientQuery.length >= 2 ? (
                      <>
                        {patients.length > 0 && <div className="sheet-section-label">Résultats</div>}
                        {patients.map(p => (
                          <div key={p.id} className="sheet-patient-row" onClick={() => selectPatientFromSheet(p)}>
                            <div className="sheet-patient-avatar">{p.first_name[0]}{p.last_name[0]}</div>
                            <div>
                              <span className="sheet-patient-name">{p.first_name} {p.last_name}</span>
                              {p.date_of_birth && (
                                <span className="sheet-patient-meta">
                                  {new Date(p.date_of_birth).toLocaleDateString('fr-FR')}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                        {patients.length === 0 && !isSearching && (
                          <div style={{ padding: '14px 16px', color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center' }}>
                            Aucun patient trouvé
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        {loadingRecent && (
                          <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
                            <div className="spinner" style={{ width: 24, height: 24 }} />
                          </div>
                        )}
                        {!loadingRecent && recentPatients.length > 0 && (
                          <>
                            <div className="sheet-section-label">Récents</div>
                            {recentPatients.map(p => (
                              <div key={p.id} className="sheet-patient-row" onClick={() => selectPatientFromSheet(p)}>
                                <div className="sheet-patient-avatar">{p.first_name[0]}{p.last_name[0]}</div>
                                <div>
                                  <span className="sheet-patient-name">{p.first_name} {p.last_name}</span>
                                  {p.date_of_birth && (
                                    <span className="sheet-patient-meta">
                                      {new Date(p.date_of_birth).toLocaleDateString('fr-FR')}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </>
                        )}
                      </>
                    )}

                    {!showNewPatientForm && (
                      <div className="sheet-create-row" onClick={() => setShowNewPatientForm(true)}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16 }}>
                          <circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 1 0-16 0"/>
                          <line x1="19" y1="8" x2="23" y2="8"/><line x1="21" y1="6" x2="21" y2="10"/>
                        </svg>
                        Créer un nouveau patient
                      </div>
                    )}

                    {showNewPatientForm && (
                      <div className="sheet-create-form">
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
                </div>
              </div>
            )}

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

              {/* Waveform visualizer */}
              <div style={{
                width: '100%', height: 64, margin: '12px 0',
                background: 'rgba(220,38,38,0.06)', borderRadius: 12,
                overflow: 'hidden', display: 'flex', alignItems: 'center'
              }}>
                <canvas
                  ref={canvasRef}
                  width={320}
                  height={64}
                  style={{ width: '100%', height: '100%' }}
                />
              </div>

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
