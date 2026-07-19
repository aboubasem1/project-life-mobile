import { Check } from 'lucide-react'

interface MinItem {
  id:    string
  label: string
  done:  boolean
}

interface Props {
  items:    MinItem[]
  onToggle: (id: string) => void
}

export function MinimumDayMode({ items, onToggle }: Props) {
  return (
    <div className="minimum-day">
      <div className="minimum-day-icon" aria-hidden="true">🌿</div>
      <h2 className="minimum-day-title">Minimaler Tag</h2>
      <p className="minimum-day-subtitle">
        Das reicht heute schon vollkommen.
      </p>
      <div className="minimum-day-tasks">
        {items.map(item => (
          <button
            key={item.id}
            className={`check-row ${item.done ? 'checked' : ''}`}
            onClick={() => onToggle(item.id)}
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
  )
}
