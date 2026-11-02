import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  ArrowLeft,
  BookmarkPlus,
  Check,
  Copy,
  Link2,
  ListTodo,
  MoreHorizontal,
  Pencil,
  Search,
  Target,
} from 'lucide-react'
import {
  KNOWLEDGE_TYPE_LABELS,
  areaLabel,
  suggestRelations,
  type KnowledgeItem,
  type KnowledgeReview,
  type Relation,
} from '../../lib/lifeos'
import {
  answerKnowledgeQuery,
  tryAnswerKnowledgeQuery,
} from '../../lib/adaptive-core/jo/knowledge-query'
import { listReels, type ReelCandidate } from '../../lib/reels'
import type { KnowledgeTabId } from '../../lib/routing'
import { ActiveRecallPanel } from './ActiveRecallPanel'
import { KnowledgeGraphPanel } from './KnowledgeGraphPanel'
import { Field, LifeAreaSelect, LifeOsEmpty } from './lifeosUi'

const TAB_LABELS: Record<KnowledgeTabId, string> = {
  notes: 'Notizen',
  transcript: 'Transkript',
  jo: 'Jo AI',
  quiz: 'Quiz',
  links: 'Verknüpfungen',
}

const TABS: KnowledgeTabId[] = ['notes', 'transcript', 'jo', 'quiz', 'links']

const ROLE_LABELS: Record<string, string> = {
  related_to: 'Verwandt',
  supports: 'Stützt',
  contradicts: 'Widerspricht',
  applicable_to: 'Passend zu',
  derived_from: 'Abgeleitet von',
}

type JoMessage = {
  id: string
  role: 'user' | 'assistant'
  text: string
  sources?: Array<{ id: string; title: string; snippet: string }>
  caution?: string
}

function formatDate(value: string): string {
  const stamp = Date.parse(value)
  if (!Number.isFinite(stamp)) return ''
  return new Date(stamp).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' })
}

function splitTranscript(raw: string): string[] {
  return raw
    .split(/\n{2,}|\r\n{2,}/)
    .map(part => part.trim())
    .filter(Boolean)
}

function joStorageKey(id: string): string {
  return `lifeos.knowledge.jo.${id}`
}

function loadJoHistory(id: string): JoMessage[] {
  try {
    const raw = sessionStorage.getItem(joStorageKey(id))
    if (!raw) return []
    const parsed = JSON.parse(raw) as JoMessage[]
    return Array.isArray(parsed) ? parsed.slice(-40) : []
  } catch {
    return []
  }
}

function saveJoHistory(id: string, messages: JoMessage[]) {
  try {
    sessionStorage.setItem(joStorageKey(id), JSON.stringify(messages.slice(-40)))
  } catch {
    /* ignore quota */
  }
}

async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value)
    return true
  } catch {
    return false
  }
}

function Disclosure({
  title,
  children,
  defaultOpen = false,
}: {
  title: string
  children: ReactNode
  defaultOpen?: boolean
}) {
  return (
    <details className="knowledge-disclosure" open={defaultOpen || undefined}>
      <summary>{title}</summary>
      <div className="knowledge-disclosure__body">{children}</div>
    </details>
  )
}

export function KnowledgeDetailView({
  item,
  items,
  relations,
  reviews,
  goals,
  projects,
  decisions,
  related,
  tab,
  onTabChange,
  onBack,
  onChange,
  onDelete,
  onLink,
  onReviewsChange,
  onOpenEntity,
  onCreateTask,
  onSaveInsight,
}: {
  item: KnowledgeItem
  items: KnowledgeItem[]
  relations: Relation[]
  reviews: KnowledgeReview[]
  goals: Array<{ id: string; title: string }>
  projects: Array<{ id: string; title: string }>
  decisions: Array<{ id: string; title: string }>
  related: Array<{ id: string; title: string; kind: string }>
  tab: KnowledgeTabId
  onTabChange: (tab: KnowledgeTabId) => void
  onBack: () => void
  onChange: (id: string, patch: Partial<KnowledgeItem>) => void
  onDelete: (id: string) => void
  onLink: (id: string, target: { kind: 'project' | 'goal' | 'decision' | 'knowledge'; targetId: string; role?: string }) => void
  onReviewsChange: (next: KnowledgeReview[]) => void
  onOpenEntity: (kind: 'knowledge' | 'goal' | 'project' | 'decision', id: string) => void
  onCreateTask: (title: string, sourceKnowledgeId: string) => void
  onSaveInsight: (text: string, sourceKnowledgeId: string) => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({
    title: item.title,
    summary: item.summary,
    content: item.content,
    notes: item.notes ?? '',
    source: item.source,
    topics: item.topics.join(', '),
  })
  const [notice, setNotice] = useState('')
  const [reel, setReel] = useState<ReelCandidate | null>(null)
  const [reelLoading, setReelLoading] = useState(false)
  const [reelError, setReelError] = useState('')
  const [transcriptQuery, setTranscriptQuery] = useState('')
  const [joScope, setJoScope] = useState<'card' | 'library'>('card')
  const [joInput, setJoInput] = useState('')
  const [joMessages, setJoMessages] = useState<JoMessage[]>(() => loadJoHistory(item.id))
  const [joBusy, setJoBusy] = useState(false)
  const [linkKind, setLinkKind] = useState<'project' | 'goal' | 'decision' | 'knowledge'>('goal')
  const [linkId, setLinkId] = useState('')
  const [selectedPassage, setSelectedPassage] = useState('')
  const tabRefs = useRef<Partial<Record<KnowledgeTabId, boolean>>>({})
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setDraft({
      title: item.title,
      summary: item.summary,
      content: item.content,
      notes: item.notes ?? '',
      source: item.source,
      topics: item.topics.join(', '),
    })
    setEditing(false)
    setMenuOpen(false)
    setJoMessages(loadJoHistory(item.id))
    setSelectedPassage('')
    tabRefs.current = {}
  }, [item.id])

  useEffect(() => {
    saveJoHistory(item.id, joMessages)
  }, [item.id, joMessages])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [joMessages, tab])

  // Lazy-load reel transcript only when needed.
  useEffect(() => {
    if (tab !== 'transcript' && tab !== 'jo') return
    if (!item.sourceReelId) return
    if (tabRefs.current.transcript && reel) return
    let cancelled = false
    setReelLoading(true)
    setReelError('')
    void listReels()
      .then(reels => {
        if (cancelled) return
        const match = reels.find(entry => entry.id === item.sourceReelId) ?? null
        setReel(match)
        tabRefs.current.transcript = true
        if (!match) setReelError('Original-Reel nicht gefunden.')
      })
      .catch(reason => {
        if (!cancelled) setReelError(reason instanceof Error ? reason.message : 'Transkript konnte nicht geladen werden.')
      })
      .finally(() => {
        if (!cancelled) setReelLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [tab, item.sourceReelId, reel])

  const suggestions = useMemo(
    () => suggestRelations({ focusId: item.id, items, relations, goals, projects, decisions }),
    [item.id, items, relations, goals, projects, decisions],
  )

  const similar = useMemo(() => {
    const topicSet = new Set(item.topics.map(topic => topic.toLowerCase()))
    return items
      .filter(entry => entry.id !== item.id)
      .map(entry => {
        const overlap = entry.topics.filter(topic => topicSet.has(topic.toLowerCase())).length
        const sameArea = entry.lifeArea && entry.lifeArea === item.lifeArea ? 1 : 0
        return { entry, score: overlap * 2 + sameArea }
      })
      .filter(hit => hit.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
  }, [item, items])

  const linkedGoals = useMemo(
    () => relations
      .filter(rel =>
        (rel.fromKind === 'knowledge' && rel.fromId === item.id && rel.toKind === 'goal')
        || (rel.toKind === 'knowledge' && rel.toId === item.id && rel.fromKind === 'goal'),
      )
      .map(rel => {
        const goalId = rel.fromKind === 'goal' ? rel.fromId : rel.toId
        return goals.find(goal => goal.id === goalId)
      })
      .filter((goal): goal is { id: string; title: string } => Boolean(goal)),
    [relations, item.id, goals],
  )

  const linkedTasks = related.filter(entry => entry.kind === 'project' || entry.kind === 'task')

  const paragraphs = useMemo(() => {
    const raw = reel?.transcript || ''
    const parts = splitTranscript(raw)
    if (parts.length === 0 && raw.trim()) return [raw.trim()]
    return parts
  }, [reel])

  const filteredParagraphs = useMemo(() => {
    const q = transcriptQuery.trim().toLowerCase()
    if (!q) return paragraphs.map((text, index) => ({ text, index, hit: false }))
    return paragraphs
      .map((text, index) => ({ text, index, hit: text.toLowerCase().includes(q) }))
      .filter(entry => entry.hit)
  }, [paragraphs, transcriptQuery])

  const suggestedQuestions = useMemo(() => {
    const topic = item.topics[0]
    return [
      topic ? `Was sagt diese Quelle zu ${topic}?` : 'Fasse die wichtigsten Erkenntnisse zusammen.',
      'Welche Handlungsempfehlungen stecken darin?',
      'Gibt es Widersprüche zu meinem übrigen Wissen?',
    ]
  }, [item.topics])

  const flash = (message: string) => {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 2200)
  }

  const applyEdits = () => {
    onChange(item.id, {
      title: draft.title.trim() || item.title,
      summary: draft.summary,
      content: draft.content,
      notes: draft.notes,
      source: draft.source,
      topics: draft.topics.split(',').map(part => part.trim()).filter(Boolean),
    })
    setEditing(false)
    flash('Gespeichert')
  }

  const askJo = (question: string) => {
    const text = question.trim()
    if (!text || joBusy) return
    setJoBusy(true)
    const userMsg: JoMessage = { id: crypto.randomUUID(), role: 'user', text }
    setJoMessages(current => [...current, userMsg])
    setJoInput('')
    try {
      const corpus = (joScope === 'card' ? [item] : items).map(entry => ({
        id: entry.id,
        title: entry.title,
        summary: entry.summary,
        content: [entry.content, entry.notes, ...(entry.ideas ?? []), ...(entry.takeaways ?? [])].filter(Boolean).join('\n'),
        topics: entry.topics,
        tags: entry.tags,
        source: entry.source,
        lifeArea: entry.lifeArea,
        areaLocked: entry.areaLocked,
        updatedAt: entry.updatedAt,
        evidenceStatus: entry.evidenceStatus,
      }))
      const scoped = joScope === 'card'
        ? answerKnowledgeQuery({ question: text, knowledge: corpus })
        : tryAnswerKnowledgeQuery({ text, knowledge: corpus })?.answer
          ?? answerKnowledgeQuery({ question: text, knowledge: corpus })
      const passageHint = selectedPassage
        ? `\n\nBezug Passage: „${selectedPassage.slice(0, 160)}${selectedPassage.length > 160 ? '…' : ''}“`
        : ''
      setJoMessages(current => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          text: `${scoped.answer}${passageHint}`,
          sources: scoped.sources,
          caution: scoped.caution,
        },
      ])
    } finally {
      setJoBusy(false)
    }
  }

  return (
    <div className="knowledge-detail">
      <header className="knowledge-detail__head">
        <button type="button" className="icon-button knowledge-detail__back" aria-label="Zurück zur Bibliothek" onClick={onBack}>
          <ArrowLeft size={18} />
        </button>
        <div className="knowledge-detail__title-wrap">
          <h2 className="knowledge-detail__title">{item.title}</h2>
          <div className="knowledge-detail__meta">
            <span>{item.source || KNOWLEDGE_TYPE_LABELS[item.type]}</span>
            {item.topics[0] && <span>{item.topics[0]}</span>}
            {item.lifeArea && <span>{areaLabel(item.lifeArea)}</span>}
            <span>{formatDate(item.createdAt)}</span>
          </div>
        </div>
        <div className="knowledge-detail__menu">
          <button
            type="button"
            className="icon-button"
            aria-label="Aktionen"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(open => !open)}
          >
            <MoreHorizontal size={18} />
          </button>
          {menuOpen && (
            <div className="knowledge-detail__menu-panel" role="menu">
              <button type="button" role="menuitem" onClick={() => { setEditing(true); setMenuOpen(false) }}>
                <Pencil size={15} /> Bearbeiten
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  void copyText([item.title, item.summary, item.content].filter(Boolean).join('\n\n')).then(ok => flash(ok ? 'Kopiert' : 'Kopieren fehlgeschlagen'))
                  setMenuOpen(false)
                }}
              >
                <Copy size={15} /> Text kopieren
              </button>
              <button
                type="button"
                role="menuitem"
                className="is-danger"
                onClick={() => {
                  setMenuOpen(false)
                  if (window.confirm('Eintrag wirklich löschen?')) onDelete(item.id)
                }}
              >
                Löschen
              </button>
            </div>
          )}
        </div>
      </header>

      {notice && <p className="knowledge-detail__notice" role="status">{notice}</p>}

      <nav className="knowledge-tabs" aria-label="Wissensbereiche">
        <div className="knowledge-tabs__scroller">
          {TABS.map(id => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              className={tab === id ? 'knowledge-tabs__tab is-active' : 'knowledge-tabs__tab'}
              onClick={() => onTabChange(id)}
            >
              {TAB_LABELS[id]}
            </button>
          ))}
        </div>
      </nav>

      <div className="knowledge-detail__body" role="tabpanel">
        {tab === 'notes' && (
          <section className="knowledge-panel">
            {editing ? (
              <div className="knowledge-edit">
                <Field label="Titel">
                  <input value={draft.title} onChange={event => setDraft(current => ({ ...current, title: event.target.value }))} />
                </Field>
                <Field label="Kurzzusammenfassung">
                  <textarea rows={3} value={draft.summary} onChange={event => setDraft(current => ({ ...current, summary: event.target.value }))} />
                </Field>
                <Field label="Ausführliche Zusammenfassung">
                  <textarea rows={6} value={draft.content} onChange={event => setDraft(current => ({ ...current, content: event.target.value }))} />
                </Field>
                <Field label="Eigene Notizen">
                  <textarea rows={4} value={draft.notes} onChange={event => setDraft(current => ({ ...current, notes: event.target.value }))} />
                </Field>
                <Field label="Quelle">
                  <input value={draft.source} onChange={event => setDraft(current => ({ ...current, source: event.target.value }))} />
                </Field>
                <Field label="Themen (Komma)">
                  <input value={draft.topics} onChange={event => setDraft(current => ({ ...current, topics: event.target.value }))} />
                </Field>
                <LifeAreaSelect value={item.lifeArea} onChange={lifeArea => onChange(item.id, { lifeArea, areaLocked: true })} />
                <div className="knowledge-panel__actions">
                  <button type="button" className="primary-button" onClick={applyEdits}>Speichern</button>
                  <button type="button" className="secondary-button" onClick={() => setEditing(false)}>Abbrechen</button>
                </div>
              </div>
            ) : (
              <>
                <article className="knowledge-article">
                  <h3>Kurzzusammenfassung</h3>
                  <p>{item.summary || 'Noch keine Zusammenfassung.'}</p>
                </article>

                {(item.ideas?.length || item.takeaways?.length) ? (
                  <article className="knowledge-article">
                    <h3>Wichtigste Erkenntnisse</h3>
                    <ul className="lifeos-plain-list">
                      {[...(item.ideas ?? []), ...(item.takeaways ?? [])].map(entry => (
                        <li key={entry}>
                          <div className="knowledge-insight-row">
                            <span>{entry}</span>
                            <div className="knowledge-insight-row__actions">
                              <button
                                type="button"
                                className="icon-button"
                                aria-label="Erkenntnis speichern"
                                onClick={() => {
                                  onSaveInsight(entry, item.id)
                                  flash('Erkenntnis gespeichert')
                                }}
                              >
                                <BookmarkPlus size={16} />
                              </button>
                              <button
                                type="button"
                                className="icon-button"
                                aria-label="Als Aufgabe"
                                onClick={() => {
                                  onCreateTask(entry, item.id)
                                  flash('Aufgabe angelegt')
                                }}
                              >
                                <ListTodo size={16} />
                              </button>
                              <button
                                type="button"
                                className="icon-button"
                                aria-label="Kopieren"
                                onClick={() => { void copyText(entry).then(ok => flash(ok ? 'Kopiert' : 'Kopieren fehlgeschlagen')) }}
                              >
                                <Copy size={16} />
                              </button>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </article>
                ) : null}

                <Disclosure title="Ausführliche Zusammenfassung">
                  <p className="knowledge-article__long">{item.content || 'Kein ausführlicher Text hinterlegt.'}</p>
                </Disclosure>

                <Disclosure title="Handlungsempfehlungen">
                  {(item.takeaways?.length ?? 0) > 0 ? (
                    <ul className="lifeos-plain-list">
                      {(item.takeaways ?? []).map(entry => (
                        <li key={`action-${entry}`}>
                          <div className="knowledge-insight-row">
                            <span>{entry}</span>
                            <button
                              type="button"
                              className="small-button"
                              onClick={() => {
                                onCreateTask(entry, item.id)
                                flash('Aufgabe angelegt')
                              }}
                            >
                              <ListTodo size={14} /> Aufgabe
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="reel-review-detail__guard">Noch keine konkreten Handlungsempfehlungen gespeichert.</p>
                  )}
                </Disclosure>

                <article className="knowledge-article">
                  <div className="knowledge-article__head">
                    <h3>Eigene Notizen</h3>
                    <button type="button" className="small-button" onClick={() => setEditing(true)}>
                      <Pencil size={14} /> Bearbeiten
                    </button>
                  </div>
                  <p className="knowledge-article__notes">{item.notes?.trim() || 'Noch keine eigenen Notizen.'}</p>
                </article>

                {goals.length > 0 && (
                  <Disclosure title="Mit Goal verknüpfen">
                    <div className="lifeos-inline">
                      <select
                        aria-label="Ziel wählen"
                        value={linkId}
                        onChange={event => setLinkId(event.target.value)}
                      >
                        <option value="">Ziel wählen</option>
                        {goals.map(goal => <option key={goal.id} value={goal.id}>{goal.title}</option>)}
                      </select>
                      <button
                        type="button"
                        className="secondary-button"
                        disabled={!linkId}
                        onClick={() => {
                          onLink(item.id, { kind: 'goal', targetId: linkId, role: 'applicable_to' })
                          setLinkId('')
                          flash('Mit Goal verknüpft')
                        }}
                      >
                        <Target size={14} /> Verknüpfen
                      </button>
                    </div>
                  </Disclosure>
                )}
              </>
            )}
          </section>
        )}

        {tab === 'transcript' && (
          <section className="knowledge-panel">
            {!item.sourceReelId ? (
              <LifeOsEmpty title="Kein Transkript" text="Dieser Eintrag ist nicht mit einem Reel verknüpft." />
            ) : reelLoading ? (
              <p className="reel-review-detail__guard">Transkript wird geladen …</p>
            ) : reelError ? (
              <p className="knowledge-panel__error" role="alert">{reelError}</p>
            ) : !reel?.transcript?.trim() ? (
              <LifeOsEmpty title="Kein Text erkannt" text="Für dieses Reel liegt noch kein Transkript vor." />
            ) : (
              <>
                <label className="text-field knowledge-transcript__search">
                  <span className="sr-only">Im Transkript suchen</span>
                  <Search size={16} aria-hidden />
                  <input
                    value={transcriptQuery}
                    onChange={event => setTranscriptQuery(event.target.value)}
                    placeholder="Im Transkript suchen"
                    aria-label="Im Transkript suchen"
                  />
                </label>
                <p className="reel-review-detail__guard">
                  Originalsprache bleibt erhalten.
                  {reel.transcriptProvider ? ` Quelle: ${reel.transcriptProvider}.` : ''}
                  {' '}Keine erfundenen Zeitmarken — Sprung zur Videoposition ist nicht angebunden.
                </p>
                <div className="knowledge-transcript">
                  {filteredParagraphs.length === 0 ? (
                    <LifeOsEmpty title="Keine Treffer" text="Kein Absatz passt zur Suche." />
                  ) : filteredParagraphs.map(entry => (
                    <article
                      key={entry.index}
                      className={selectedPassage === entry.text ? 'knowledge-transcript__p is-selected' : 'knowledge-transcript__p'}
                    >
                      <p>{entry.text}</p>
                      <div className="knowledge-transcript__actions">
                        <button
                          type="button"
                          className="small-button"
                          onClick={() => {
                            const next = [item.notes?.trim(), entry.text].filter(Boolean).join('\n\n')
                            onChange(item.id, { notes: next })
                            flash('In Notizen übernommen')
                          }}
                        >
                          In Notizen
                        </button>
                        <button
                          type="button"
                          className="small-button"
                          onClick={() => {
                            setSelectedPassage(entry.text)
                            onTabChange('jo')
                          }}
                        >
                          Mit Jo besprechen
                        </button>
                        <button
                          type="button"
                          className="small-button"
                          onClick={() => { void copyText(entry.text).then(ok => flash(ok ? 'Kopiert' : 'Kopieren fehlgeschlagen')) }}
                        >
                          Kopieren
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
                {reel.onScreenText?.trim() && (
                  <Disclosure title="Bildschirmtext">
                    <pre className="knowledge-transcript__ocr">{reel.onScreenText}</pre>
                  </Disclosure>
                )}
              </>
            )}
          </section>
        )}

        {tab === 'jo' && (
          <section className="knowledge-panel knowledge-jo">
            <div className="knowledge-jo__scope" role="group" aria-label="Jo-Kontext">
              <button
                type="button"
                className={joScope === 'card' ? 'small-button is-active' : 'small-button'}
                onClick={() => setJoScope('card')}
              >
                Diese Karte
              </button>
              <button
                type="button"
                className={joScope === 'library' ? 'small-button is-active' : 'small-button'}
                onClick={() => setJoScope('library')}
              >
                Ganze Bibliothek
              </button>
            </div>
            {selectedPassage && (
              <p className="knowledge-jo__passage">
                Passage: „{selectedPassage.slice(0, 120)}{selectedPassage.length > 120 ? '…' : ''}“
                <button type="button" className="text-button" onClick={() => setSelectedPassage('')}>lösen</button>
              </p>
            )}
            <div className="knowledge-jo__suggestions" aria-label="Vorschläge">
              {suggestedQuestions.map(question => (
                <button key={question} type="button" className="small-button" onClick={() => askJo(question)}>
                  {question}
                </button>
              ))}
            </div>
            <div className="knowledge-jo__thread" aria-live="polite">
              {joMessages.length === 0 ? (
                <LifeOsEmpty title="Frag Jo zu diesem Wissen" text="Antworten nutzen deine gespeicherten Karten und nennen Quellen." />
              ) : joMessages.map(message => (
                <article key={message.id} className={`knowledge-jo__bubble is-${message.role}`}>
                  <p>{message.text}</p>
                  {message.caution && <small>{message.caution}</small>}
                  {message.sources && message.sources.length > 0 && (
                    <ul className="knowledge-jo__sources">
                      {message.sources.map(source => (
                        <li key={source.id}>
                          <button type="button" className="text-button" onClick={() => onOpenEntity('knowledge', source.id)}>
                            {source.title}
                          </button>
                          <span>{source.snippet}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {message.role === 'assistant' && (
                    <div className="knowledge-jo__bubble-actions">
                      <button
                        type="button"
                        className="small-button"
                        onClick={() => {
                          const next = [item.notes?.trim(), message.text].filter(Boolean).join('\n\n')
                          onChange(item.id, { notes: next })
                          flash('Als Notiz gespeichert')
                        }}
                      >
                        Als Notiz
                      </button>
                      <button
                        type="button"
                        className="small-button"
                        onClick={() => {
                          onCreateTask(message.text.slice(0, 120), item.id)
                          flash('Aufgabe angelegt')
                        }}
                      >
                        Als Aufgabe
                      </button>
                    </div>
                  )}
                </article>
              ))}
              <div ref={chatEndRef} />
            </div>
            <form
              className="knowledge-jo__composer"
              onSubmit={event => {
                event.preventDefault()
                askJo(joInput)
              }}
            >
              <input
                value={joInput}
                onChange={event => setJoInput(event.target.value)}
                placeholder="Frage zu diesem Wissen…"
                aria-label="Frage an Jo"
                disabled={joBusy}
              />
              <button type="submit" className="primary-button" disabled={joBusy || !joInput.trim()}>
                {joBusy ? '…' : 'Fragen'}
              </button>
            </form>
          </section>
        )}

        {tab === 'quiz' && (
          <section className="knowledge-panel">
            <p className="reel-review-detail__guard">
              Karteikarten aus gespeichertem Wissen. Multiple-Choice-Generierung und serverseitige Quiz-Auswertung fehlen noch —
              Fortschritt läuft lokal über Active Recall / Spaced Repetition.
            </p>
            <ActiveRecallPanel item={item} reviews={reviews} onChangeReviews={onReviewsChange} />
          </section>
        )}

        {tab === 'links' && (
          <section className="knowledge-panel">
            <article className="knowledge-article">
              <h3>Ähnliche Einträge</h3>
              {similar.length === 0 ? (
                <p className="reel-review-detail__guard">Keine thematisch ähnlichen Karten gefunden.</p>
              ) : (
                <ul className="knowledge-link-list">
                  {similar.map(({ entry }) => (
                    <li key={entry.id}>
                      <button type="button" className="knowledge-link-list__item" onClick={() => onOpenEntity('knowledge', entry.id)}>
                        <strong>{entry.title}</strong>
                        <span>{entry.topics.slice(0, 2).join(' · ') || entry.source}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </article>

            <article className="knowledge-article">
              <h3>Themen & Tags</h3>
              <div className="knowledge-chip-row">
                {item.topics.length === 0 && item.tags.length === 0 && (
                  <span className="reel-review-detail__guard">Keine Themen hinterlegt.</span>
                )}
                {item.topics.map(topic => <span key={`t-${topic}`} className="knowledge-chip">{topic}</span>)}
                {item.tags.filter(tag => !tag.startsWith('reel:') && !tag.startsWith('import:')).map(tag => (
                  <span key={`g-${tag}`} className="knowledge-chip is-muted">{tag}</span>
                ))}
              </div>
            </article>

            <article className="knowledge-article">
              <h3>Goals</h3>
              {linkedGoals.length === 0 ? (
                <p className="reel-review-detail__guard">Noch nicht mit einem Goal verknüpft.</p>
              ) : (
                <ul className="knowledge-link-list">
                  {linkedGoals.map(goal => (
                    <li key={goal.id}>
                      <button type="button" className="knowledge-link-list__item" onClick={() => onOpenEntity('goal', goal.id)}>
                        <strong>{goal.title}</strong>
                        <span>Goal</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </article>

            {linkedTasks.length > 0 && (
              <article className="knowledge-article">
                <h3>Zugehörige Projekte</h3>
                <ul className="knowledge-link-list">
                  {linkedTasks.map(entry => (
                    <li key={`${entry.kind}-${entry.id}`}>
                      <button type="button" className="knowledge-link-list__item" onClick={() => onOpenEntity(entry.kind === 'project' ? 'project' : 'knowledge', entry.id)}>
                        <strong>{entry.title}</strong>
                        <span>{entry.kind}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </article>
            )}

            <Disclosure title="Graph">
              <KnowledgeGraphPanel
                focusId={item.id}
                relations={relations}
                knowledge={items.map(entry => ({ id: entry.id, title: entry.title }))}
                goals={goals}
                projects={projects}
                decisions={decisions}
                onOpen={onOpenEntity}
              />
            </Disclosure>

            <Disclosure title="Manuell verknüpfen">
              {suggestions.length > 0 && suggestions.map(suggestion => (
                <div key={`${suggestion.role}-${suggestion.toKind}-${suggestion.toId}`} className="lifeos-inline">
                  <span>{ROLE_LABELS[suggestion.role] || suggestion.role}: {suggestion.reason}</span>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => onLink(item.id, { kind: suggestion.toKind, targetId: suggestion.toId, role: suggestion.role })}
                  >
                    <Check size={14} /> Übernehmen
                  </button>
                </div>
              ))}
              <div className="lifeos-inline">
                <select value={linkKind} onChange={event => setLinkKind(event.target.value as typeof linkKind)} aria-label="Verknüpfungsart">
                  <option value="goal">Ziel</option>
                  <option value="project">Projekt</option>
                  <option value="decision">Entscheidung</option>
                  <option value="knowledge">Wissen</option>
                </select>
                {linkKind === 'goal' || linkKind === 'project' || linkKind === 'decision' || linkKind === 'knowledge' ? (
                  <select
                    aria-label="Ziel wählen"
                    value={linkId}
                    onChange={event => setLinkId(event.target.value)}
                  >
                    <option value="">Auswählen</option>
                    {(linkKind === 'goal' ? goals : linkKind === 'project' ? projects : linkKind === 'decision' ? decisions : items.filter(entry => entry.id !== item.id).map(entry => ({ id: entry.id, title: entry.title }))).map(entry => (
                      <option key={entry.id} value={entry.id}>{entry.title}</option>
                    ))}
                  </select>
                ) : null}
                <button
                  type="button"
                  className="secondary-button"
                  disabled={!linkId}
                  onClick={() => {
                    onLink(item.id, { kind: linkKind, targetId: linkId, role: 'related_to' })
                    setLinkId('')
                    flash('Verknüpft')
                  }}
                >
                  <Link2 size={14} /> Verknüpfen
                </button>
              </div>
            </Disclosure>
          </section>
        )}
      </div>
    </div>
  )
}
