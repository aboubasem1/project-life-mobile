import { useMemo, useState } from 'react'
import { Check } from 'lucide-react'
import type { DashboardEntry } from '../types/DashboardEntry'
import { createDefaultEntry } from '../types/DashboardEntry'
import { calculateScore } from '../lib/score'
import type { SyncStatus } from '../hooks/useEntries'
import type { EnergyLevel } from '../components/today/EnergyCheck'
import { EnergyCheck } from '../components/today/EnergyCheck'
import { RoutineStepper } from '../components/today/RoutineStepper'
import type { RoutineStep } from '../components/today/RoutineStepper'
import { NextActionCard } from '../components/today/NextActionCard'
import { QuickCapture } from '../components/today/QuickCapture'
import { DailyAnchors } from '../components/today/DailyAnchors'
import { MinimumDayMode } from '../components/today/MinimumDayMode'
import { FocusMode } from '../components/FocusMode'
import { SyncStatusBadge } from '../components/ui/SyncStatusBadge'

// ─── Exported type for App routing ────────────────────────────────────────────
export type AppView = 'today' | 'plan' | 'verlauf'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getToday(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

type TimeOfDay = 'morning' | 'afternoon' | 'evening'

function getTimeOfDay(): TimeOfDay {
  const h = new Date().getHours()
  if (h >= 5 && h < 12) return 'morning'
  if (h >= 12 && h < 18) return 'afternoon'
  return 'evening'
}

function getGreeting(tod: TimeOfDay): string {
  if (tod === 'morning')   return 'Guten Morgen.'
  if (tod === 'afternoon') return 'Guten Nachmittag.'
  return 'Guten Abend.'
}

const ENERGY_LABEL: Record<EnergyLevel, string> = {
  low:  'Niedrig',
  okay: 'Okay',
  high: 'Gut',
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  entries:    DashboardEntry[]
  syncStatus: SyncStatus
  onSave:     (entry: DashboardEntry) => Promise<void>
}

// ─── Component ────────────────────────────────────────────────────────────────
export function TodayView({ entries, syncStatus, onSave }: Props) {
  const today                     = getToday()
  const [timeOfDay]               = useState<TimeOfDay>(getTimeOfDay)
  const [focusOpen, setFocusOpen] = useState(false)
  const [focusTask, setFocusTask] = useState('')

  // Always derive entry from entries list (live updates from parent)
  const entry = useMemo<DashboardEntry>(
    () => entries.find(e => e.date === today) ?? createDefaultEntry(today),
    [entries, today],
  )

  const update = (partial: Partial<DashboardEntry>) =>
    onSave({ ...entry, ...partial })

  // ─── Energy ────────────────────────────────────────────────────────────
  const energyLevel = (entry.energyLevel ?? null) as EnergyLevel | null

  // ─── Morning routine steps ────────────────────────────────────────────
  const morningSteps = useMemo<RoutineStep[]>(() => [
    {
      id: 'breathing', name: 'Atemübung / Wim Hof',
      detail: '11 Minuten', done: !!entry.breathingDone,
    },
    { id: 'coldShower', name: 'Kalte Dusche',                done: !!entry.coldShower   },
    { id: 'gratitude',  name: 'Dankbarkeit & Affirmationen', done: !!entry.gratitudeDone },
    { id: 'protein',    name: 'Proteinshake & Supplements',  done: !!entry.proteinShake  },
    {
      id: 'training', name: 'Kurzes Training', detail: 'Optional', optional: true,
      done: !!(entry.pushupsDone || entry.squatsDone),
    },
    { id: 'work', name: 'Arbeitsmodus starten', done: !!entry.focusDone },
  ], [entry])

  const MORNING_PATCH: Record<string, () => Partial<DashboardEntry>> = {
    breathing:  () => ({ breathingDone: !entry.breathingDone }),
    coldShower: () => ({ coldShower:    !entry.coldShower     }),
    gratitude:  () => ({ gratitudeDone: !entry.gratitudeDone  }),
    protein:    () => ({ proteinShake:  !entry.proteinShake   }),
    training:   () => ({ pushupsDone:   !entry.pushupsDone    }),
    work:       () => ({ focusDone:     !entry.focusDone      }),
  }

  const handleMorningToggle = (id: string) => {
    const patch = MORNING_PATCH[id]?.()
    if (patch) void update(patch)
  }

  // ─── Anchors ──────────────────────────────────────────────────────────
  const anchorTexts = entry.anchors     ?? []
  const anchorDone  = entry.anchorsDone ?? []
  const anchorItems = anchorTexts.map((t, i) => ({ text: t, done: !!anchorDone[i] }))

  const handleAnchorToggle = (idx: number) => {
    const next = anchorTexts.map((_, i) => (i === idx ? !anchorDone[i] : !!anchorDone[i]))
    void update({ anchorsDone: next })
  }

  // ─── QuickCapture ──────────────────────────────────────────────────────
  const handleCapture = (text: string) => {
    const ts  = new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
    const cur = entry.journalText ?? ''
    void update({ journalText: cur ? `${cur}\n${ts} ${text}` : `${ts} ${text}` })
  }

  // ─── Focus mode ────────────────────────────────────────────────────────
  const openFocus = (task?: string) => {
    setFocusTask(task ?? anchorTexts[0] ?? 'Fokus')
    setFocusOpen(true)
  }

  const handleFocusDone = (thought?: string) => {
    setFocusOpen(false)
    const patch: Partial<DashboardEntry> = { focusDone: true }
    if (thought) {
      const cur = entry.journalText ?? ''
      patch.journalText = cur ? `${cur}\n💡 ${thought}` : `💡 ${thought}`
    }
    void update(patch)
  }

  // ─── Minimum day items ─────────────────────────────────────────────────
  const minItems = [
    { id: 'coldShower', label: 'Kalte Dusche',              done: !!entry.coldShower   },
    { id: 'protein',    label: 'Proteinshake',               done: !!entry.proteinShake  },
    { id: 'gratitude',  label: 'Einen Dankbarkeits-Gedanken', done: !!entry.gratitudeDone },
  ]

  const handleMinToggle = (id: string) => handleMorningToggle(id)

  // ─── Evening check items ──────────────────────────────────────────────
  const EVENING_ITEMS = [
    {
      id: 'protein',
      label: 'Protein erreicht',
      done: !!entry.proteinReached,
      patch: () => ({ proteinReached: !entry.proteinReached }),
    },
    {
      id: 'calories',
      label: 'Kalorien erreicht',
      done: !!entry.caloriesReached,
      patch: () => ({ caloriesReached: !entry.caloriesReached }),
    },
    {
      id: 'training',
      label: 'Training oder Bewegung',
      done: !!(entry.pushupsDone || entry.squatsDone || entry.wallsitDone || entry.plankDone),
      patch: () => ({ pushupsDone: !entry.pushupsDone }),
    },
    {
      id: 'journal',
      label: 'Tagesabschluss',
      done: !!entry.journalDone,
      patch: () => ({ journalDone: !entry.journalDone }),
    },
  ]

  const score = calculateScore(entry)

  // FocusMode renders as fullscreen overlay (z-index 200 > bottom-nav 100)
  if (focusOpen) {
    return (
      <FocusMode
        task={focusTask}
        onDone={handleFocusDone}
        onClose={() => setFocusOpen(false)}
      />
    )
  }

  const morningDone = morningSteps.every(s => s.done)
  const showAnchors = timeOfDay !== 'morning' || morningDone

  return (
    <div className="view-content fade-in">

      {/* ── Greeting ─────────────────────────────────────────────────── */}
      <div className="greeting-section">
        <p className="greeting-time">{today}</p>
        <h1 className="greeting-text">{getGreeting(timeOfDay)}</h1>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 'var(--sp-3)',
        }}>
          <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>
            Score heute: <strong style={{ color: 'var(--text-secondary)' }}>{score}</strong>/100
          </span>
          <SyncStatusBadge status={syncStatus} />
        </div>
      </div>

      {/* ── Energy check or status ───────────────────────────────────── */}
      {!energyLevel ? (
        <EnergyCheck
          value={null}
          onChange={v => void update({ energyLevel: v })}
        />
      ) : (
        <div className="energy-status">
          <span>Energie: {ENERGY_LABEL[energyLevel]}</span>
          <button
            className="energy-status-change"
            onClick={() => void update({ energyLevel: undefined })}
            aria-label="Energielevel ändern"
          >
            Ändern
          </button>
        </div>
      )}

      {/* ── Low energy → minimal mode ───────────────────────────────── */}
      {energyLevel === 'low' && (
        <MinimumDayMode items={minItems} onToggle={handleMinToggle} />
      )}

      {/* ── Normal / high energy ────────────────────────────────────── */}
      {(energyLevel === 'okay' || energyLevel === 'high') && (
        <>
          {/* Morning routine stepper */}
          {timeOfDay === 'morning' && (
            <RoutineStepper
              steps={morningSteps}
              onToggle={handleMorningToggle}
            />
          )}

          {/* Daily anchors (shown afternoon/evening OR after morning routine) */}
          {showAnchors && anchorItems.length > 0 && (
            <DailyAnchors
              anchors={anchorItems}
              onToggle={handleAnchorToggle}
            />
          )}

          {/* Next action card for first undone anchor */}
          {showAnchors && (() => {
            const next = anchorItems.findIndex(a => !a.done)
            if (next === -1) return null
            const a = anchorItems[next]
            return (
              <NextActionCard
                task={a.text}
                onStartFocus={() => openFocus(a.text)}
                onComplete={() => handleAnchorToggle(next)}
              />
            )
          })()}

          {/* No anchors prompt */}
          {showAnchors && anchorItems.length === 0 && (
            <div className="empty-state card-sm">
              <div className="empty-state-icon" aria-hidden="true">📌</div>
              <p className="empty-state-title">Noch keine Tagesanker</p>
              <p className="empty-state-body">
                Gehe zu <strong>Plan</strong>, um 1–4 wichtige Aufgaben für heute festzulegen.
              </p>
            </div>
          )}

          {/* Evening check */}
          {timeOfDay === 'evening' && (
            <div className="card">
              <p className="daily-anchors-title" style={{ marginBottom: 'var(--sp-3)' }}>
                Abend-Check
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
                {EVENING_ITEMS.map(item => (
                  <button
                    key={item.id}
                    className={`check-row ${item.done ? 'checked' : ''}`}
                    onClick={() => void update(item.patch())}
                    aria-pressed={item.done}
                  >
                    <div
                      className={`anchor-check ${item.done ? 'done' : ''}`}
                      aria-hidden="true"
                    >
                      {item.done && <Check size={11} strokeWidth={3} />}
                    </div>
                    <span className="check-label">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Quick capture (always visible) ──────────────────────────── */}
      <QuickCapture onCapture={handleCapture} />
    </div>
  )
}
