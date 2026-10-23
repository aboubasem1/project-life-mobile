import { describe, expect, it } from 'vitest'
import { buildKnowledgeNeighborhood, layoutRadial, nodeKey } from './knowledgeGraph'
import {
  buildRecallCard,
  dueReviews,
  enableReview,
  recallAffectsNowOrGates,
  scheduleReview,
  upsertReview,
} from './activeRecall'
import { emptyLifeOsState, mergeLifeOsState, normalizeLifeOsState } from './store'

describe('knowledge graph', () => {
  const knowledge = [
    { id: 'k1', title: 'Training' },
    { id: 'k2', title: 'Schlaf' },
    { id: 'k3', title: 'Ernährung' },
  ]
  const relations = [
    { id: 'r1', fromKind: 'knowledge' as const, fromId: 'k1', toKind: 'knowledge' as const, toId: 'k2', role: 'related_to', createdAt: '2026-10-23T00:00:00.000Z' },
    { id: 'r2', fromKind: 'knowledge' as const, fromId: 'k1', toKind: 'goal' as const, toId: 'g1', role: 'applicable_to', createdAt: '2026-10-23T00:00:00.000Z' },
    { id: 'r3', fromKind: 'knowledge' as const, fromId: 'k2', toKind: 'knowledge' as const, toId: 'k3', role: 'supports', createdAt: '2026-10-23T00:00:00.000Z' },
  ]

  it('shows the focus node and direct neighbors without loading everything', () => {
    const graph = buildKnowledgeNeighborhood({
      focusId: 'k1',
      relations,
      knowledge,
      goals: [{ id: 'g1', title: 'Fit bleiben' }],
      limit: 4,
    })
    expect(graph.nodes[0]?.id).toBe('k1')
    expect(graph.nodes.map(node => node.id).sort()).toEqual(['g1', 'k1', 'k2'])
    expect(graph.nodes.some(node => node.id === 'k3')).toBe(false)
    expect(layoutRadial(graph.nodes)).toHaveLength(3)
    expect(layoutRadial(graph.nodes).find(node => node.depth === 0)?.x).toBe(160)
  })

  it('filters by relationship and expands on demand', () => {
    const filtered = buildKnowledgeNeighborhood({
      focusId: 'k1',
      relations,
      knowledge,
      goals: [{ id: 'g1', title: 'Fit bleiben' }],
      roleFilter: 'applicable_to',
    })
    expect(filtered.nodes.map(node => node.id).sort()).toEqual(['g1', 'k1'])
    const expanded = buildKnowledgeNeighborhood({
      focusId: 'k1',
      relations,
      knowledge,
      limit: 10,
      expandedKeys: [nodeKey('knowledge', 'k2')],
    })
    expect(expanded.nodes.some(node => node.id === 'k3')).toBe(true)
  })
})

describe('active recall', () => {
  it('schedules opt-in reviews and never touches NOW or Gates', () => {
    const enabled = enableReview('k1', new Date('2026-10-23T08:00:00.000Z'))
    const next = scheduleReview(enabled, 'good', 'k1', new Date('2026-10-23T08:00:00.000Z'))
    expect(next.enabled).toBe(true)
    expect(next.intervalDays).toBe(1)
    expect(dueReviews([next], new Date('2026-10-22T08:00:00.000Z'))).toHaveLength(0)
    expect(dueReviews([next], new Date('2026-10-25T08:00:00.000Z'))).toHaveLength(1)
    expect(recallAffectsNowOrGates()).toBe(false)
    const card = buildRecallCard({
      id: 'k1',
      title: 'Training',
      content: 'Zwei Einheiten.',
      summary: 'Kurz und klar.',
      source: 'Reel',
      type: 'video',
      topics: ['Training'],
      tags: [],
      takeaways: ['(unbelegt) Zwei Einheiten'],
      createdAt: '2026-10-23T00:00:00.000Z',
      updatedAt: '2026-10-23T00:00:00.000Z',
    })
    expect(card.question).toContain('Training')
    expect(card.answer).toContain('Kurz und klar')
  })

  it('persists review progress through LifeOS merge', () => {
    const local = normalizeLifeOsState({
      ...emptyLifeOsState(),
      knowledgeReviews: [enableReview('k1', new Date('2026-10-23T08:00:00.000Z'))],
    })
    const remote = normalizeLifeOsState({
      ...emptyLifeOsState(),
      knowledgeReviews: [scheduleReview(enableReview('k1'), 'good', 'k1', new Date('2026-10-24T08:00:00.000Z'))],
    })
    const merged = mergeLifeOsState(local, remote)
    expect(merged.knowledgeReviews).toHaveLength(1)
    expect(merged.knowledgeReviews[0]?.lastResult).toBe('good')
    expect(upsertReview([], enableReview('k2'))).toHaveLength(1)
  })
})
