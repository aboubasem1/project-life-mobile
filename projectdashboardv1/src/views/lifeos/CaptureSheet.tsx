import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Check, Image, LockKeyhole, Mic, Sparkles, Square, X } from 'lucide-react'
import { transcribeCaptureAudio, webSpeechTranscriptionProvider } from '../../lib/decision-engine/transcription'
import { CAPTURE_TARGET_LABELS, type CaptureTargetType, type LifeAreaKey } from '../../lib/lifeos'
import type { CaptureDecisionPreview, CaptureDecisionPreviewItem } from '../../lib/lifeos/types'
import { Field, LifeAreaSelect } from './lifeosUi'

const TARGETS: CaptureTargetType[] = ['inbox', 'task', 'note', 'knowledge', 'goal', 'event', 'decision', 'reference']
const MAX_FILE_CHARS = 350_000

type CapturePhase = 'idle' | 'recording' | 'processing' | 'preview'

export function CaptureSheet({
  onClose,
  onCapture,
  onDecide,
  onOpenPrivateNotes,
  initialRaw = '',
  inactive = false,
}: {
  onClose: () => void
  initialRaw?: string
  onOpenPrivateNotes?: (text: string) => void
  inactive?: boolean
  onDecide?: (input: { content: string; source: 'quick_add' | 'voice' }) => Promise<CaptureDecisionPreview | undefined>
  onCapture: (input: {
    raw: string
    url?: string
    fileName?: string
    fileKind?: 'file' | 'screenshot'
    fileDataUrl?: string
    classifyAs?: CaptureTargetType
    lifeArea?: LifeAreaKey
    source?: string
    audioRef?: string
    transcriptId?: string
    decisionPreview?: CaptureDecisionPreview
  }) => void
}) {
  const [raw, setRaw] = useState(initialRaw)
  const [url, setUrl] = useState('')
  const [target, setTarget] = useState<CaptureTargetType>('inbox')
  const [lifeArea, setLifeArea] = useState<LifeAreaKey | undefined>(undefined)
  const [fileName, setFileName] = useState('')
  const [fileKind, setFileKind] = useState<'file' | 'screenshot' | undefined>(undefined)
  const [fileDataUrl, setFileDataUrl] = useState<string | undefined>(undefined)
  const [error, setError] = useState('')
  const [phase, setPhase] = useState<CapturePhase>('idle')
  const [seconds, setSeconds] = useState(0)
  const [preview, setPreview] = useState<CaptureDecisionPreview | undefined>(undefined)
  const [kept, setKept] = useState<string[]>([])
  const [audioRef, setAudioRef] = useState<string | undefined>(undefined)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<number>(0)
  const streamRef = useRef<MediaStream | null>(null)
  const liveTranscriptRef = useRef('')

  useEffect(() => () => {
    window.clearInterval(timerRef.current)
    streamRef.current?.getTracks().forEach(track => track.stop())
    if (audioRef?.startsWith('blob:')) URL.revokeObjectURL(audioRef)
  }, [audioRef])

  const commit = (nextPreview?: CaptureDecisionPreview) => {
    if (!raw.trim() && !url.trim() && !fileName) {
      setError('Schreib etwas, füge einen Link hinzu oder wähle eine Datei.')
      return
    }
    const filtered = nextPreview ?? (preview
      ? { ...preview, items: preview.items.filter(item => kept.includes(item.actionId)) }
      : undefined)
    onCapture({
      raw: raw.trim() || url.trim() || fileName,
      url: url.trim() || undefined,
      fileName: fileName || undefined,
      fileKind,
      fileDataUrl,
      classifyAs: target,
      lifeArea,
      source: audioRef ? 'voice' : 'quick_add',
      audioRef,
      decisionPreview: filtered,
    })
  }

  const runDecide = async (content: string, source: 'quick_add' | 'voice') => {
    if (!onDecide || !content.trim()) {
      commit()
      return
    }
    setPhase('processing')
    setError('')
    try {
      const next = await onDecide({ content, source })
      if (next && next.items.length > 0) {
        setPreview(next)
        setKept(next.items.map(item => item.actionId))
        setPhase('preview')
        return
      }
      commit(next)
    } catch {
      setError('Einordnen nicht möglich — du kannst trotzdem speichern.')
      setPhase('idle')
    }
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (phase === 'preview') {
      commit()
      return
    }
    void runDecide(raw.trim() || url.trim() || fileName, audioRef ? 'voice' : 'quick_add')
  }

  const onFile = (file: File | undefined) => {
    if (!file) return
    if (file.size > 220_000) {
      setError('Datei ist zu groß für den lokalen Speicher (max. ~200 KB).')
      return
    }
    const kind: 'file' | 'screenshot' = file.type.startsWith('image/') ? 'screenshot' : 'file'
    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      if (result.length > MAX_FILE_CHARS) {
        setError('Datei ist zu groß für den lokalen Speicher.')
        return
      }
      setFileName(file.name)
      setFileKind(kind)
      setFileDataUrl(result)
      setError('')
    }
    reader.readAsDataURL(file)
  }

  const stopTracks = () => {
    streamRef.current?.getTracks().forEach(track => track.stop())
    streamRef.current = null
    window.clearInterval(timerRef.current)
  }

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Aufnahme ist auf diesem Gerät nicht verfügbar. Schreib den Gedanken.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      chunksRef.current = []
      const recorder = new MediaRecorder(stream)
      recorderRef.current = recorder
      recorder.ondataavailable = event => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }
      recorder.start()
      liveTranscriptRef.current = ''
      setSeconds(0)
      setPhase('recording')
      setError('')
      timerRef.current = window.setInterval(() => setSeconds(current => current + 1), 1000)
      void webSpeechTranscriptionProvider().transcribe({ audioRef: 'live' }).then(result => {
        const transcript = result.transcript.trim()
        if (!transcript) return
        liveTranscriptRef.current = liveTranscriptRef.current || transcript
        setRaw(current => current || transcript)
      }).catch(() => undefined)
    } catch {
      setError('Mikrofonzugriff wurde verweigert.')
    }
  }

  const finishRecording = (keep: boolean) => {
    const recorder = recorderRef.current
    if (!recorder || recorder.state === 'inactive') {
      stopTracks()
      setPhase('idle')
      return
    }
    recorder.onstop = () => {
      stopTracks()
      if (!keep) {
        liveTranscriptRef.current = ''
        setPhase('idle')
        return
      }
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
      const nextRef = URL.createObjectURL(blob)
      setAudioRef(nextRef)
      setPhase('processing')
      void transcribeCaptureAudio({
        liveTranscript: liveTranscriptRef.current || raw,
        audioRef: nextRef,
        mimeType: blob.type,
      }).then(result => {
        if (!result?.transcript) {
          setError('Kein Text erkannt. Ergänze kurz, worum es ging.')
          setPhase('idle')
          return
        }
        setRaw(result.transcript)
        return runDecide(result.transcript, 'voice')
      }).catch(() => {
        setError('Kein Text erkannt. Ergänze kurz, worum es ging.')
        setPhase('idle')
      })
    }
    recorder.stop()
  }

  const toggleItem = (item: CaptureDecisionPreviewItem) => {
    setKept(current => current.includes(item.actionId)
      ? current.filter(id => id !== item.actionId)
      : [...current, item.actionId])
  }

  const clock = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`

  return (
    <div
      className="modal-backdrop capture-sheet-backdrop"
      role="presentation"
      aria-hidden={inactive || undefined}
      inert={inactive || undefined}
      onMouseDown={event => event.target === event.currentTarget && onClose()}
    >
      <form className="modal modal--small capture-sheet" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="capture-title">
        <div className="modal-header">
          <div>
            <span className="eyebrow">
              {phase === 'recording' ? 'Jo AI · hört zu' : phase === 'processing' ? 'Jo AI · ordnet ein' : phase === 'preview' ? 'Jo AI · Vorschläge' : 'Jo AI · Universal Capture'}
            </span>
            <h2 id="capture-title">
              {phase === 'recording' ? 'Sprich einfach los.' : phase === 'processing' ? 'Einen Moment.' : phase === 'preview' ? 'So wird es abgelegt.' : 'Was möchtest du festhalten?'}
            </h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Schließen"><X size={18} /></button>
        </div>

        {phase === 'recording' && (
          <div className="capture-voice" role="status">
            <strong>{clock}</strong>
            <span>Aufnahme läuft</span>
            <div className="capture-voice__actions">
              <button type="button" className="secondary-button" onClick={() => finishRecording(false)}>Abbrechen</button>
              <button type="button" className="primary-button" onClick={() => finishRecording(true)}>
                <Square size={14} /> Stop
              </button>
            </div>
          </div>
        )}

        {phase !== 'recording' && (
          <Field label="Eingabe">
            <textarea
              value={raw}
              onChange={event => setRaw(event.target.value)}
              placeholder={audioRef ? 'Voice ist da — ergänze nur, falls etwas fehlt.' : 'Gedanke, Aufgabe, Mahlzeit, Einkauf…'}
              rows={4}
              autoFocus={phase === 'idle'}
            />
          </Field>
        )}
        {phase === 'idle' && audioRef && (
          <p className="capture-voice-note" role="status">Voice Memo aufgenommen</p>
        )}

        {phase === 'idle' && (
          <>
            <Field label="Link (optional)">
              <input value={url} onChange={event => setUrl(event.target.value)} placeholder="https://" inputMode="url" />
            </Field>
            <div className="lifeos-file-row">
              <button type="button" className="secondary-button" onClick={() => fileRef.current?.click()}>
                <Image size={16} /> Foto / Datei
              </button>
              <input
                ref={fileRef}
                type="file"
                hidden
                onChange={event => onFile(event.target.files?.[0])}
              />
              {fileName && <span className="lifeos-file-name">{fileName}</span>}
            </div>
            <div className="lifeos-chip-row" role="group" aria-label="Zieltyp">
              {TARGETS.map(item => (
                <button
                  key={item}
                  type="button"
                  className={target === item ? 'choice-button is-active' : 'choice-button'}
                  onClick={() => setTarget(item)}
                >
                  {CAPTURE_TARGET_LABELS[item]}
                </button>
              ))}
            </div>
            <LifeAreaSelect value={lifeArea} onChange={setLifeArea} />
          </>
        )}

        {phase === 'preview' && preview && (
          <ul className="capture-preview">
            {preview.items.map(item => (
              <li key={item.actionId} className={kept.includes(item.actionId) ? 'is-on' : undefined}>
                <button type="button" onClick={() => toggleItem(item)}>
                  <Check size={14} />
                  <span>
                    <strong>{item.intent} · {item.domain}</strong>
                    <small>
                      {item.content}
                      {item.mealLabel ? ` · ${item.mealLabel}` : ''}
                      {item.due ? ` · ${item.due}` : ''}
                    </small>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {error && <p className="lifeos-error">{error}</p>}

        <div className="modal-actions capture-modal-actions">
          {phase === 'idle' && (
            <button type="button" className="secondary-button capture-mic" onClick={() => void startRecording()}>
              <Mic size={16} /> Voice
            </button>
          )}
          {phase === 'idle' && onOpenPrivateNotes && (
            <button type="button" className="secondary-button" onClick={() => onOpenPrivateNotes(raw.trim())}>
              <LockKeyhole size={16} /> Passcode-geschützt
            </button>
          )}
          {phase === 'preview' && (
            <button type="button" className="secondary-button" onClick={() => { setKept(preview?.items.map(item => item.actionId) ?? []); commit(preview) }}>
              Alles übernehmen
            </button>
          )}
          {phase !== 'recording' && (
            <button type="submit" className="primary-button" disabled={phase === 'processing'}>
              <Sparkles size={16} /> {phase === 'preview' ? 'Übernehmen' : phase === 'processing' ? 'Jo ordnet ein…' : 'Mit Jo einordnen'}
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
