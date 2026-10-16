import { useMemo, useState } from 'react'

export type BodyWeightRecord = { date: string; kg: number }
export type BodyEvolutionProps = {
  records: BodyWeightRecord[]
  baselineKg?: number
  targetKg?: number
}

const milestones = [67, 70, 75, 80]
const DAY = 86400000

export function weightProjection(records: BodyWeightRecord[], baselineKg = 64) {
  const valid = records
    .filter(r => /^\d{4}-\d{2}-\d{2}$/.test(r.date) && Number.isFinite(r.kg) && r.kg > 20 && r.kg < 400)
    .sort((a, b) => a.date.localeCompare(b.date))
  const daily = Array.from(new Map(valid.map(r => [r.date, r])).values())
  const last = daily.at(-1)
  const recent = last ? daily.filter(r => (Date.parse(last.date) - Date.parse(r.date)) / DAY <= 28) : []
  const first = recent[0]
  const days = first && last ? (Date.parse(last.date) - Date.parse(first.date)) / DAY : 0
  const weeklyRate = recent.length >= 3 && days >= 14 ? ((last!.kg - first!.kg) / days) * 7 : null
  const current = last?.kg ?? baselineKg
  return {
    current,
    weeklyRate,
    projections: [30, 90, 180].map(daysAhead => ({
      days: daysAhead,
      illustrativeLow: +(current + daysAhead / 7 * 0.16).toFixed(1),
      illustrativeHigh: +(current + daysAhead / 7 * 0.32).toFixed(1),
      observedTrend: weeklyRate === null ? null : +(current + weeklyRate * daysAhead / 7).toFixed(1),
    })),
  }
}

/** Opt-in, mobile-first display. All scenario numbers are hypothetical body weight, not muscle mass. */
export function BodyEvolutionCard({ records, baselineKg = 64, targetKg = 80 }: BodyEvolutionProps) {
  const [showScenario, setShowScenario] = useState(true)
  const { current, weeklyRate, projections } = useMemo(() => weightProjection(records, baselineKg), [records, baselineKg])
  const progress = Math.max(0, Math.min(100, ((current - baselineKg) / Math.max(0.1, targetKg - baselineKg)) * 100))
  const next = milestones.find(m => m > current)
  return (
    <section aria-label="Body Evolution" style={{ border: '1px solid var(--border, #ddd)', borderRadius: 18, padding: 16 }}>
      <p style={{ margin: 0, opacity: .7 }}>GENERATiONAL RUN / BODY EVOLUTION</p>
      <h2 style={{ margin: '8px 0' }}>{current.toFixed(1)} → {targetKg} kg</h2>
      <div role="progressbar" aria-valuemin={baselineKg} aria-valuemax={targetKg} aria-valuenow={Math.min(targetKg, Math.max(baselineKg, current))}
        style={{ height: 10, background: 'var(--surface-soft, #ccc)', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ width: progress + '%', height: '100%', background: 'var(--accent, #518a8b)' }} />
      </div>
      <p>{next ? 'Nächster Meilenstein: ' + next + ' kg' : 'Alle vorgeschlagenen Meilensteine erreicht'}</p>
      <p>{weeklyRate === null ? 'Noch kein belastbarer Gewichtstrend – mindestens 3 Messungen über 14 Tage erfassen.' : 'Beobachteter Trend: ' + (weeklyRate > 0 ? '+' : '') + weeklyRate.toFixed(2) + ' kg/Woche'}</p>
      <label><input type="checkbox" checked={showScenario} onChange={e => setShowScenario(e.target.checked)} /> Zukunftsszenarien anzeigen</label>
      {showScenario && <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
        {projections.map(p => <div key={p.days} style={{ padding: 10, borderRadius: 10, background: 'var(--surface-soft, rgba(128,128,128,.1))' }}>
          <strong>In {p.days} Tagen</strong>
          <div>Beispielkorridor: {p.illustrativeLow}–{p.illustrativeHigh} kg</div>
          {p.observedTrend !== null && <div>Lineare Fortschreibung: {p.observedTrend} kg</div>}
        </div>)}
      </div>}
      <small style={{ display: 'block', marginTop: 12, opacity: .75 }}>Illustrative Körpergewichtsszenarien, keine Garantie und keine Vorhersage reiner Muskelmasse. Pausen sind kein Versagen.</small>
    </section>
  )
}
