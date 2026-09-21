import { Moon, Sun, X } from 'lucide-react'

export function RoutineModeSelector({
  onClose,
  onSelectMorning,
  onSelectEvening,
}: {
  onClose: () => void
  onSelectMorning: () => void
  onSelectEvening: () => void
}) {
  return (
    <div
      className="modal-backdrop routine-selector-backdrop"
      role="presentation"
      onMouseDown={event => event.target === event.currentTarget && onClose()}
    >
      <div className="routine-selector" role="dialog" aria-modal="true" aria-labelledby="routine-selector-title">
        <header className="routine-selector__top">
          <span className="eyebrow">Routine</span>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Schließen">
            <X size={18} />
          </button>
        </header>
        <h2 id="routine-selector-title">Welcher Modus?</h2>
        <p>Wähle bewusst. LifeOS öffnet nur das Gate, das du jetzt brauchst.</p>
        <div className="routine-selector__modes">
          <button type="button" className="routine-selector__mode" onClick={onSelectMorning}>
            <span className="routine-selector__icon" aria-hidden="true"><Sun size={28} /></span>
            <strong>Morning</strong>
            <span>Tag beginnen</span>
          </button>
          <button type="button" className="routine-selector__mode is-night" onClick={onSelectEvening}>
            <span className="routine-selector__icon" aria-hidden="true"><Moon size={28} /></span>
            <strong>Evening</strong>
            <span>Tag schließen</span>
          </button>
        </div>
      </div>
    </div>
  )
}
