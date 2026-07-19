import { Check } from 'lucide-react'

export interface RoutineStep {
  id:       string
  name:     string
  detail?:  string
  optional?: boolean
  done:     boolean
}

interface Props {
  steps:    RoutineStep[]
  onToggle: (id: string) => void
}

export function RoutineStepper({ steps, onToggle }: Props) {
  // First non-optional incomplete step; fall back to any incomplete
  const currentIdx =
    steps.findIndex(s => !s.done && !s.optional) !== -1
      ? steps.findIndex(s => !s.done && !s.optional)
      : steps.findIndex(s => !s.done)

  const current = currentIdx !== -1 ? steps[currentIdx] : null
  const next    = current
    ? steps.slice(currentIdx + 1).find(s => !s.done)
    : null

  const doneCount = steps.filter(s => s.done).length
  const allDone   = doneCount === steps.length

  return (
    <div className="routine-stepper">
      {/* Progress dots */}
      <div
        className="routine-progress"
        role="progressbar"
        aria-valuenow={doneCount}
        aria-valuemax={steps.length}
        aria-label={`${doneCount} von ${steps.length} Schritten erledigt`}
      >
        {steps.map((s, i) => (
          <div
            key={s.id}
            className={[
              'routine-progress-dot',
              s.done              ? 'done'    : '',
              i === currentIdx    ? 'current' : '',
            ].join(' ').trim()}
          />
        ))}
      </div>

      {allDone ? (
        <div className="routine-all-done">
          <div className="routine-all-done-icon" aria-hidden="true">✓</div>
          <p className="routine-all-done-text">Morgenroutine abgeschlossen</p>
        </div>
      ) : current ? (
        <>
          <div className="routine-step-current">
            <p className="routine-step-counter">
              Schritt {currentIdx + 1} von {steps.length}
              {current.optional && ' · Optional'}
            </p>
            <h2 className="routine-step-name">{current.name}</h2>
            {current.detail && (
              <p className="routine-step-detail">{current.detail}</p>
            )}
            <div className="routine-step-actions">
              <button
                className="btn btn-primary"
                onClick={() => onToggle(current.id)}
                aria-label={`${current.name} als erledigt markieren`}
              >
                <Check size={15} aria-hidden="true" />
                Erledigt
              </button>
              {current.optional && (
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => onToggle(current.id)}
                >
                  Überspringen
                </button>
              )}
            </div>
          </div>

          {next && (
            <div
              className="routine-step-next"
              aria-label={`Danach: ${next.name}`}
            >
              <div className="routine-step-next-meta">
                <span className="routine-step-next-label">Danach</span>
                <span className="routine-step-next-name">{next.name}</span>
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  )
}
