import { useCallback, useState } from 'react'
import { X, Check, Lightbulb } from 'lucide-react'

interface Props {
  task:    string
  onDone:  (thought?: string) => void
  onClose: () => void
}

export function FocusMode({ task, onDone, onClose }: Props) {
  const [thought, setThought] = useState('')

  const handleDone = useCallback(() => {
    onDone(thought.trim() || undefined)
  }, [thought, onDone])

  return (
    <div className="focus-mode" role="dialog" aria-modal="true" aria-label="Fokusmodus">
      <button
        className="focus-close-btn"
        onClick={onClose}
        aria-label="Fokusmodus schließen"
      >
        <X size={20} aria-hidden="true" />
      </button>

      <p className="focus-task-name">{task}</p>

      <button
        className="btn btn-primary btn-lg"
        onClick={handleDone}
        aria-label="Aufgabe als erledigt markieren"
        style={{ marginBottom: 'var(--sp-8)' }}
      >
        <Check size={20} aria-hidden="true" />
        Fertig
      </button>

      {/* Park a thought */}
      <div className="focus-thought-row">
        <Lightbulb
          size={16}
          aria-hidden="true"
          style={{ color: 'var(--text-muted)', flexShrink: 0 }}
        />
        <input
          className="focus-thought-input"
          placeholder="Gedanke parken…"
          value={thought}
          onChange={e => setThought(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleDone()}
          aria-label="Gedanke für später notieren"
          maxLength={200}
        />
      </div>
    </div>
  )
}
