import { useState } from 'react'
import { Plus } from 'lucide-react'
import { KNOWLEDGE_TYPE_LABELS, type KnowledgeItem, type KnowledgeType } from '../../lib/lifeos'
import { Field, LifeAreaSelect, LifeOsEmpty, LifeOsPage } from './lifeosUi'

export function KnowledgeView({
  items,
  selectedId,
  related,
  onSelect,
  onCreate,
  onChange,
  onDelete,
  onLink,
}: {
  items: KnowledgeItem[]
  selectedId?: string
  related: Array<{ id: string; title: string; kind: string }>
  onSelect: (id: string) => void
  onCreate: () => string
  onChange: (id: string, patch: Partial<KnowledgeItem>) => void
  onDelete: (id: string) => void
  onLink: (id: string, target: { kind: 'project' | 'goal' | 'decision' | 'knowledge'; targetId: string }) => void
}) {
  const selected = items.find(item => item.id === selectedId) ?? items[0] ?? null
  const [linkKind, setLinkKind] = useState<'project' | 'goal' | 'decision' | 'knowledge'>('project')
  const [linkId, setLinkId] = useState('')

  return (
    <LifeOsPage
      eyebrow="Learn"
      title="Knowledge"
      action={<button type="button" className="small-button" onClick={() => onCreate()}><Plus size={14} /> Eintrag</button>}
    >
      {items.length === 0 ? (
        <section className="card">
          <LifeOsEmpty title="Noch kein Wissen" text="Gedanken, Artikel, Videos, Bücher — Beziehungen zuerst, Graph später." />
        </section>
      ) : (
        <div className="lifeos-split">
          <section className="card lifeos-list-card">
            {items.map(item => (
              <button
                key={item.id}
                type="button"
                className={item.id === selected?.id ? 'lifeos-list-item is-active' : 'lifeos-list-item'}
                onClick={() => onSelect(item.id)}
              >
                <strong>{item.title}</strong>
                <span>{KNOWLEDGE_TYPE_LABELS[item.type]}</span>
              </button>
            ))}
          </section>
          {selected && (
            <section className="card">
              <Field label="Titel">
                <input value={selected.title} onChange={event => onChange(selected.id, { title: event.target.value })} />
              </Field>
              <Field label="Inhalt">
                <textarea value={selected.content} onChange={event => onChange(selected.id, { content: event.target.value })} rows={6} />
              </Field>
              <Field label="Summary">
                <textarea value={selected.summary} onChange={event => onChange(selected.id, { summary: event.target.value })} rows={2} />
              </Field>
              <div className="lifeos-inline">
                <label className="text-field">
                  <span>Typ</span>
                  <select value={selected.type} onChange={event => onChange(selected.id, { type: event.target.value as KnowledgeType })}>
                    {Object.entries(KNOWLEDGE_TYPE_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                  </select>
                </label>
                <Field label="Quelle">
                  <input value={selected.source} onChange={event => onChange(selected.id, { source: event.target.value })} />
                </Field>
              </div>
              <Field label="Source URL">
                <input value={selected.sourceUrl ?? ''} onChange={event => onChange(selected.id, { sourceUrl: event.target.value || undefined })} />
              </Field>
              <Field label="Topics (Komma)">
                <input
                  value={selected.topics.join(', ')}
                  onChange={event => onChange(selected.id, { topics: event.target.value.split(',').map(item => item.trim()).filter(Boolean) })}
                />
              </Field>
              <LifeAreaSelect value={selected.lifeArea} onChange={lifeArea => onChange(selected.id, { lifeArea })} />
              <Field label="Tags (Komma)">
                <input
                  value={selected.tags.join(', ')}
                  onChange={event => onChange(selected.id, { tags: event.target.value.split(',').map(item => item.trim()).filter(Boolean) })}
                />
              </Field>
              <div className="lifeos-inline">
                <select value={linkKind} onChange={event => setLinkKind(event.target.value as typeof linkKind)}>
                  <option value="project">Projekt</option>
                  <option value="goal">Ziel</option>
                  <option value="decision">Entscheidung</option>
                  <option value="knowledge">Wissen</option>
                </select>
                <input value={linkId} onChange={event => setLinkId(event.target.value)} placeholder="ID" />
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => {
                    if (!linkId.trim()) return
                    onLink(selected.id, { kind: linkKind, targetId: linkId.trim() })
                    setLinkId('')
                  }}
                >
                  Verknüpfen
                </button>
              </div>
              {related.length > 0 && (
                <ul className="lifeos-plain-list">
                  {related.map(item => <li key={`${item.kind}-${item.id}`}>{item.kind}: {item.title}</li>)}
                </ul>
              )}
              <button type="button" className="secondary-button" onClick={() => onDelete(selected.id)}>Löschen</button>
            </section>
          )}
        </div>
      )}
    </LifeOsPage>
  )
}
