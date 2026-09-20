import { useState } from 'react'
import { Plus } from 'lucide-react'
import {
  DECISION_STATUS_LABELS,
  type Decision,
  type DecisionStatus,
  type GoalLike,
} from '../../lib/lifeos'
import { Field, LifeAreaSelect, LifeOsEmpty, LifeOsPage } from './lifeosUi'

export function DecisionView({
  decisions,
  projects,
  goals,
  selectedId,
  onSelect,
  onCreate,
  onChange,
  onDelete,
}: {
  decisions: Decision[]
  projects: Array<{ id: string; label: string }>
  goals: GoalLike[]
  selectedId?: string
  onSelect: (id: string) => void
  onCreate: () => string
  onChange: (id: string, patch: Partial<Decision>) => void
  onDelete: (id: string) => void
}) {
  const selected = decisions.find(item => item.id === selectedId) ?? decisions[0] ?? null
  const [titleDraft, setTitleDraft] = useState('')

  return (
    <LifeOsPage
      eyebrow="Decide"
      title="Decision Journal"
      action={(
        <button
          type="button"
          className="small-button"
          onClick={() => {
            const id = onCreate()
            if (titleDraft.trim()) onChange(id, { title: titleDraft.trim() })
            setTitleDraft('')
          }}
        >
          <Plus size={14} /> Entscheidung
        </button>
      )}
    >
      {decisions.length === 0 ? (
        <section className="card">
          <LifeOsEmpty
            title="Noch keine Entscheidungen"
            text="Halte fest, warum du etwas tust — und prüfe später das Ergebnis."
            action={<button type="button" className="secondary-button" onClick={() => onCreate()}><Plus size={15} /> Anlegen</button>}
          />
        </section>
      ) : (
        <div className="lifeos-split">
          <section className="card lifeos-list-card">
            {decisions.map(item => (
              <button
                key={item.id}
                type="button"
                className={item.id === selected?.id ? 'lifeos-list-item is-active' : 'lifeos-list-item'}
                onClick={() => onSelect(item.id)}
              >
                <strong>{item.title}</strong>
                <span>{DECISION_STATUS_LABELS[item.status]}{item.reviewAt ? ` · Review ${item.reviewAt}` : ''}</span>
              </button>
            ))}
          </section>
          {selected && (
            <section className="card">
              <Field label="Titel">
                <input value={selected.title} onChange={event => onChange(selected.id, { title: event.target.value })} />
              </Field>
              <Field label="Entscheidung">
                <textarea value={selected.decision} onChange={event => onChange(selected.id, { decision: event.target.value })} rows={3} />
              </Field>
              <Field label="Kontext">
                <textarea value={selected.context} onChange={event => onChange(selected.id, { context: event.target.value })} rows={2} />
              </Field>
              <Field label="Begründung">
                <textarea value={selected.reasoning} onChange={event => onChange(selected.id, { reasoning: event.target.value })} rows={2} />
              </Field>
              <Field label="Alternativen">
                <textarea value={selected.alternatives} onChange={event => onChange(selected.id, { alternatives: event.target.value })} rows={2} />
              </Field>
              <Field label="Erwartetes Outcome">
                <textarea value={selected.expectedOutcome} onChange={event => onChange(selected.id, { expectedOutcome: event.target.value })} rows={2} />
              </Field>
              <div className="lifeos-inline">
                <label className="text-field">
                  <span>Projekt</span>
                  <select value={selected.projectId ?? ''} onChange={event => onChange(selected.id, { projectId: event.target.value || undefined })}>
                    <option value="">Keins</option>
                    {projects.map(project => <option key={project.id} value={project.id}>{project.label}</option>)}
                  </select>
                </label>
                <label className="text-field">
                  <span>Ziel</span>
                  <select value={selected.goalId ?? ''} onChange={event => onChange(selected.id, { goalId: event.target.value || undefined })}>
                    <option value="">Keins</option>
                    {goals.map(goal => <option key={goal.id} value={goal.id}>{goal.title}</option>)}
                  </select>
                </label>
              </div>
              <div className="lifeos-inline">
                <label className="text-field">
                  <span>Entschieden am</span>
                  <input type="date" value={selected.decidedAt} onChange={event => onChange(selected.id, { decidedAt: event.target.value })} />
                </label>
                <label className="text-field">
                  <span>Review am</span>
                  <input type="date" value={selected.reviewAt ?? ''} onChange={event => onChange(selected.id, { reviewAt: event.target.value || undefined })} />
                </label>
              </div>
              <LifeAreaSelect value={selected.lifeArea} onChange={lifeArea => onChange(selected.id, { lifeArea })} />
              <Field label="Tatsächliches Outcome">
                <textarea value={selected.actualOutcome ?? ''} onChange={event => onChange(selected.id, { actualOutcome: event.target.value })} rows={2} />
              </Field>
              <label className="text-field">
                <span>Bewertung (1–5)</span>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={selected.rating ?? ''}
                  onChange={event => onChange(selected.id, { rating: event.target.value ? Number(event.target.value) : undefined })}
                />
              </label>
              <label className="text-field">
                <span>Status</span>
                <select value={selected.status} onChange={event => onChange(selected.id, { status: event.target.value as DecisionStatus })}>
                  {Object.entries(DECISION_STATUS_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                </select>
              </label>
              <button type="button" className="secondary-button" onClick={() => onDelete(selected.id)}>Löschen</button>
            </section>
          )}
        </div>
      )}
    </LifeOsPage>
  )
}
