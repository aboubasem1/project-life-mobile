import { useMemo, useState } from 'react'
import {
  buildRecallCard,
  disableReview,
  dueReviews,
  enableReview,
  scheduleReview,
  upsertReview,
  type KnowledgeItem,
  type KnowledgeReview,
} from '../../lib/lifeos'

export function ActiveRecallPanel({
  item,
  reviews,
  onChangeReviews,
}: {
  item: KnowledgeItem
  reviews: KnowledgeReview[]
  onChangeReviews: (next: KnowledgeReview[]) => void
}) {
  const current = reviews.find(entry => entry.knowledgeId === item.id)
  const card = useMemo(() => buildRecallCard(item), [item])
  const due = dueReviews(reviews).some(entry => entry.knowledgeId === item.id)
  const [revealed, setRevealed] = useState(false)

  if (!current?.enabled) {
    return (
      <div className="reel-review-detail">
        <p className="reel-review-detail__guard">Optional. Aktiviert kurze Rückfragen zu diesem Eintrag — nicht in NOW oder den Gates.</p>
        <button
          type="button"
          className="secondary-button reel-touch"
          onClick={() => onChangeReviews(upsertReview(reviews, enableReview(item.id)))}
        >
          Lernen aktivieren
        </button>
      </div>
    )
  }

  return (
    <div className="reel-review-detail">
      <p className="reel-review-detail__guard">
        {due ? 'Fällig zur Wiederholung.' : `Nächste Wiederholung: ${new Date(current.dueAt).toLocaleDateString('de-DE')}.`}
      </p>
      <strong>{card.question}</strong>
      {!revealed ? (
        <button type="button" className="primary-button reel-touch" onClick={() => setRevealed(true)}>Antwort zeigen</button>
      ) : (
        <>
          <p style={{ whiteSpace: 'pre-wrap' }}>{card.answer}</p>
          <div className="reel-review-actions">
            {(['again', 'hard', 'good'] as const).map(result => (
              <button
                key={result}
                type="button"
                className="secondary-button reel-touch"
                onClick={() => {
                  onChangeReviews(upsertReview(reviews, scheduleReview(current, result, item.id)))
                  setRevealed(false)
                }}
              >
                {result === 'again' ? 'Nochmal' : result === 'hard' ? 'Schwer' : 'Gut'}
              </button>
            ))}
          </div>
        </>
      )}
      <button
        type="button"
        className="small-button"
        onClick={() => onChangeReviews(upsertReview(reviews, disableReview(current)))}
      >
        Lernen pausieren
      </button>
    </div>
  )
}
