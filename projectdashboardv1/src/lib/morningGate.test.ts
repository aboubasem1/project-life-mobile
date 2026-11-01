import { describe, expect, it } from 'vitest'
import {
  DEFAULT_COMMITMENT_TEXT,
  DEFAULT_GRATITUDE_TEXT,
  DEFAULT_MORNING_RITUAL,
  DEFAULT_SELFCARE_ITEMS,
  FULLSCREEN_STEP_IDS,
  checkinResolution,
  emptyRitualProgress,
  essentialsPhaseOpen,
  markRitualStepSkipped,
  medicationDoseOptions,
  mergeMorningRitualProgress,
  morningRitualPhase,
  nextCheckinQuestion,
  nextMorningRitualStep,
  normalizeMorningRitualConfig,
  normalizeMorningRitualProgress,
  completeRitualTimer,
  pauseRitualTimer,
  resetRitualTimer,
  resolveCommitment,
  ritualSequence,
  startRitualTimer,
  timerRemainingMs,
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

    expect(merged).toMatchObject({
      date: '2026-09-15',
      done: ['gratitude', 'coldShower', 'prayer'],
      skipped: [],
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

describe('Skin & Smile morning selfcare', () => {
  it('includes the correct existing products and sunscreen', () => {
    const ids = DEFAULT_SELFCARE_ITEMS.map(item => item.id)
    expect(ids).toContain('purito')
    expect(ids).toContain('spf')
    expect(DEFAULT_SELFCARE_ITEMS.find(item => item.id === 'cream')?.label).toContain('Needly')
  })

  it('migrates untouched legacy selfcare while preserving custom lists', () => {
    const legacy = [
      { id: 'teeth', label: 'Zähne geputzt' },
      { id: 'rinse', label: 'Mundspülung' },
      { id: 'face', label: 'Gesicht gereinigt' },
      { id: 'cream', label: 'Creme drauf' },
      { id: 'lotion', label: 'Bodylotion' },
      { id: 'deo', label: 'Deo' },
      { id: 'perfume', label: 'Parfüm' },
    ]
    expect(normalizeMorningRitualConfig({ selfcareItems: legacy }).selfcareItems.some(item => item.id === 'spf')).toBe(true)
    expect(normalizeMorningRitualConfig({ selfcareItems: [{ id: 'own', label: 'Individuell' }] }).selfcareItems)
      .toEqual([{ id: 'own', label: 'Individuell' }])
  })
})

describe('imported weight in Morning Gate', () => {
  it('asks to confirm an imported weight until the step is done or skipped', () => {
    const config = {
      ...DEFAULT_MORNING_RITUAL,
      hiddenSteps: DEFAULT_MORNING_RITUAL.stepOrder.filter(id => id !== 'weight'),
    }
    const base = {
      enabled: true,
      skipped: false,
      preview: false,
      progress: emptyRitualProgress('2026-11-01'),
      medications: [],
      proteinShake: true,
      gratitudeDone: true,
      energySet: true,
      headRecoveryDone: true,
      pushupsDone: true,
      coldShowerDone: true,
      winnerModeDone: true,
      config,
    }
    expect(nextMorningRitualStep({ ...base, weightSet: true })).toBe('weight')
    expect(nextMorningRitualStep({
      ...base,
      weightSet: true,
      progress: { ...base.progress, done: ['weight'] },
    })).not.toBe('weight')
    expect(nextMorningRitualStep({
      ...base,
      weightSet: false,
      progress: { ...base.progress, skipped: ['weight'] },
    })).not.toBe('weight')
  })
})

describe('morning gate 2 sequence', () => {
  it('starts untouched configs with mood, then weight, and keeps later rituals available but hidden', () => {
    const config = normalizeMorningRitualConfig(undefined)
    expect(ritualSequence(config).slice(0, 5)).toEqual([
      'headRecovery',
      'weight',
      'gratitude',
      'commitment',
      'medsShake',
    ])
    expect(config.hiddenSteps).toContain('prayer')
    expect(config.hiddenSteps).not.toContain('weight')
  })

  it('keeps a custom order and only inserts commitment after gratitude', () => {
    const config = normalizeMorningRitualConfig({
      stepOrder: ['medsShake', 'gratitude', 'coldShower'],
      hiddenSteps: [],
    })
    expect(config.stepOrder.slice(0, 4)).toEqual(['medsShake', 'gratitude', 'commitment', 'coldShower'])
  })

  it('shows one check-in question at a time and does not finish after mood alone', () => {
    expect(nextCheckinQuestion({
      mood: '',
      sleepQuality: '',
      sleepDuration: '',
      dreamed: undefined,
      skipped: [],
    })).toBe('mood')
    expect(checkinResolution({
      mood: 'Gut',
      sleepQuality: '',
      sleepDuration: '',
      dreamed: undefined,
      skipped: [],
    })).toBe('pending')
    expect(nextCheckinQuestion({
      mood: 'Gut',
      sleepQuality: '',
      sleepDuration: '',
      dreamed: undefined,
      skipped: [],
    })).toBe('recovery')
    expect(checkinResolution({
      mood: 'Gut',
      sleepQuality: 'Gut',
      sleepDuration: '7h',
      dreamed: false,
      skipped: [],
    })).toBe('completed')
    expect(checkinResolution({
      mood: 'Gut',
      sleepQuality: '',
      sleepDuration: '7h',
      dreamed: false,
      skipped: ['recovery'],
    })).toBe('skipped')
  })

  it('does not treat a skipped step as completed', () => {
    const skipped = markRitualStepSkipped(emptyRitualProgress('2026-11-01'), 'gratitude')
    expect(skipped.skipped).toContain('gratitude')
    expect(skipped.done).not.toContain('gratitude')
    const base = {
      enabled: true,
      skipped: false,
      preview: false,
      medications: [],
      proteinShake: true,
      gratitudeDone: false,
      energySet: true,
      headRecoveryDone: true,
      pushupsDone: true,
      coldShowerDone: true,
      winnerModeDone: true,
      config: normalizeMorningRitualConfig(undefined),
    }
    expect(nextMorningRitualStep({ ...base, progress: skipped })).not.toBe('gratitude')
  })

  it('keeps essentials open until shake, meds and supplements are resolved', () => {
    const progress = emptyRitualProgress('2026-11-01')
    expect(essentialsPhaseOpen({
      progress,
      pendingMedicationIds: ['elvanse'],
      supplementIds: ['omega'],
      pendingDailyIds: [],
      proteinShake: false,
    })).toBe(true)
    const medsSkipped = { ...progress, medsSkipped: ['elvanse'], supplementsSkipped: ['omega'], shakeStatus: 'skipped' as const }
    expect(essentialsPhaseOpen({
      progress: medsSkipped,
      pendingMedicationIds: ['elvanse'],
      supplementIds: ['omega'],
      pendingDailyIds: [],
      proteinShake: false,
    })).toBe(false)
    expect(nextMorningRitualStep({
      enabled: true,
      skipped: false,
      preview: false,
      progress: medsSkipped,
      medications: [],
      proteinShake: false,
      gratitudeDone: true,
      energySet: true,
      headRecoveryDone: true,
      pushupsDone: true,
      coldShowerDone: true,
      winnerModeDone: true,
      essentialsOpen: false,
      config: normalizeMorningRitualConfig({ hiddenSteps: DEFAULT_MORNING_RITUAL.stepOrder.filter(id => id !== 'medsShake') }),
    })).toBe('medsShake')
  })

  it('uses only configured medication doses', () => {
    expect(medicationDoseOptions({ name: 'Elvanse', dosage: '30 mg', notes: 'morgens' })).toEqual(['30 mg'])
    expect(medicationDoseOptions({ name: 'Elvanse', dosage: '30 mg oder 50 mg' })).toEqual(['30 mg', '50 mg'])
    expect(medicationDoseOptions({ name: 'Elvanse', dosage: '', doseOptions: ['20 mg', '30 mg'] })).toEqual(['20 mg', '30 mg'])
    expect(medicationDoseOptions({ name: 'Elvanse', dosage: '' })).toEqual([])
  })

  it('does not invent a personal agreement when none or several documents match', () => {
    expect(resolveCommitment({
      configuredText: DEFAULT_COMMITMENT_TEXT,
      documents: [{ id: 'note', title: 'Einkauf', content: 'Milch' }],
    })).toMatchObject({ imported: false, text: DEFAULT_COMMITMENT_TEXT })
    const ambiguous = resolveCommitment({
      configuredText: 'Mein Satz',
      documents: [
        { id: 'a', title: 'Vereinbarung', content: 'Text A' },
        { id: 'b', title: 'Affirmation', content: 'Text B' },
      ],
    })
    expect(ambiguous.imported).toBe(false)
    expect(ambiguous.ambiguous).toBe(true)
    expect(ambiguous.text).toBe('Mein Satz')
    expect(resolveCommitment({
      configuredText: 'Fallback',
      linkedDocumentId: 'b',
      documents: [
        { id: 'a', title: 'Vereinbarung', content: 'Text A' },
        { id: 'b', title: 'Affirmation', content: 'Text B' },
      ],
    })).toMatchObject({ imported: true, documentId: 'b', text: 'Text B' })
  })

  it('keeps a cold-shower timer truthful across a suspended gap and a reset', () => {
    const started = startRitualTimer({ durationSec: 60, startedAt: null, accumulatedMs: 0, running: false }, 1_000)
    expect(timerRemainingMs(started, 1_000)).toBe(60_000)
    expect(timerRemainingMs(started, 16_000)).toBe(45_000)
    const paused = pauseRitualTimer(started, 16_000)
    expect(paused.running).toBe(false)
    expect(timerRemainingMs(paused, 80_000)).toBe(45_000)
    expect(timerRemainingMs(resetRitualTimer(paused), 90_000)).toBe(60_000)
    const finished = completeRitualTimer(started)
    expect(finished.running).toBe(false)
    expect(timerRemainingMs(finished, 90_000)).toBe(0)
    expect(paused.accumulatedMs).toBeGreaterThan(0)
  })
})
