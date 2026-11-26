import { useEffect, useMemo, useRef, useState } from 'react'
import { ListFilter, Plus, Search, Upload } from 'lucide-react'
import {
  KNOWLEDGE_TYPE_LABELS,
  LIFE_AREAS,
  areaLabel,
  rankKnowledge,
  type KnowledgeItem,
  type KnowledgeReview,
  type KnowledgeType,
  type Relation,
} from '../../lib/lifeos'
import { listPublishedKnowledge, listReels, type KnowledgePublishDraft } from '../../lib/reels'
import {
  knowledgeSurfaceFromHash,
  knowledgeTabFromHash,
  navigateKnowledgeHash,
  type KnowledgeSurface,
  type KnowledgeTabId,
} from '../../lib/routing'
import { LifeOsEmpty, LifeOsPage } from './lifeosUi'
import { KnowledgeDetailView } from './KnowledgeDetailView'
import { ReelImportPanel } from './ReelImportPanel'

type SortMode = 'newest' | 'oldest' | 'title' | 'relevance'
type SourceFilter = 'all' | 'reel' | 'other'

const PAGE_SIZE = 40

function formatDate(value: string): string {
  const stamp = Date.parse(value)
  if (!Number.isFinite(stamp)) return ''
  return new Date(stamp).toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })
}

function matchesSource(item: KnowledgeItem, filter: SourceFilter): boolean {
  if (filter === 'all') return true
  const isReel = Boolean(item.sourceReelId) || item.tags.some(tag => tag.startsWith('reel:') || tag === 'import:reel') || item.type === 'video'
  return filter === 'reel' ? isReel : !isReel
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs)
    return () => window.clearTimeout(timer)
  }, [value, delayMs])
  return debounced
}

export function KnowledgeView({
  items,
  relations,
  reviews,
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
  onReviewsChange,
  onOpenEntity,
  onCreateTask,
  onSaveInsight,
}: {
  items: KnowledgeItem[]
  relations: Relation[]
  reviews: KnowledgeReview[]
  goals: Array<{ id: string; title: string }>
  projects: Array<{ id: string; title: string }>
  decisions: Array<{ id: string; title: string }>
  selectedId?: string
  related: Array<{ id: string; title: string; kind: string }>
  onSelect: (id: string | undefined) => void
  onCreate: () => string
  onChange: (id: string, patch: Partial<KnowledgeItem>) => void
  onDelete: (id: string) => void
  onLink: (id: string, target: { kind: 'project' | 'goal' | 'decision' | 'knowledge'; targetId: string; role?: string }) => void
  onPublished: (drafts: KnowledgePublishDraft[]) => number
  onReviewsChange: (next: KnowledgeReview[]) => void
  onOpenEntity: (kind: 'knowledge' | 'goal' | 'project' | 'decision', id: string) => void
  onCreateTask: (title: string, sourceKnowledgeId: string) => void
  onSaveInsight: (text: string, sourceKnowledgeId: string) => void
}) {
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebouncedValue(query, 200)
  const [topic, setTopic] = useState('')
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all')
  const [typeFilter, setTypeFilter] = useState<KnowledgeType | 'all'>('all')
  const [areaFilter, setAreaFilter] = useState('')
  const [sort, setSort] = useState<SortMode>('newest')
  const [showFilters, setShowFilters] = useState(false)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [queueOpen, setQueueOpen] = useState(0)
  const [surface, setSurface] = useState<KnowledgeSurface>(() => knowledgeSurfaceFromHash())
  const [tab, setTab] = useState<KnowledgeTabId>(() => knowledgeTabFromHash() ?? 'notes')
  const tabById = useRef<Record<string, KnowledgeTabId>>({})
  const publishRef = useRef(onPublished)
  publishRef.current = onPublished

  useEffect(() => {
    let cancelled = false
    void listPublishedKnowledge()
      .then(drafts => {
        if (!cancelled && drafts.length > 0) publishRef.current(drafts)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const refreshQueue = () => {
      void listReels()
        .then(reels => {
          if (cancelled) return
          const open = reels.filter(reel => {
            if (reel.knowledgeItemId || reel.status === 'PUBLISHED') return false
            return reel.status === 'FAILED'
              || reel.jobStatus === 'queued'
              || reel.jobStatus === 'running'
              || reel.jobStatus === 'retry'
              || reel.jobStatus === 'dead'
              || ['UPLOADED', 'PROCESSING', 'EXTRACTED', 'CLASSIFIED', 'FACT_CHECK_PENDING', 'REVIEW_READY', 'USER_REVIEWED', 'MORE_EVIDENCE', 'APPROVED_CANDIDATE', 'SOURCE_ONLY'].includes(reel.status)
          }).length
          setQueueOpen(open)
        })
        .catch(() => {})
    }
    refreshQueue()
    const timer = window.setInterval(refreshQueue, 15_000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [surface])

  useEffect(() => {
    const sync = () => {
      const nextSurface = knowledgeSurfaceFromHash()
      setSurface(nextSurface)
      const hashTab = knowledgeTabFromHash()
      if (hashTab) setTab(hashTab)
      try {
        if (sessionStorage.getItem('lifeos.open-reel-import') === '1') {
          sessionStorage.removeItem('lifeos.open-reel-import')
          setSurface('processing')
          navigateKnowledgeHash({ surface: 'processing', replace: true })
        }
      } catch {
        /* ignore */
      }
    }
    sync()
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])

  useEffect(() => {
    if (selectedId) {
      setSurface(current => (current === 'processing' ? current : 'detail'))
      const remembered = tabById.current[selectedId]
      const hashTab = knowledgeTabFromHash()
      setTab(hashTab ?? remembered ?? 'notes')
    } else if (surface === 'detail') {
      setSurface('library')
    }
  }, [selectedId])

  const topics = useMemo(() => {
    const counts = new Map<string, number>()
    for (const item of items) {
      for (const entry of item.topics) {
        const key = entry.trim()
        if (!key) continue
        counts.set(key, (counts.get(key) ?? 0) + 1)
      }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name)
  }, [items])

  const ranked = useMemo(
    () => new Map(rankKnowledge(items, debouncedQuery).map(hit => [hit.id, hit.score])),
    [items, debouncedQuery],
  )

  const filtered = useMemo(() => {
    let list = items.filter(item => {
      if (topic && !item.topics.some(entry => entry.toLowerCase() === topic.toLowerCase())) return false
      if (areaFilter && item.lifeArea !== areaFilter) return false
      if (typeFilter !== 'all' && item.type !== typeFilter) return false
      if (!matchesSource(item, sourceFilter)) return false
      if (debouncedQuery.trim() && !ranked.has(item.id)) return false
      return true
    })
    if (sort === 'relevance' || debouncedQuery.trim()) {
      list = [...list].sort((a, b) => (ranked.get(b.id) ?? 0) - (ranked.get(a.id) ?? 0))
    } else if (sort === 'title') {
      list = [...list].sort((a, b) => a.title.localeCompare(b.title, 'de'))
    } else if (sort === 'oldest') {
      list = [...list].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    } else {
      list = [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    }
    return list
  }, [items, topic, areaFilter, typeFilter, sourceFilter, debouncedQuery, ranked, sort])

  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [debouncedQuery, topic, areaFilter, typeFilter, sourceFilter, sort])

  const visible = filtered.slice(0, visibleCount)
  const selected = selectedId ? items.find(item => item.id === selectedId) ?? null : null

  const openDetail = (id: string, nextTab: KnowledgeTabId = 'notes') => {
    tabById.current[id] = nextTab
    setTab(nextTab)
    setSurface('detail')
    onSelect(id)
    navigateKnowledgeHash({ id, tab: nextTab })
  }

  const openLibrary = () => {
    setSurface('library')
    onSelect(undefined)
    navigateKnowledgeHash({})
  }

  const openProcessing = () => {
    setSurface('processing')
    onSelect(undefined)
    navigateKnowledgeHash({ surface: 'processing' })
  }

  const changeTab = (next: KnowledgeTabId) => {
    setTab(next)
    if (selectedId) {
      tabById.current[selectedId] = next
      navigateKnowledgeHash({ id: selectedId, tab: next, replace: true })
    }
  }

  if (surface === 'processing') {
    return (
      <LifeOsPage
        eyebrow="Wissen"
        title="Verarbeitung"
        action={
          <button type="button" className="small-button" onClick={openLibrary}>
            Zur Bibliothek
          </button>
        }
      >
        <ReelImportPanel
          variant="page"
          onClose={openLibrary}
          onPublished={drafts => {
            const created = onPublished(drafts)
            return created
          }}
        />
      </LifeOsPage>
    )
  }

  if (surface === 'detail' && selected) {
    return (
      <div className="view-stack lifeos-page knowledge-detail-page">
        <KnowledgeDetailView
          item={selected}
          items={items}
          relations={relations}
          reviews={reviews}
          goals={goals}
          projects={projects}
          decisions={decisions}
          related={related}
          tab={tab}
          onTabChange={changeTab}
          onBack={openLibrary}
          onChange={onChange}
          onDelete={id => {
            onDelete(id)
            openLibrary()
          }}
          onLink={onLink}
          onReviewsChange={onReviewsChange}
          onOpenEntity={(kind, id) => {
            if (kind === 'knowledge') openDetail(id, tabById.current[id] ?? 'notes')
            else onOpenEntity(kind, id)
          }}
          onCreateTask={onCreateTask}
          onSaveInsight={onSaveInsight}
        />
      </div>
    )
  }

  return (
    <LifeOsPage
      eyebrow="Learn"
      title="Wissensbibliothek"
      action={
        <div className="lifeos-inline knowledge-library__actions">
          <button type="button" className="small-button" onClick={openProcessing}>
            <Upload size={14} /> Verarbeitung{queueOpen > 0 ? ` (${queueOpen})` : ''}
          </button>
          <button
            type="button"
            className="small-button"
            onClick={() => {
              const id = onCreate()
              openDetail(id)
            }}
          >
            <Plus size={14} /> Hinzufügen
          </button>
        </div>
      }
    >
      <div className="knowledge-library">
        <label className="text-field knowledge-library__search">
          <span className="sr-only">Wissen durchsuchen</span>
          <Search size={16} aria-hidden />
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Suchen in Titel, Themen, Inhalt…"
            aria-label="Wissen durchsuchen"
          />
        </label>

        <div className="knowledge-library__toolbar">
          <button
            type="button"
            className={showFilters ? 'small-button is-active' : 'small-button'}
            onClick={() => setShowFilters(open => !open)}
          >
            <ListFilter size={14} /> Filter
          </button>
          <label className="knowledge-library__sort">
            <span className="sr-only">Sortierung</span>
            <select
              aria-label="Sortierung"
              value={debouncedQuery.trim() ? 'relevance' : sort}
              onChange={event => setSort(event.target.value as SortMode)}
            >
              {debouncedQuery.trim() && <option value="relevance">Relevanz</option>}
              <option value="newest">Neueste</option>
              <option value="oldest">Älteste</option>
              <option value="title">Titel</option>
            </select>
          </label>
          <span className="knowledge-library__count">{filtered.length} Einträge</span>
        </div>

        {showFilters && (
          <div className="knowledge-library__filters">
            <label className="text-field">
              <span>Thema</span>
              <select aria-label="Thema" value={topic} onChange={event => setTopic(event.target.value)}>
                <option value="">Alle Themen</option>
                {topics.map(entry => <option key={entry} value={entry}>{entry}</option>)}
              </select>
            </label>
            <label className="text-field">
              <span>Quelle</span>
              <select aria-label="Quelle" value={sourceFilter} onChange={event => setSourceFilter(event.target.value as SourceFilter)}>
                <option value="all">Alle Quellen</option>
                <option value="reel">Reels / Videos</option>
                <option value="other">Sonstige</option>
              </select>
            </label>
            <label className="text-field">
              <span>Typ</span>
              <select aria-label="Typ" value={typeFilter} onChange={event => setTypeFilter(event.target.value as KnowledgeType | 'all')}>
                <option value="all">Alle Typen</option>
                {Object.entries(KNOWLEDGE_TYPE_LABELS).map(([id, label]) => (
                  <option key={id} value={id}>{label}</option>
                ))}
              </select>
            </label>
            <label className="text-field">
              <span>Bereich</span>
              <select aria-label="Bereich" value={areaFilter} onChange={event => setAreaFilter(event.target.value)}>
                <option value="">Alle Bereiche</option>
                {LIFE_AREAS.map(area => <option key={area.key} value={area.key}>{area.name}</option>)}
              </select>
            </label>
          </div>
        )}

        {items.length === 0 ? (
          <section className="card knowledge-library__empty">
            <LifeOsEmpty
              title="Noch kein Wissen"
              text="Importiere Reels oder lege einen Eintrag an."
              action={
                <div className="lifeos-inline">
                  <button type="button" className="primary-button" onClick={openProcessing}>Verarbeitung öffnen</button>
                  <button type="button" className="secondary-button" onClick={() => openDetail(onCreate())}>Eintrag anlegen</button>
                </div>
              }
            />
          </section>
        ) : filtered.length === 0 ? (
          <section className="card knowledge-library__empty">
            <LifeOsEmpty title="Nichts gefunden" text="Kein Eintrag passt zu Suche oder Filter." />
          </section>
        ) : (
          <>
            <div className="knowledge-card-grid" role="list">
              {visible.map(item => (
                <button
                  key={item.id}
                  type="button"
                  role="listitem"
                  className="knowledge-card"
                  onClick={() => openDetail(item.id)}
                >
                  <div className="knowledge-card__top">
                    <strong className="knowledge-card__title">{item.title}</strong>
                    {item.evidenceStatus === 'source_only' && (
                      <span className="knowledge-card__status">Nur Quelle</span>
                    )}
                  </div>
                  <p className="knowledge-card__summary">{item.summary || 'Keine Zusammenfassung.'}</p>
                  <div className="knowledge-card__meta">
                    <span>{item.source || KNOWLEDGE_TYPE_LABELS[item.type]}</span>
                    <span>{item.topics[0] || (item.lifeArea ? areaLabel(item.lifeArea) : 'Ohne Thema')}</span>
                    <span>{formatDate(item.createdAt)}</span>
                  </div>
                </button>
              ))}
            </div>
            {visibleCount < filtered.length && (
              <button
                type="button"
                className="secondary-button knowledge-library__more"
                onClick={() => setVisibleCount(count => count + PAGE_SIZE)}
              >
                Mehr laden ({filtered.length - visibleCount} übrig)
              </button>
            )}
          </>
        )}
      </div>
    </LifeOsPage>
  )
}
