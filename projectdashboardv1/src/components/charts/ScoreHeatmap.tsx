/**
 * Score Heatmap — GitHub-style contribution grid
 * Shows last 105 days (15 weeks) colored by daily score
 */
import { useMemo } from 'react'
import type { DashboardEntry } from '../../types/DashboardEntry'
import { calculateScore } from '../../lib/score'

interface Props {
  entries: DashboardEntry[]
}

function scoreToColor(score: number): string {
  if (score <= 0)  return 'rgba(255,255,255,0.05)'
  if (score < 35)  return '#ff3b3060'
  if (score < 55)  return '#ff950080'
  if (score < 75)  return '#4facfe90'
  if (score < 90)  return '#34c75990'
  return '#ffd60a'
}

export function ScoreHeatmap({ entries }: Props) {
  const data = useMemo(() => {
    const map = new Map<string, number>()
    for (const e of entries) {
      map.set(e.date, e.dailyScore ?? calculateScore(e))
    }

    // Build 105-day grid ending today
    const days: { date: string; score: number; isToday: boolean }[] = []
    const today = new Date()
    for (let i = 104; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      const iso = d.toISOString().split('T')[0]
      days.push({ date: iso, score: map.get(iso) ?? 0, isToday: i === 0 })
    }
    // Pad front so grid starts on Monday
    const firstDay = new Date(days[0].date + 'T00:00:00').getDay() // 0=Sun
    const pad = firstDay === 0 ? 6 : firstDay - 1
    return { days, pad }
  }, [entries])

  const weekCount = Math.ceil((data.days.length + data.pad) / 7)

  return (
    <div className="heatmap-wrap">
      <div
        className="heatmap-grid"
        style={{ gridTemplateColumns: `repeat(${weekCount}, 1fr)` }}
      >
        {/* Pad empty cells */}
        {Array.from({ length: data.pad }).map((_, i) => (
          <div key={`pad-${i}`} className="hm-cell empty" />
        ))}
        {data.days.map(d => (
          <div
            key={d.date}
            className={`hm-cell${d.isToday ? ' today' : ''}`}
            style={{ background: scoreToColor(d.score) }}
            title={`${d.date}: ${d.score > 0 ? d.score + ' Pkt' : '—'}`}
          />
        ))}
      </div>
      <div className="heatmap-legend">
        <span className="hm-leg-label">0</span>
        {[0, 35, 55, 75, 90].map((v, i) => (
          <div key={i} className="hm-leg-cell" style={{ background: scoreToColor(v === 0 ? 0 : v + 1) }} />
        ))}
        <span className="hm-leg-label">100</span>
      </div>
    </div>
  )
}
