import { Check } from 'lucide-react'

interface AnchorItem {
  text: string
  done: boolean
}

interface Props {
  anchors:  AnchorItem[]
  onToggle: (idx: number) => void
}

export function DailyAnchors({ anchors, onToggle }: Props) {
  if (anchors.length === 0) return null

  return (
    <div>
      <div className="daily-anchors-header">
        <span className="daily-anchors-title">Heute wichtig</span>
        <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>
          {anchors.filter(a => a.done).length}/{anchors.length}
        </span>
      </div>
      {anchors.map((a, i) => (
        <div
          key={i}
          className={`anchor-item ${a.done ? 'done' : ''}`}
          onClick={() => onToggle(i)}
          role="checkbox"
          aria-checked={a.done}
          tabIndex={0}
          onKeyDown={e => (e.key === ' ' || e.key === 'Enter') && onToggle(i)}
        >
          <div
            className={`anchor-check ${a.done ? 'done' : ''}`}
            aria-hidden="true"
          >
            {a.done && <Check size={11} strokeWidth={3} />}
          </div>
          <span className="anchor-text">{a.text}</span>
        </div>
      ))}
    </div>
  )
}
