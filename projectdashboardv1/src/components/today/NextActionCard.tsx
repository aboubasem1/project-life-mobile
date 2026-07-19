import { Zap, ChevronRight } from 'lucide-react'

interface Props {
  task:         string
  onStartFocus: () => void
  onComplete:   () => void
}

export function NextActionCard({ task, onStartFocus, onComplete }: Props) {
  return (
    <div className="next-action-card">
      <p className="next-action-eyebrow">Nächste Aktion</p>
      <p className="next-action-task">{task}</p>
      <div className="next-action-footer">
        <button className="btn btn-primary" onClick={onStartFocus}>
          <Zap size={14} aria-hidden="true" />
          Fokus starten
        </button>
        <button
          className="btn btn-ghost btn-sm"
          onClick={onComplete}
          style={{ marginLeft: 'auto' }}
        >
          Erledigt
          <ChevronRight size={14} aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
