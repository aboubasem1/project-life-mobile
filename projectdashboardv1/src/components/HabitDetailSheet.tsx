import { X } from 'lucide-react'
import { habitDetailStats } from '../lib/habitDetail'
import type { DashboardEntry, HabitKey } from '../types/DashboardEntry'

export function HabitDetailSheet({
  habitKey,
  label,
  entries,
  today,
  onClose,
}: {
  habitKey: HabitKey
  label: string
  entries: DashboardEntry[]
  today: string
  onClose: () => void
}) {
  const stats = habitDetailStats(entries, habitKey, today)

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal habit-detail-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="habit-detail-title"
        onClick={event => event.stopPropagation()}
      >
        <header className="habit-detail-sheet__top">
          <div>
            <span className="eyebrow">Habit</span>
            <h2 id="habit-detail-title">{label}</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Schließen">
            <X size={18} />
          </button>
        </header>

        <div className="habit-detail-sheet__stats">
          <div>
            <strong>{stats.currentStreak}</strong>
            <span>Aktuell</span>
          </div>
          <div>
            <strong>{stats.bestStreak}</strong>
            <span>Beste Serie</span>
          </div>
          <div>
            <strong>{stats.completedDays}</strong>
            <span>Tage gesamt</span>
          </div>
        </div>

        <p className="field-hint">Woche</p>
        <div className="habit-week" aria-label="Letzte sieben Tage">
          {stats.week.map(cell => (
            <span
              key={cell.date}
              className={[
                'habit-week__cell',
                cell.done ? 'is-done' : '',
                cell.shielded ? 'is-shield' : '',
              ].filter(Boolean).join(' ')}
              title={cell.date}
            />
          ))}
        </div>

        <p className="field-hint">12 Wochen</p>
        <div className="habit-mini-heat" aria-label="Habit-Heatmap">
          {stats.heatmap.map(cell => (
            <span
              key={cell.date}
              className={[
                'habit-mini-heat__cell',
                cell.done ? 'is-done' : '',
                cell.shielded ? 'is-shield' : '',
              ].filter(Boolean).join(' ')}
              title={cell.date}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
