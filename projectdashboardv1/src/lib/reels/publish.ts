import { parseLifeArea, suggestLifeArea, normalizeTopic, type DomainEvent, type KnowledgeItem, type LifeOsState } from '../lifeos'
import type { KnowledgePublishDraft, ReelCandidate } from './types'

const REVIEWABLE = new Set([
  'REVIEW_READY', 'USER_REVIEWED', 'MORE_EVIDENCE', 'APPROVED_CANDIDATE', 'SOURCE_ONLY', 'REJECTED', 'PUBLISHED',
])

export function previewBulkAction(
  reels: ReelCandidate[],
  action: 'approve_publish' | 'reject' | 'source_only',
  includeMediumRisk: boolean,
): { eligible: ReelCandidate[]; blocked: ReelCandidate[] } {
  const eligible: ReelCandidate[] = []
  const blocked: ReelCandidate[] = []
  for (const reel of reels) {
    if (!REVIEWABLE.has(reel.status)) {
      blocked.push(reel)
      continue
    }
    if (action === 'reject' || action === 'source_only' || reel.status === 'PUBLISHED') {
      eligible.push(reel)
      continue
    }
    const guidelineBlocked = reel.suggestedTarget === 'guideline' && reel.claims.some(claim => claim.verificationStatus !== 'SUPPORTED')
    const targetBlocked = reel.suggestedTarget !== 'knowledge' && reel.suggestedTarget !== 'guideline'
    const riskBlocked = reel.riskLevel === 'high' || (reel.riskLevel === 'medium' && !includeMediumRisk)
    if (guidelineBlocked || targetBlocked || riskBlocked) blocked.push(reel)
    else eligible.push(reel)
  }
  return { eligible, blocked }
}

function iso(value: string): string | null {
  const time = Date.parse(value)
  return Number.isFinite(time) ? new Date(time).toISOString() : null
}

export function applyPublishedKnowledge(
  state: LifeOsState,
  drafts: KnowledgePublishDraft[],
): { state: LifeOsState; createdIds: string[]; keptIds: string[] } {
  const createdIds: string[] = []
  const keptIds: string[] = []
  let knowledge = state.knowledge
  let events = state.events
  for (const draft of drafts) {
    const title = draft.title?.trim()
    const id = draft.id?.trim()
    const reelId = draft.reelId?.trim()
    if (!id || !title || !reelId) continue
    const reelTag = `reel:${reelId}`
    const existing = knowledge.find(item => item.id === id || item.tags.includes(reelTag))
    if (existing) {
      keptIds.push(existing.id)
      continue
    }
    const createdAt = iso(draft.createdAt) ?? iso(draft.updatedAt) ?? new Date().toISOString()
    const updatedAt = iso(draft.updatedAt) ?? createdAt
    const topics = (Array.isArray(draft.topics) ? draft.topics.map(String).filter(Boolean).slice(0, 20) : []).map(topic => normalizeTopic(topic)).filter(Boolean)
    const evidenceStatus = draft.evidenceLabel
    const item: KnowledgeItem = {
      id,
      title: title.slice(0, 160),
      content: (draft.content || '').slice(0, 4000),
      summary: (draft.summary || title).slice(0, 500),
      source: (draft.source || 'Instagram Reel').slice(0, 180),
      type: 'video',
      topics,
      tags: [...new Set([...(Array.isArray(draft.tags) ? draft.tags.map(String) : []), reelTag, 'import:reel'])].slice(0, 30),
      lifeArea: parseLifeArea(draft.lifeArea) ?? suggestLifeArea(topics, draft.summary),
      ideas: (draft.summary || '').split(/[.!?]\s+/).map(part => part.trim()).filter(Boolean).slice(0, 3),
      takeaways: (draft.content || '').split('\n').flatMap(line => {
        const text = line.replace(/^- /, '').trim()
        return text.startsWith('(') ? [text.slice(0, 180)] : []
      }).slice(0, 4),
      evidenceStatus,
      confidence: evidenceStatus === 'verified' ? 0.8 : evidenceStatus === 'source_only' ? 0.3 : 0.45,
      sourceReelId: reelId,
      createdAt,
      updatedAt,
    }
    const event: DomainEvent = {
      id: `knowledge.created:${id}`,
      type: 'knowledge.created',
      entityKind: 'knowledge',
      entityId: id,
      payload: { title: item.title, source: 'reel', ...(item.lifeArea ? { lifeArea: item.lifeArea } : {}) },
      createdAt: updatedAt,
    }
    knowledge = [item, ...knowledge]
    if (!events.some(existingEvent => existingEvent.id === event.id)) events = [...events, event]
    createdIds.push(id)
  }
  if (createdIds.length === 0) return { state, createdIds, keptIds }
  return { state: { ...state, knowledge, events }, createdIds, keptIds }
}
