import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { EXAM_TYPE_LIST } from '../data/examTypes.js'
import { transcribeAudio, structureExam, saveReport } from '../services/api.js'
import { useAuth } from '../context/AuthContext.jsx'

const STEP = {
  SETUP:        'setup',        // Sélection type + patient
  READY:        'ready',        // Prêt à enregistrer
  RECORDING:    'recording',    // En cours
  TRANSCRIBING: 'transcribing', // Transcription Groq
  STRUCTURING:  'structuring',  // Structuration Claude
  SAVING:       'saving',       // Sauvegarde
  DONE:         'done',         // Terminé
  ERROR:        'error'
}

export default function ReadPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [step, setStep] = useState(STEP.SETUP)
  const [selectedType, setSelectedType] = useState(null)
  const [patientName, setPatientName] = useState('')
  const [indication, setIndication] = useState('')
  const [error, setError] = useState(null)
  const [duration, setDuration] = useState(0)
  const [reportId, setReportId] = useState(null)

  const mediaRecorderRef = useRef(null)
  const audioChunksRef   = useRef([])
  const streamRef        = useRef(null)
  const timerRef         = useRef(null)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearInterval(timerRef.current)
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [])

  function formatDuration(s) {
    const m = Math.floor(s / 60)
    const sec = s % 60
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

    await new Promise(resolve => {
      recorder.onstop = resolve
      recorder.stop()
    })

    const blob = new Blob(audioChunksRef.current, { type: audioChunksRef.current[0]?.type || 'audio/webm' })
    await processAudio(blob)
  }

  async function processAudio(blob) {
    try {
      // 1. Transcription
      setStep(STEP.TRANSCRIBING)
      const { text } = await transcribeAudio(blob)

      // 2. Structuration Claude
      setStep(STEP.STRUCTURING)
      const { structured } = await structureExam(text, selectedType.id)

      // 3. Sauvegarde
      setStep(STEP.SAVING)
      const report = await saveReport({
        exam_type:     selectedType.id,
        patient_name:  patientName || null,
        indication:    indication  || null,
        transcript:    text,
        structured,
        user_id:       user?.id
      })

      setReportId(report.id)
      setStep(STEP.DONE)
    } catch (err) {
      setError(err.message)
      setStep(STEP.ERROR)
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────

  if (step === STEP.DONE) {
    return (
      <div className="page" style={{ justifyContent: 'center', padding: 24 }}>
        <div className="animate-fade-in" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '4rem', marginBottom: 16 }}>✅</div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: 8 }}>Rapport créé</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 32 }}>
            {selectedType?.name} — {patientName || 'Patient'}
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

  if ([STEP.TRANSCRIBING, STEP.STRUCTURING, STEP.SAVING].includes(step)) {
    const steps = [
      { id: STEP.TRANSCRIBING, label: 'Transcription audio...',      icon: '🎙️' },
      { id: STEP.STRUCTURING,  label: 'Structuration du rapport...', icon: '🧠' },
      { id: STEP.SAVING,       label: 'Sauvegarde...',               icon: '💾' }
    ]
    const currentIdx = steps.findIndex(s => s.id === step)
    return (
      <div className="page" style={{ justifyContent: 'center', padding: 24 }}>
        <div className="animate-fade-in" style={{ width: '100%', maxWidth: 360, margin: '0 auto' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 24, textAlign: 'center' }}>
            Traitement en cours…
          </h2>
          <div className="steps">
            {steps.map((s, i) => (
              <div key={s.id} className={`step ${i < currentIdx ? 'done' : i === currentIdx ? 'active' : 'pending'}`}>
                <span className="step-icon">
                  {i < currentIdx ? '✓' : i === currentIdx ? <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> : '○'}
                </span>
                {s.icon} {s.label}
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

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

  return (
    <div className="page">
      <header className="page-header">
        <button className="btn-back" onClick={() => navigate('/')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 18, height: 18 }}>
            <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12,19 5,12 12,5" />
          </svg>
        </button>
        <h1 className="page-title">
          {step === STEP.SETUP ? 'Nouveau rapport' : step === STEP.READY ? selectedType?.name : 'Enregistrement'}
        </h1>
      </header>

      <div className="page-content">

        {/* ── SETUP : sélection type + patient ── */}
        {step === STEP.SETUP && (
          <div className="animate-fade-in">
            <div className="form-group" style={{ marginBottom: 20 }}>
              <label className="form-label">Patient (optionnel)</label>
              <input
                className="form-input"
                placeholder="Nom et prénom"
                value={patientName}
                onChange={e => setPatientName(e.target.value)}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 20 }}>
              <label className="form-label">Indication clinique</label>
              <textarea
                className="form-textarea"
                placeholder="Ex : HTA, suivi post-op, douleur thoracique..."
                value={indication}
                onChange={e => setIndication(e.target.value)}
                rows={2}
              />
            </div>

            <label className="form-label" style={{ display: 'block', marginBottom: 10 }}>
              Type d'examen
            </label>
            <div className="exam-grid">
              {EXAM_TYPE_LIST.map(type => (
                <button
                  key={type.id}
                  className={`exam-card ${selectedType?.id === type.id ? 'selected' : ''}`}
                  onClick={() => setSelectedType(type)}
                  style={selectedType?.id === type.id ? { borderColor: type.color } : {}}
                >
                  <span className="exam-card-icon">{type.icon}</span>
                  <span className="exam-card-name">{type.shortName}</span>
                  <span className="exam-card-desc">{type.description}</span>
                </button>
              ))}
            </div>

            {selectedType && (
              <button
                className="btn btn-primary"
                style={{ marginTop: 24 }}
                onClick={() => setStep(STEP.READY)}
              >
                Continuer
              </button>
            )}
          </div>
        )}

        {/* ── READY : prêt à enregistrer ── */}
        {step === STEP.READY && (
          <div className="animate-fade-in">
            <div className="card" style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: '2rem' }}>{selectedType.icon}</span>
              <div>
                <div style={{ fontWeight: 600 }}>{selectedType.name}</div>
                {patientName && <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{patientName}</div>}
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

            <div className="record-zone">
              <button className="record-btn" onClick={startRecording}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
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
            <div className="record-zone">
              <div className="record-timer">{formatDuration(duration)}</div>

              <button className="record-btn recording" onClick={stopRecording}>
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
              </button>

              <p className="record-hint">
                Lisez le résultat…<br />Appuyez sur Stop quand vous avez terminé
              </p>
            </div>

            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {selectedType?.icon} {selectedType?.name}
                {patientName && ` · ${patientName}`}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
