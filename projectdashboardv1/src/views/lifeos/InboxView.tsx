import { useState } from 'react'
import { Archive, Inbox, Trash2 } from 'lucide-react'
import {
  CAPTURE_TARGET_LABELS,
  type Capture,
  type CaptureTargetType,
  type LifeAreaKey,
} from '../../lib/lifeos'
import { ChipRow, LifeAreaSelect, LifeOsEmpty, LifeOsPage } from './lifeosUi'

const TARGETS: CaptureTargetType[] = ['task', 'note', 'knowledge', 'goal', 'event', 'decision', 'reference']

export function InboxView({
  items,
  projects,
  goals,
  onCapture,
  onOpen,
  onClassify,
  onConvert,
  onArchive,
  onDelete,
  onLink,
}: {
  items: Capture[]
  projects: Array<{ id: string; label: string }>
  goals: Array<{ id: string; title: string }>
  onCapture: () => void
  onOpen: (id: string) => void
  onClassify: (id: string, type: CaptureTargetType) => void
  onConvert: (id: string) => void
  onArchive: (id: string) => void
  onDelete: (id: string) => void
  onLink: (id: string, links: { projectId?: string; goalId?: string; lifeArea?: LifeAreaKey }) => void
}) {
  const [openId, setOpenId] = useState<string | null>(items[0]?.id ?? null)
  const selected = items.find(item => item.id === openId) ?? items[0] ?? null

  return (
    <LifeOsPage
      eyebrow="Organisieren"
      title="Inbox"
      action={<button type="button" className="small-button" onClick={onCapture}>Erfassen</button>}
    >
      {items.length === 0 ? (
        <section className="card">
          <LifeOsEmpty
            title="Inbox ist leer"
            text="Erst erfassen, später sortieren. Cmd/Ctrl+K oder Erfassen."
            action={<button type="button" className="secondary-button" onClick={onCapture}><Inbox size={15} /> Capture</button>}
          />
        </section>
      ) : (
        <div className="lifeos-split">
          <section className="card lifeos-list-card">
            {items.map(item => (
              <button
                key={item.id}
                type="button"
                className={item.id === selected?.id ? 'lifeos-list-item is-active' : 'lifeos-list-item'}
                onClick={() => {
                  setOpenId(item.id)
                  onOpen(item.id)
                }}
              >
                <strong>{item.title}</strong>
                <span>{CAPTURE_TARGET_LABELS[item.targetType]}{item.lifeArea ? ` · ${item.lifeArea}` : ' · Unclassified'} · {new Date(item.createdAt).toLocaleString('de-DE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
              </button>
            ))}
          </section>
          {selected && (
            <section className="card">
              <span className="eyebrow">Capture</span>
              <h3 className="lifeos-detail-title">{selected.title}</h3>
              {selected.body && <p className="lifeos-body">{selected.body}</p>}
              {selected.decisionPreview && selected.decisionPreview.items.length > 0 && (
                <div className="lifeos-decision-preview">
                  <span className="field-hint">Vorschläge · {selected.decisionPreview.provider}</span>
                  <ul>
                    {selected.decisionPreview.items.map(item => (
                      <li key={item.actionId}>
                        {item.intent} · {item.domain}
                        {item.mealLabel ? ` · ${item.mealLabel}` : ''}
                        {item.due ? ` · ${item.due}` : ''}
                        {item.requiresConfirmation ? ' · Review' : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {selected.url && <p><a href={selected.url} target="_blank" rel="noreferrer">{selected.url}</a></p>}
              {selected.fileName && <p className="field-hint">{selected.fileName}</p>}
              {selected.fileDataUrl?.startsWith('data:image/') && (
                <img src={selected.fileDataUrl} alt={selected.fileName || 'Screenshot'} className="lifeos-preview" />
              )}
              <ChipRow>
                {TARGETS.map(type => (
                  <button
                    key={type}
                    type="button"
                    className={selected.targetType === type ? 'choice-button is-active' : 'choice-button'}
                    onClick={() => onClassify(selected.id, type)}
                  >
                    {CAPTURE_TARGET_LABELS[type]}
                  </button>
                ))}
              </ChipRow>
              <label className="text-field">
                <span>Projekt</span>
                <select
                  value={selected.projectId ?? ''}
                  onChange={event => onLink(selected.id, { projectId: event.target.value || undefined, goalId: selected.goalId, lifeArea: selected.lifeArea })}
                >
                  <option value="">Kein Projekt</option>
                  {projects.map(project => <option key={project.id} value={project.id}>{project.label}</option>)}
                </select>
              </label>
              <label className="text-field">
                <span>Ziel</span>
                <select
                  value={selected.goalId ?? ''}
                  onChange={event => onLink(selected.id, { projectId: selected.projectId, goalId: event.target.value || undefined, lifeArea: selected.lifeArea })}
                >
                  <option value="">Kein Ziel</option>
                  {goals.map(goal => <option key={goal.id} value={goal.id}>{goal.title}</option>)}
                </select>
              </label>
              <LifeAreaSelect
                value={selected.lifeArea}
                onChange={lifeArea => onLink(selected.id, { projectId: selected.projectId, goalId: selected.goalId, lifeArea })}
              />
              <div className="lifeos-actions">
                <button type="button" className="primary-button" onClick={() => onConvert(selected.id)} disabled={selected.targetType === 'inbox'}>
                  Umwandeln
                </button>
                <button type="button" className="secondary-button" onClick={() => onArchive(selected.id)}>
                  <Archive size={15} /> Archiv
                </button>
                <button type="button" className="secondary-button" onClick={() => onDelete(selected.id)}>
                  <Trash2 size={15} /> Löschen
                </button>
              </div>
            </section>
          )}
        </div>
      )}
    </LifeOsPage>
  )
}
