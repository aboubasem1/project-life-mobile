import { useEffect, useState, useRef } from 'react'
import type { DashboardEntry } from '../types/DashboardEntry'
import { createDefaultEntry, HABITS } from '../types/DashboardEntry'
import { ScoreGauge } from '../components/charts/ScoreGauge'
import { SyncStatusBadge } from '../components/ui/SyncStatusBadge'
import type { SyncStatus } from '../hooks/useEntries'
import { calculateScore, getScoreBreakdown } from '../lib/score'
import {
  Sunrise, Zap, Brain, Apple, Briefcase, Moon, BarChart2,
  SmilePlus, Smile, Meh, Frown, AlertCircle,
  BatteryFull, Battery, BatteryMedium, BatteryLow, BatteryCharging,
} from 'lucide-react'

const getToday = (): string => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

interface Props {
  entries: DashboardEntry[]
  syncStatus: SyncStatus
  onSave: (entry: DashboardEntry) => Promise<void>
}

type Tab = 'morning' | 'evening'

export function DashboardView({ entries, syncStatus, onSave }: Props) {
  const today          = getToday()
  const [date, setDate]  = useState(today)
  const [entry, setEntry] = useState<DashboardEntry>(() => createDefaultEntry(today))
  const [tab, setTab]    = useState<Tab>('morning')
  const [saving, setSaving] = useState(false)
  const saveTimer   = useRef<number | null>(null)
  const lastSaved   = useRef(JSON.stringify(createDefaultEntry(today)))

  // Load entry when date changes or entries refresh from remote
  useEffect(() => {
    const found = entries.find(e => e.date === date)
    const loaded = found ?? createDefaultEntry(date)
    setEntry(loaded)
    lastSaved.current = JSON.stringify(loaded)
  }, [date, entries])

  // Auto-save with debounce
  useEffect(() => {
    const cur = JSON.stringify(entry)
    if (cur === lastSaved.current) return
    saveTimer.current && clearTimeout(saveTimer.current)
    setSaving(true)
    saveTimer.current = window.setTimeout(async () => {
      await onSave(entry)
      lastSaved.current = cur
      setSaving(false)
    }, 600)
    return () => { saveTimer.current && clearTimeout(saveTimer.current) }
  }, [entry, onSave])

  const update = (partial: Partial<DashboardEntry>) =>
    setEntry(prev => ({ ...prev, ...partial }))

  const navDate = (dir: -1 | 1) => {
    const d = new Date(date + 'T00:00:00')
    d.setDate(d.getDate() + dir)
    setDate(d.toISOString().split('T')[0])
  }

  const score     = calculateScore(entry)
  const breakdown = getScoreBreakdown(entry)
  const isToday   = date === today

  const MOOD_OPTIONS = [
    { value: 'MOTIVIERT',     Icon: SmilePlus,     label: 'MOTIVIERT'   },
    { value: 'GUT',           Icon: Smile,         label: 'GUT'         },
    { value: 'NEUTRAL',       Icon: Meh,           label: 'NEUTRAL'     },
    { value: 'MÜDE',          Icon: Frown,         label: 'MÜDE'        },
    { value: 'GESTRESST',     Icon: AlertCircle,   label: 'GESTRESST'   },
  ]
  const SLEEP_OPTIONS = [
    { value: 'SEHR SCHLECHT', Icon: Battery,         label: 'S.SCHLECHT'  },
    { value: 'SCHLECHT',      Icon: BatteryLow,      label: 'SCHLECHT'    },
    { value: 'OKAY',          Icon: BatteryMedium,   label: 'OKAY'        },
    { value: 'GUT',           Icon: BatteryFull,     label: 'GUT'         },
    { value: 'SEHR GUT',      Icon: BatteryCharging, label: 'S.GUT'       },
  ]
  const SLEEP_DURATION_OPTIONS = ['5h', '6h', '6.5h', '7h', '7.5h', '8h', '9h']
  const MEDITATION_OPTIONS = [0, 5, 10, 15, 20, 30]

  return (
    <div className="dashboard-view">

      {/* ── Top: date nav + score ───────────────────────────────────────── */}
      <div className="score-header">
        <div className="date-nav">
          <button className="nav-btn" onClick={() => navDate(-1)}>‹</button>
          <input
            type="date"
            value={date}
            max={today}
            onChange={e => setDate(e.target.value)}
            className="date-input"
          />
          <button
            className="nav-btn"
            onClick={() => navDate(1)}
            disabled={isToday}
            aria-disabled={isToday}
          >›</button>
        </div>

        <div className="score-gauge-wrap">
          <ScoreGauge score={score} />
        </div>

        <SyncStatusBadge status={saving ? 'syncing' : syncStatus} />
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────────── */}
      <nav className="tab-switch">
        <button
          className={`tab-btn ${tab === 'morning' ? 'active' : ''}`}
          onClick={() => setTab('morning')}
        ><Sunrise size={14} style={{flexShrink:0}} /> MORGENS</button>
        <button
          className={`tab-btn ${tab === 'evening' ? 'active' : ''}`}
          onClick={() => setTab('evening')}
        ><Moon size={14} style={{flexShrink:0}} /> ABENDS</button>
      </nav>

      {/* ── Morning tab ─────────────────────────────────────────────────── */}
      {tab === 'morning' && (
        <div className="tab-content">

          <section className="panel">
            <div className="panel-header"><span className="chip"><Sunrise size={12} /> AUFWACHEN</span></div>
            <div className="metric-grid">

              <label className="metric-card">
                <span>STIMMUNG</span>
                <div className="quick-select-row">
                  {MOOD_OPTIONS.map(({ value, Icon, label }) => (
                    <button
                      key={value}
                      type="button"
                      className={`quick-btn ${entry.mood === value ? 'active' : ''}`}
                      onClick={() => update({ mood: value })}
                      title={label}
                    ><Icon size={18} /></button>
                  ))}
                </div>
              </label>

              <label className="metric-card">
                <span>SCHLAFQUALITÄT</span>
                <div className="quick-select-row">
                  {SLEEP_OPTIONS.map(({ value, Icon, label }) => (
                    <button
                      key={value}
                      type="button"
                      className={`quick-btn ${entry.sleepQuality === value ? 'active' : ''}`}
                      onClick={() => update({ sleepQuality: value })}
                      title={label}
                    ><Icon size={18} /></button>
                  ))}
                </div>
              </label>

              <label className="metric-card">
                <span>SCHLAFDAUER</span>
                <div className="quick-select-row">
                  {SLEEP_DURATION_OPTIONS.map(o => (
                    <button
                      key={o}
                      type="button"
                      className={`quick-btn ${entry.sleepDuration === o ? 'active' : ''}`}
                      onClick={() => update({ sleepDuration: o })}
                    >{o}</button>
                  ))}
                </div>
              </label>

              <label className="metric-card">
                <span>MEDITATION MIN</span>
                <div className="quick-select-row">
                  {MEDITATION_OPTIONS.map(o => (
                    <button
                      key={o}
                      type="button"
                      className={`quick-btn ${entry.meditationMinutes === o ? 'active' : ''}`}
                      onClick={() => update({ meditationMinutes: o })}
                    >{o === 0 ? '–' : `${o}m`}</button>
                  ))}
                </div>
              </label>

            </div>
          </section>

          <section className="panel">
            <div className="panel-header"><span className="chip"><Zap size={12} /> DAILY HABITS</span></div>
            <div className="habit-list">
              {HABITS.filter(h => h.group === 'habits').map(h => (
                <button
                  key={h.key}
                  className={`habit-toggle ${entry[h.key] ? 'done' : ''}`}
                  style={{ '--habit-color': h.color } as React.CSSProperties}
                  onClick={() => update({ [h.key]: !entry[h.key] } as Partial<DashboardEntry>)}
                  type="button"
                >
                  <h.icon size={18} style={{ color: h.color, flexShrink: 0 }} />
                  <span className="habit-label">{h.label}</span>
                  <span className="habit-check">{entry[h.key] ? '✓' : ''}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="panel-header"><span className="chip"><Brain size={12} /> MINDSET</span></div>
            <div className="habit-list">
              {HABITS.filter(h => h.group === 'mindset').map(h => (
                <button
                  key={h.key}
                  className={`habit-toggle ${entry[h.key] ? 'done' : ''}`}
                  style={{ '--habit-color': h.color } as React.CSSProperties}
                  onClick={() => update({ [h.key]: !entry[h.key] } as Partial<DashboardEntry>)}
                  type="button"
                >
                  <h.icon size={18} style={{ color: h.color, flexShrink: 0 }} />
                  <span className="habit-label">{h.label}</span>
                  <span className="habit-check">{entry[h.key] ? '✓' : ''}</span>
                </button>
              ))}
            </div>
          </section>

        </div>
      )}

      {/* ── Evening tab ─────────────────────────────────────────────────── */}
      {tab === 'evening' && (
        <div className="tab-content">

          <section className="panel">
            <div className="panel-header"><span className="chip"><Apple size={12} /> ABEND-CHECK</span></div>
            <div className="habit-list">
              <button
                className={`habit-toggle ${entry.proteinReached ? 'done' : ''}`}
                style={{ '--habit-color': '#34c759' } as React.CSSProperties}
                onClick={() => update({ proteinReached: !entry.proteinReached })}
                type="button"
              >
                <Apple size={18} style={{ color: '#34c759', flexShrink: 0 }} />
                <span className="habit-label">Protein erreicht</span>
                <span className="habit-check">{entry.proteinReached ? '✓' : ''}</span>
              </button>
              <button
                className={`habit-toggle ${entry.caloriesReached ? 'done' : ''}`}
                style={{ '--habit-color': '#ff9f0a' } as React.CSSProperties}
                onClick={() => update({ caloriesReached: !entry.caloriesReached })}
                type="button"
              >
                <Zap size={18} style={{ color: '#ff9f0a', flexShrink: 0 }} />
                <span className="habit-label">Kalorien erreicht</span>
                <span className="habit-check">{entry.caloriesReached ? '✓' : ''}</span>
              </button>
            </div>
            <div className="weight-picker-row">
              <span className="weight-picker-label">GEWICHT</span>
              <div className="weight-picker-wrap">
                <select
                  className="weight-picker-select"
                  value={entry.weightKg || 65}
                  onChange={e => update({ weightKg: parseFloat(e.target.value) })}
                >
                  {Array.from({ length: (100 - 45) / 0.5 + 1 }, (_, i) => 45 + i * 0.5).map(w => (
                    <option key={w} value={w}>{w.toFixed(1)} kg</option>
                  ))}
                </select>
                <span className="weight-picker-value">
                  {(entry.weightKg || 65).toFixed(1)} kg
                </span>
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-header"><span className="chip"><Briefcase size={12} /> WORK & FOKUS</span></div>
            <div className="metric-grid">
              <div className="row-2">
                <label className="metric-card">
                  <span>DEEP WORK (H)</span>
                  <input type="number" value={entry.deepWorkHours || ''} min={0} step={0.5}
                    onChange={e => update({ deepWorkHours: parseFloat(e.target.value) || 0 })} />
                </label>
                <label className="metric-card">
                  <span>TASKS ERLEDIGT</span>
                  <input type="number" value={entry.tasksDone || ''} min={0}
                    onChange={e => update({ tasksDone: parseInt(e.target.value) || 0 })} />
                </label>
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-header"><span className="chip"><Moon size={12} /> ABEND RITUAL</span></div>
            <div className="habit-list">
              {HABITS.filter(h => h.group === 'evening').map(h => (
                <button
                  key={h.key}
                  className={`habit-toggle ${entry[h.key] ? 'done' : ''}`}
                  style={{ '--habit-color': h.color } as React.CSSProperties}
                  onClick={() => update({ [h.key]: !entry[h.key] } as Partial<DashboardEntry>)}
                  type="button"
                >
                  <h.icon size={18} style={{ color: h.color, flexShrink: 0 }} />
                  <span className="habit-label">{h.label}</span>
                  <span className="habit-check">{entry[h.key] ? '✓' : ''}</span>
                </button>
              ))}
            </div>
            <div className="metric-grid" style={{ marginTop: '16px' }}>
              <label className="metric-card">
                <span>JOURNAL NOTIZEN</span>
                <textarea
                  className="journal-textarea"
                  value={entry.journalText}
                  placeholder="Was war heute gut? Was war herausfordernd?"
                  rows={4}
                  onChange={e => update({ journalText: e.target.value })}
                />
              </label>
            </div>
          </section>

        </div>
      )}

      {/* ── Score breakdown ─────────────────────────────────────────────── */}
      <section className="panel">
        <div className="panel-header"><span className="chip"><BarChart2 size={12} /> SCORE BREAKDOWN</span></div>
        <div className="breakdown-grid">
          {breakdown.map(cat => (
            <div key={cat.category} className="breakdown-cat">
              <div className="breakdown-header">
                <span className="breakdown-name">{cat.category}</span>
                <span className="breakdown-pts">{cat.achieved}/{cat.max}</span>
              </div>
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{ width: `${cat.max > 0 ? (cat.achieved / cat.max) * 100 : 0}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

    </div>
  )
}
