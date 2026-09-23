import { createId, nowIso } from '../schema.js'
import { emitAdaptiveEvent, loadAdaptiveEvents, type AdaptiveEvent } from '../events/store.js'
import type { ChangeSpec } from '../change-engine/types.js'

export type AdaptationSuggestion = {
  id: string
  observation: string
  suggestion: string
  confidence: number
  target: string
  changeSpec?: ChangeSpec
  status: 'proposed' | 'accepted' | 'rejected' | 'dismissed'
  createdAt: string
}

export type PatternHit = {
  kind: 'skipped_step' | 'abandoned_gate' | 'deferred_task' | 'long_routine' | 'dismissed_suggestion'
  key: string
  count: number
  total: number
  rate: number
}

function rate(count: number, total: number): number {
  if (total <= 0) return 0
  return count / total
}

export function detectPatterns(events: AdaptiveEvent[] = loadAdaptiveEvents()): PatternHit[] {
  const hits: PatternHit[] = []
  const stepStats = new Map<string, { completed: number; skipped: number }>()
  let gateOpened = 0
  let gateAbandoned = 0
  let deferred = 0
  let tasks = 0
  let dismissed = 0
  let suggestions = 0

  for (const event of events) {
    switch (event.type) {
      case 'routine_step.completed': {
        const key = event.entityId ?? 'unknown'
        const stat = stepStats.get(key) ?? { completed: 0, skipped: 0 }
        stat.completed += 1
        stepStats.set(key, stat)
        break
      }
      case 'routine_step.skipped': {
        const key = event.entityId ?? 'unknown'
        const stat = stepStats.get(key) ?? { completed: 0, skipped: 0 }
        stat.skipped += 1
        stepStats.set(key, stat)
        break
      }
      case 'gate.opened':
        gateOpened += 1
        break
      case 'gate.abandoned':
        gateAbandoned += 1
        break
      case 'task.deferred':
        deferred += 1
        tasks += 1
        break
      case 'task.completed':
      case 'task.created':
        tasks += 1
        break
      case 'suggestion.rejected':
        dismissed += 1
        suggestions += 1
        break
      case 'suggestion.created':
      case 'suggestion.shown':
      case 'suggestion.accepted':
        suggestions += 1
        break
      default:
        break
    }
  }

  for (const [key, stat] of stepStats) {
    const total = stat.completed + stat.skipped
    const skipRate = rate(stat.skipped, total)
    if (total >= 4 && skipRate >= 0.6) {
      hits.push({
        kind: 'skipped_step',
        key,
        count: stat.skipped,
        total,
        rate: skipRate,
      })
    }
  }

  const abandonRate = rate(gateAbandoned, gateOpened)
  if (gateOpened >= 3 && abandonRate >= 0.4) {
    hits.push({
      kind: 'abandoned_gate',
      key: 'gate',
      count: gateAbandoned,
      total: gateOpened,
      rate: abandonRate,
    })
  }

  const deferRate = rate(deferred, tasks)
  if (tasks >= 5 && deferRate >= 0.4) {
    hits.push({
      kind: 'deferred_task',
      key: 'task',
      count: deferred,
      total: tasks,
      rate: deferRate,
    })
  }

  const dismissRate = rate(dismissed, suggestions)
  if (suggestions >= 3 && dismissRate >= 0.5) {
    hits.push({
      kind: 'dismissed_suggestion',
      key: 'suggestion',
      count: dismissed,
      total: suggestions,
      rate: dismissRate,
    })
  }

  return hits.sort((a, b) => b.rate - a.rate)
}

export function suggestionsFromPatterns(hits: PatternHit[]): AdaptationSuggestion[] {
  return hits.map(hit => {
    if (hit.kind === 'skipped_step') {
      const pct = Math.round(hit.rate * 100)
      const changeSpec: ChangeSpec = {
        id: createId('chg'),
        type: 'CONFIG_CHANGE',
        target: 'routine.morning',
        operations: [{ op: 'disable', path: 'hiddenSteps', item: hit.key }],
        reason: `${hit.key} skipped ${pct}% — hide from Morning Gate`,
        risk: 'LOW',
        affectedEntities: [hit.key, 'morning_gate'],
        createdAt: nowIso(),
      }
      return {
        id: createId('sug'),
        observation: `${hit.key} skipped ${pct}% of the time.`,
        suggestion: hit.key === 'energy' || hit.key === 'headRecovery' || /mood/i.test(hit.key)
          ? `Remove ${hit.key} from Morning Gate while retaining it in Evening Gate.`
          : `Hide ${hit.key} from Morning Gate.`,
        confidence: Math.min(0.95, 0.55 + hit.rate * 0.4),
        target: 'routine.morning',
        changeSpec,
        status: 'proposed' as const,
        createdAt: nowIso(),
      }
    }
    if (hit.kind === 'abandoned_gate') {
      return {
        id: createId('sug'),
        observation: `Gate abandoned ${Math.round(hit.rate * 100)}% of opens.`,
        suggestion: 'Try a shorter Morning Gate for one week.',
        confidence: 0.6,
        target: 'routine.morning',
        status: 'proposed' as const,
        createdAt: nowIso(),
      }
    }
    return {
      id: createId('sug'),
      observation: `${hit.kind} pattern (${Math.round(hit.rate * 100)}%).`,
      suggestion: 'Review recent deferrals and simplify NOW.',
      confidence: 0.5,
      target: 'surface.now',
      status: 'proposed' as const,
      createdAt: nowIso(),
    }
  })
}

/** OBSERVE → SUGGEST. Never auto-applies. */
export function analyzeAndSuggest(events?: AdaptiveEvent[]): AdaptationSuggestion[] {
  const hits = detectPatterns(events)
  const suggestions = suggestionsFromPatterns(hits)
  for (const suggestion of suggestions) {
    emitAdaptiveEvent('suggestion.created', {
      entityId: suggestion.id,
      payload: { target: suggestion.target, confidence: suggestion.confidence },
    })
  }
  return suggestions
}
