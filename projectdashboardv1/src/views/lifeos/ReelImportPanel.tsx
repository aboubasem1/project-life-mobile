import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, FileVideo, RefreshCw, ShieldCheck, Upload, X } from 'lucide-react'
import { LIFE_AREAS } from '../../lib/lifeos'
import { validateReelFile, MAX_REEL_BATCH } from '../../lib/reels/import-session'
import { getReel, batchReviewReels, publishReel, recoverReelUploads, listReels, processReel, reviewReel, uploadAndRegisterReel, type ReelCandidate, type ReelReviewAction } from '../../lib/reels'

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
  const selected = reels.find(item => item.id === selectedId)
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [workerAvailable, setWorkerAvailable] = useState(false)
  const [notice, setNotice] = useState('')
  const [filter, setFilter] = useState('')
  const [areaFilter, setAreaFilter] = useState('')
  const [riskFilter, setRiskFilter] = useState('')
  const [checked, setChecked] = useState<string[]>([])
  const [batchAction, setBatchAction] = useState<'publish' | 'reject' | 'source_only' | ''>('')
  const visible = reels.filter(r => (!filter || (filter === 'published' ? r.publishedId : r.status === filter)) && (!areaFilter || r.lifeArea === areaFilter) && (!riskFilter || r.riskLevel === riskFilter))
  const [draft, setDraft] = useState({ title: '', summary: '', lifeArea: '', topics: '', target: 'source_only', note: '' })

  const counts = useMemo(() => ({
    total: reels.length,
    ready: reels.filter(item => item.status === 'REVIEW_READY').length,
    approved: reels.filter(item => item.publishedId).length,
    failed: reels.filter(item => item.status === 'FAILED').length,
  }), [reels])

  const reload = async () => {
    setLoading(true)
    setError('')
    try { const result = await listReels(); setReels(result.reels); setWorkerAvailable(result.workerAvailable) } catch (reason) { setError(reason instanceof Error ? reason.message : 'Reels konnten nicht geladen werden.') }
    finally { setLoading(false) }
  }

  useEffect(() => {
    void recoverReelUploads().then(count => { if (count) setNotice(`${count} Übertragungen sind unvollständig. Bitte die betroffenen Videos erneut auswählen.`) }).finally(() => { void reload() })
    const poll = () => {
      if (document.hidden) return
      void listReels().then(result => {
        setWorkerAvailable(result.workerAvailable)
        setReels(current => result.reels.map(next => current.find(old => old.id === next.id && old.version === next.version && old.jobState === next.jobState && old.publishedId === next.publishedId && old.jobAvailableAt === next.jobAvailableAt) || next))
      }).catch(() => { /* Keep the last confirmed server state while offline. */ })
    }
    const timer = window.setInterval(poll, 5000)
    document.addEventListener('visibilitychange', poll)
  return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', poll) }
  }, [])
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
    const accepted = files.filter(file => !validateReelFile(file)).slice(0, MAX_REEL_BATCH)
    if (!accepted.length) { setError('Bitte Video-Dateien auswählen.'); return }
    const queue = accepted.map(file => ({ id: crypto.randomUUID(), file, progress: 0, phase: 'queued' as const }))
    setUploads(current => [...current, ...queue])
    setPendingFiles([])
    setError('')
    setNotice('')
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
          patchUpload(item.id, { phase: 'done', progress: 100 })
        } catch (reason) {
          patchUpload(item.id, { phase: 'error', error: reason instanceof Error ? reason.message : 'Fehler' })
        }
      }
    }
    await worker()
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
      if (action === 'approve_candidate') {
        const publishedId = await publishReel(next)
        setReels(current => replaceReel(current, { ...next, publishedId }))
        setNotice('In Knowledge gespeichert. Der Geräte-Sync übernimmt den Eintrag.')
      } else setReels(current => replaceReel(current, next))
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Review konnte nicht gespeichert werden.') }
    finally { setBusy(false) }
  }

  const submitBatch = async () => {
    if (!batchAction) return
    setBusy(true)
    setError('')
    try {
      const result = await batchReviewReels(reels.filter(r => checked.includes(r.id)).slice(0, 50), batchAction)
      const failed = result.filter(r => r.error)
      setNotice(`${result.length - failed.length} Einträge gespeichert. ${failed.length} benötigen weitere Prüfung.`)
      if (failed.length) setError(failed.map(r => `${reels.find(item => item.id === r.id)?.title || 'Reel'}: ${r.error}`).join(' / '))
      setChecked(failed.map(r => r.id))
      const refreshed = await listReels(); setReels(refreshed.reels)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Sammelaktion fehlgeschlagen.') }
    finally { setBusy(false); setBatchAction('') }
  }

  return (
    <section className="card reel-import">
      <div className="reel-import__header">
        <div>
          <span className="eyebrow">Reel Inbox</span>
          <h2>Reels importieren</h2>
          <p>Bis zu 50 Videos aus Fotos oder Dateien. Während der Übertragung LifeOS geöffnet lassen. Danach läuft die Verarbeitung auf dem Server.</p>
        </div>
        <button type="button" className="icon-button" aria-label="Reel-Import schließen" disabled={busy} onClick={onClose}><X size={18} /></button>
      </div>

      <div className="reel-import__steps" aria-label="Ablauf">
        <span><b>1</b> Auswählen</span><span><b>2</b> Importieren</span><span><b>3</b> Wissen übernehmen</span>
      </div>

      <div className="reel-import__actions">
        <input ref={inputRef} hidden type="file" multiple accept="video/*,.mp4,.mov,.m4v,.webm" onChange={event => {
          const files = [...(event.target.files ?? [])]
          event.target.value = ''
          const invalid = files.filter(file => validateReelFile(file))
          setError(invalid.map(file => `${file.name}: ${validateReelFile(file)}`).join(' / '))
          setPendingFiles(files.filter(file => !validateReelFile(file)).slice(0, MAX_REEL_BATCH))
          setNotice(files.length > MAX_REEL_BATCH ? 'Maximal 50 Videos pro Runde. Bitte übrige Videos danach auswählen.' : '')
        }} />
        <button type="button" className="primary-button" disabled={busy} onClick={() => inputRef.current?.click()}>
          <Upload size={16} /> Reels auswählen
        </button>
        {pendingFiles.length > 0 && <button type="button" className="primary-button" disabled={busy} onClick={() => void startFiles(pendingFiles)}>{pendingFiles.length} Videos importieren</button>}
        <button type="button" className="secondary-button" disabled={loading || busy} onClick={() => void reload()}><RefreshCw size={15} /> Aktualisieren</button>
      </div>

      {error && <p role="alert" className="reel-import__error">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {!busy && uploads.some(u => u.phase === 'done') && workerAvailable && <p role="status">Deine übertragenen Videos werden auf dem Server verarbeitet. Du kannst LifeOS jetzt schließen.</p>}
      {!workerAvailable && reels.some(r => r.jobState === 'queued' || r.jobState === 'running') && <p role="status">Videos gespeichert. Die Serververarbeitung ist derzeit nicht bestätigt; der Status wird automatisch aktualisiert.</p>}
      {uploads.length > 0 && (
        <div className="reel-upload-list">
          {uploads.map(item => (
            <div key={item.id} className={`reel-upload-row is-${item.phase}`}>
              <FileVideo size={17} /><span>{item.file.name}</span>
              <progress aria-label={`Übertragung ${item.file.name}`} max={100} value={item.phase === 'processing' ? undefined : item.progress} />
              <small>{item.phase === 'queued' ? 'wartet' : item.phase === 'uploading' ? `${item.progress}%` : item.phase === 'processing' ? 'Transkript + Prüfung' : item.phase === 'done' ? 'übertragen' : item.phase === 'duplicate' ? 'schon vorhanden' : item.error}</small>
            </div>
          ))}
        </div>
      )}

      <div className="reel-import__stats">
        <span><b>{counts.total}</b> gesamt</span><span><b>{counts.ready}</b> zu prüfen</span><span><b>{counts.approved}</b> übernommen</span><span><b>{counts.failed}</b> Fehler</span>
      </div>

      <div className="reel-import__actions">
        <label>Status <select value={filter} onChange={e => setFilter(e.target.value)}><option value="">Alle</option>{['UPLOADED','PROCESSING','REVIEW_READY','APPROVED_CANDIDATE','SOURCE_ONLY','FAILED'].map(status => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}<option value="published">Übernommen</option></select></label>
        <label>Bereich <select value={areaFilter} onChange={e => setAreaFilter(e.target.value)}><option value="">Alle</option>{LIFE_AREAS.map(a => <option key={a.key} value={a.key}>{a.name}</option>)}</select></label>
        <label>Risiko <select value={riskFilter} onChange={e => setRiskFilter(e.target.value)}><option value="">Alle</option><option value="low">Niedrig</option><option value="medium">Mittel</option><option value="high">Hoch</option></select></label>
        <button type="button" className="secondary-button" disabled={busy} onClick={() => setChecked(visible.filter(r => !r.publishedId && ['REVIEW_READY','USER_REVIEWED','APPROVED_CANDIDATE','SOURCE_ONLY','REJECTED','MORE_EVIDENCE'].includes(r.status)).slice(0, 50).map(r => r.id))}>Bis zu 50 auswählen</button>
      </div>
      {checked.length > 0 && <div className="reel-review-actions">
        <span>{checked.length} ausgewählt</span>
        <button type="button" disabled={busy} className="secondary-button" onClick={() => setBatchAction('publish')}>Wissen übernehmen</button>
        <button type="button" disabled={busy} className="secondary-button" onClick={() => setBatchAction('source_only')}>Nur Quellen</button>
        <button type="button" disabled={busy} className="secondary-button" onClick={() => setBatchAction('reject')}>Verwerfen</button>
        <button type="button" disabled={busy} className="secondary-button" onClick={() => setChecked([])}>Auswahl aufheben</button>
      </div>}
      {batchAction && <div className="reel-batch-confirm" role="region" aria-label="Sammelaktion bestätigen">
        <p>{batchAction === 'publish' ? 'Nur freigabefähige Wissenseinträge mit niedrigem Risiko werden übernommen. Andere Einträge bleiben zur Einzelprüfung.' : batchAction === 'reject' ? 'Ausgewählte Einträge verwerfen? Die Quellen bleiben erhalten.' : 'Ausgewählte Einträge ausschließlich als Quellen behalten?'}</p>
        <button type="button" className="primary-button" disabled={busy} onClick={() => void submitBatch()}>Für {checked.length} Einträge bestätigen</button>
        <button type="button" className="secondary-button" disabled={busy} onClick={() => setBatchAction('')}>Abbrechen</button>
      </div>}
      {loading ? <p>Reels werden geladen …</p> : reels.length === 0 ? (
        <div className="reel-import__empty"><FileVideo size={26} /><strong>Noch keine Reels</strong><span>Wähle oben deine ersten Videos aus Fotos oder Dateien.</span></div>
      ) : (
        <div className="reel-review-layout">
          <div className="reel-review-list">
            {visible.map(reel => (
              <div key={reel.id} className="reel-select-row">
              <input type="checkbox" aria-label={`${reel.title || reel.originalName} auswählen`} disabled={busy || Boolean(reel.publishedId)} checked={checked.includes(reel.id)} onChange={e => setChecked(current => e.target.checked ? [...current, reel.id].slice(0,50) : current.filter(id => id !== reel.id))} />
              <button type="button" className={reel.id === selected?.id ? 'reel-review-item is-active' : 'reel-review-item'} onClick={() => { setSelectedId(''); void getReel(reel.id).then(detail => { setReels(current => replaceReel(current, detail)); setSelectedId(detail.id) }).catch(reason => setError(reason instanceof Error ? reason.message : 'Quelle nicht erreichbar.')) }}>
                <span><strong>{reel.title || reel.originalName || 'Unbenanntes Reel'}</strong><small>{reel.originalName}</small></span>
                <em className={`reel-status is-${reel.status.toLowerCase()}`}>{reel.publishedId ? 'Übernommen' : reel.jobState === 'queued' ? (reel.jobAvailableAt && Date.parse(reel.jobAvailableAt) > Date.now() + 3600_000 ? 'Wartet auf nächstes Tageskontingent' : 'Wartet auf Verarbeitung') : STATUS_LABELS[reel.status] || reel.status}</em>
              </button></div>
            ))}
          </div>

          {selected && <div className="reel-review-detail">
            <div className="reel-review-detail__meta">
              <span className={`reel-risk is-${selected.riskLevel}`}>Risiko: {selected.riskLevel}</span>
              <span>Nützlichkeit: {selected.usefulnessScore ?? '–'}/100</span>
              <span>JEV: {selected.jev?.available ? `${Math.round((selected.jev.confidence ?? 0) * 100)}%` : 'manuell prüfen'}</span>
            </div>
            {selected.status === 'UPLOADED' && !selected.jobState && <button type="button" className="secondary-button" disabled={busy} onClick={() => void retry(selected)}>Verarbeitung starten</button>}
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
              <button type="button" className="primary-button" disabled={busy || Boolean(selected.publishedId) || !['REVIEW_READY', 'USER_REVIEWED', 'MORE_EVIDENCE', 'APPROVED_CANDIDATE', 'SOURCE_ONLY', 'REJECTED'].includes(selected.status)} onClick={() => void submitReview('approve_candidate')}><Check size={16} /> Prüfung bestätigen & Wissen übernehmen</button>
              <button type="button" className="secondary-button" disabled={busy} onClick={() => void submitReview('more_evidence')}>Mehr Belege</button>
              <button type="button" className="secondary-button" disabled={busy} onClick={() => void submitReview('source_only')}>Nur Quelle</button>
              <button type="button" className="secondary-button" disabled={busy} onClick={() => void submitReview('reject')}>Verwerfen</button>
            </div>
            <p className="reel-review-detail__guard">Du bestätigst deine Prüfung. Unbelegte Aussagen bleiben als solche gekennzeichnet. Routinen und Aufgaben werden nicht verändert.</p>
          </div>}
        </div>
      )}
    </section>
  )
}
