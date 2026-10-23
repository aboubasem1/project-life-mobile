import { describe, expect, it } from 'vitest'
import { emptyLifeOsState, mergeLifeOsState } from '../lifeos'
import { applyPublishedKnowledge, previewBulkAction } from './publish'
import type { KnowledgePublishDraft, ReelCandidate } from './types'

const draft: KnowledgePublishDraft = {
  id: 'knowledge-1',
  reelId: 'reel-1',
  title: 'Trainingsstart',
  content: 'Kurz.\n\nAussagen:\n- (unbelegt) Zwei Einheiten.',
  summary: 'Kurz.',
  source: 'Reel: clip.mov',
  type: 'video',
  topics: ['Training'],
  tags: ['reel:reel-1', 'risk:low', 'evidence:unverified', 'import:reel'],
  lifeArea: 'health',
  createdAt: '2026-10-23T08:00:00.000Z',
  updatedAt: '2026-10-23T09:00:00.000Z',
  evidenceLabel: 'unverified',
  riskLevel: 'low',
}

function reel(patch: Partial<ReelCandidate> = {}): ReelCandidate {
  return {
    id: 'reel-1',
    objectId: 'object-1',
    checksumSha256: 'a'.repeat(64),
    status: 'REVIEW_READY',
    title: 'Trainingsstart',
    summary: 'Kurz.',
    transcript: 'Text',
    transcriptProvider: null,
    transcriptModel: null,
    onScreenText: '',
    lifeArea: 'health',
    topics: ['Training'],
    usefulnessScore: 70,
    riskLevel: 'low',
    suggestedTarget: 'knowledge',
    jev: null,
    reviewerNote: '',
    processingAttempts: 1,
    errorMessage: null,
    version: 2,
    claims: [],
    createdAt: '2026-10-23T08:00:00.000Z',
    updatedAt: '2026-10-23T09:00:00.000Z',
    ...patch,
  }
}

describe('published reel knowledge', () => {
  it('creates one canonical item and ignores a repeated publish', () => {
    const first = applyPublishedKnowledge(emptyLifeOsState(), [draft])
    const second = applyPublishedKnowledge(first.state, [draft, { ...draft, title: 'Andere Fassung', updatedAt: '2026-10-23T12:00:00.000Z' }])
    expect(first.createdIds).toEqual(['knowledge-1'])
    expect(first.state.knowledge[0]).toMatchObject({ title: 'Trainingsstart', sourceReelId: 'reel-1', evidenceStatus: 'unverified' })
    expect(first.state.events.map(event => event.id)).toContain('knowledge.created:knowledge-1')
    expect(second.createdIds).toEqual([])
    expect(second.state.knowledge[0]?.title).toBe('Trainingsstart')
  })

  it('preserves a user edit when another device publishes the same reel', () => {
    const created = applyPublishedKnowledge(emptyLifeOsState(), [draft]).state
    const edited = {
      ...created,
      knowledge: created.knowledge.map(item => ({ ...item, title: 'Meine Fassung', updatedAt: '2026-10-23T10:00:00.000Z' })),
    }
    const remote = applyPublishedKnowledge(emptyLifeOsState(), [draft]).state
    const merged = mergeLifeOsState(edited, remote)
    expect(merged.knowledge).toHaveLength(1)
    expect(merged.knowledge[0]?.title).toBe('Meine Fassung')
  })

  it('does not let a bulk action bypass high risk', () => {
    const preview = previewBulkAction([
      reel(),
      reel({ id: 'reel-2', riskLevel: 'high', suggestedTarget: 'guideline' }),
    ], 'approve_publish', true)
    expect(preview.eligible.map(item => item.id)).toEqual(['reel-1'])
    expect(preview.blocked.map(item => item.id)).toEqual(['reel-2'])
  })
})
