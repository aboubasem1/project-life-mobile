import { describe, expect, it } from 'vitest'
import { MAX_REEL_BYTES, reelContentType, validateReelFile } from './import-session'
import { normalizeKnowledge, mergeLifeOsState, emptyLifeOsState } from '../lifeos/store'
import { applyPublications } from '../../../../server/reel-publication'
import { jobSettings, retryDelaySeconds } from '../../../../server/reel-jobs'
import type { DomainEvent, KnowledgeItem } from '../lifeos/types'

const knowledge: KnowledgeItem = {
  id: 'reel:one', title: 'Titel', content: 'Zusammenfassung', summary: 'Zusammenfassung', source: 'Reel', type: 'video', topics: [], tags: [],
  createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  reelSource: { reelId: 'one', objectId: 'object', version: 4, evidence: 'unverified', risk: 'low' },
}
const event: DomainEvent = { id: 'reel-published:one', type: 'knowledge.created', entityId: knowledge.id, entityKind: 'knowledge', createdAt: knowledge.createdAt, payload: {} }
const publication = { version: 1 as const, knowledge, event }

describe('mobile Reel import and canonical publication', () => {
  it('accepts iPhone Photos and Files selections including absent MIME metadata', () => {
    for (const file of [{ name: 'IMG.MOV', type: '', size: 100 }, { name: 'reel.mp4', type: 'video/mp4', size: 200 }]) expect(validateReelFile(file)).toBeNull()
    expect(reelContentType({ name: 'IMG.MOV', type: '' })).toBe('video/quicktime')
  })
  it('rejects empty, oversized and unsupported files independently within a batch', () => {
    const files = [{ name: 'good.mov', type: '', size: 10 }, { name: 'empty.mov', type: '', size: 0 }, { name: 'large.mp4', type: '', size: MAX_REEL_BYTES + 1 }, { name: 'fake.txt', type: 'text/plain', size: 10 }]
    expect(files.map(f => Boolean(validateReelFile(f)))).toEqual([false, true, true, true])
  })
  it('delivers exactly one canonical object and event across repeated requests and devices', () => {
    const once = applyPublications(emptyLifeOsState(), [publication])
    const twice = applyPublications(once, [publication])
    const merged = mergeLifeOsState(once, twice)
    expect(merged.knowledge).toHaveLength(1); expect(merged.events).toHaveLength(1)
    expect(normalizeKnowledge(merged.knowledge[0])?.reelSource).toEqual(knowledge.reelSource)
  })
  it('never overwrites existing manual edits during publication delivery', () => {
    const local = { knowledge: [{ ...knowledge, title: 'Edited', updatedAt: '2020-01-01T00:00:00Z' }], events: [event] }
    const delivered = applyPublications(local, [publication])
    expect((delivered.knowledge as KnowledgeItem[])[0].title).toBe('Edited')
  })
  it('preserves deletion acknowledgments through cross-device merge and replay', () => {
    const local = { ...emptyLifeOsState(), deletedKnowledgeIds: [knowledge.id] }
    const merged = mergeLifeOsState(local, applyPublications({}, [publication]))
    expect(merged.knowledge).toEqual([])
    expect(applyPublications(merged, [publication]).knowledge).toEqual([])
  })
  it('uses bounded retry backoff and conservative defaults', () => {
    expect([1,2,3,100].map(retryDelaySeconds)).toEqual([30,60,120,3600])
    expect(jobSettings().concurrency).toBeGreaterThanOrEqual(1)
    expect(jobSettings().concurrency).toBeLessThanOrEqual(3)
  })
})
