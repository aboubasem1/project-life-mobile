import { useState } from 'react'
import { ArrowLeft, Plus } from 'lucide-react'
import type { GoalLike, ProjectLike } from '../../lib/lifeos'
import { Field, LifeAreaSelect, LifeOsEmpty, LifeOsPage } from './lifeosUi'

export function GoalDetailView({
  goal,
  projects,
  onBack,
  onChange,
  onAddCheckIn,
}: {
  goal: GoalLike | null
  projects: ProjectLike[]
  onBack: () => void
  onChange: (patch: Partial<GoalLike>) => void
  onAddCheckIn: (note: string, value?: number) => void
}) {
  const [note, setNote] = useState('')
  const [value, setValue] = useState('')
  const linked = projects.filter(project => project.goalId === goal?.id)

  if (!goal) {
    return (
      <LifeOsPage eyebrow="Ziele" title="Ziel">
        <section className="card">
          <LifeOsEmpty title="Ziel nicht gefunden" text="Öffne ein Ziel aus Labor." action={<button type="button" className="secondary-button" onClick={onBack}>Zurück</button>} />
        </section>
      </LifeOsPage>
    )
  }

  return (
    <LifeOsPage
      eyebrow="Goal"
      title={goal.title}
      action={<button type="button" className="small-button" onClick={onBack}><ArrowLeft size={14} /> Labor</button>}
    >
      <section className="card">
        <Field label="Titel"><input value={goal.title} onChange={event => onChange({ title: event.target.value })} /></Field>
        <Field label="Beschreibung"><textarea value={goal.description ?? ''} onChange={event => onChange({ description: event.target.value })} rows={2} /></Field>
        <Field label="Gewünschtes Outcome"><textarea value={goal.outcome ?? ''} onChange={event => onChange({ outcome: event.target.value })} rows={2} /></Field>
        <div className="lifeos-inline">
          <Field label="Metric"><input value={goal.metric ?? ''} onChange={event => onChange({ metric: event.target.value || undefined })} placeholder="optional" /></Field>
          <Field label="Target"><input value={goal.target ?? ''} onChange={event => onChange({ target: event.target.value ? Number(event.target.value) : undefined })} /></Field>
          <Field label="Aktuell"><input value={goal.current ?? ''} onChange={event => onChange({ current: event.target.value ? Number(event.target.value) : undefined })} /></Field>
          <Field label="Einheit"><input value={goal.unit ?? ''} onChange={event => onChange({ unit: event.target.value || undefined })} /></Field>
        </div>
        <div className="lifeos-inline">
          <label className="text-field">
            <span>Status</span>
            <select value={goal.status ?? 'active'} onChange={event => onChange({ status: event.target.value as GoalLike['status'] })}>
              <option value="active">Aktiv</option>
              <option value="paused">Pausiert</option>
              <option value="done">Fertig</option>
              <option value="dropped">Fallengelassen</option>
            </select>
          </label>
          <Field label="Deadline"><input type="date" value={goal.dueDate} onChange={event => onChange({ dueDate: event.target.value })} /></Field>
          <Field label="Fortschritt %"><input type="number" min={0} max={100} value={goal.percent} onChange={event => onChange({ percent: Number(event.target.value) || 0 })} /></Field>
        </div>
        <LifeAreaSelect value={goal.lifeArea} onChange={lifeArea => onChange({ lifeArea })} />
        <div className="mini-progress" aria-hidden="true"><span style={{ width: `${goal.percent}%` }} /></div>
      </section>

      <section className="card">
        <span className="eyebrow">Check-ins</span>
        {(goal.checkIns ?? []).map(item => (
          <div key={item.id} className="lifeos-list-item">
            <strong>{item.note || 'Check-in'}</strong>
            <span>{item.at}{item.value != null ? ` · ${item.value}` : ''}</span>
          </div>
        ))}
        <div className="lifeos-inline">
          <input className="dashboard-plus-input" value={note} onChange={event => setNote(event.target.value)} placeholder="Kurzer Stand" />
          <input className="dashboard-plus-input" value={value} onChange={event => setValue(event.target.value)} placeholder="Zahl optional" />
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              if (!note.trim() && !value.trim()) return
              onAddCheckIn(note.trim(), value ? Number(value) : undefined)
              setNote('')
              setValue('')
            }}
          >
            <Plus size={14} /> Check-in
          </button>
        </div>
      </section>

      <section className="card">
        <span className="eyebrow">Projekte</span>
        {linked.length === 0
          ? <p className="field-hint">Keine Projekte mit diesem Ziel verknüpft.</p>
          : linked.map(project => (
            <div key={project.id} className="lifeos-list-item">
              <strong>{project.label}</strong>
              <span>{project.tasks.filter(task => !task.done).length} offene Tasks</span>
            </div>
          ))}
      </section>
    </LifeOsPage>
  )
}
