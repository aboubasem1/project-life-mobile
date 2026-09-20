import { AREA_REVIEW_PROMPTS, REVIEW_TYPE_LABELS, areaLabel, formatMinutes, type Review, type ReviewType } from '../../lib/lifeos'
import { Field, LifeOsEmpty, LifeOsPage } from './lifeosUi'

export function ReviewView({
  reviews,
  draft,
  onType,
  onStart,
  onChange,
  onComplete,
  onSelect,
}: {
  reviews: Review[]
  draft: Review | null
  onType: (type: ReviewType) => void
  onStart: () => void
  onChange: (patch: Partial<Review>) => void
  onComplete: () => void
  onSelect: (id: string) => void
}) {
  const current = draft

  return (
    <LifeOsPage eyebrow="Review" title="Reviews">
      <section className="card">
        <div className="lifeos-chip-row">
          {(Object.keys(REVIEW_TYPE_LABELS) as ReviewType[]).map(type => (
            <button
              key={type}
              type="button"
              className={current?.type === type ? 'choice-button is-active' : 'choice-button'}
              onClick={() => onType(type)}
            >
              {REVIEW_TYPE_LABELS[type]}
            </button>
          ))}
        </div>
        <button type="button" className="secondary-button" onClick={onStart}>
          Review aus vorhandenen Daten starten
        </button>
      </section>

      {!current ? (
        <section className="card">
          <LifeOsEmpty title="Kein Review geladen" text="Wähle einen Zeitraum und starte. Es werden nur vorhandene Zahlen aggregiert." />
        </section>
      ) : (
        <section className="card">
          <span className="eyebrow">{REVIEW_TYPE_LABELS[current.type]}</span>
          <h3>{current.periodStart} – {current.periodEnd}</h3>
          <ul className="lifeos-plain-list">
            <li>Aufgaben fertig / offen: {current.aggregates.completedTasks} / {current.aggregates.openTasks}</li>
            <li>Captures: {current.aggregates.captures} · Wissen: {current.aggregates.knowledge} · Decisions: {current.aggregates.decisions}</li>
            <li>Decision Reviews fällig: {current.aggregates.decisionReviewsDue}</li>
            <li>Fokus: {current.aggregates.focusMinutes} min</li>
            <li>Geplant / tatsächlich: {current.aggregates.plannedMinutes} / {current.aggregates.actualMinutes} min</li>
          </ul>
          {current.aggregates.lifeAreas && (current.aggregates.lifeAreas.hasTimeData || current.aggregates.lifeAreas.coverage > 0) && (
            <div className="life-area-review">
              <span className="eyebrow">Life Areas</span>
              {current.aggregates.lifeAreas.hasTimeData ? (
                <ul className="lifeos-plain-list">
                  {current.aggregates.lifeAreas.slices
                    .filter(slice => slice.key !== 'unclassified' && (slice.actualMinutes > 0 || slice.plannedMinutes > 0))
                    .map(slice => (
                      <li key={slice.key}>
                        {slice.key === 'unclassified' ? 'Unclassified' : areaLabel(slice.key)}
                        {' · '}
                        {formatMinutes(slice.actualMinutes)}
                        {slice.plannedMinutes > 0 ? ` geplant ${formatMinutes(slice.plannedMinutes)}` : ''}
                      </li>
                    ))}
                </ul>
              ) : (
                <p className="field-hint">Noch keine belastbaren Zeitdaten für eine Area-Verteilung.</p>
              )}
              <p className="field-hint">
                Classification Coverage {Math.round(current.aggregates.lifeAreas.coverage * 100)}%
                {current.aggregates.lifeAreas.reliable ? '' : ' · Verteilung nicht belastbar genug für Anteile.'}
              </p>
              <ul className="lifeos-plain-list">
                {AREA_REVIEW_PROMPTS.map(prompt => <li key={prompt}>{prompt}</li>)}
              </ul>
            </div>
          )}
          {current.aggregates.projectProgress.map(item => (
            <p key={item.id} className="field-hint">{item.name}: {item.percent}%</p>
          ))}
          <Field label="Was lief gut"><textarea value={current.whatWentWell} onChange={event => onChange({ whatWentWell: event.target.value })} rows={2} /></Field>
          <Field label="Was lief schlecht"><textarea value={current.whatWentWrong} onChange={event => onChange({ whatWentWrong: event.target.value })} rows={2} /></Field>
          <Field label="Was ich gelernt habe"><textarea value={current.whatILearned} onChange={event => onChange({ whatILearned: event.target.value })} rows={2} /></Field>
          <Field label="Was ich ändern will"><textarea value={current.whatToChange} onChange={event => onChange({ whatToChange: event.target.value })} rows={2} /></Field>
          <Field label="Nächste Prioritäten"><textarea value={current.nextPriorities} onChange={event => onChange({ nextPriorities: event.target.value })} rows={2} /></Field>
          <Field label="Notizen"><textarea value={current.notes} onChange={event => onChange({ notes: event.target.value })} rows={2} /></Field>
          <button type="button" className="primary-button" onClick={onComplete}>
            {current.completedAt ? 'Review aktualisieren' : 'Review speichern'}
          </button>
        </section>
      )}

      {reviews.length > 0 && (
        <section className="card">
          <span className="eyebrow">Historie</span>
          {reviews.map(item => (
            <button key={item.id} type="button" className="lifeos-list-item" onClick={() => onSelect(item.id)}>
              <strong>{REVIEW_TYPE_LABELS[item.type]} {item.periodStart}</strong>
              <span>{item.completedAt ? 'Gespeichert' : 'Entwurf'}</span>
            </button>
          ))}
        </section>
      )}
    </LifeOsPage>
  )
}
