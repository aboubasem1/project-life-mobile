import type { KnowledgeItem, KnowledgeReview } from './types.js'

export type RecallCard = {
  knowledgeId: string
  question: string
  answer: string
  sourceTitle: string
}

/** Simple spaced-repetition schedule (SM-2 lite). No model call required. */
export function scheduleReview(
  current: KnowledgeReview | undefined,
  result: 'again' | 'hard' | 'good',
  knowledgeId: string,
  now = new Date(),
): KnowledgeReview {
  const easeBase = current?.ease ?? 2.3
  const ease = Math.max(1.3, result === 'again' ? easeBase - 0.3 : result === 'hard' ? easeBase - 0.1 : easeBase + 0.1)
  const repetitions = result === 'again' ? 0 : (current?.repetitions ?? 0) + 1
  const intervalDays = result === 'again'
    ? 1
    : repetitions === 1
      ? 1
      : repetitions === 2
        ? result === 'hard' ? 2 : 3
        : Math.max(1, Math.round((current?.intervalDays ?? 1) * (result === 'hard' ? Math.max(1.2, ease - 0.2) : ease)))
  const due = new Date(now)
  due.setDate(due.getDate() + intervalDays)
  return {
    knowledgeId: current?.knowledgeId || knowledgeId,
    enabled: true,
    ease,
    intervalDays,
    dueAt: due.toISOString(),
    streak: result === 'again' ? 0 : (current?.streak ?? 0) + 1,
    repetitions,
    lastResult: result,
    updatedAt: now.toISOString(),
  }
}

export function enableReview(knowledgeId: string, now = new Date()): KnowledgeReview {
  return {
    knowledgeId,
    enabled: true,
    ease: 2.3,
    intervalDays: 0,
    dueAt: now.toISOString(),
    streak: 0,
    repetitions: 0,
    updatedAt: now.toISOString(),
  }
}

export function disableReview(current: KnowledgeReview, now = new Date()): KnowledgeReview {
  return { ...current, enabled: false, updatedAt: now.toISOString() }
}

export function dueReviews(reviews: KnowledgeReview[], now = new Date()): KnowledgeReview[] {
  const stamp = now.toISOString()
  return reviews
    .filter(item => item.enabled && item.dueAt <= stamp)
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
}

export function buildRecallCard(item: KnowledgeItem): RecallCard {
  const answer = [item.summary, ...(item.takeaways ?? []), ...(item.ideas ?? [])]
    .map(part => part.trim())
    .filter(Boolean)
    .join('\n')
    .slice(0, 500) || item.content.slice(0, 400) || 'Noch kein Inhalt gespeichert.'
  return {
    knowledgeId: item.id,
    question: `Was weißt du über „${item.title}“?`,
    answer,
    sourceTitle: item.title,
  }
}

export function upsertReview(reviews: KnowledgeReview[], next: KnowledgeReview): KnowledgeReview[] {
  const without = reviews.filter(item => item.knowledgeId !== next.knowledgeId)
  return [...without, next]
}

/** Active Recall must stay opt-in and never become NOW/Gate tasks. */
export function recallAffectsNowOrGates(): false {
  return false
}
