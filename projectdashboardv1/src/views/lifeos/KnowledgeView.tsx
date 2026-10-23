import { useMemo, useState } from 'react'
import { Plus, Upload } from 'lucide-react'
import { KNOWLEDGE_TYPE_LABELS, rankKnowledge, suggestRelations, type KnowledgeItem, type KnowledgeType, type Relation } from '../../lib/lifeos'
import { Field, LifeAreaSelect, LifeOsEmpty, LifeOsPage } from './lifeosUi'
import { ReelImportPanel } from './ReelImportPanel'
import type { KnowledgePublishDraft } from '../../lib/reels'

const ROLE_LABELS: Record<string, string> = {
  related_to: 'Verwandt',
  supports: 'Stützt',
  contradicts: 'Widerspricht',
  applicable_to: 'Passend zu',
  derived_from: 'Abgeleitet von',
}

const EVIDENCE_LABELS: Record<string, string> = {
  verified: 'belegt',
  mixed: 'teilweise belegt',
  unverified: 'unbelegt',
  source_only: 'nur Quelle',
}

export function KnowledgeView({
  items,
  relations,
  goals,
  projects,
  decisions,
  selectedId,
  related,
  onSelect,
  onCreate,
  onChange,
  onDelete,
  onLink,
  onPublished,
}: {
  items: KnowledgeItem[]
  relations: Relation[]
  goals: Array<{ id: string; title: string }>
  projects: Array<{ id: string; title: string }>
  decisions: Array<{ id: string; title: string }>
  selectedId?: string
  related: Array<{ id: string; title: string; kind: string }>
  onSelect: (id: string) => void
  onCreate: () => string
  onChange: (id: string, patch: Partial<KnowledgeItem>) => void
  onDelete: (id: string) => void
  onLink: (id: string, target: { kind: 'project' | 'goal' | 'decision' | 'knowledge'; targetId: string; role?: string }) => void
  onPublished: (drafts: KnowledgePublishDraft[]) => number
}) {
  const [query, setQuery] = useState('')
  const [linkKind, setLinkKind] = useState<'project' | 'goal' | 'decision' | 'knowledge'>('project')
  const [linkId, setLinkId] = useState('')
  const [showReelImport, setShowReelImport] = useState(false)
  const ranked = useMemo(() => new Map(rankKnowledge(items, query).map(hit => [hit.id, hit.score])), [items, query])
  const visible = query.trim()
    ? items.filter(item => ranked.has(item.id)).sort((a, b) => (ranked.get(b.id) ?? 0) - (ranked.get(a.id) ?? 0))
    : items
  const selected = visible.find(item => item.id === selectedId) ?? visible[0] ?? null
  const suggestions = selected
    ? suggestRelations({ focusId: selected.id, items, relations, goals, projects, decisions })
    : []

  return (
    <LifeOsPage
      eyebrow="Learn"
      title="Knowledge"
      action={<div className="lifeos-inline">
        <button type="button" className="small-button" onClick={() => setShowReelImport(current => !current)}><Upload size={14} /> Reels importieren</button>
        <button type="button" className="small-button" onClick={() => onCreate()}><Plus size={14} /> Eintrag</button>
      </div>}
    >
      {showReelImport && <ReelImportPanel onClose={() => setShowReelImport(false)} onPublished={onPublished} />}
      <label className="text-field">
        <span className="sr-only">Wissen durchsuchen</span>
        <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Wissen durchsuchen" aria-label="Wissen durchsuchen" />
      </label>
      {items.length === 0 ? (
        <section className="card">
          <LifeOsEmpty title="Noch kein Wissen" text="Gedanken, Artikel, Videos, Bücher — oder Reels importieren." />
        </section>
      ) : visible.length === 0 ? (
        <section className="card">
          <LifeOsEmpty title="Nichts gefunden" text="Kein Eintrag passt zu dieser Suche." />
        </section>
      ) : (
        <div className="lifeos-split">
          <section className="card lifeos-list-card">
            {visible.map(item => (
              <button
                key={item.id}
                type="button"
                className={item.id === selected?.id ? 'lifeos-list-item is-active' : 'lifeos-list-item'}
                onClick={() => onSelect(item.id)}
              >
                <strong>{item.title}</strong>
                <span>{item.topics[0] || KNOWLEDGE_TYPE_LABELS[item.type]}</span>
              </button>
            ))}
          </section>
          {selected && (
            <section className="card">
              <Field label="Titel">
                <input value={selected.title} onChange={event => onChange(selected.id, { title: event.target.value })} />
              </Field>
              <p className="reel-review-detail__guard">{selected.summary || 'Noch keine Zusammenfassung.'}</p>
              <div className="reel-import__stats">
                <span>{selected.topics[0] || 'Ohne Thema'}</span>
                <span>{selected.source || 'Ohne Quelle'}</span>
                {selected.evidenceStatus && <span>{EVIDENCE_LABELS[selected.evidenceStatus]}</span>}
              </div>
              {related.length > 0 && (
                <ul className="lifeos-plain-list">
                  {related.map(item => <li key={`${item.kind}-${item.id}`}>{item.kind}: {item.title}</li>)}
                </ul>
              )}
              <details>
                <summary>Details</summary>
                <div className="reel-review-detail">
                  {selected.ideas && selected.ideas.length > 0 && <p>{selected.ideas.join(' ')}</p>}
                  {selected.takeaways && selected.takeaways.length > 0 && (
                    <ul className="lifeos-plain-list">{selected.takeaways.map(item => <li key={item}>{item}</li>)}</ul>
                  )}
                  {selected.sourceReelId && <p className="reel-review-detail__guard">Originaltranskript bleibt am Reel {selected.sourceReelId}.</p>}
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
                  <Field label="Topics (Komma)">
                    <input
                      value={selected.topics.join(', ')}
                      onChange={event => onChange(selected.id, { topics: event.target.value.split(',').map(item => item.trim()).filter(Boolean) })}
                    />
                  </Field>
                  <LifeAreaSelect value={selected.lifeArea} onChange={lifeArea => onChange(selected.id, { lifeArea, areaLocked: true })} />
                  <button type="button" className="secondary-button" onClick={() => onDelete(selected.id)}>Löschen</button>
                </div>
              </details>
              <details>
                <summary>Beziehungen</summary>
                {suggestions.length === 0 ? <p className="reel-review-detail__guard">Keine neuen Vorschläge.</p> : suggestions.map(suggestion => (
                  <div key={`${suggestion.role}-${suggestion.toKind}-${suggestion.toId}`} className="lifeos-inline">
                    <span>{ROLE_LABELS[suggestion.role]}: {suggestion.reason}</span>
                    <button type="button" className="secondary-button" onClick={() => onLink(selected.id, { kind: suggestion.toKind, targetId: suggestion.toId, role: suggestion.role })}>Übernehmen</button>
                  </div>
                ))}
                <div className="lifeos-inline">
                  <select value={linkKind} onChange={event => setLinkKind(event.target.value as typeof linkKind)}>
                    <option value="project">Projekt</option>
                    <option value="goal">Ziel</option>
                    <option value="decision">Entscheidung</option>
                    <option value="knowledge">Wissen</option>
                  </select>
                  <input value={linkId} onChange={event => setLinkId(event.target.value)} placeholder="ID" aria-label="Ziel-ID" />
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => {
                      if (!linkId.trim()) return
                      onLink(selected.id, { kind: linkKind, targetId: linkId.trim(), role: 'related_to' })
                      setLinkId('')
                    }}
                  >
                    Verknüpfen
                  </button>
                </div>
              </details>
            </section>
          )}
        </div>
      )}
    </LifeOsPage>
  )
}
