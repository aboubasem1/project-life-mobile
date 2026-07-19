import { useState, useEffect, useCallback } from 'react'
import { X, Play, Pause, Check, Lightbulb } from 'lucide-react'

const PRESETS      = [10, 25, 45] as const
const MORE_PRESETS = [5, 15, 60, 90] as const

interface Props {
  task:    string
  onDone:  (thought?: string) => void
  onClose: () => void
}

function fmt(s: number): string {
  const m   = Math.floor(s / 60)
  const sec = s % 60
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

export function FocusMode({ task, onDone, onClose }: Props) {
  const [preset,   setPreset]   = useState(25)
  const [seconds,  setSeconds]  = useState(25 * 60)
  const [running,  setRunning]  = useState(false)
  const [thought,  setThought]  = useState('')
  const [showMore, setShowMore] = useState(false)

  const selectPreset = (min: number) => {
    if (running) return
    setPreset(min)
    setSeconds(min * 60)
  }

  useEffect(() => {
    if (!running) return
    const id = setInterval(() => {
      setSeconds(s => {
        if (s <= 1) { setRunning(false); return 0 }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [running])

  const handleDone = useCallback(() => {
    setRunning(false)
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

      <div
        className="focus-timer"
        aria-live="polite"
        aria-atomic="true"
        aria-label={`${fmt(seconds)} verbleibend`}
      >
        {fmt(seconds)}
      </div>

      {/* Presets */}
      <div
        className="focus-presets"
        role="group"
        aria-label="Dauer wählen"
      >
        {PRESETS.map(min => (
          <button
            key={min}
            className={`focus-preset-btn ${preset === min && !showMore ? 'active' : ''}`}
            onClick={() => { selectPreset(min); setShowMore(false) }}
            aria-pressed={preset === min && !showMore}
            disabled={running}
          >
            {min} min
          </button>
        ))}
        <button
          className={`focus-preset-btn ${showMore ? 'active' : ''}`}
          onClick={() => setShowMore(v => !v)}
          aria-expanded={showMore}
          aria-label="Weitere Zeitoptionen"
          disabled={running}
        >
          ···
        </button>
      </div>

      {showMore && (
        <div
          className="focus-presets"
          role="group"
          aria-label="Weitere Zeitoptionen"
          style={{ marginTop: 'calc(-1 * var(--sp-3))' }}
        >
          {MORE_PRESETS.map(min => (
            <button
              key={min}
              className={`focus-preset-btn ${preset === min ? 'active' : ''}`}
              onClick={() => selectPreset(min)}
              aria-pressed={preset === min}
              disabled={running}
            >
              {min} min
            </button>
          ))}
        </div>
      )}

      <div className="focus-controls">
        <button
          className="btn btn-secondary btn-lg"
          onClick={() => setRunning(r => !r)}
          aria-label={running ? 'Pause' : 'Timer starten'}
        >
          {running
            ? <Pause size={20} aria-hidden="true" />
            : <Play  size={20} aria-hidden="true" />
          }
          {running ? 'Pause' : 'Starten'}
        </button>

        <button
          className="btn btn-primary btn-lg"
          onClick={handleDone}
          aria-label="Aufgabe als erledigt markieren"
        >
          <Check size={20} aria-hidden="true" />
          Fertig
        </button>
      </div>

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
          aria-label="Gedanke für später notieren"
          maxLength={200}
        />
      </div>
    </div>
  )
}
