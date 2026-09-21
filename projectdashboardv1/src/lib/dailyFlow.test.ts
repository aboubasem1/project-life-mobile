import { describe, expect, it } from 'vitest'
import { createDefaultEntry } from '../types/DashboardEntry'
import { selectTodayWeight } from './bodyMeasurement'
import {
  applyMealToEntry,
  assessDailyProgress,
  completedRitualSteps,
  DEFAULT_SHAKE_MEAL,
  isHeadRecoveryDone,
  revertMealFromEntry,
  overviewSlot,
  selectNowItems,
  selectOverviewItems,
  shouldShowDailyClose,
  syncProteinShakeNutrition,
} from './dailyFlow'
import { DEFAULT_MORNING_RITUAL, emptyRitualProgress } from './morningGate'

describe('protein shake nutrition', () => {
  it('books the configured meal once and ignores a second apply', () => {
    const entry = createDefaultEntry('2026-09-20')
    const first = applyMealToEntry(entry, DEFAULT_SHAKE_MEAL, 150)
    expect(first.proteinShake).toBe(true)
    expect(first.proteinGrams).toBe(30)
    expect(first.calories).toBe(180)
    expect(first.appliedMeals).toEqual(['protein-shake'])

    const again = applyMealToEntry({ ...entry, ...first }, DEFAULT_SHAKE_MEAL, 150)
    expect(again).toEqual({})
  })

  it('reverts the same meal without going negative', () => {
    const booked = { ...createDefaultEntry('2026-09-20'), ...applyMealToEntry(createDefaultEntry('2026-09-20'), DEFAULT_SHAKE_MEAL) }
    const reverted = revertMealFromEntry(booked, DEFAULT_SHAKE_MEAL)
    expect(reverted.proteinShake).toBe(false)
    expect(reverted.proteinGrams).toBe(0)
    expect(reverted.appliedMeals).toEqual([])
  })

  it('backfills nutrition when the shake is already done but no meal is booked', () => {
    const entry = { ...createDefaultEntry('2026-09-20'), proteinShake: true }
    const patch = syncProteinShakeNutrition(entry, true, DEFAULT_SHAKE_MEAL)
    expect(patch.proteinGrams).toBe(30)
    expect(patch.calories).toBe(180)
    expect(patch.appliedMeals).toEqual(['protein-shake'])
  })

  it('sync is idempotent for repeated true toggles', () => {
    let entry = createDefaultEntry('2026-09-20')
    const first = syncProteinShakeNutrition(entry, true, DEFAULT_SHAKE_MEAL)
    entry = { ...entry, ...first }
    const second = syncProteinShakeNutrition(entry, true, DEFAULT_SHAKE_MEAL)
    expect(second.proteinGrams ?? entry.proteinGrams).toBe(30)
    expect((second.appliedMeals ?? entry.appliedMeals)?.length).toBe(1)
  })
})

describe('now selection', () => {
  it('hides completed morning routines and later anchors in the morning', () => {
    const items = selectNowItems({
      anchors: ['Task A', 'Task B abends'],
      anchorsDone: [false, false],
      anchorMinutes: [25, 25],
      habits: [
        { key: 'proteinShake', label: 'Proteinshake', done: true },
        { key: 'coldShower', label: 'Cold Shower', done: true },
        { key: 'journalDone', label: 'Journal', done: false },
      ],
      hour: 8,
    })
    expect(items.map(item => item.title)).toEqual(['Task A'])
  })

  it('adds life area and urgency without inventing data', () => {
    const items = selectNowItems({
      anchors: [],
      anchorsDone: [],
      anchorMinutes: [],
      habits: [{ key: 'proteinShake', label: 'Proteinshake', done: false }],
      hour: 8,
    })
    expect(items[0]?.area).toBe('health')
    expect(items[0]?.urgency).toBe('now')
  })
})

describe('overview slots', () => {
  it('groups real morning, day and evening items without inventing rows', () => {
    const items = selectOverviewItems({
      anchors: ['Life OS Migration'],
      anchorsDone: [false],
      anchorMinutes: [45],
      habits: [
        { key: 'coldShower', label: 'Cold Shower', done: true },
        { key: 'journalDone', label: 'Abendessen', done: false },
      ],
    })
    expect(overviewSlot(items.find(item => item.habitKey === 'coldShower')!)).toBe('morning')
    expect(overviewSlot(items.find(item => item.kind === 'anchor')!)).toBe('day')
    expect(overviewSlot(items.find(item => item.habitKey === 'journalDone')!)).toBe('evening')
  })
})

describe('daily progress', () => {
  it('counts morning completions without evening tasks', () => {
    const entry = {
      ...createDefaultEntry('2026-09-20'),
      energyLevel: 'okay' as const,
      proteinShake: true,
      coldShower: true,
      mood: 'Gut',
      anchors: ['Abendtask'],
      anchorsDone: [false],
    }
    const progress = assessDailyProgress({
      entry,
      activeHabits: ['proteinShake', 'coldShower', 'journalDone'],
      habitDone: { proteinShake: true, coldShower: true, journalDone: false },
      hour: 9,
    })
    expect(progress.total).toBeGreaterThan(0)
    expect(progress.percent).toBeGreaterThan(50)
    expect(progress.meaning).toContain('Morgen')
  })
})

describe('stimmung und erholung', () => {
  it('does not complete the card after only one selection', () => {
    expect(isHeadRecoveryDone({
      mood: 'Gut',
      sleepQuality: '',
      sleepDuration: '',
      dreamed: undefined,
    })).toBe(false)
  })

  it('completes the card only after all four selections', () => {
    expect(isHeadRecoveryDone({
      mood: 'Gut',
      sleepQuality: 'Gut',
      sleepDuration: '7h',
      dreamed: false,
    })).toBe(true)
  })
})

describe('evening close visibility', () => {
  it('hides daily close during the day unless already closed', () => {
    expect(shouldShowDailyClose(11, false)).toBe(false)
    expect(shouldShowDailyClose(20, false)).toBe(true)
    expect(shouldShowDailyClose(11, true)).toBe(true)
    expect(shouldShowDailyClose(20, false, { enabled: false })).toBe(false)
    expect(shouldShowDailyClose(18, false, { fromHour: 20 })).toBe(false)
    expect(shouldShowDailyClose(21, false, { fromHour: 20 })).toBe(true)
    expect(shouldShowDailyClose(20, false, { enabled: false })).toBe(false)
    expect(shouldShowDailyClose(20, true, { enabled: false })).toBe(true)
  })
})

describe('ritual reopen state', () => {
  it('keeps completed morning steps when progress is empty', () => {
    const entry = {
      ...createDefaultEntry('2026-09-20'),
      proteinShake: true,
      gratitudeDone: true,
      coldShower: true,
      mood: 'Gut',
      sleepQuality: 'Gut',
      sleepDuration: '7h',
      dreamed: false,
    }
    const done = completedRitualSteps({
      progress: emptyRitualProgress('2026-09-20'),
      entry,
      config: DEFAULT_MORNING_RITUAL,
    })
    expect(done).toEqual(expect.arrayContaining(['medsShake', 'gratitude', 'coldShower', 'headRecovery']))
  })
})

describe('today weight', () => {
  it('prefers a same-day scale sample over a manual entry', () => {
    const weight = selectTodayWeight({
      date: '2026-09-20',
      entry: { weightKg: 80, weightMeasuredAt: '2026-09-20T07:00:00' },
      measurements: [{
        id: 'm1',
        measuredAt: '2026-09-20T08:10:00',
        weightKg: 79.4,
        source: 'apple_health',
        sourceApp: 'Fitdays',
        externalId: 'fit-1',
      }],
    })
    expect(weight).toEqual({
      value: 79.4,
      unit: 'kg',
      measuredAt: '2026-09-20T08:10:00',
      source: 'fitdays',
    })
  })

  it('returns null when no today measurement exists', () => {
    expect(selectTodayWeight({
      date: '2026-09-20',
      entry: { weightKg: 0 },
      measurements: [],
    })).toBeNull()
  })

  it('does not treat a previous-day manual weight as today', () => {
    expect(selectTodayWeight({
      date: '2026-09-20',
      entry: { weightKg: 56.8, weightMeasuredAt: '2026-09-14T08:00:00' },
      measurements: [],
    })).toBeNull()
  })
})
