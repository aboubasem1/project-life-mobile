import { describe, expect, it } from 'vitest'
import {
  DEFAULT_GRATITUDE_TEXT,
  FULLSCREEN_STEP_IDS,
  mergeMorningRitualProgress,
  morningRitualPhase,
  normalizeMorningRitualConfig,
  normalizeMorningRitualProgress,
} from './morningGate'

describe('gratitude text', () => {
  it('uses the new gratitude reading for fresh and legacy settings', () => {
    const legacyText = [
      'Heute bin ich dankbar für diesen Morgen.',
      'Für einen Körper, der mitmacht.',
      'Für Klarheit, die wächst, wenn ich langsam starte.',
      'Für die Arbeit, die wartet — und dafür, dass ich bereit sein kann.',
    ].join('\n')

    expect(normalizeMorningRitualConfig(undefined).gratitudeText).toBe(DEFAULT_GRATITUDE_TEXT)
    expect(normalizeMorningRitualConfig({ gratitudeText: legacyText }).gratitudeText).toBe(DEFAULT_GRATITUDE_TEXT)
  })

  it('preserves a custom gratitude reading', () => {
    expect(normalizeMorningRitualConfig({ gratitudeText: 'Mein eigener Text' }).gratitudeText)
      .toBe('Mein eigener Text')
  })
})

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

describe('energy ritual step', () => {
  it('belongs to the fullscreen morning gate, not the Heute view', () => {
    expect(morningRitualPhase('energy')).toBe('gate')
    expect(FULLSCREEN_STEP_IDS).toContain('energy')
    expect(FULLSCREEN_STEP_IDS).toContain('headRecovery')
    expect(morningRitualPhase('headRecovery')).toBe('gate')
    expect(morningRitualPhase('todos')).toBe('heute')
  })
})
