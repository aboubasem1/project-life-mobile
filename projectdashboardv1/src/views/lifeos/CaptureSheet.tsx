import { useEffect, useId, useRef, useState, type CSSProperties, type FormEvent, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, Check, Image, Link2, LockKeyhole, Mic, Sparkles, Square, X } from 'lucide-react'
import { transcribeCaptureAudio, TranscriptionError, pickRecorderMimeType } from '../../lib/decision-engine/transcription'
import { acquireMicrophoneStream } from '../../lib/micPermission'
import {
  CAPTURE_TARGET_LABELS,
  LIFE_AREA_LABELS,
  LIFE_AREAS,
  type CaptureTargetType,
  type LifeAreaKey,
} from '../../lib/lifeos'
import type { CaptureDecisionPreview, CaptureDecisionPreviewItem } from '../../lib/lifeos/types'
import { uploadLifeOsFile } from '../../lib/objectStorage'

const TARGETS: CaptureTargetType[] = ['task', 'note', 'knowledge', 'goal', 'event', 'decision', 'reference', 'inbox']
const MAX_FILE_CHARS = 350_000
const MAX_CLOUD_FILE_BYTES = 100 * 1024 * 1024

type CaptureStep =
  | 'input'
  | 'recording'
  | 'processing'
  | 'suggest'
  | 'adjust-type'
  | 'adjust-when'
  | 'adjust-where'
  | 'adjust-details'
  | 'adjust-more'
  | 'saving'
  | 'saved'

type WhenChoice = 'keep' | 'today' | 'tomorrow' | 'none'

const INTENT_LABELS: Record<string, string> = {
  CREATE_TASK: 'Aufgabe',
  CREATE_NOTE: 'Notiz',
  LOG_MEAL: 'Mahlzeit',
  ADD_SHOPPING_ITEM: 'Einkauf',
  COMPLETE_ROUTINE: 'Routine',
  UPDATE_CALENDAR: 'Termin',
  REVIEW: 'Prüfen',
  REQUEST_INFORMATION: 'Nachfragen',
  CLASSIFY: 'Einordnen',
  UNKNOWN: 'Capture',
}

function intentLabel(item: CaptureDecisionPreviewItem): string {
  return INTENT_LABELS[item.suggestedAction] || INTENT_LABELS[item.intent] || CAPTURE_TARGET_LABELS.inbox
}

function targetFromItem(item: CaptureDecisionPreviewItem | undefined): CaptureTargetType {
  if (!item) return 'inbox'
  const intent = item.suggestedAction || item.intent
  switch (intent) {
    case 'CREATE_TASK':
    case 'ADD_SHOPPING_ITEM':
    case 'COMPLETE_ROUTINE':
      return 'task'
    case 'CREATE_NOTE':
    case 'LOG_MEAL':
      return 'note'
    case 'UPDATE_CALENDAR':
      return 'event'
    case 'CLASSIFY':
      return item.domain === 'KNOWLEDGE' ? 'knowledge' : 'inbox'
    default:
      if (item.domain === 'NOTE' || item.domain === 'KNOWLEDGE') return item.domain === 'KNOWLEDGE' ? 'knowledge' : 'note'
      if (item.domain === 'TASK' || item.domain === 'WORK' || item.domain === 'SHOPPING') return 'task'
      return 'inbox'
  }
}

function dateKeyInBerlin(daysFromToday: number): string {
  const base = new Date()
  base.setHours(12, 0, 0, 0)
  base.setDate(base.getDate() + daysFromToday)
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(base)
}

function formatDueLabel(due?: string): string | undefined {
  if (!due) return undefined
  const today = dateKeyInBerlin(0)
  const tomorrow = dateKeyInBerlin(1)
  if (due === today) return 'Heute'
  if (due === tomorrow) return 'Morgen'
  try {
    const [year, month, day] = due.split('-').map(Number)
    if (!year || !month || !day) return due
    return new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'short' }).format(new Date(year, month - 1, day))
  } catch {
    return due
  }
}

function fileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '')
    reader.onerror = () => reject(new Error('Datei konnte nicht gelesen werden.'))
    reader.readAsDataURL(file)
  })
}

function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

export function CaptureSheet({
  onClose,
  onCapture,
  onDecide,
  onOpenPrivateNotes,
  initialRaw = '',
  initialClassifyAs,
  initialMode = 'default',
  inactive = false,
}: {
  onClose: () => void
  initialRaw?: string
  initialClassifyAs?: CaptureTargetType
  initialMode?: 'default' | 'shopping' | 'stock' | 'med-log' | 'goal' | 'finance' | 'list'
  onOpenPrivateNotes?: (text: string) => void
  inactive?: boolean
  onDecide?: (input: { content: string; source: 'quick_add' | 'voice' }) => Promise<CaptureDecisionPreview | undefined>
  onCapture: (input: {
    raw: string
    url?: string
    fileName?: string
    fileKind?: 'file' | 'screenshot'
    fileDataUrl?: string
    fileObjectId?: string
    fileStorageKey?: string
    fileContentType?: string
    fileSize?: number
    classifyAs?: CaptureTargetType
    lifeArea?: LifeAreaKey
    source?: string
    audioRef?: string
    transcriptId?: string
    decisionPreview?: CaptureDecisionPreview
    applyConfirmedDecisions?: boolean
    captureMode?: 'default' | 'shopping' | 'stock' | 'med-log' | 'goal' | 'finance' | 'list'
  }) => void | Promise<void>
}) {
  const titleId = useId()
  const [raw, setRaw] = useState(initialRaw)
  const [url, setUrl] = useState('')
  const [showLink, setShowLink] = useState(false)
  const [keyboardInset, setKeyboardInset] = useState(0)
  const [target, setTarget] = useState<CaptureTargetType>(initialClassifyAs ?? 'inbox')
  const [lifeArea, setLifeArea] = useState<LifeAreaKey | undefined>(undefined)
  const [dueOverride, setDueOverride] = useState<string | undefined>(undefined)
  const [whenChoice, setWhenChoice] = useState<WhenChoice>('keep')
  const [fileName, setFileName] = useState('')
  const [fileKind, setFileKind] = useState<'file' | 'screenshot' | undefined>(undefined)
  const [selectedFile, setSelectedFile] = useState<File | undefined>(undefined)
  const [error, setError] = useState('')
  const [step, setStep] = useState<CaptureStep>('input')
  const [seconds, setSeconds] = useState(0)
  const [preview, setPreview] = useState<CaptureDecisionPreview | undefined>(undefined)
  const [kept, setKept] = useState<string[]>([])
  const [audioRef, setAudioRef] = useState<string | undefined>(undefined)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<number>(0)
  const streamRef = useRef<MediaStream | null>(null)
  const liveTranscriptRef = useRef('')
  const closeTimerRef = useRef<number>(0)
  const captureMode = initialMode

  useEffect(() => () => {
    window.clearInterval(timerRef.current)
    window.clearTimeout(closeTimerRef.current)
    streamRef.current?.getTracks().forEach(track => track.stop())
    if (audioRef?.startsWith('blob:')) URL.revokeObjectURL(audioRef)
  }, [audioRef])

  useEffect(() => {
    if (step === 'input') inputRef.current?.focus()
  }, [step])

  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return
    let frame = 0
    const syncKeyboard = () => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => {
        // iOS Safari shrinks visualViewport and may offset it; keep sheet above the keyboard.
        const layoutHeight = window.innerHeight
        const inset = Math.max(0, Math.round(layoutHeight - viewport.height - viewport.offsetTop))
        setKeyboardInset(inset > 40 ? inset : 0)
      })
    }
    syncKeyboard()
    viewport.addEventListener('resize', syncKeyboard)
    viewport.addEventListener('scroll', syncKeyboard)
    window.addEventListener('focusin', syncKeyboard)
    window.addEventListener('focusout', syncKeyboard)
    return () => {
      window.cancelAnimationFrame(frame)
      viewport.removeEventListener('resize', syncKeyboard)
      viewport.removeEventListener('scroll', syncKeyboard)
      window.removeEventListener('focusin', syncKeyboard)
      window.removeEventListener('focusout', syncKeyboard)
    }
  }, [])

  const primaryItem = preview?.items.find(item => kept.includes(item.actionId)) ?? preview?.items[0]
  const extraCount = Math.max(0, (preview?.items.length ?? 0) - 1)
  const effectiveDue = dueOverride ?? primaryItem?.due
  const offline = isOffline()

  const applyWhenChoice = (choice: WhenChoice) => {
    setWhenChoice(choice)
    if (choice === 'today') setDueOverride(dateKeyInBerlin(0))
    else if (choice === 'tomorrow') setDueOverride(dateKeyInBerlin(1))
    else if (choice === 'none') setDueOverride(undefined)
    else setDueOverride(primaryItem?.due)
  }

  const buildFilteredPreview = (nextPreview?: CaptureDecisionPreview): CaptureDecisionPreview | undefined => {
    const base = nextPreview ?? (preview
      ? { ...preview, items: preview.items.filter(item => kept.includes(item.actionId)) }
      : undefined)
    if (!base) return undefined
    if (!dueOverride) return base
    return {
      ...base,
      items: base.items.map((item, index) => (
        index === 0 || item.actionId === primaryItem?.actionId
          ? { ...item, due: dueOverride }
          : item
      )),
    }
  }

  const commit = async (options?: {
    nextPreview?: CaptureDecisionPreview
    applyConfirmed?: boolean
    classifyAs?: CaptureTargetType
  }) => {
    if (!raw.trim() && !url.trim() && !fileName) {
      setError('Schreib kurz, was du festhalten willst.')
      setStep('input')
      return
    }
    if (offline && selectedFile) {
      setError('Offline — Datei später anhängen. Text kannst du trotzdem speichern.')
    }
    const filtered = buildFilteredPreview(options?.nextPreview)
    let attachment: {
      fileDataUrl?: string
      fileObjectId?: string
      fileStorageKey?: string
      fileContentType?: string
      fileSize?: number
    } = {}
    if (selectedFile) {
      setStep('saving')
      setError('')
      try {
        const stored = await uploadLifeOsFile(selectedFile, 'captures')
        attachment = {
          fileObjectId: stored.objectId,
          fileStorageKey: stored.storageKey,
          fileContentType: stored.contentType,
          fileSize: stored.sizeBytes,
        }
      } catch {
        if (selectedFile.size > 220_000) {
          setError('Cloud-Dateispeicher nicht erreichbar. Für den lokalen Fallback max. ~200 KB.')
          setStep('adjust-details')
          return
        }
        const localDataUrl = await fileAsDataUrl(selectedFile).catch(() => '')
        if (!localDataUrl || localDataUrl.length > MAX_FILE_CHARS) {
          setError('Datei konnte nicht sicher gespeichert werden.')
          setStep('adjust-details')
          return
        }
        attachment = { fileDataUrl: localDataUrl, fileSize: selectedFile.size }
      }
    }

    setStep('saving')
    try {
      await onCapture({
        raw: raw.trim() || url.trim() || fileName,
        url: url.trim() || undefined,
        fileName: fileName || undefined,
        fileKind,
        ...attachment,
        classifyAs: options?.classifyAs ?? target,
        lifeArea,
        source: audioRef ? 'voice' : 'quick_add',
        audioRef,
        decisionPreview: filtered,
        applyConfirmedDecisions: Boolean(options?.applyConfirmed && filtered?.items.length),
        captureMode,
      })
      setStep('saved')
      await new Promise<void>(resolve => {
        window.clearTimeout(closeTimerRef.current)
        closeTimerRef.current = window.setTimeout(() => resolve(), 700)
      })
      onClose()
    } catch {
      setError('Speichern fehlgeschlagen. Eingabe bleibt erhalten.')
      setStep(preview ? 'suggest' : 'input')
    }
  }

  const runDecide = async (content: string, source: 'quick_add' | 'voice') => {
    if (!content.trim()) {
      setError('Schreib kurz, was du festhalten willst.')
      return
    }
    if (captureMode !== 'default') {
      const modeTarget: CaptureTargetType =
        captureMode === 'goal' ? 'goal'
          : captureMode === 'med-log' || captureMode === 'stock' || captureMode === 'finance' || captureMode === 'list'
            ? 'note'
            : captureMode === 'shopping'
              ? 'inbox'
              : 'task'
      setTarget(initialClassifyAs ?? modeTarget)
      setPreview(undefined)
      setKept([])
      setStep('suggest')
      return
    }
    if (!onDecide) {
      await commit({ classifyAs: initialClassifyAs ?? 'inbox' })
      return
    }
    if (offline) {
      setError('Offline — Jo speichert lokal ohne Cloud-Einordnung.')
      await commit({ classifyAs: target === 'inbox' ? (initialClassifyAs ?? 'inbox') : target })
      return
    }
    setStep('processing')
    setError('')
    try {
      const next = await onDecide({ content, source })
      if (next && next.items.length > 0) {
        setPreview(next)
        setKept(next.items.map(item => item.actionId))
        const first = next.items[0]
        setTarget(initialClassifyAs ?? targetFromItem(first))
        setDueOverride(first?.due)
        setWhenChoice(first?.due ? 'keep' : 'none')
        setStep('suggest')
        return
      }
      await commit({ nextPreview: next, classifyAs: initialClassifyAs ?? 'inbox' })
    } catch {
      setError('Einordnen nicht möglich — du kannst trotzdem speichern.')
      setStep('input')
    }
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (step === 'suggest') {
      void commit({ applyConfirmed: true, classifyAs: target })
      return
    }
    if (step === 'adjust-type') {
      setStep('adjust-when')
      return
    }
    if (step === 'adjust-when') {
      setStep('adjust-where')
      return
    }
    if (step === 'adjust-where') {
      setStep('adjust-details')
      return
    }
    if (step === 'adjust-details' || step === 'adjust-more') {
      void commit({ applyConfirmed: true, classifyAs: target })
      return
    }
    if (step === 'input') {
      void runDecide(raw.trim() || url.trim() || fileName, audioRef ? 'voice' : 'quick_add')
    }
  }

  const onFile = (file: File | undefined) => {
    if (!file) return
    if (file.size > MAX_CLOUD_FILE_BYTES) {
      setError('Datei ist größer als 100 MB.')
      return
    }
    const kind: 'file' | 'screenshot' = file.type.startsWith('image/') ? 'screenshot' : 'file'
    setSelectedFile(file)
    setFileName(file.name)
    setFileKind(kind)
    setError('')
  }

  const stopTracks = () => {
    streamRef.current?.getTracks().forEach(track => track.stop())
    streamRef.current = null
    window.clearInterval(timerRef.current)
  }

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Aufnahme ist auf diesem Gerät nicht verfügbar.')
      return
    }
    try {
      // One getUserMedia path only — do not also start Web Speech Recognition
      // (Safari/iOS would re-prompt for the microphone on every start).
      const stream = await acquireMicrophoneStream()
      streamRef.current = stream
      chunksRef.current = []
      const mimeType = pickRecorderMimeType()
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream)
      recorderRef.current = recorder
      recorder.ondataavailable = event => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }
      recorder.start(250)
      liveTranscriptRef.current = ''
      setSeconds(0)
      setStep('recording')
      setError('')
      timerRef.current = window.setInterval(() => setSeconds(current => current + 1), 1000)
    } catch {
      setError('Mikrofonzugriff wurde verweigert.')
    }
  }

  const finishRecording = (keep: boolean) => {
    const recorder = recorderRef.current
    if (!recorder || recorder.state === 'inactive') {
      stopTracks()
      setStep('input')
      return
    }
    recorder.onstop = () => {
      stopTracks()
      if (!keep) {
        liveTranscriptRef.current = ''
        setStep('input')
        return
      }
      const mime = recorder.mimeType || pickRecorderMimeType() || 'audio/webm'
      const blob = new Blob(chunksRef.current, { type: mime })
      if (blob.size < 32) {
        setError('Aufnahme war zu kurz. Sprich etwas länger und stoppe erneut.')
        setStep('input')
        return
      }
      const nextRef = URL.createObjectURL(blob)
      setAudioRef(nextRef)
      setStep('processing')
      void transcribeCaptureAudio({
        // Never pass typed draft text as "live" speech — that skipped Whisper.
        audioRef: nextRef,
        mimeType: mime,
      }).then(result => {
        setRaw(result.transcript)
        return runDecide(result.transcript, 'voice')
      }).catch((error: unknown) => {
        const message = error instanceof TranscriptionError
          ? error.message
          : 'Kein Text erkannt. Ergänze kurz, worum es ging.'
        setError(message)
        setStep('input')
      })
    }
    try {
      if (recorder.state === 'recording') recorder.requestData()
    } catch {
      // Older browsers may not support requestData.
    }
    recorder.stop()
  }

  const goBack = () => {
    setError('')
    switch (step) {
      case 'suggest':
        setStep('input')
        return
      case 'adjust-type':
        setStep('suggest')
        return
      case 'adjust-when':
        setStep('adjust-type')
        return
      case 'adjust-where':
        setStep('adjust-when')
        return
      case 'adjust-details':
        setStep('adjust-where')
        return
      case 'adjust-more':
        setShowLink(false)
        setStep('adjust-details')
        return
      case 'recording':
        finishRecording(false)
        return
      case 'processing':
      case 'saving':
      case 'saved':
        return
      case 'input':
        onClose()
        return
      default: {
        const _exhaustive: never = step
        return _exhaustive
      }
    }
  }

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape' || inactive) return
      event.preventDefault()
      goBack()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const onTextKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault()
      void runDecide(raw.trim(), audioRef ? 'voice' : 'quick_add')
    }
  }

  const clock = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
  const canGoBack = step !== 'input' && step !== 'processing' && step !== 'saving' && step !== 'saved'

  const modeSuggestLabel = (() => {
    switch (captureMode) {
      case 'shopping':
        return 'Einkaufsartikel'
      case 'stock':
        return 'Bestand'
      case 'med-log':
        return 'Einnahme'
      case 'goal':
        return 'Ziel'
      case 'finance':
        return 'Finanzeintrag'
      case 'list':
        return 'Liste'
      case 'default':
        return CAPTURE_TARGET_LABELS[target] || (primaryItem ? intentLabel(primaryItem) : 'Capture')
      default: {
        const _exhaustive: never = captureMode
        return _exhaustive
      }
    }
  })()

  const inputPlaceholder = (() => {
    switch (captureMode) {
      case 'shopping':
        return 'Welchen Artikel brauchst du?'
      case 'stock':
        return 'Welches Produkt / welchen Bestand?'
      case 'med-log':
        return 'Welche Einnahme dokumentieren?'
      case 'goal':
        return 'Welches Ziel oder welchen Fortschritt?'
      case 'finance':
        return 'Welchen Finanzeintrag?'
      case 'list':
        return 'Wie soll die Liste heißen?'
      case 'default':
        return 'Was möchtest du festhalten?'
      default: {
        const _exhaustive: never = captureMode
        return _exhaustive
      }
    }
  })()

  const primaryLabel = (() => {
    switch (step) {
      case 'suggest':
      case 'adjust-details':
      case 'adjust-more':
        return 'Speichern'
      case 'adjust-type':
      case 'adjust-when':
      case 'adjust-where':
      case 'input':
      case 'recording':
        return 'Weiter'
      case 'processing':
      case 'saving':
        return 'Einen Moment…'
      case 'saved':
        return 'Gespeichert'
      default: {
        const _exhaustive: never = step
        return _exhaustive
      }
    }
  })()

  return createPortal(
    <div
      className={keyboardInset > 0 ? 'modal-backdrop capture-sheet-backdrop is-keyboard' : 'modal-backdrop capture-sheet-backdrop'}
      role="presentation"
      aria-hidden={inactive || undefined}
      inert={inactive || undefined}
      style={{ '--capture-keyboard-inset': `${keyboardInset}px` } as CSSProperties}
      onPointerDown={event => {
        if (event.target === event.currentTarget && step !== 'processing' && step !== 'saving') onClose()
      }}
    >
      <form
        className={`capture-sheet capture-sheet--${step}${keyboardInset > 0 ? ' is-keyboard' : ''}`}
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onPointerDown={event => event.stopPropagation()}
      >
        <div className="capture-sheet__chrome">
          {canGoBack ? (
            <button type="button" className="icon-button" onClick={goBack} aria-label="Zurück">
              <ArrowLeft size={18} />
            </button>
          ) : (
            <span className="capture-sheet__chrome-spacer" />
          )}
          <p id={titleId} className="capture-sheet__eyebrow">
            {step === 'recording' && 'Jo hört zu'}
            {step === 'processing' && 'Jo ordnet ein'}
            {step === 'suggest' && 'Vorschlag'}
            {(step === 'adjust-type' || step === 'adjust-when' || step === 'adjust-where') && 'Anpassen'}
            {step === 'adjust-details' && 'Details'}
            {step === 'adjust-more' && 'Optionen'}
            {step === 'saved' && 'Gespeichert'}
            {(step === 'input' || step === 'saving') && 'Jo AI'}
          </p>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Schließen"
            disabled={step === 'processing' || step === 'saving'}
          >
            <X size={18} />
          </button>
        </div>

        <div className="capture-sheet__body" key={step}>
          {step === 'input' && (
            <>
              <textarea
                ref={inputRef}
                className="capture-sheet__input"
                value={raw}
                onChange={event => setRaw(event.target.value)}
                onKeyDown={onTextKeyDown}
                placeholder={inputPlaceholder}
                rows={3}
                autoFocus
              />
              <div className="capture-sheet__row">
                <button type="button" className="capture-sheet__ghost" onClick={() => void startRecording()}>
                  <Mic size={16} /> Sprache
                </button>
              </div>
            </>
          )}

          {step === 'recording' && (
            <div className="capture-voice" role="status">
              <strong>{clock}</strong>
              <span>Sprich einfach los</span>
              <div className="capture-voice__actions">
                <button type="button" className="secondary-button" onClick={() => finishRecording(false)}>Abbrechen</button>
                <button type="button" className="primary-button" onClick={() => finishRecording(true)}>
                  <Square size={14} /> Stop
                </button>
              </div>
            </div>
          )}

          {step === 'processing' && (
            <div className="capture-sheet__status" role="status">
              <Sparkles size={18} className="capture-sheet__spin" />
              <span>Jo liest mit…</span>
            </div>
          )}

          {(step === 'suggest' && (primaryItem || captureMode !== 'default')) && (
            <div className="capture-suggest">
              <p className="capture-suggest__quote">{raw.trim()}</p>
              <dl className="capture-suggest__meta">
                <div>
                  <dt>Erkannt als</dt>
                  <dd>{modeSuggestLabel}</dd>
                </div>
                {formatDueLabel(effectiveDue) && (
                  <div>
                    <dt>Geplant</dt>
                    <dd>{formatDueLabel(effectiveDue)}</dd>
                  </div>
                )}
                <div>
                  <dt>Ziel</dt>
                  <dd>{lifeArea ? LIFE_AREA_LABELS[lifeArea] : 'Heute / Inbox'}</dd>
                </div>
              </dl>
              {extraCount > 0 && (
                <p className="capture-suggest__more">
                  +{extraCount} weitere {extraCount === 1 ? 'Eintrag' : 'Einträge'}
                </p>
              )}
            </div>
          )}

          {step === 'adjust-type' && (
            <div className="capture-adjust">
              <p className="capture-adjust__question">Welcher Typ passt?</p>
              <div className="capture-adjust__options" role="group" aria-label="Typ">
                {TARGETS.map(item => (
                  <button
                    key={item}
                    type="button"
                    className={target === item ? 'capture-option is-active' : 'capture-option'}
                    onClick={() => setTarget(item)}
                  >
                    {CAPTURE_TARGET_LABELS[item]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 'adjust-when' && (
            <div className="capture-adjust">
              <p className="capture-adjust__question">Wann?</p>
              <div className="capture-adjust__options" role="group" aria-label="Zeitpunkt">
                {([
                  ['keep', primaryItem?.due ? `Vorschlag (${formatDueLabel(primaryItem.due)})` : 'Ohne Datum'],
                  ['today', 'Heute'],
                  ['tomorrow', 'Morgen'],
                  ['none', 'Kein Datum'],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={whenChoice === value ? 'capture-option is-active' : 'capture-option'}
                    onClick={() => applyWhenChoice(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 'adjust-where' && (
            <div className="capture-adjust">
              <p className="capture-adjust__question">Wohin?</p>
              <div className="capture-adjust__options" role="group" aria-label="Zielbereich">
                <button
                  type="button"
                  className={!lifeArea ? 'capture-option is-active' : 'capture-option'}
                  onClick={() => setLifeArea(undefined)}
                >
                  Unclassified
                </button>
                {LIFE_AREAS.map(area => (
                  <button
                    key={area.key}
                    type="button"
                    className={lifeArea === area.key ? 'capture-option is-active' : 'capture-option'}
                    onClick={() => setLifeArea(area.key)}
                  >
                    {area.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 'adjust-details' && (
            <div className="capture-adjust">
              <p className="capture-adjust__question">Noch Details?</p>
              <p className="capture-adjust__hint">Speichern reicht meist. Extras nur bei Bedarf.</p>
            </div>
          )}

          {step === 'adjust-more' && (
            <div className="capture-adjust">
              <p className="capture-adjust__question">Weitere Optionen</p>
              <div className="capture-adjust__stack">
                <button type="button" className="capture-sheet__ghost" onClick={() => fileRef.current?.click()}>
                  <Image size={14} /> {fileName || 'Foto / Datei'}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  hidden
                  onChange={event => onFile(event.target.files?.[0])}
                />
                {showLink || url.trim() ? (
                  <input
                    className="capture-sheet__field"
                    value={url}
                    onChange={event => setUrl(event.target.value)}
                    placeholder="https://"
                    inputMode="url"
                    autoFocus={showLink && !url.trim()}
                  />
                ) : (
                  <button type="button" className="capture-sheet__ghost" onClick={() => setShowLink(true)}>
                    <Link2 size={14} /> Link hinzufügen
                  </button>
                )}
                {onOpenPrivateNotes && (
                  <button type="button" className="capture-sheet__ghost" onClick={() => onOpenPrivateNotes(raw.trim())}>
                    <LockKeyhole size={14} /> Passcode-Sperre
                  </button>
                )}
              </div>
            </div>
          )}

          {step === 'saving' && (
            <div className="capture-sheet__status" role="status">
              <span>Speichert…</span>
            </div>
          )}

          {step === 'saved' && (
            <div className="capture-sheet__status capture-sheet__status--ok" role="status">
              <Check size={22} />
              <span>Gespeichert</span>
            </div>
          )}
        </div>

        {error && <p className="capture-sheet__error" role="alert">{error}</p>}
        {offline && step === 'input' && (
          <p className="capture-sheet__hint">Offline — Speichern möglich, Jo-Einordnung später.</p>
        )}

        {step !== 'recording' && step !== 'saved' && (
          <div className="capture-sheet__actions">
            {step === 'suggest' && (
              <button type="button" className="capture-sheet__secondary" onClick={() => setStep('adjust-type')}>
                Anpassen
              </button>
            )}
            {step === 'adjust-details' && (
              <button
                type="button"
                className="capture-sheet__secondary"
                onClick={() => setStep('adjust-more')}
              >
                Weitere Optionen
              </button>
            )}
            {(step === 'input' || step === 'suggest' || step.startsWith('adjust')) && (
              <button
                type="submit"
                className="primary-button capture-sheet__primary"
                disabled={step === 'processing' || step === 'saving' || (step === 'input' && !raw.trim() && !url.trim() && !fileName)}
              >
                {step === 'input' ? <><Sparkles size={16} /> Weiter</> : primaryLabel}
              </button>
            )}
          </div>
        )}
      </form>
    </div>,
    document.body,
  )
}
