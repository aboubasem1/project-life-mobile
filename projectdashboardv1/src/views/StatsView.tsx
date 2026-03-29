import { useMemo } from 'react'
import type { DashboardEntry } from '../types/DashboardEntry'
import { HABITS } from '../types/DashboardEntry'
import { WeeklyChart } from '../components/charts/WeeklyChart'
import { calculateScore, calculateStreakForHabit, calculateCompletionRate, getScoreLabel } from '../lib/score'
import { exportJSON, importJSON, upsertEntry } from '../lib/storage'

interface Props {
  entries: DashboardEntry[]
  onReload: () => Promise<void>
}

export function StatsView({ entries, onReload }: Props) {
  const sorted = useMemo(
    () => [...entries].sort((a, b) => a.date.localeCompare(b.date)),
    [entries]
  )

  const last30 = sorted.slice(-30)

  const avgScore = useMemo(() => {
    const scored = sorted.filter(e => e.dailyScore != null && e.dailyScore > 0)
    if (!scored.length) return 0
    return Math.round(scored.reduce((s, e) => s + (e.dailyScore ?? 0), 0) / scored.length)
  }, [sorted])

  const bestDay = useMemo(() => {
    if (!sorted.length) return null
    return sorted.reduce((best, e) =>
      (e.dailyScore ?? 0) > (best.dailyScore ?? 0) ? e : best
    , sorted[0])
  }, [sorted])

  // Overall streak: consecutive days with entries
  const currentStreak = useMemo(() => {
    if (!sorted.length) return 0
    const today = new Date().toISOString().split('T')[0]
    let streak = 0
    let cursor = new Date(today)
    const set = new Set(sorted.map(e => e.date))
    while (set.has(cursor.toISOString().split('T')[0])) {
      streak++
      cursor.setDate(cursor.getDate() - 1)
    }
    return streak
  }, [sorted])

  const handleImport = () => {
    const inp = document.createElement('input')
    inp.type = 'file'
    inp.accept = '.json'
    inp.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      try {
        const imported = await importJSON(file)
        imported.forEach(entry => upsertEntry(entry))
        await onReload()
        alert(`${imported.length} Einträge importiert.`)
      } catch {
        alert('Import fehlgeschlagen. Ungültiges Format.')
      }
    }
    inp.click()
  }

  return (
    <div className="stats-view">

      {/* ── KPI strip ───────────────────────────────────────────────────── */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <span className="kpi-value">{sorted.length}</span>
          <span className="kpi-label">TAGE ERFASST</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-value">{avgScore}</span>
          <span className="kpi-label">Ø SCORE</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-value">{bestDay ? (bestDay.dailyScore ?? calculateScore(bestDay)) : '—'}</span>
          <span className="kpi-label">BESTER TAG</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-value">{currentStreak}</span>
          <span className="kpi-label">STREAK</span>
        </div>
      </div>

      {/* ── Chart ───────────────────────────────────────────────────────── */}
      <section className="panel">
        <div className="panel-header"><span className="chip">📈 30-TAGE VERLAUF</span></div>
        <div className="chart-wrap">
          <WeeklyChart entries={last30} />
        </div>
      </section>

      {/* ── Habit streaks ───────────────────────────────────────────────── */}
      <section className="panel">
        <div className="panel-header"><span className="chip">🔥 HABIT STREAKS</span></div>
        <div className="habit-streak-list">
          {HABITS.map(h => {
            const streak  = calculateStreakForHabit(sorted, h.key)
            const rate7   = calculateCompletionRate(sorted, h.key, 7)
            const rate30  = calculateCompletionRate(sorted, h.key, 30)
            return (
              <div key={h.key} className="streak-row">
                <span className="streak-emoji">{h.emoji}</span>
                <div className="streak-info">
                  <span className="streak-label">{h.label}</span>
                  <div className="streak-bars">
                    <div className="streak-bar-wrap" title={`7 Tage: ${rate7}%`}>
                      <div className="streak-bar-fill" style={{ width: `${rate7}%`, background: h.color }} />
                    </div>
                    <div className="streak-bar-wrap" title={`30 Tage: ${rate30}%`}>
                      <div className="streak-bar-fill" style={{ width: `${rate30}%`, background: h.color, opacity: 0.6 }} />
                    </div>
                  </div>
                </div>
                <div className="streak-stats">
                  <span className="streak-fire">{streak > 0 ? `🔥${streak}` : '—'}</span>
                  <span className="streak-pct">{rate7}%</span>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* ── Score history table ─────────────────────────────────────────── */}
      {sorted.length > 0 && (
        <section className="panel">
          <div className="panel-header"><span className="chip">📅 VERLAUF</span></div>
          <div className="history-list">
            {[...sorted].reverse().slice(0, 14).map(e => {
              const s = e.dailyScore ?? calculateScore(e)
              return (
                <div key={e.date} className="history-row">
                  <span className="history-date">{e.date}</span>
                  <div className="history-bar-wrap">
                    <div className="history-bar" style={{ width: `${s}%` }} />
                  </div>
                  <span className="history-score">{s}</span>
                  <span className="history-label">{getScoreLabel(s)}</span>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* ── Data management ─────────────────────────────────────────────── */}
      <section className="panel">
        <div className="panel-header"><span className="chip">💾 DATEN</span></div>
        <div className="data-actions">
          <button className="action-btn" onClick={() => { exportJSON(entries); }}>
            ↓ EXPORTIEREN
          </button>
          <button className="action-btn secondary" onClick={handleImport}>
            ↑ IMPORTIEREN
          </button>
          <button className="action-btn ghost" onClick={() => void onReload()}>
            ↻ SYNC
          </button>
        </div>
        <p className="data-hint">{sorted.length} Einträge lokal gespeichert</p>
      </section>

    </div>
  )
}
