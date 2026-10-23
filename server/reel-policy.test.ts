import { describe, expect, it } from 'vitest'
import { SyncHttpError } from './sync-core'
import {
  buildKnowledgeDraft,
  bulkItemDecision,
  isClaimable,
  pipelineStage,
  processingFailureDisposition,
  publishBlockReason,
  retryDelayMs,
} from './reel-policy'

const base = {
  id: 'reel-1',
  status: 'REVIEW_READY',
  riskLevel: 'low' as const,
  suggestedTarget: 'knowledge' as const,
  claims: [{ text: 'Zwei Trainingseinheiten pro Woche helfen beim Start.', verificationStatus: 'UNVERIFIED' }],
  title: 'Trainingsstart',
  summary: 'Kurz und praktisch.',
  topics: ['Training'],
  lifeArea: 'health',
  originalName: 'reel.mov',
  createdAt: '2026-10-23T08:00:00.000Z',
}

describe('reel job policy', () => {
  it('claims queued work and stale running work, but not a fresh lock', () => {
    const now = 1_000_000
    expect(isClaimable({ status: 'queued', runAfterMs: now - 1, lockedAtMs: null }, now)).toBe(true)
    expect(isClaimable({ status: 'retry', runAfterMs: now + 1, lockedAtMs: null }, now)).toBe(false)
    expect(isClaimable({ status: 'running', runAfterMs: 0, lockedAtMs: now - 26 * 60_000 }, now)).toBe(true)
    expect(isClaimable({ status: 'running', runAfterMs: 0, lockedAtMs: now - 60_000 }, now)).toBe(false)
  })

  it('backs off and treats lock loss differently from a permanent media error', () => {
    expect(retryDelayMs(1)).toBe(20_000)
    expect(retryDelayMs(3)).toBe(180_000)
    expect(processingFailureDisposition(new SyncHttpError(422, 'Keine Sprache'))).toBe('permanent')
    expect(processingFailureDisposition(new SyncHttpError(503, 'temporär'))).toBe('retry')
    expect(processingFailureDisposition(new SyncHttpError(409, 'Verarbeitung wurde von einem anderen Worker übernommen.'))).toBe('lost_lock')
  })

  it('resumes after a saved transcript instead of repeating extraction', () => {
    expect(pipelineStage({ status: 'PROCESSING', transcript: '', onScreenText: '', title: '', claimsSaved: false })).toBe('extract')
    expect(pipelineStage({ status: 'EXTRACTED', transcript: 'Hallo', onScreenText: '', title: '', claimsSaved: false })).toBe('analyze')
    expect(pipelineStage({ status: 'FACT_CHECK_PENDING', transcript: 'Hallo', onScreenText: '', title: 'Titel', claimsSaved: false })).toBe('verify')
    expect(pipelineStage({ status: 'REVIEW_READY', transcript: 'Hallo', onScreenText: '', title: 'Titel', claimsSaved: true })).toBe('done')
  })
})

describe('reel publishing policy', () => {
  it('blocks high risk and unsupported guidelines in a batch', () => {
    expect(bulkItemDecision(base, 'approve_publish', false).ok).toBe(true)
    expect(bulkItemDecision({ ...base, riskLevel: 'high' }, 'approve_publish', true).ok).toBe(false)
    expect(bulkItemDecision({ ...base, riskLevel: 'medium' }, 'approve_publish', false).ok).toBe(false)
    expect(bulkItemDecision({ ...base, riskLevel: 'medium' }, 'approve_publish', true).ok).toBe(true)
    expect(bulkItemDecision({ ...base, suggestedTarget: 'guideline' }, 'approve_publish', false).ok).toBe(false)
    expect(bulkItemDecision({ ...base, suggestedTarget: 'guideline', claims: [{ text: 'Belegt', verificationStatus: 'SUPPORTED' }] }, 'approve_publish', false).ok).toBe(true)
  })

  it('keeps unverified reel claims labeled and idempotent draft content stable', () => {
    expect(publishBlockReason({ ...base, status: 'UPLOADED' }, 'knowledge')).toMatch(/freigeben/i)
    const draft = buildKnowledgeDraft({
      reel: base,
      knowledgeItemId: 'knowledge-1',
      publishedAt: '2026-10-23T09:00:00.000Z',
      sourceOnly: false,
    })
    expect(draft.id).toBe('knowledge-1')
    expect(draft.tags).toContain('reel:reel-1')
    expect(draft.content).toContain('unbelegt')
    expect(draft.content).not.toContain('Originaltranskript:\n')
    const repeat = buildKnowledgeDraft({
      reel: base,
      knowledgeItemId: 'knowledge-1',
      publishedAt: '2026-10-23T09:00:00.000Z',
      sourceOnly: false,
    })
    expect(repeat).toEqual(draft)
  })

  it('publishes source-only material as a source, not a guideline', () => {
    const draft = buildKnowledgeDraft({
      reel: { ...base, status: 'SOURCE_ONLY', suggestedTarget: 'source_only' },
      knowledgeItemId: 'knowledge-2',
      publishedAt: '2026-10-23T09:00:00.000Z',
      sourceOnly: true,
    })
    expect(draft.evidenceLabel).toBe('source_only')
    expect(draft.tags).toContain('source-only')
    expect(draft.content).toContain('keine geprüfte Leitlinie')
  })
})
