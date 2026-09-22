import { describe, expect, it } from 'vitest'
import {
  EVENING_GATE_STEP_IDS,
  createEveningGateState,
  finishEveningGate,
  markEveningGateStepDone,
  nextEveningGateStep,
  restartEveningGate,
} from './eveningGate'

describe('evening gate', () => {
  it('starts with the wind-down card and preserves configured preparation items', () => {
    const state = createEveningGateState()
    expect(nextEveningGateStep(state)).toBe('windDown')
    expect(state.energyLevel).toBeUndefined()
    expect(state.preparationItems.length).toBeGreaterThan(0)
  })

  it('persists a separate evening energy reading', () => {
    const state = createEveningGateState({ energyLevel: 'low' })
    expect(state.energyLevel).toBe('low')
    expect(createEveningGateState({ ...state, energyLevel: 'high' }).energyLevel).toBe('high')
  })

  it('resumes at the first incomplete card', () => {
    let state = createEveningGateState()
    state = markEveningGateStepDone(state, 'windDown', new Date('2026-09-20T20:00:00Z'))
    state = markEveningGateStepDone(state, 'shower', new Date('2026-09-20T20:05:00Z'))
    expect(nextEveningGateStep(state)).toBe('breathing')
    expect(state.startedAt).toBe('2026-09-20T20:00:00.000Z')
  })

  it('finishes and can be intentionally restarted', () => {
    const finished = finishEveningGate(createEveningGateState(), new Date('2026-09-20T21:00:00Z'))
    expect(finished.done).toEqual([...EVENING_GATE_STEP_IDS])
    expect(finished.completedAt).toBe('2026-09-20T21:00:00.000Z')
    expect(nextEveningGateStep(finished)).toBeNull()

    const restarted = restartEveningGate(finished)
    expect(restarted.completedAt).toBeUndefined()
    expect(restarted.energyLevel).toBeUndefined()
    expect(nextEveningGateStep(restarted)).toBe('windDown')
  })
})
