import { describe, expect, it } from 'vitest'
import {
  EVENING_GATE_STEP_IDS,
  eveningCareSteps,
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
    expect(nextEveningGateStep(state)).toBe('skinSmile')
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

describe('Skin & Smile evening gate', () => {
  it('schedules COSRX BHA on Monday and Thursday only', () => {
    const options = { backBpo: false, whitening: false }
    expect(eveningCareSteps('2026-10-12', options).map(s => s.id)).toContain('bha')
    expect(eveningCareSteps('2026-10-15', options).map(s => s.id)).toContain('bha')
    expect(eveningCareSteps('2026-10-13', options).map(s => s.id)).not.toContain('bha')
  })

  it('keeps high-concentration BPO and phonebleaching strictly optional', () => {
    const state = createEveningGateState()
    expect(state.careOptions).toEqual({ backBpo: false, whitening: false })
    expect(eveningCareSteps('2026-10-13', state.careOptions).map(s => s.id))
      .toEqual(['cleanse', 'needly', 'dental'])
    const selected = createEveningGateState({ careChecked: ['cleanse'], careOptions: { backBpo: true, whitening: true } })
    expect(eveningCareSteps('2026-10-13', selected.careOptions).map(s => s.id)).toContain('whitening')
    expect(restartEveningGate(selected).careChecked).toEqual([])
  })

  it('treats the care step as a gate-only step, without creating NOW habits', () => {
    expect(EVENING_GATE_STEP_IDS).toContain('skinSmile')
    expect(createEveningGateState({ careChecked: ['unknown' as never, 'needly'] }).careChecked).toEqual(['needly'])
  })
})
