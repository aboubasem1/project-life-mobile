import type { EntityKind, Relation } from './types.js'

export type GraphNodeKind = Extract<EntityKind, 'knowledge' | 'goal' | 'project' | 'decision'>

export type GraphNode = {
  key: string
  id: string
  kind: GraphNodeKind
  title: string
  depth: number
}

export type GraphEdge = {
  id: string
  fromKey: string
  toKey: string
  role: string
}

export type GraphNeighborhood = {
  focusKey: string
  nodes: GraphNode[]
  edges: GraphEdge[]
  truncated: boolean
}

export type NamedEntity = { id: string; title: string }

export function nodeKey(kind: GraphNodeKind, id: string): string {
  return `${kind}:${id}`
}

export function buildKnowledgeNeighborhood(input: {
  focusId: string
  relations: Relation[]
  knowledge: NamedEntity[]
  goals?: NamedEntity[]
  projects?: NamedEntity[]
  decisions?: NamedEntity[]
  roleFilter?: string
  limit?: number
  expandedKeys?: string[]
}): GraphNeighborhood {
  const limit = Math.max(3, Math.min(24, input.limit ?? 10))
  const roleFilter = input.roleFilter && input.roleFilter !== 'all' ? input.roleFilter : null
  const titles = new Map<string, GraphNode>()
  const put = (kind: GraphNodeKind, item: NamedEntity) => {
    titles.set(nodeKey(kind, item.id), { key: nodeKey(kind, item.id), id: item.id, kind, title: item.title, depth: 0 })
  }
  for (const item of input.knowledge) put('knowledge', item)
  for (const item of input.goals ?? []) put('goal', item)
  for (const item of input.projects ?? []) put('project', item)
  for (const item of input.decisions ?? []) put('decision', item)

  const focusKey = nodeKey('knowledge', input.focusId)
  if (!titles.has(focusKey)) {
    return { focusKey, nodes: [], edges: [], truncated: false }
  }

  const expanded = new Set<string>([focusKey, ...(input.expandedKeys ?? [])])
  const nodes = new Map<string, GraphNode>()
  const edges: GraphEdge[] = []
  nodes.set(focusKey, { ...titles.get(focusKey)!, depth: 0 })

  const visit = (currentKey: string, depth: number) => {
    for (const relation of input.relations) {
      if (roleFilter && (relation.role ?? 'related_to') !== roleFilter) continue
      if (!isGraphKind(relation.fromKind) || !isGraphKind(relation.toKind)) continue
      const left = nodeKey(relation.fromKind, relation.fromId)
      const right = nodeKey(relation.toKind, relation.toId)
      let neighborKey = ''
      if (left === currentKey) neighborKey = right
      else if (right === currentKey) neighborKey = left
      else continue
      if (!titles.has(neighborKey)) continue
      if (!edges.some(edge => edge.id === relation.id)) {
        edges.push({ id: relation.id, fromKey: left, toKey: right, role: relation.role ?? 'related_to' })
      }
      if (nodes.has(neighborKey)) continue
      if (nodes.size >= limit) return true
      nodes.set(neighborKey, { ...titles.get(neighborKey)!, depth: depth + 1 })
    }
    return false
  }

  let truncated = visit(focusKey, 0)
  for (const key of expanded) {
    if (key === focusKey) continue
    if (!nodes.has(key) && titles.has(key)) {
      if (nodes.size >= limit) {
        truncated = true
        break
      }
      nodes.set(key, { ...titles.get(key)!, depth: 1 })
    }
    if (nodes.has(key) && visit(key, nodes.get(key)!.depth)) truncated = true
  }

  const nodeKeys = new Set(nodes.keys())
  return {
    focusKey,
    nodes: [...nodes.values()].sort((a, b) => a.depth - b.depth || a.title.localeCompare(b.title)),
    edges: edges.filter(edge => nodeKeys.has(edge.fromKey) && nodeKeys.has(edge.toKey)),
    truncated,
  }
}

function isGraphKind(value: string): value is GraphNodeKind {
  return value === 'knowledge' || value === 'goal' || value === 'project' || value === 'decision'
}

export function layoutRadial(nodes: GraphNode[], width = 320, height = 240): Array<GraphNode & { x: number; y: number }> {
  const cx = width / 2
  const cy = height / 2
  const byDepth = new Map<number, GraphNode[]>()
  for (const node of nodes) {
    const list = byDepth.get(node.depth) ?? []
    list.push(node)
    byDepth.set(node.depth, list)
  }
  const placed: Array<GraphNode & { x: number; y: number }> = []
  for (const [depth, group] of [...byDepth.entries()].sort((a, b) => a[0] - b[0])) {
    if (depth === 0) {
      placed.push({ ...group[0], x: cx, y: cy })
      continue
    }
    const radius = Math.min(width, height) * (0.18 + depth * 0.22)
    group.forEach((node, index) => {
      const angle = ((Math.PI * 2) * index) / group.length - Math.PI / 2
      placed.push({
        ...node,
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
      })
    })
  }
  return placed
}
