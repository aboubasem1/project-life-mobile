import { describe, expect, it } from 'vitest'
import { normalizeKnowledge } from './store'
import {
  documentsFromLifeOs,
  documentsInRoom,
  keepManualArea,
  planIndexUpdate,
  preferredSemanticEngine,
  rankKnowledge,
  semanticFallback,
  suggestRelations,
  type KnowledgeDoc,
} from './knowledgeRank'

function doc(patch: Partial<KnowledgeDoc> & Pick<KnowledgeDoc, 'id' | 'title'>): KnowledgeDoc {
  return {
    summary: '',
    content: '',
    topics: [],
    tags: [],
    source: '',
    updatedAt: '2026-10-23T09:00:00.000Z',
    ...patch,
  }
}

describe('knowledge search', () => {
  const items = [
    doc({ id: 'a', title: 'Muskelaufbau', summary: 'Zwei Trainingseinheiten pro Woche.', topics: ['Training'], content: 'Progressive Überlastung.' }),
    doc({ id: 'b', title: 'Steuerfrist', summary: 'Rechnung bis Freitag.', topics: ['Finanzen'], content: 'Keine Trainingsnotiz.' }),
    doc({ id: 'c', title: 'Essen', summary: 'Eiweiß zur Mahlzeit.', topics: ['Ernährung'], content: 'Passt zum Training.' }),
  ]

  it('ranks German and English topic words and returns nothing for a blank query', () => {
    expect(rankKnowledge(items, '   ')).toEqual([])
    const training = rankKnowledge(items, 'Muskelaufbau Training')
    expect(training[0]?.id).toBe('a')
    expect(training.map(hit => hit.id)).not.toContain('b')
    expect(rankKnowledge(items, 'Ernährung')[0]?.id).toBe('c')
  })

  it('uses token overlap when full-text stems are unavailable', () => {
    expect(preferredSemanticEngine(false, true)).toBe('lexical')
    expect(preferredSemanticEngine(true, false)).toBe('lexical')
    expect(preferredSemanticEngine(true, true)).toBe('pgvector')
    expect(semanticFallback('Zwei Trainingseinheiten pro Woche', 'Trainingseinheiten für Muskelaufbau')).toBeGreaterThan(
      semanticFallback('Zwei Trainingseinheiten pro Woche', 'Rechnung bis Freitag'),
    )
  })

  it('keeps a manual life area and reindexes only edits and deletions', () => {
    expect(keepManualArea({ lifeArea: 'work', areaLocked: true }, 'health').lifeArea).toBe('work')
    expect(keepManualArea({ lifeArea: undefined }, 'health').lifeArea).toBe('health')
    const plan = planIndexUpdate(
      [{ id: 'a', updatedAt: '1' }, { id: 'gone', updatedAt: '1' }],
      [doc({ id: 'a', title: 'Neu', updatedAt: '2' }), doc({ id: 'b', title: 'Frisch', updatedAt: '1' })],
    )
    expect(plan.remove).toEqual(['gone'])
    expect(plan.upsert.map(item => item.id)).toEqual(['a', 'b'])
  })

  it('isolates rooms and keeps an existing knowledge record readable', () => {
    const rows = documentsInRoom([
      { roomId: 'room-a', id: '1' },
      { roomId: 'room-b', id: '2' },
    ], 'room-a')
    expect(rows.map(row => row.id)).toEqual(['1'])
    const legacy = normalizeKnowledge({ id: 'old', title: 'Notiz', createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z' })
    expect(legacy).toMatchObject({ id: 'old', title: 'Notiz', topics: [], areaLocked: undefined })
    const saved = documentsFromLifeOs({ knowledge: [legacy, { id: '', title: 'skip' }] })
    expect(saved).toHaveLength(1)
  })

  it('proposes a contradiction without duplicating an accepted relation', () => {
    const focus = doc({ id: 'a', title: 'Schlaf', topics: ['Schlaf'], content: 'Acht Stunden sind belegt.' })
    const other = doc({ id: 'b', title: 'Schlaf', topics: ['Schlaf'], content: 'Der anderen Aussage wird widersprochen: vier Stunden reichen.' })
    const first = suggestRelations({ focusId: 'a', items: [focus, other], relations: [] })
    expect(first[0]).toMatchObject({ toId: 'b', role: 'contradicts' })
    const again = suggestRelations({
      focusId: 'a',
      items: [focus, other],
      relations: [{ fromKind: 'knowledge', fromId: 'a', toKind: 'knowledge', toId: 'b', role: 'contradicts' }],
    })
    expect(again).toEqual([])
  })
})
