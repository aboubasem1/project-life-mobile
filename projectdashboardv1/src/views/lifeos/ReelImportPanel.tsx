import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, FileVideo, RefreshCw, ShieldCheck, Upload, X } from 'lucide-react'
import { LIFE_AREAS } from '../../lib/lifeos'
import {
  batchReels,
  listReels,
  planVideoBatch,
  previewBulkAction,
  processReel,
  publishReel,
  reviewReel,
  uploadAndRegisterReel,
  type KnowledgePublishDraft,
  type ReelCandidate,
  type ReelReviewAction,
} from '../../lib/reels'

type LocalUpload = {
  id: string
  name: string
  progress: number
  phase: 'queued' | 'uploading' | 'done' | 'error' | 'duplicate'
  error?: string
  queued?: boolean
}

const ACTIVE = new Set(['UPLOADED', 'PROCESSING', 'EXTRACTED', 'CLASSIFIED', 'FACT_CHECK_PENDING'])
const READY = new Set(['REVIEW_READY', 'USER_REVIEWED', 'MORE_EVIDENCE', 'APPROVED_CANDIDATE'])

const STATUS_LABELS: Record<string, string> = {
  UPLOADED: 'Hochgeladen', PROCESSING: 'Wird verarbeitet', EXTRACTED: 'Transkribiert',
  CLASSIFIED: 'Sortiert', FACT_CHECK_PENDING: 'Faktencheck', REVIEW_READY: 'Bereit',
  USER_REVIEWED: 'Geprüft', APPROVED_CANDIDATE: 'Freigegeben', REJECTED: 'Verworfen',
  SOURCE_ONLY: 'Nur Quelle', MORE_EVIDENCE: 'Mehr Belege', FAILED: 'Fehler',
  DUPLICATE: 'Duplikat', SUPERSEDED: 'Ersetzt', PUBLISHED: 'Im Wissen',
}

const CLAIM_LABELS: Record<string, string> = {
  SUPPORTED: 'belegt', PARTIALLY_SUPPORTED: 'teilweise belegt', CONTRADICTED: 'widersprochen',
  UNVERIFIED: 'unbelegt', REVIEW_REQUIRED: 'prüfen',
}

function replaceReel(items: ReelCandidate[], next: ReelCandidate): ReelCandidate[] {
  return [next, ...items.filter(item => item.id !== next.id)].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

function tap(pattern: number | number[] = 12) {
  if (typeof navigator === 'undefined' || !navigator.vibrate) return
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  navigator.vibrate(pattern)
}

function statusGroup(reel: ReelCandidate): 'processing' | 'ready' | 'published' | 'failed' | 'other' {
  if (reel.knowledgeItemId || reel.status === 'PUBLISHED') return 'published'
  if (reel.status === 'FAILED') return 'failed'
  if (ACTIVE.has(reel.status) || reel.jobStatus === 'queued' || reel.jobStatus === 'running' || reel.jobStatus === 'retry') return 'processing'
  if (READY.has(reel.status) || reel.status === 'SOURCE_ONLY') return 'ready'
  return 'other'
}

export function ReelImportPanel({
  onClose,
  onPublished,
}: {
  onClose: () => void
  onPublished: (drafts: KnowledgePublishDraft[]) => number
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploads, setUploads] = useState<LocalUpload[]>([])
  const [reels, setReels] = useState<ReelCandidate[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [detailId, setDetailId] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [hint, setHint] = useState('Lass LifeOS offen, bis die Übertragung fertig ist. Die Verarbeitung kann danach auf dem Server weiterlaufen.')
  const [filter, setFilter] = useState<'all' | 'processing' | 'ready' | 'published' | 'failed'>('all')
  const [area, setArea] = useState('')
  const [risk, setRisk] = useState('')
  const [includeMedium, setIncludeMedium] = useState(false)
  const [confirm, setConfirm] = useState<'approve_publish' | 'reject' | 'source_only' | null>(null)
  const detail = reels.find(item => item.id === detailId) ?? null
  const [draft, setDraft] = useState({ title: '', summary: '', lifeArea: '', topics: '', target: 'source_only', note: '' })

  const reload = async (quiet = false) => {
    if (!quiet) setLoading(true)
    try {
      const next = await listReels()
      setReels(next)
      if (!quiet) setError('')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Reels konnten nicht geladen werden.')
    } finally {
      if (!quiet) setLoading(false)
    }
  }

  useEffect(() => { void reload() }, [])
  useEffect(() => {
    const active = reels.some(reel => statusGroup(reel) === 'processing')
    if (!active) return undefined
    const timer = window.setInterval(() => { void reload(true) }, 8000)
    return () => window.clearInterval(timer)
  }, [reels])
  useEffect(() => {
    if (!detail) return
    setDraft({
      title: detail.title,
      summary: detail.summary,
      lifeArea: detail.lifeArea,
      topics: detail.topics.join(', '),
      target: detail.suggestedTarget || 'source_only',
      note: detail.reviewerNote,
    })
  }, [detail])

  const visible = useMemo(() => reels.filter(reel => {
    if (filter !== 'all' && statusGroup(reel) !== filter) return false
    if (area && reel.lifeArea !== area) return false
    if (risk && reel.riskLevel !== risk) return false
    return true
  }), [reels, filter, area, risk])
  const chosen = reels.filter(reel => selected.includes(reel.id))
  const preview = confirm ? previewBulkAction(chosen, confirm, includeMedium) : null
  const uploading = uploads.some(item => item.phase === 'queued' || item.phase === 'uploading')
  const transferred = uploads.some(item => item.phase === 'done' || item.phase === 'duplicate')
  const backgroundReady = reels.some(reel => reel.backgroundProcessing) && uploads.some(item => item.queued)
  const stage = uploading || (transferred && !visible.some(reel => statusGroup(reel) === 'ready')) ? 'import' : visible.length || reels.length ? 'review' : 'select'

  const patchUpload = (id: string, patch: Partial<LocalUpload>) => {
    setUploads(current => current.map(item => item.id === id ? { ...item, ...patch } : item))
  }

  const startFiles = async (files: File[]) => {
    const plan = planVideoBatch(files)
    setHint(plan.hint)
    if (!plan.accepted.length) {
      setError(plan.skipped[0]?.reason || 'Bitte Videos auswählen.')
      return
    }
    const skipped = plan.skipped.length ? `${plan.skipped.length} Datei${plan.skipped.length === 1 ? '' : 'en'} für später ausgelassen.` : ''
    setNotice(skipped)
    const queue = plan.accepted.map(file => ({ id: crypto.randomUUID(), name: file.name, progress: 0, phase: 'queued' as const, file }))
    setUploads(queue.map(item => ({ id: item.id, name: item.name, progress: item.progress, phase: item.phase })))
    setError('')
    setBusy(true)
    let cursor = 0
    const concurrency = plan.accepted.some(file => file.size > 80 * 1024 * 1024) ? 1 : 2
    const worker = async () => {
      while (cursor < queue.length) {
        const item = queue[cursor++]
        try {
          patchUpload(item.id, { phase: 'uploading' })
          const registered = await uploadAndRegisterReel(item.file, progress => patchUpload(item.id, { progress }), LIFE_AREAS.map(entry => entry.key))
          setReels(current => replaceReel(current, registered.reel))
          patchUpload(item.id, {
            phase: registered.duplicate || registered.reel.status === 'DUPLICATE' ? 'duplicate' : 'done',
            progress: 100,
            queued: registered.queued,
          })
        } catch (reason) {
          patchUpload(item.id, { phase: 'error', error: reason instanceof Error ? reason.message : 'Upload fehlgeschlagen.' })
        }
      }
    }
    await Promise.all(Array.from({ length: concurrency }, () => worker()))
    setBusy(false)
    tap(20)
    await reload(true)
  }

  const runBatch = async () => {
    if (!confirm || !preview?.eligible.length) return
    setBusy(true)
    setError('')
    try {
      const result = await batchReels({ action: confirm, reels: preview.eligible, includeMediumRisk: includeMedium })
      const drafts = result.results.flatMap(item => item.ok && item.knowledge ? [item.knowledge] : [])
      const failed = result.results.filter(item => !item.ok)
      let created = 0
      if (drafts.length) created = onPublished(drafts)
      setReels(current => result.results.reduce((items, item) => item.reel ? replaceReel(items, item.reel) : items, current))
      setSelected([])
      setConfirm(null)
      setNotice(created ? `${created} Einträge sind jetzt im Knowledge.` : failed[0]?.error || 'Auswahl gespeichert.')
      tap(created ? [12, 30, 12] : 12)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Aktion fehlgeschlagen.')
    } finally {
      setBusy(false)
    }
  }

  const retry = async (reel: ReelCandidate) => {
    setBusy(true)
    setError('')
    try {
      const next = await processReel(reel.id, LIFE_AREAS.map(entry => entry.key))
      setReels(current => replaceReel(current, next))
      setNotice('Verarbeitung wurde erneut eingeplant.')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Verarbeitung fehlgeschlagen.')
    } finally {
      setBusy(false)
    }
  }

  const submitReview = async (action: ReelReviewAction) => {
    if (!detail) return
    setBusy(true)
    setError('')
    try {
      const next = await reviewReel({
        reel: detail,
        action,
        title: draft.title,
        summary: draft.summary,
        lifeArea: draft.lifeArea,
        topics: draft.topics.split(',').map(item => item.trim()).filter(Boolean),
        suggestedTarget: draft.target as ReelCandidate['suggestedTarget'],
        reviewerNote: draft.note,
      })
      setReels(current => replaceReel(current, next))
      if (action === 'approve_candidate') {
        const published = await publishReel(next, false)
        const created = onPublished([published.knowledge])
        setReels(current => replaceReel(current, published.reel))
        setNotice(created ? 'In Knowledge gespeichert.' : 'Dieser Eintrag war bereits im Knowledge.')
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Review konnte nicht gespeichert werden.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card reel-import">
      <div className="reel-import__header">
        <div>
          <span className="eyebrow">Wissen</span>
          <h2>Reels importieren</h2>
          <p>Wähle Videos aus Fotos oder Dateien. Nach dem Upload läuft die Verarbeitung auf dem Server weiter.</p>
        </div>
        <button type="button" className="icon-button" aria-label="Reel-Import schließen" onClick={onClose}><X size={18} /></button>
      </div>

      <div className="reel-import__steps" aria-label="Ablauf">
        <span className={stage === 'select' ? 'is-current' : ''}><b>1</b> Auswählen</span>
        <span className={stage === 'import' ? 'is-current' : ''}><b>2</b> Importieren</span>
        <span className={stage === 'review' ? 'is-current' : ''}><b>3</b> Wissen übernehmen</span>
      </div>

      <div className="reel-import__actions">
          <input ref={inputRef} hidden type="file" multiple accept="video/mp4,video/quicktime,video/webm,video/*,.mp4,.mov,.m4v,.webm" onChange={event => {
            const files = [...(event.target.files ?? [])]
            event.target.value = ''
            void startFiles(files)
          }} />
          <button type="button" className="primary-button reel-touch" disabled={busy} onClick={() => inputRef.current?.click()}>
            <Upload size={16} /> Videos auswählen
          </button>
        </div>
      <p className="reel-review-detail__guard">{hint} Wenn das iPhone nur ein Video anbietet, starte die nächste Runde — bereits übertragene bleiben erhalten.</p>
      {error && <p className="reel-import__error" role="alert">{error}</p>}
      {notice && <p className="reel-import__notice">{notice}</p>}
      {!uploading && transferred && backgroundReady && (
        <p className="reel-import__notice">Deine Videos werden auf dem Server verarbeitet. Du kannst LifeOS jetzt schließen.</p>
      )}
      {!uploading && uploads.some(item => item.phase === 'done' && !item.queued) && (
        <p className="reel-import__error">Übertragen, aber noch nicht zur Verarbeitung eingeplant. Öffne den Eintrag und starte sie erneut.</p>
      )}

      {uploads.length > 0 && (
        <div className="reel-upload-list" aria-live="polite">
          {uploads.map(item => (
            <div key={item.id} className={`reel-upload-row is-${item.phase}`}>
              <FileVideo size={17} />
              <span>{item.name}</span>
              <progress max={100} value={item.progress} aria-label={`Upload ${item.name}`} />
              <small>{item.phase === 'queued' ? 'wartet' : item.phase === 'uploading' ? `${item.progress}%` : item.phase === 'done' ? 'übertragen' : item.phase === 'duplicate' ? 'schon vorhanden' : item.error}</small>
            </div>
          ))}
        </div>
      )}

      {loading ? <p>Bisherige Importe werden geladen …</p> : reels.length === 0 ? (
        <div className="reel-import__empty"><FileVideo size={26} /><strong>Noch keine Reels</strong><span>Wähle Videos aus der Fotos-App oder aus Dateien.</span></div>
      ) : (
        <div className="reel-review-layout">
          <div>
            <div className="reel-import__filters" aria-label="Filter">
              {(['all', 'processing', 'ready', 'published', 'failed'] as const).map(key => (
                <button key={key} type="button" className={filter === key ? 'small-button is-active' : 'small-button'} onClick={() => setFilter(key)}>
                  {key === 'all' ? 'Alle' : key === 'processing' ? 'Läuft' : key === 'ready' ? 'Prüfen' : key === 'published' ? 'Wissen' : 'Fehler'}
                </button>
              ))}
            </div>
            <div className="lifeos-inline">
              <label className="text-field"><span className="sr-only">Themenbereich</span>
                <select aria-label="Themenbereich" value={area} onChange={event => setArea(event.target.value)}>
                  <option value="">Alle Bereiche</option>
                  {LIFE_AREAS.map(entry => <option key={entry.key} value={entry.key}>{entry.name}</option>)}
                </select>
              </label>
              <label className="text-field"><span className="sr-only">Risiko</span>
                <select aria-label="Risiko" value={risk} onChange={event => setRisk(event.target.value)}>
                  <option value="">Jedes Risiko</option>
                  <option value="low">Niedrig</option>
                  <option value="medium">Mittel</option>
                  <option value="high">Hoch</option>
                </select>
              </label>
            </div>
            <div className="reel-review-list">
              {visible.map(reel => (
                <div key={reel.id} className={detailId === reel.id ? 'reel-review-item is-active' : 'reel-review-item'}>
                  <input aria-label={`${reel.title || reel.originalName || 'Reel'} auswählen`} type="checkbox" checked={selected.includes(reel.id)} onChange={event => setSelected(current => event.target.checked ? [...current, reel.id] : current.filter(id => id !== reel.id))} />
                  <button type="button" className="reel-review-open" onClick={() => setDetailId(reel.id)}>
                    <strong>{reel.title || reel.originalName || 'Unbenanntes Reel'}</strong>
                    <small>{reel.summary || reel.originalName || STATUS_LABELS[reel.status]}</small>
                  </button>
                  <em className={`reel-status is-${reel.status.toLowerCase()}`}>{STATUS_LABELS[reel.status] || reel.status}</em>
                </div>
              ))}
            </div>
          </div>

          <div className="reel-review-detail">
            {chosen.length > 0 && !confirm && (
              <div className="reel-review-actions">
                <button type="button" className="primary-button reel-touch" disabled={busy} onClick={() => setConfirm('approve_publish')}><Check size={16} /> Übernehmen</button>
                <button type="button" className="secondary-button reel-touch" disabled={busy} onClick={() => setConfirm('source_only')}>Nur Quelle</button>
                <button type="button" className="secondary-button reel-touch" disabled={busy} onClick={() => setConfirm('reject')}>Verwerfen</button>
                <label className="reel-medium-toggle"><input type="checkbox" checked={includeMedium} onChange={event => setIncludeMedium(event.target.checked)} /> Mittleres Risiko einschließen</label>
              </div>
            )}
            {confirm && preview && (
              <div className="reel-import__notice">
                <strong>{preview.eligible.length} Einträge</strong>
                <p>{confirm === 'approve_publish' ? 'werden ins Knowledge übernommen.' : confirm === 'source_only' ? 'bleiben als Quelle gespeichert, ohne Leitlinie zu werden.' : 'werden verworfen.'} {preview.blocked.length > 0 ? `${preview.blocked.length} bleiben unberührt, darunter hohes Risiko.` : ''}</p>
                <div className="reel-review-actions">
                  <button type="button" className="primary-button reel-touch" disabled={busy || preview.eligible.length === 0} onClick={() => void runBatch()}>Bestätigen</button>
                  <button type="button" className="secondary-button reel-touch" disabled={busy} onClick={() => setConfirm(null)}>Zurück</button>
                </div>
              </div>
            )}
            <button type="button" className="secondary-button" disabled={loading} onClick={() => void reload()}><RefreshCw size={15} /> Aktualisieren</button>
            {detail ? (
              <details open>
                <summary>Details prüfen</summary>
                <div className="reel-review-detail__meta">
                  <span className={`reel-risk is-${detail.riskLevel}`}>Risiko: {detail.riskLevel}</span>
                  <span>Nützlichkeit: {detail.usefulnessScore ?? '–'}/100</span>
                </div>
                {detail.errorMessage && <div className="reel-import__error">{detail.errorMessage} <button type="button" disabled={busy} onClick={() => void retry(detail)}>Erneut versuchen</button></div>}
                {detail.jobStatus === 'dead' && <button type="button" disabled={busy} onClick={() => void retry(detail)}>Erneut verarbeiten</button>}
                <label className="text-field"><span>Titel</span><input value={draft.title} onChange={event => setDraft(current => ({ ...current, title: event.target.value }))} /></label>
                <label className="text-field"><span>Zusammenfassung</span><textarea rows={4} value={draft.summary} onChange={event => setDraft(current => ({ ...current, summary: event.target.value }))} /></label>
                <div className="lifeos-inline">
                  <label className="text-field"><span>Themenbereich</span><select value={draft.lifeArea} onChange={event => setDraft(current => ({ ...current, lifeArea: event.target.value }))}>
                    <option value="">Noch offen</option>{LIFE_AREAS.map(entry => <option key={entry.key} value={entry.key}>{entry.name}</option>)}
                  </select></label>
                  <label className="text-field"><span>Ziel</span><select value={draft.target} onChange={event => setDraft(current => ({ ...current, target: event.target.value }))}>
                    <option value="knowledge">Knowledge</option><option value="guideline">Leitlinie</option><option value="source_only">Nur Quelle</option><option value="reject">Verwerfen</option>
                  </select></label>
                </div>
                <label className="text-field"><span>Topics</span><input value={draft.topics} onChange={event => setDraft(current => ({ ...current, topics: event.target.value }))} /></label>
                <div className="reel-claims">
                  <h3><ShieldCheck size={17} /> Aussagen</h3>
                  {detail.claims.length === 0 ? <p>Keine eigenständige Tatsachenbehauptung erkannt.</p> : detail.claims.map(claim => (
                    <article key={claim.id} className={`reel-claim is-${claim.verificationStatus.toLowerCase()}`}>
                      <div><strong>{CLAIM_LABELS[claim.verificationStatus]}</strong><span>{claim.text}</span></div>
                      {claim.note && <small>{claim.note}</small>}
                    </article>
                  ))}
                </div>
                <details><summary>Transkript</summary><div className="reel-transcript">{detail.transcript || 'Keine Sprache erkannt.'}{detail.onScreenText ? `\n\nBildschirmtext:\n${detail.onScreenText}` : ''}</div></details>
                <label className="text-field"><span>Notiz</span><textarea rows={2} value={draft.note} onChange={event => setDraft(current => ({ ...current, note: event.target.value }))} /></label>
                <div className="reel-review-actions">
                  <button type="button" className="primary-button" disabled={busy} onClick={() => void submitReview('approve_candidate')}>Einzeln übernehmen</button>
                  <button type="button" className="secondary-button" disabled={busy} onClick={() => void submitReview('more_evidence')}>Mehr Belege</button>
                </div>
              </details>
            ) : <p className="reel-review-detail__guard">Wähle Einträge und übernimm sie gesammelt. Hohes Risiko bleibt einzeln prüfbar.</p>}
            {visible[0] && !detail && <button type="button" className="secondary-button" onClick={() => setDetailId(visible[0].id)}>Einen Eintrag öffnen</button>}
            {detail && <button type="button" className="secondary-button" onClick={() => setDetailId('')}>Details schließen</button>}
          </div>
        </div>
      )}
    </section>
  )
}
