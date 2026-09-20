import { describe, expect, it } from 'vitest'
import {
  mergeMorningRitualProgress,
  normalizeMorningRitualProgress,
} from './morningGate'

describe('morning ritual progress', () => {
  it('merges same-day progress without losing completed work', () => {
    const merged = mergeMorningRitualProgress(
      {
        date: '2026-09-15',
        done: ['gratitude', 'coldShower'],
        selfcareChecked: ['teeth'],
        pushups: 20,
        ko: 2,
      },
      {
        date: '2026-09-15',
        done: ['coldShower', 'prayer'],
        selfcareChecked: ['face'],
        pushups: 35,
        ko: 1,
      },
    )

    expect(merged).toEqual({
      date: '2026-09-15',
      done: ['gratitude', 'coldShower', 'prayer'],
      selfcareChecked: ['teeth', 'face'],
      pushups: 35,
      ko: 2,
    })
  })

  it('keeps only the newer day when dates differ', () => {
    const merged = mergeMorningRitualProgress(
      { date: '2026-09-14', done: ['prayer'] },
      { date: '2026-09-15', done: ['gratitude'] },
    )

    expect(merged?.date).toBe('2026-09-15')
    expect(merged?.done).toEqual(['gratitude'])
  })

  it('rejects malformed progress without a valid date', () => {
    expect(normalizeMorningRitualProgress({ date: 'today', done: [] })).toBeNull()
  })
})
