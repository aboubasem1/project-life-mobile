import { useMemo, useState } from 'react'
import { buildKnowledgeNeighborhood, layoutRadial, nodeKey, type GraphNodeKind } from '../../lib/lifeos'

const KIND_LABEL: Record<GraphNodeKind, string> = {
  knowledge: 'Wissen',
  goal: 'Ziel',
  project: 'Projekt',
  decision: 'Entscheidung',
}

const ROLE_OPTIONS = [
  { id: 'all', label: 'Alle' },
  { id: 'related_to', label: 'Verwandt' },
  { id: 'supports', label: 'Stützt' },
  { id: 'contradicts', label: 'Widerspricht' },
  { id: 'applicable_to', label: 'Passend' },
]

export function KnowledgeGraphPanel({
  focusId,
  relations,
  knowledge,
  goals,
  projects,
  decisions,
  onOpen,
}: {
  focusId: string
  relations: Array<{ id: string; fromKind: string; fromId: string; toKind: string; toId: string; role?: string }>
  knowledge: Array<{ id: string; title: string }>
  goals: Array<{ id: string; title: string }>
  projects: Array<{ id: string; title: string }>
  decisions: Array<{ id: string; title: string }>
  onOpen: (kind: GraphNodeKind, id: string) => void
}) {
  const [roleFilter, setRoleFilter] = useState('all')
  const [expandedKeys, setExpandedKeys] = useState<string[]>([])
  const [highlight, setHighlight] = useState(nodeKey('knowledge', focusId))
  const graph = useMemo(() => buildKnowledgeNeighborhood({
    focusId,
    relations: relations as never,
    knowledge,
    goals,
    projects,
    decisions,
    roleFilter,
    limit: 10,
    expandedKeys,
  }), [focusId, relations, knowledge, goals, projects, decisions, roleFilter, expandedKeys])
  const placed = useMemo(() => layoutRadial(graph.nodes), [graph.nodes])
  const byKey = useMemo(() => new Map(placed.map(node => [node.key, node])), [placed])

  if (graph.nodes.length === 0) {
    return <p className="reel-review-detail__guard">Noch keine Beziehungen für diesen Eintrag.</p>
  }

  return (
    <div className="knowledge-graph">
      <div className="lifeos-inline" role="group" aria-label="Beziehungsfilter">
        {ROLE_OPTIONS.map(option => (
          <button
            key={option.id}
            type="button"
            className={roleFilter === option.id ? 'small-button is-active' : 'small-button'}
            onClick={() => setRoleFilter(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>
      <svg className="knowledge-graph__canvas" viewBox="0 0 320 240" role="img" aria-label="Wissensgraph">
        {graph.edges.map(edge => {
          const from = byKey.get(edge.fromKey)
          const to = byKey.get(edge.toKey)
          if (!from || !to) return null
          const active = highlight === edge.fromKey || highlight === edge.toKey
          return (
            <line
              key={edge.id}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              className={active ? 'knowledge-graph__edge is-active' : 'knowledge-graph__edge'}
            />
          )
        })}
        {placed.map(node => (
          <g key={node.key} transform={`translate(${node.x} ${node.y})`}>
            <circle
              r={node.depth === 0 ? 18 : 14}
              className={highlight === node.key ? `knowledge-graph__node is-${node.kind} is-active` : `knowledge-graph__node is-${node.kind}`}
            />
            <text y={4} textAnchor="middle" className="knowledge-graph__label">{node.title.slice(0, 12)}</text>
            <title>{`${KIND_LABEL[node.kind]}: ${node.title}`}</title>
            <circle
              r={22}
              fill="transparent"
              role="button"
              tabIndex={0}
              aria-label={`${KIND_LABEL[node.kind]} ${node.title} öffnen`}
              onFocus={() => setHighlight(node.key)}
              onClick={() => {
                setHighlight(node.key)
                onOpen(node.kind, node.id)
              }}
              onKeyDown={event => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  setHighlight(node.key)
                  onOpen(node.kind, node.id)
                }
              }}
            />
          </g>
        ))}
      </svg>
      {graph.truncated && (
        <button
          type="button"
          className="secondary-button"
          onClick={() => {
            const next = graph.nodes.find(node => node.depth > 0 && !expandedKeys.includes(node.key))
            if (next) setExpandedKeys(current => [...current, next.key])
          }}
        >
          Mehr Verbindungen
        </button>
      )}
    </div>
  )
}
