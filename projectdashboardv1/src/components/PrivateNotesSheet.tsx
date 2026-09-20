import { useState, type FormEvent } from 'react'
import { Check, KeyRound, LockKeyhole, Plus, ShieldCheck, Trash2, X } from 'lucide-react'
import {
  createPrivateNote,
  decryptPrivateVault,
  encryptPrivateVault,
  loadPrivateVaultEnvelope,
  savePrivateVaultEnvelope,
  type PrivateNote,
} from '../lib/privateVault'

export function PrivateNotesSheet({
  initialText = '',
  onClose,
  onSaved,
}: {
  initialText?: string
  onClose: () => void
  onSaved?: () => void
}) {
  const [envelope, setEnvelope] = useState(() => loadPrivateVaultEnvelope())
  const [notes, setNotes] = useState<PrivateNote[] | null>(null)
  const [passcode, setPasscode] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [draft, setDraft] = useState(initialText)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const createVault = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    if (passcode.length < 4) {
      setError('Der Passcode braucht mindestens 4 Zeichen.')
      return
    }
    if (passcode !== confirmation) {
      setError('Die Passcodes stimmen nicht überein.')
      return
    }
    setBusy(true)
    try {
      const nextNotes = draft.trim() ? [createPrivateNote(draft)] : []
      const nextEnvelope = await encryptPrivateVault(passcode, nextNotes)
      savePrivateVaultEnvelope(nextEnvelope)
      setEnvelope(nextEnvelope)
      setNotes(nextNotes)
      setDraft('')
      setSaved(Boolean(nextNotes.length))
      if (nextNotes.length > 0) onSaved?.()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Privater Bereich konnte nicht angelegt werden.')
    } finally {
      setBusy(false)
    }
  }

  const unlockVault = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const decrypted = await decryptPrivateVault(passcode, envelope)
      setNotes(decrypted)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Entsperren fehlgeschlagen.')
    } finally {
      setBusy(false)
    }
  }

  const saveNote = async (event: FormEvent) => {
    event.preventDefault()
    if (!notes) return
    if (!draft.trim()) {
      setError('Schreib zuerst eine private Notiz.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const nextNotes = [createPrivateNote(draft), ...notes]
      const nextEnvelope = await encryptPrivateVault(passcode, nextNotes)
      savePrivateVaultEnvelope(nextEnvelope)
      setEnvelope(nextEnvelope)
      setNotes(nextNotes)
      setDraft('')
      setSaved(true)
      onSaved?.()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Notiz konnte nicht gespeichert werden.')
    } finally {
      setBusy(false)
    }
  }

  const deleteNote = async (note: PrivateNote) => {
    if (!notes || !window.confirm('Private Notiz wirklich löschen?')) return
    setBusy(true)
    setError('')
    try {
      const nextNotes = notes.filter(item => item.id !== note.id)
      const nextEnvelope = await encryptPrivateVault(passcode, nextNotes)
      savePrivateVaultEnvelope(nextEnvelope)
      setEnvelope(nextEnvelope)
      setNotes(nextNotes)
      onSaved?.()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Notiz konnte nicht gelöscht werden.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="modal-backdrop private-vault-backdrop"
      role="presentation"
      onMouseDown={event => event.target === event.currentTarget && onClose()}
    >
      <section className="modal modal--small private-vault" role="dialog" aria-modal="true" aria-labelledby="private-vault-title">
        <div className="modal-header">
          <div>
            <span className="eyebrow">Private Memo</span>
            <h2 id="private-vault-title">Passcode-geschützt</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Schließen">
            <X size={18} />
          </button>
        </div>

        {!envelope && (
          <form className="private-vault__stack" onSubmit={createVault}>
            <div className="private-vault__seal" aria-hidden="true"><ShieldCheck size={28} /></div>
            <p>Lege einmalig einen Passcode fest. Notizen werden vor dem Speichern auf diesem Gerät verschlüsselt.</p>
            <label className="private-vault__field">
              <span>Neuer Passcode</span>
              <input
                type="password"
                inputMode="numeric"
                autoComplete="new-password"
                value={passcode}
                onChange={event => setPasscode(event.target.value)}
                placeholder="Mindestens 4 Zeichen"
                autoFocus
              />
            </label>
            <label className="private-vault__field">
              <span>Passcode wiederholen</span>
              <input
                type="password"
                inputMode="numeric"
                autoComplete="new-password"
                value={confirmation}
                onChange={event => setConfirmation(event.target.value)}
              />
            </label>
            {initialText.trim() && (
              <p className="private-vault__pending"><LockKeyhole size={15} /> Deine aktuelle Notiz wird direkt eingeschlossen.</p>
            )}
            <p className="private-vault__warning">Wichtig: Der Passcode wird nicht gespeichert und kann nicht wiederhergestellt werden. Sechs oder mehr Zeichen sind empfohlen.</p>
            {error && <p className="lifeos-error" role="alert">{error}</p>}
            <button type="submit" className="primary-button" disabled={busy}>
              <KeyRound size={17} /> {busy ? 'Wird verschlüsselt…' : 'Privaten Bereich anlegen'}
            </button>
          </form>
        )}

        {envelope && notes === null && (
          <form className="private-vault__stack" onSubmit={unlockVault}>
            <div className="private-vault__seal" aria-hidden="true"><LockKeyhole size={28} /></div>
            <p>Nur der richtige Passcode entschlüsselt deine privaten Notizen.</p>
            <label className="private-vault__field">
              <span>Passcode</span>
              <input
                type="password"
                inputMode="numeric"
                autoComplete="current-password"
                value={passcode}
                onChange={event => setPasscode(event.target.value)}
                autoFocus
              />
            </label>
            {error && <p className="lifeos-error" role="alert">{error}</p>}
            <button type="submit" className="primary-button" disabled={busy || !passcode}>
              <KeyRound size={17} /> {busy ? 'Entschlüsselt…' : 'Entsperren'}
            </button>
          </form>
        )}

        {notes !== null && (
          <div className="private-vault__stack">
            <div className="private-vault__status">
              <span><ShieldCheck size={16} /> Entsperrt</span>
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  setNotes(null)
                  setPasscode('')
                  setError('')
                }}
              >
                Sperren
              </button>
            </div>
            <form className="private-vault__composer" onSubmit={saveNote}>
              <textarea
                value={draft}
                onChange={event => setDraft(event.target.value)}
                rows={4}
                maxLength={10_000}
                placeholder="Private Notiz…"
                autoFocus={Boolean(initialText)}
              />
              {error && <p className="lifeos-error" role="alert">{error}</p>}
              {saved && !error && <p className="private-vault__saved"><Check size={15} /> Verschlüsselt gespeichert</p>}
              <button type="submit" className="primary-button" disabled={busy || !draft.trim()}>
                <Plus size={17} /> {busy ? 'Speichert…' : 'Private Notiz speichern'}
              </button>
            </form>
            <div className="private-vault__notes">
              <div className="private-vault__notes-head">
                <strong>Deine privaten Notizen</strong>
                <span>{notes.length}</span>
              </div>
              {notes.length === 0 ? (
                <p className="private-vault__empty">Noch keine privaten Notizen.</p>
              ) : (
                <ul>
                  {notes.map(note => (
                    <li key={note.id}>
                      <div>
                        <p>{note.text}</p>
                        <time dateTime={note.createdAt}>
                          {new Intl.DateTimeFormat('de-DE', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          }).format(new Date(note.createdAt))}
                        </time>
                      </div>
                      <button type="button" className="icon-button" onClick={() => void deleteNote(note)} aria-label="Private Notiz löschen">
                        <Trash2 size={16} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
