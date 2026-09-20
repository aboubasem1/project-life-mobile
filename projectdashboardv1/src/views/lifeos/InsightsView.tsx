import type { Insight } from '../../lib/lifeos'
import { LifeOsEmpty, LifeOsPage } from './lifeosUi'

export function InsightsView({
  insights,
  onRefresh,
}: {
  insights: Insight[]
  onRefresh: () => void
}) {
  return (
    <LifeOsPage
      eyebrow="Learn"
      title="Insights"
      action={<button type="button" className="small-button" onClick={onRefresh}>Neu berechnen</button>}
    >
      {insights.length === 0 ? (
        <section className="card">
          <LifeOsEmpty
            title="Noch keine belegten Hinweise"
            text="Insights entstehen nur aus vorhandenen Daten. Es werden keine Statistiken erfunden."
          />
        </section>
      ) : (
        insights.map(item => (
          <section key={item.id} className="card">
            <span className="eyebrow">{item.source === 'interpretation' ? 'Interpretation' : 'Deterministisch'} · {Math.round(item.confidence * 100)}%</span>
            <h3>{item.title}</h3>
            <p className="lifeos-body">{item.message}</p>
            <ul className="lifeos-plain-list">
              {item.evidence.map(row => (
                <li key={`${row.label}-${row.value}`}>{row.label}: {row.value}</li>
              ))}
            </ul>
            {item.suggestedAction && <p className="field-hint">Nächster Schritt: {item.suggestedAction}</p>}
          </section>
        ))
      )}
    </LifeOsPage>
  )
}
