import { useEffect, useId, useRef } from 'react'
import { BookOpen, X } from 'lucide-react'
import type { KnowledgeQueryAnswer } from '../lib/adaptive-core/jo/knowledge-query'

export function KnowledgeAnswerSheet({
  question,
  answer,
  onClose,
  onOpenSource,
}: {
  question: string
  answer: KnowledgeQueryAnswer
  onClose: () => void
  onOpenSource: (id: string) => void
}) {
  const titleId = useId()
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeRef.current?.focus()
  }, [answer.answer])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="change-preview-backdrop" role="presentation" onClick={onClose}>
      <section
        className="change-preview"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={event => event.stopPropagation()}
      >
        <header className="change-preview__head">
          <div>
            <span className="eyebrow">Jo · Wissen</span>
            <h2 id={titleId}>{answer.found ? 'Antwort aus deinem Knowledge' : 'Nichts gefunden'}</h2>
          </div>
          <button ref={closeRef} type="button" className="icon-button" aria-label="Schließen" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <p className="change-preview__lead">{question}</p>
        <p className="change-preview__lead" style={{ whiteSpace: 'pre-wrap' }}>{answer.answer}</p>
        {answer.caution && <p className="change-preview__risk">{answer.caution}</p>}
        {answer.sources.length > 0 && (
          <div>
            <strong>Quellen</strong>
            <ul className="change-preview__list">
              {answer.sources.map(source => (
                <li key={source.id}>
                  <button type="button" className="secondary-button reel-touch" onClick={() => onOpenSource(source.id)}>
                    <BookOpen size={15} /> {source.title}
                  </button>
                  <small>{source.snippet}</small>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="change-preview__actions">
          <button type="button" className="primary-button" onClick={onClose}>Fertig</button>
        </div>
      </section>
    </div>
  )
}
