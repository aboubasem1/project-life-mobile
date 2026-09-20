import { useEffect, useMemo, useState } from 'react'
import type { DashboardEntry } from '../types/DashboardEntry'
import {
  buildDailyWeightPoints,
  buildWeightDailyStat,
  formatClock,
  formatKgDelta,
  loadBodyMeasurements,
  type BodyMeasurement,
} from '../lib/bodyMeasurement'
import { LIFE_OS_SYNC_EXTRAS_EVENT } from '../lib/deviceSync'

function formatKg(value: number): string {
  return `${value.toFixed(1)} kg`
}

export function WeightDailyCard({
  date,
  today,
  entries,
  goalKg = 0,
  startKg = 0,
}: {
  date: string
  today: string
  entries: DashboardEntry[]
  goalKg?: number
  startKg?: number
}) {
  const [measurements, setMeasurements] = useState<BodyMeasurement[]>(() => loadBodyMeasurements())

  useEffect(() => {
    const refresh = () => setMeasurements(loadBodyMeasurements())
    window.addEventListener(LIFE_OS_SYNC_EXTRAS_EVENT, refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener(LIFE_OS_SYNC_EXTRAS_EVENT, refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [])

  const points = useMemo(
    () => buildDailyWeightPoints(entries, measurements),
    [entries, measurements],
  )
  const stat = useMemo(
    () => buildWeightDailyStat(points, date, today, goalKg, startKg),
    [points, date, today, goalKg, startKg],
  )

  const clock = formatClock(stat.measuredAt)
  const source = stat.sourceApp === 'fitdays'
    ? 'Fitdays'
    : stat.sourceApp
      ? stat.sourceApp
      : null

  return (
    <section className="card weight-daily-card">
      <div className="weight-daily__head">
        <span className="eyebrow">Körper</span>
        <h2>Gewicht</h2>
      </div>
      {stat.kg === null ? (
        <p className="field-hint">
          Noch keine Messung. Waage über Fitdays → Apple Health, oder später unter Check-in eintragen.
        </p>
      ) : (
        <>
          <div className="weight-daily__hero">
            <strong>{formatKg(stat.kg)}</strong>
            <span>
              {stat.deltaYesterday === null
                ? 'Erster Wert'
                : `${formatKgDelta(stat.deltaYesterday)} seit ${stat.comparedToYesterday ? 'gestern' : 'letzter Messung'}`}
            </span>
          </div>
          <div className="weight-daily__rows">
            <div><span>7 Tage</span><strong>{formatKgDelta(stat.delta7)}</strong></div>
            <div><span>30 Tage</span><strong>{formatKgDelta(stat.delta30)}</strong></div>
            {stat.bodyFatPercent !== null && (
              <div><span>Körperfett</span><strong>{stat.bodyFatPercent.toFixed(1)}%</strong></div>
            )}
            {stat.goalKg !== null && (
              <div><span>Ziel</span><strong>{formatKg(stat.goalKg)}</strong></div>
            )}
            {stat.progressKg !== null && stat.spanKg !== null && (
              <div>
                <span>Fortschritt</span>
                <strong>{Math.abs(stat.progressKg).toFixed(1)} / {Math.abs(stat.spanKg).toFixed(1)} kg</strong>
              </div>
            )}
          </div>
          {(clock || source || stat.isCarriedForward) && (
            <p className="field-hint">
              {stat.isCarriedForward && stat.date ? `Letzter Wert vom ${stat.date}` : null}
              {stat.isCarriedForward && (clock || source) ? ' · ' : null}
              {clock ? `${clock} Uhr` : null}
              {clock && source ? ' · ' : null}
              {source}
            </p>
          )}
        </>
      )}
    </section>
  )
}
