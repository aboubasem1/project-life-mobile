import { describe, expect, it } from 'vitest'
import { emptyLifeOsState } from '../lifeos/store.js'
import { applyDecisionBatch, previewFromBatch } from './actions.js'
import { matchWorkoutRoutine } from './decisions/workout.js'
import { runLocalCaptureDecision } from './engine.js'

const NOW = new Date('2026-09-21T08:00:00.000Z')
const TODAY = '2026-09-21'
const ENTRY = {
  date: TODAY,
  proteinGrams: 0,
  calories: 0,
  fatGrams: 0,
  carbsGrams: 0,
  fiberGrams: 0,
  appliedMeals: [] as string[],
  pushupsDone: false,
}

describe('workout matching', () => {
  it.each([
    ['10 KO gemacht', 'ko', 10],
    ['KO fertig', 'ko', undefined],
    ['30 Pushups', 'pushups', 30],
    ['Pushups fertig', 'pushups', undefined],
    ['Workout fertig', 'workout', undefined],
  ] as const)('matches %s', (text, kind, count) => {
    const match = matchWorkoutRoutine(text)
    expect(match?.kind).toBe(kind)
    expect(match?.count).toBe(count)
  })

  it('does not steal shopping/tasks', () => {
    expect(matchWorkoutRoutine('Milch kaufen')).toBeNull()
    expect(matchWorkoutRoutine('KO Meeting vorbereiten')).toBeNull()
  })
})

describe('Jo AI COMPLETE_ROUTINE apply', () => {
  it('logs KO into ritualUpdates and marks pushupsDone', () => {
    const batch = runLocalCaptureDecision({
      id: 'ko-1',
      source: 'quick_add',
      content: '10 KO gemacht',
      timestamp: NOW.toISOString(),
    }, {
      now: NOW,
      flags: { autoActionsEnabled: false, jevEnabled: false, llmFallbackEnabled: false },
    })
    expect(batch.decisions[0]?.intent).toBe('COMPLETE_ROUTINE')
    expect(batch.decisions[0]?.entities.routineId).toBe('ko')
    expect(previewFromBatch(batch).items[0]?.suggestedAction).toBe('COMPLETE_ROUTINE')

    const applied = applyDecisionBatch({
      batch,
      lifeOs: emptyLifeOsState(),
      dashboard: { focusTodos: [], boards: [], goals: [] },
      entry: ENTRY as never,
      autoActionsEnabled: false,
      confirmedByUser: true,
      today: TODAY,
    })
    expect(applied.applied[0]?.intent).toBe('COMPLETE_ROUTINE')
    expect(applied.ritualUpdates).toEqual({ ko: 10, markWorkoutDone: true })
    expect(applied.entry?.pushupsDone).toBe(true)
  })
})
