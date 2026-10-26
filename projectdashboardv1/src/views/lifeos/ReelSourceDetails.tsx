import { useState } from 'react'
import { getReel, type ReelCandidate } from '../../lib/reels'

export function ReelSourceDetails({ reelId }: { reelId: string }) {
  const [reel, setReel] = useState<ReelCandidate | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  return <details onToggle={event => {
    if (!event.currentTarget.open || reel || busy) return
    setBusy(true)
    void getReel(reelId).then(setReel).catch(reason => setError(reason instanceof Error ? reason.message : 'Quelle nicht erreichbar.')).finally(() => setBusy(false))
  }}>
    <summary>Originaltranskript & Belege</summary>
    {busy && <p role="status">Quelle wird geladen …</p>}
    {error && <p role="alert">{error} Bitte schließen und erneut öffnen.</p>}
    {reel && <>
      <p>{reel.originalName} · Aussagen der Originalquelle</p>
      <div className="reel-transcript">{reel.transcript || 'Keine Sprache erkannt.'}{reel.onScreenText && `\n\nBildschirmtext:\n${reel.onScreenText}`}</div>
      {reel.claims.map(claim => <article key={claim.id} className="reel-claim">
        <p>{claim.text}</p><small>{claim.verificationStatus === 'SUPPORTED' ? 'Belegt' : 'Nicht vollständig belegt'} · {claim.note}</small>
        {claim.evidence.map(e => <a key={e.url} href={/^https:\/\//.test(e.url) ? e.url : undefined} target="_blank" rel="noreferrer">{e.title || e.url}</a>)}
      </article>)}
    </>}
  </details>
}
