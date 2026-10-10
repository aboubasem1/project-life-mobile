import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, FileVideo, RefreshCw, ShieldCheck, Upload, X } from 'lucide-react'
import { LIFE_AREAS } from '../../lib/lifeos'
import { listReels, processReel, reviewReel, uploadAndRegisterReel, type ReelCandidate, type ReelReviewAction } from '../../lib/reels'

type LocalUpload = {
  id: string
  file: File
  progress: number
  phase: 'queued' | 'uploading' | 'processing' | 'done' | 'error' | 'duplicate'
  error?: string
}

const STATUS_LABELS: Record<string, string> = {
  UPLOADED: 'Hochgeladen', PROCESSING: 'Wird verarbeitet', EXTRACTED: 'Transkribiert',
  CLASSIFIED: 'Sortiert', FACT_CHECK_PENDING: 'Faktencheck', REVIEW_READY: 'Bereit zur Prüfung',
  USER_REVIEWED: 'Geprüft', APPROVED_CANDIDATE: 'Freigegebener Entwurf', REJECTED: 'Verworfen',
  SOURCE_ONLY: 'Nur Quelle', MORE_EVIDENCE: 'Mehr Belege nötig', FAILED: 'Fehler',
  DUPLICATE: 'Duplikat', SUPERSEDED: 'Ersetzt',
}

const CLAIM_LABELS: Record<string, string> = {
  SUPPORTED: 'belegt', PARTIALLY_SUPPORTED: 'teilweise belegt', CONTRADICTED: 'widersprochen',
  UNVERIFIED: 'unbelegt', REVIEW_REQUIRED: 'prüfen',
}

function replaceReel(items: ReelCandidate[], next: ReelCandidate): ReelCandidate[] {
  return [next, ...items.filter(item => item.id !== next.id)].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function ReelImportPanel({ onClose }: { onClose: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploads, setUploads] = useState<LocalUpload[]>([])
  const [reels, setReels] = useState<ReelCandidate[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const selected = reels.find(item => item.id === selectedId) ?? reels.find(item => item.status === 'REVIEW_READY') ?? reels[0]
  const [draft, setDraft] = useState({ title: '', summary: '', lifeArea: '', topics: '', target: 'source_only', note: '' })

  const counts = useMemo(() => ({
    total: reels.length,
    ready: reels.filter(item => item.status === 'REVIEW_READY').length,
    approved: reels.filter(item => item.status === 'APPROVED_CANDIDATE').length,
    failed: reels.filter(item => item.status === 'FAILED').length,
  }), [reels])

  const reload = async () => {
    setLoading(true)
    setError('')
    try { setReels(await listReels()) } catch (reason) { setError(reason instanceof Error ? reason.message : 'Reels konnten nicht geladen werden.') }
    finally { setLoading(false) }
  }

  useEffect(() => { void reload() }, [])
  useEffect(() => {
    if (!selected) return
    setDraft({
      title: selected.title,
      summary: selected.summary,
      lifeArea: selected.lifeArea,
      topics: selected.topics.join(', '),
      target: selected.suggestedTarget || 'source_only',
      note: selected.reviewerNote,
    })
  }, [selected])

  const patchUpload = (id: string, patch: Partial<LocalUpload>) => {
    setUploads(current => current.map(item => item.id === id ? { ...item, ...patch } : item))
  }

  const startFiles = async (files: File[]) => {
    const accepted = files.filter(file => file.type.startsWith('video/') || /\.(mp4|mov|m4v|webm)$/i.test(file.name)).slice(0, 50)
    if (!accepted.length) { setError('Bitte Video-Dateien auswählen.'); return }
    const queue = accepted.map(file => ({ id: crypto.randomUUID(), file, progress: 0, phase: 'queued' as const }))
    setUploads(queue)
    setError('')
    setBusy(true)
    let cursor = 0
    const worker = async () => {
      while (cursor < queue.length) {
        const item = queue[cursor++]
        try {
          patchUpload(item.id, { phase: 'uploading' })
          const registered = await uploadAndRegisterReel(item.file, progress => patchUpload(item.id, { progress }))
          setReels(current => replaceReel(current, registered))
          if (registered.status === 'DUPLICATE') {
            patchUpload(item.id, { phase: 'duplicate', progress: 100 })
            continue
          }
          patchUpload(item.id, { phase: 'processing', progress: 100 })
          const processed = await processReel(registered.id, LIFE_AREAS.map(area => area.key))
          setReels(current => replaceReel(current, processed))
          setSelectedId(current => current || processed.id)
          patchUpload(item.id, { phase: 'done' })
        } catch (reason) {
          patchUpload(item.id, { phase: 'error', error: reason instanceof Error ? reason.message : 'Fehler' })
        }
      }
    }
    await Promise.all([worker(), worker()])
    setBusy(false)
    await reload()
  }

  const retry = async (reel: ReelCandidate) => {
    setBusy(true)
    setError('')
    try {
      const next = await processReel(reel.id, LIFE_AREAS.map(area => area.key))
      setReels(current => replaceReel(current, next))
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Verarbeitung fehlgeschlagen.') }
    finally { setBusy(false) }
  }

  const submitReview = async (action: ReelReviewAction) => {
    if (!selected) return
    setBusy(true)
    setError('')
    try {
      const next = await reviewReel({
        reel: selected,
        action,
        title: draft.title,
        summary: draft.summary,
        lifeArea: draft.lifeArea,
        topics: draft.topics.split(',').map(item => item.trim()).filter(Boolean),
        suggestedTarget: draft.target as ReelCandidate['suggestedTarget'],
        reviewerNote: draft.note,
      })
      setReels(current => replaceReel(current, next))
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Review konnte nicht gespeichert werden.') }
    finally { setBusy(false) }
  }

  return (
    <section className="card reel-import">
      <div className="reel-import__header">
        <div>
          <span className="eyebrow">Reel Inbox</span>
          <h2>Hochladen → automatisch prüfen → selbst freigeben</h2>
          <p>Bis zu 50 Videos pro Runde. Nichts wird automatisch in Knowledge oder Leitlinien veröffentlicht.</p>
        </div>
        <button type="button" className="icon-button" aria-label="Reel-Import schließen" onClick={onClose}><X size={18} /></button>
      </div>

      <div className="reel-import__steps" aria-label="Ablauf">
        <span><b>1</b> Videos wählen</span><span><b>2</b> Automatik läuft</span><span><b>3</b> Ergebnisse prüfen</span>
      </div>

      <div className="reel-import__actions">
        <input ref={inputRef} hidden type="file" multiple accept="video/*,.mp4,.mov,.m4v,.webm" onChange={event => {
          const files = [...(event.target.files ?? [])]
          event.target.value = ''
          void startFiles(files)
        }} />
        <button type="button" className="primary-button" disabled={busy} onClick={() => inputRef.current?.click()}>
          <Upload size={16} /> Reels auswählen
        </button>
        <button type="button" className="secondary-button" disabled={loading} onClick={() => void reload()}><RefreshCw size={15} /> Aktualisieren</button>
      </div>

      {error && <p className="reel-import__error">{error}</p>}
      {uploads.length > 0 && (
        <div className="reel-upload-list">
          {uploads.map(item => (
            <div key={item.id} className={`reel-upload-row is-${item.phase}`}>
              <FileVideo size={17} /><span>{item.file.name}</span>
              <progress max={100} value={item.phase === 'processing' ? undefined : item.progress} />
              <small>{item.phase === 'queued' ? 'wartet' : item.phase === 'uploading' ? `${item.progress}%` : item.phase === 'processing' ? 'Transkript + Prüfung' : item.phase === 'done' ? 'fertig' : item.phase === 'duplicate' ? 'schon vorhanden' : item.error}</small>
            </div>
          ))}
        </div>
      )}

      <div className="reel-import__stats">
        <span><b>{counts.total}</b> gesamt</span><span><b>{counts.ready}</b> zu prüfen</span><span><b>{counts.approved}</b> Entwürfe</span><span><b>{counts.failed}</b> Fehler</span>
      </div>

      {loading ? <p>Reels werden geladen …</p> : reels.length === 0 ? (
        <div className="reel-import__empty"><FileVideo size={26} /><strong>Noch keine Reels</strong><span>Wähle oben deine ersten Videos aus der Mac-Galerie.</span></div>
      ) : (
        <div className="reel-review-layout">
          <div className="reel-review-list">
            {reels.map(reel => (
              <button key={reel.id} type="button" className={reel.id === selected?.id ? 'reel-review-item is-active' : 'reel-review-item'} onClick={() => setSelectedId(reel.id)}>
                <span><strong>{reel.title || reel.originalName || 'Unbenanntes Reel'}</strong><small>{reel.originalName}</small></span>
                <em className={`reel-status is-${reel.status.toLowerCase()}`}>{STATUS_LABELS[reel.status] || reel.status}</em>
              </button>
            ))}
          </div>

          {selected && <div className="reel-review-detail">
            <div className="reel-review-detail__meta">
              <span className={`reel-risk is-${selected.riskLevel}`}>Risiko: {selected.riskLevel}</span>
              <span>Nützlichkeit: {selected.usefulnessScore ?? '–'}/100</span>
              <span>JEV: {selected.jev?.available ? `${Math.round((selected.jev.confidence ?? 0) * 100)}%` : 'manuell prüfen'}</span>
            </div>
            {selected.errorMessage && <div className="reel-import__error">{selected.errorMessage} <button type="button" disabled={busy} onClick={() => void retry(selected)}>Erneut versuchen</button></div>}
            <label className="text-field"><span>Titel</span><input value={draft.title} onChange={event => setDraft(current => ({ ...current, title: event.target.value }))} /></label>
            <label className="text-field"><span>Zusammenfassung</span><textarea rows={4} value={draft.summary} onChange={event => setDraft(current => ({ ...current, summary: event.target.value }))} /></label>
            <div className="lifeos-inline">
              <label className="text-field"><span>Themenbereich</span><select value={draft.lifeArea} onChange={event => setDraft(current => ({ ...current, lifeArea: event.target.value }))}>
                <option value="">Noch offen</option>{LIFE_AREAS.map(area => <option key={area.key} value={area.key}>{area.name}</option>)}
              </select></label>
              <label className="text-field"><span>Ziel</span><select value={draft.target} onChange={event => setDraft(current => ({ ...current, target: event.target.value }))}>
                <option value="knowledge">Knowledge</option><option value="guideline">Leitlinie</option><option value="source_only">Nur Quelle</option><option value="reject">Verwerfen</option>
              </select></label>
            </div>
            <label className="text-field"><span>Topics (Komma)</span><input value={draft.topics} onChange={event => setDraft(current => ({ ...current, topics: event.target.value }))} /></label>

            <div className="reel-claims">
              <h3><ShieldCheck size={17} /> Aussagen & Belege</h3>
              {selected.claims.length === 0 ? <p>Keine eigenständige Tatsachenbehauptung erkannt.</p> : selected.claims.map(claim => (
                <article key={claim.id} className={`reel-claim is-${claim.verificationStatus.toLowerCase()}`}>
                  <div><strong>{CLAIM_LABELS[claim.verificationStatus]}</strong><span>{claim.text}</span></div>
                  {claim.note && <small>{claim.note}</small>}
                  {claim.evidence.length > 0 && <ul>{claim.evidence.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.title || source.url}</a></li>)}</ul>}
                </article>
              ))}
            </div>

            <details><summary>Transkript & Bildschirmtext</summary><div className="reel-transcript">
              {selected.transcript || 'Keine Sprache erkannt.'}
              {selected.onScreenText && <>\n\nBildschirmtext:\n{selected.onScreenText}</>}
            </div></details>
            <label className="text-field"><span>Deine Prüfnotiz</span><textarea rows={2} value={draft.note} onChange={event => setDraft(current => ({ ...current, note: event.target.value }))} /></label>
            <div className="reel-review-actions">
              <button type="button" className="primary-button" disabled={busy || !['REVIEW_READY', 'USER_REVIEWED', 'MORE_EVIDENCE', 'APPROVED_CANDIDATE', 'SOURCE_ONLY', 'REJECTED'].includes(selected.status)} onClick={() => void submitReview('approve_candidate')}><Check size={16} /> Als Entwurf freigeben</button>
              <button type="button" className="secondary-button" disabled={busy} onClick={() => void submitReview('more_evidence')}>Mehr Belege</button>
              <button type="button" className="secondary-button" disabled={busy} onClick={() => void submitReview('source_only')}>Nur Quelle</button>
              <button type="button" className="secondary-button" disabled={busy} onClick={() => void submitReview('reject')}>Verwerfen</button>
            </div>
            <p className="reel-review-detail__guard">„Freigeben“ erstellt nur einen geprüften Entwurf. Finales Publizieren bleibt gesperrt.</p>
          </div>}
        </div>
      )}
    </section>
  )
}
