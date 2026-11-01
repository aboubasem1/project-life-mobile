import { describe, expect, it } from 'vitest'
import { emptyLifeOsState } from '../lifeos'
import { preserveReelKnowledgeItems } from './preserveKnowledge'
import { knowledgeAfterReelImport } from './surviveSync'
import type { KnowledgePublishDraft } from './types'

const draft: KnowledgePublishDraft = {
  id: 'knowledge-reel-1',
  reelId: 'reel-1',
  title: 'Trainingsstart',
  content: 'Erst die Wiederholungen zählen.',
  summary: 'Kurzer Start',
  source: 'Instagram Reel',
  type: 'video',
  topics: ['training'],
  tags: ['reel:reel-1'],
  lifeArea: 'health',
  createdAt: '2026-11-01T12:00:00.000Z',
  updatedAt: '2026-11-01T12:00:00.000Z',
  evidenceLabel: 'unverified',
  riskLevel: 'low',
}

describe('reel knowledge survives sync', () => {
  it('keeps the imported item when no snapshot can be pushed or pulled', () => {
    const state = knowledgeAfterReelImport({ drafts: [draft] })
    expect(state.knowledge.map(item => item.id)).toEqual(['knowledge-reel-1'])
    expect(state.knowledge[0]).toMatchObject({ title: 'Trainingsstart', sourceReelId: 'reel-1' })
  })

  it('keeps the imported item when a later snapshot has no knowledge', () => {
    const state = knowledgeAfterReelImport({
      drafts: [draft],
      remoteLifeOs: { version: 1, knowledge: [], captures: [] },
    })
    expect(state.knowledge.map(item => item.title)).toEqual(['Trainingsstart'])
  })

  it('does not let a newer snapshot blank a published reel title', () => {
    const local = knowledgeAfterReelImport({ drafts: [draft] }).knowledge
    const merged = preserveReelKnowledgeItems(local, [{
      id: 'knowledge-reel-1',
      title: '',
      sourceReelId: '',
      updatedAt: '2026-11-01T13:00:00.000Z',
    }])
    expect(merged[0]).toMatchObject({ title: 'Trainingsstart', sourceReelId: 'reel-1' })
  })

  it('leaves unrelated knowledge on the newer snapshot', () => {
    const local = emptyLifeOsState().knowledge
    const merged = preserveReelKnowledgeItems(local, [{
      id: 'note-1',
      title: 'Notiz',
      updatedAt: '2026-11-01T13:00:00.000Z',
    }])
    expect(merged).toEqual([{
      id: 'note-1',
      title: 'Notiz',
      updatedAt: '2026-11-01T13:00:00.000Z',
    }])
  })
})
