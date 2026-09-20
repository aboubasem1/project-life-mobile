import { useRef, useState, type FormEvent } from 'react'
import { Inbox, LockKeyhole, X } from 'lucide-react'
import { CAPTURE_TARGET_LABELS, type CaptureTargetType, type LifeAreaKey } from '../../lib/lifeos'
import { Field, LifeAreaSelect } from './lifeosUi'

const TARGETS: CaptureTargetType[] = ['inbox', 'task', 'note', 'knowledge', 'goal', 'event', 'decision', 'reference']
const MAX_FILE_CHARS = 350_000

export function CaptureSheet({
  onClose,
  onCapture,
  onOpenPrivateNotes,
  initialRaw = '',
  inactive = false,
}: {
  onClose: () => void
  initialRaw?: string
  onOpenPrivateNotes?: (text: string) => void
  inactive?: boolean
  onCapture: (input: {
    raw: string
    url?: string
    fileName?: string
    fileKind?: 'file' | 'screenshot'
    fileDataUrl?: string
    classifyAs?: CaptureTargetType
    lifeArea?: LifeAreaKey
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
  const fileRef = useRef<HTMLInputElement | null>(null)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!raw.trim() && !url.trim() && !fileName) {
      setError('Schreib etwas, füge einen Link hinzu oder wähle eine Datei.')
      return
    }
    onCapture({
      raw: raw.trim() || url.trim() || fileName,
      url: url.trim() || undefined,
      fileName: fileName || undefined,
      fileKind,
      fileDataUrl,
      classifyAs: target,
      lifeArea,
    })
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

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      aria-hidden={inactive || undefined}
      inert={inactive || undefined}
      onMouseDown={event => event.target === event.currentTarget && onClose()}
    >
      <form className="modal modal--small" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="capture-title">
        <div className="modal-header">
          <div>
            <span className="eyebrow">Capture</span>
            <h2 id="capture-title">Schnell erfassen</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Schließen"><X size={18} /></button>
        </div>
        <p className="field-hint">Erst ablegen. Klassifizieren kannst du später in der Inbox.</p>
        <Field label="Was liegt an?">
          <textarea
            value={raw}
            onChange={event => setRaw(event.target.value)}
            placeholder="Gedanke, Aufgabe, Link, Entscheidung…"
            rows={4}
            autoFocus
          />
        </Field>
        <Field label="Link (optional)">
          <input value={url} onChange={event => setUrl(event.target.value)} placeholder="https://" inputMode="url" />
        </Field>
        <div className="lifeos-file-row">
          <button type="button" className="secondary-button" onClick={() => fileRef.current?.click()}>
            Datei / Screenshot
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
        {error && <p className="lifeos-error">{error}</p>}
        <div className="modal-actions capture-modal-actions">
          {onOpenPrivateNotes && (
            <button type="button" className="secondary-button" onClick={() => onOpenPrivateNotes(raw.trim())}>
              <LockKeyhole size={16} /> Passcode-geschützt
            </button>
          )}
          <button type="submit" className="primary-button">
            <Inbox size={16} /> In Inbox legen
          </button>
        </div>
      </form>
    </div>
  )
}
