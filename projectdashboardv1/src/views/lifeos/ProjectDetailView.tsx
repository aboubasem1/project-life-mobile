import { useMemo, useState } from 'react'
import { ArrowLeft, Plus } from 'lucide-react'
import { projectProgress, resolveLifeArea, resolveNextAction, type GoalLike, type KnowledgeItem, type Decision, type ActivityRecord, type LifeAreaKey } from '../../lib/lifeos'
import { Field, LifeAreaMark, LifeAreaSelect, LifeOsEmpty, LifeOsPage } from './lifeosUi'

type ProjectStatus = 'active' | 'paused' | 'done' | 'archived'

export type ProjectBoard = {
  id: string
  label: string
  description?: string
  outcome?: string
  status?: ProjectStatus
  priority?: 'p1' | 'p2' | 'p3' | 'p4'
  startDate?: string
  targetDate?: string
  nextAction?: string
  nextActionTaskId?: string
  milestones?: Array<{ id: string; title: string; done: boolean; due?: string }>
  goalId?: string
  lifeArea?: LifeAreaKey
  tasks: Array<{ id: string; title: string; done: boolean; plannedMinutes?: number; actualMinutes?: number; lifeArea?: LifeAreaKey }>
}

export function ProjectDetailView({
  project,
  goals,
  knowledge,
  decisions,
  activities,
  notes,
  onBack,
  onChange,
  onAddTask,
  onToggleTask,
  onPatchTask,
  onOpenDecision,
  onOpenKnowledge,
}: {
  project: ProjectBoard | null
  goals: GoalLike[]
  knowledge: KnowledgeItem[]
  decisions: Decision[]
  activities: ActivityRecord[]
  notes: string[]
  onBack: () => void
  onChange: (patch: Partial<ProjectBoard>) => void
  onAddTask: (title: string) => void
  onToggleTask: (taskId: string) => void
  onPatchTask: (taskId: string, patch: { lifeArea?: LifeAreaKey }) => void
  onOpenDecision: (id: string) => void
  onOpenKnowledge: (id: string) => void
}) {
  const [taskDraft, setTaskDraft] = useState('')
  const [milestoneDraft, setMilestoneDraft] = useState('')
  const next = useMemo(() => project ? resolveNextAction(project) : null, [project])
  const progress = project ? projectProgress(project) : 0

  if (!project) {
    return (
      <LifeOsPage eyebrow="Projekte" title="Projekt">
        <section className="card">
          <LifeOsEmpty title="Projekt nicht gefunden" text="Öffne ein Board aus Lab." action={<button type="button" className="secondary-button" onClick={onBack}>Zurück</button>} />
        </section>
      </LifeOsPage>
    )
  }

  return (
    <LifeOsPage
      eyebrow="Projekt"
      title={project.label}
      action={<button type="button" className="small-button" onClick={onBack}><ArrowLeft size={14} /> Lab</button>}
    >
      <section className="card">
        <Field label="Titel">
          <input value={project.label} onChange={event => onChange({ label: event.target.value })} />
        </Field>
        <Field label="Outcome">
          <textarea value={project.outcome ?? ''} onChange={event => onChange({ outcome: event.target.value })} rows={2} placeholder="Was ist fertig, wenn das Projekt gelingt?" />
        </Field>
        <Field label="Beschreibung">
          <textarea value={project.description ?? ''} onChange={event => onChange({ description: event.target.value })} rows={3} />
        </Field>
        <div className="lifeos-inline">
          <label className="text-field">
            <span>Status</span>
            <select value={project.status ?? 'active'} onChange={event => onChange({ status: event.target.value as ProjectStatus })}>
              <option value="active">Aktiv</option>
              <option value="paused">Pausiert</option>
              <option value="done">Fertig</option>
              <option value="archived">Archiv</option>
            </select>
          </label>
          <label className="text-field">
            <span>Priorität</span>
            <select value={project.priority ?? 'p3'} onChange={event => onChange({ priority: event.target.value as ProjectBoard['priority'] })}>
              <option value="p1">P1</option>
              <option value="p2">P2</option>
              <option value="p3">P3</option>
              <option value="p4">P4</option>
            </select>
          </label>
        </div>
        <div className="lifeos-inline">
          <label className="text-field">
            <span>Start</span>
            <input type="date" value={project.startDate ?? ''} onChange={event => onChange({ startDate: event.target.value || undefined })} />
          </label>
          <label className="text-field">
            <span>Zieltermin</span>
            <input type="date" value={project.targetDate ?? ''} onChange={event => onChange({ targetDate: event.target.value || undefined })} />
          </label>
        </div>
        <label className="text-field">
          <span>Ziel</span>
          <select value={project.goalId ?? ''} onChange={event => onChange({ goalId: event.target.value || undefined })}>
            <option value="">Keins</option>
            {goals.map(goal => <option key={goal.id} value={goal.id}>{goal.title}</option>)}
          </select>
        </label>
        <LifeAreaSelect
          value={project.lifeArea}
          inherited={goals.find(item => item.id === project.goalId)?.lifeArea}
          source={resolveLifeArea({ explicit: project.lifeArea, goal: goals.find(item => item.id === project.goalId) }).source}
          onChange={lifeArea => onChange({ lifeArea })}
        />
        <p className="field-hint">
          <LifeAreaMark
            area={resolveLifeArea({ explicit: project.lifeArea, goal: goals.find(item => item.id === project.goalId) }).key}
            inherited={!project.lifeArea && Boolean(goals.find(item => item.id === project.goalId)?.lifeArea)}
          />
        </p>
        <div className="progress-ring-wrap">
          <div>
            <div className="prog-label">Progress</div>
            <div className="prog-sub">{project.tasks.filter(task => task.done).length} von {project.tasks.length} Aufgaben</div>
          </div>
          <div className="prog-num">{progress}%</div>
        </div>
      </section>

      <section className="card">
        <span className="eyebrow">Next Action</span>
        <h3>Nächster konkreter Schritt</h3>
        <Field label="Manuell setzen">
          <input
            value={project.nextAction ?? ''}
            onChange={event => onChange({ nextAction: event.target.value })}
            placeholder="Nur setzen, wenn du ihn kennst"
          />
        </Field>
        <p className="field-hint">
          {next
            ? `${next.source === 'manual' ? 'Manuell' : 'Aus offener Aufgabe'}: ${next.text}`
            : 'Keine Next Action — keine offene Aufgabe vorhanden.'}
        </p>
      </section>

      <section className="card">
        <span className="eyebrow">Milestones</span>
        <div className="editable-task-list">
          {(project.milestones ?? []).map(item => (
            <label key={item.id} className="lifeos-check-row">
              <input
                type="checkbox"
                checked={item.done}
                onChange={() => onChange({
                  milestones: (project.milestones ?? []).map(milestone => milestone.id === item.id ? { ...milestone, done: !milestone.done } : milestone),
                })}
              />
              <span>{item.title}</span>
            </label>
          ))}
        </div>
        <div className="lifeos-inline">
          <input className="dashboard-plus-input" value={milestoneDraft} onChange={event => setMilestoneDraft(event.target.value)} placeholder="Milestone" />
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              if (!milestoneDraft.trim()) return
              onChange({
                milestones: [...(project.milestones ?? []), { id: crypto.randomUUID(), title: milestoneDraft.trim(), done: false }],
              })
              setMilestoneDraft('')
            }}
          >
            <Plus size={14} />
          </button>
        </div>
      </section>

      <section className="card">
        <span className="eyebrow">Tasks</span>
        <div className="editable-task-list">
          {project.tasks.map(task => {
            const resolved = resolveLifeArea({
              explicit: task.lifeArea,
              project,
              goal: goals.find(item => item.id === project.goalId),
            })
            return (
              <div key={task.id} className={task.done ? 'lifeos-list-item is-done' : 'lifeos-list-item'}>
                <button type="button" className="lifeos-task-toggle" onClick={() => onToggleTask(task.id)}>
                  <strong>{task.title}</strong>
                  <span>
                    {task.done ? 'Erledigt' : 'Offen'}
                    {task.plannedMinutes != null ? ` · geplant ${task.plannedMinutes}m` : ''}
                    {task.actualMinutes != null ? ` · tatsächlich ${task.actualMinutes}m` : ''}
                    {` · ${resolved.key ? resolved.key : 'Unclassified'}${resolved.source !== 'explicit' && resolved.key ? ' · geerbt' : ''}`}
                  </span>
                </button>
                <LifeAreaSelect
                  compact
                  value={task.lifeArea}
                  inherited={resolved.source === 'explicit' ? undefined : resolved.key}
                  onChange={lifeArea => onPatchTask(task.id, { lifeArea })}
                />
              </div>
            )
          })}
        </div>
        <div className="lifeos-inline">
          <input className="dashboard-plus-input" value={taskDraft} onChange={event => setTaskDraft(event.target.value)} placeholder="Neue Aufgabe" />
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              if (!taskDraft.trim()) return
              onAddTask(taskDraft.trim())
              setTaskDraft('')
            }}
          >
            <Plus size={14} /> Aufgabe
          </button>
        </div>
      </section>

      <section className="card">
        <span className="eyebrow">Kontext</span>
        <h3>Notes / Knowledge / Decisions / Activity</h3>
        {notes.length > 0 && <ul className="lifeos-plain-list">{notes.map(note => <li key={note}>{note}</li>)}</ul>}
        {knowledge.length === 0 && decisions.length === 0 && activities.length === 0 && notes.length === 0 && (
          <p className="field-hint">Noch nichts verknüpft. Inbox → Projekt zuordnen.</p>
        )}
        {knowledge.map(item => (
          <button key={item.id} type="button" className="lifeos-list-item" onClick={() => onOpenKnowledge(item.id)}>
            <strong>{item.title}</strong>
            <span>Wissen</span>
          </button>
        ))}
        {decisions.map(item => (
          <button key={item.id} type="button" className="lifeos-list-item" onClick={() => onOpenDecision(item.id)}>
            <strong>{item.title}</strong>
            <span>Entscheidung · {item.status}</span>
          </button>
        ))}
        {activities.map(item => (
          <div key={item.id} className="lifeos-list-item">
            <strong>{item.title}</strong>
            <span>
              {item.date}
              {item.plannedDurationMin != null ? ` · geplant ${item.plannedDurationMin}m` : ''}
              {item.actualDurationMin != null ? ` · tatsächlich ${item.actualDurationMin}m` : ''}
            </span>
          </div>
        ))}
      </section>
    </LifeOsPage>
  )
}
