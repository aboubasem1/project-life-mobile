import { useEffect, useId, useRef } from 'react'
import { Check, RotateCcw, X } from 'lucide-react'
import type { ChangePreview } from '../lib/adaptive-core/change-engine/types'
import type { RiskLevel } from '../lib/adaptive-core/types'
import type { ImplementationSpec } from '../lib/adaptive-core/jo/orchestrator'

type Phase = 'preview' | 'applied' | 'code' | 'error'

const RISK_LABEL: Record<RiskLevel, string> = {
  LOW: 'Niedrig',
  MEDIUM: 'Mittel',
  HIGH: 'Hoch',
  CRITICAL: 'Kritisch',
}

export function ChangePreviewSheet({
  phase,
  preview,
  implementationSpec,
  error,
  developerMode = false,
  onApply,
  onCancel,
  onUndo,
}: {
  phase: Phase
  preview?: ChangePreview | null
  implementationSpec?: ImplementationSpec | null
  error?: string
  developerMode?: boolean
  onApply: () => void
  onCancel: () => void
  onUndo?: () => void
}) {
  const titleId = useId()
  const applyRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    applyRef.current?.focus()
  }, [phase, preview?.changeSpec.id, implementationSpec?.id])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onCancel])

  if (phase === 'code' && implementationSpec) {
    return (
      <div className="change-preview-backdrop" role="presentation" onClick={onCancel}>
        <section
          className="change-preview"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          onClick={event => event.stopPropagation()}
        >
          <header className="change-preview__head">
            <div>
              <span className="eyebrow">Entwicklung</span>
              <h2 id={titleId}>Code-Änderung nötig</h2>
            </div>
            <button type="button" className="icon-button" aria-label="Schließen" onClick={onCancel}>
              <X size={18} />
            </button>
          </header>
          <p className="change-preview__lead">{implementationSpec.goal}</p>
          <ul className="change-preview__list">
            {implementationSpec.acceptanceCriteria.slice(0, 3).map(item => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="change-preview__risk">Risiko: {RISK_LABEL[implementationSpec.risk]}</p>
          {developerMode && (
            <pre className="change-preview__debug">{JSON.stringify(implementationSpec, null, 2)}</pre>
          )}
          <div className="change-preview__actions">
            <button type="button" className="secondary-button" onClick={onCancel}>Verstanden</button>
          </div>
        </section>
      </div>
    )
  }

  if (phase === 'error') {
    return (
      <div className="change-preview-backdrop" role="presentation" onClick={onCancel}>
        <section className="change-preview" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={event => event.stopPropagation()}>
          <header className="change-preview__head">
            <div>
              <span className="eyebrow">LifeOS</span>
              <h2 id={titleId}>Nicht anwendbar</h2>
            </div>
            <button type="button" className="icon-button" aria-label="Schließen" onClick={onCancel}>
              <X size={18} />
            </button>
          </header>
          <p className="change-preview__lead">{error || 'Die Änderung konnte nicht sicher interpretiert werden.'}</p>
          <div className="change-preview__actions">
            <button type="button" className="primary-button" ref={applyRef} onClick={onCancel}>OK</button>
          </div>
        </section>
      </div>
    )
  }

  if (phase === 'applied' && preview) {
    return (
      <div className="change-preview-backdrop" role="presentation" onClick={onCancel}>
        <section className="change-preview is-applied" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={event => event.stopPropagation()}>
          <header className="change-preview__head">
            <div>
              <span className="eyebrow">LifeOS</span>
              <h2 id={titleId}>Übernommen</h2>
            </div>
            <button type="button" className="icon-button" aria-label="Schließen" onClick={onCancel}>
              <X size={18} />
            </button>
          </header>
          <ul className="change-preview__list">
            {preview.summaryLines.map(line => (
              <li key={line}><Check size={14} /> {line}</li>
            ))}
          </ul>
          <div className="change-preview__actions">
            {preview.reversible && onUndo && (
              <button type="button" className="secondary-button" ref={applyRef} onClick={onUndo}>
                <RotateCcw size={16} /> Rückgängig
              </button>
            )}
            <button type="button" className="primary-button" onClick={onCancel}>Fertig</button>
          </div>
        </section>
      </div>
    )
  }

  if (!preview) return null

  return (
    <div className="change-preview-backdrop" role="presentation" onClick={onCancel}>
      <section className="change-preview" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={event => event.stopPropagation()}>
        <header className="change-preview__head">
          <div>
            <span className="eyebrow">LifeOS Update</span>
            <h2 id={titleId}>{preview.summaryLines.length} {preview.summaryLines.length === 1 ? 'Änderung' : 'Änderungen'}</h2>
          </div>
          <button type="button" className="icon-button" aria-label="Abbrechen" onClick={onCancel}>
            <X size={18} />
          </button>
        </header>
        <ul className="change-preview__list">
          {preview.summaryLines.map(line => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <p className="change-preview__risk">Risiko: {RISK_LABEL[preview.risk]}</p>
        {developerMode && (
          <pre className="change-preview__debug">{JSON.stringify(preview.changeSpec, null, 2)}</pre>
        )}
        <div className="change-preview__actions">
          <button type="button" className="secondary-button" onClick={onCancel}>Abbrechen</button>
          <button type="button" className="primary-button" ref={applyRef} onClick={onApply}>Übernehmen</button>
        </div>
      </section>
    </div>
  )
}
