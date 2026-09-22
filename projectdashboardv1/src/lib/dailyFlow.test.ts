import { describe, expect, it } from 'vitest'
import { createDefaultEntry } from '../types/DashboardEntry'
import { selectTodayWeight } from './bodyMeasurement'
import { getDayMode } from './dayPolicy'
import {
  applyMealToEntry,
  assessDailyProgress,
  completedRitualSteps,
  DEFAULT_SHAKE_MEAL,
  isHeadRecoveryDone,
  revertMealFromEntry,
  overviewSlot,
  eveningOwnedHabitKeys,
  eveningRemaining,
  ritualOwnedHabitKeys,
  ritualRemaining,
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

  it('keeps ritual-owned habits out of NOW and overview', () => {
    const owned = ritualOwnedHabitKeys({
      enabled: true,
      steps: ['medsShake', 'coldShower', 'todos'],
      doneSteps: [],
    })
    const habits = [
      { key: 'proteinShake', label: 'Proteinshake', done: false },
      { key: 'coldShower', label: 'Cold Shower', done: false },
      { key: 'focusDone', label: 'Fokus', done: false },
    ]
    const now = selectNowItems({
      anchors: ['Task A'],
      anchorsDone: [false],
      anchorMinutes: [25],
      habits,
      hour: 8,
      excludeHabitKeys: owned,
    })
    const overview = selectOverviewItems({
      anchors: ['Task A'],
      anchorsDone: [false],
      anchorMinutes: [25],
      habits,
      excludeHabitKeys: owned,
    })
    expect(now.map(item => item.title)).toEqual(['Task A'])
    expect(overview.map(item => item.habitKey).filter(Boolean)).toEqual(['focusDone'])
    expect(ritualRemaining({ steps: ['medsShake', 'coldShower', 'todos'], doneSteps: ['medsShake'] }).remaining).toBe(2)
  })

  it('releases ritual habits once the morning gate is skipped', () => {
    expect(ritualOwnedHabitKeys({
      enabled: true,
      skipped: true,
      steps: ['medsShake', 'coldShower'],
      doneSteps: [],
    })).toEqual([])
  })

  it('keeps morning leftovers out of evening NOW', () => {
    const now = selectNowItems({
      anchors: ['Deep Work'],
      anchorsDone: [false],
      anchorMinutes: [45],
      habits: [
        { key: 'proteinShake', label: 'Proteinshake', done: false },
        { key: 'coldShower', label: 'Cold Shower', done: false },
        { key: 'journalDone', label: 'Journal', done: false },
        { key: 'breathingDone', label: 'Atmung', done: false },
      ],
      hour: 20,
    })
    expect(now.map(item => item.habitKey ?? item.title)).toEqual(['Deep Work'])
  })

  it('lets the evening gate own breathing and journal', () => {
    const owned = eveningOwnedHabitKeys({
      enabled: true,
      completed: false,
      doneSteps: [],
    })
    const now = selectNowItems({
      anchors: [],
      anchorsDone: [],
      anchorMinutes: [],
      habits: [
        { key: 'journalDone', label: 'Journal', done: false },
        { key: 'breathingDone', label: 'Atmung', done: false },
        { key: 'coldShower', label: 'Cold Shower', done: false },
      ],
      hour: 20,
      excludeHabitKeys: owned,
    })
    expect(now).toEqual([])
    expect(owned.sort()).toEqual(['breathingDone', 'journalDone'])
    expect(eveningRemaining(['windDown', 'shower']).remaining).toBe(5)
    expect(eveningOwnedHabitKeys({ enabled: true, completed: true, doneSteps: [] })).toEqual([])
  })

  it('keeps an evening habit out of morning NOW', () => {
    const now = selectNowItems({
      anchors: [],
      anchorsDone: [],
      anchorMinutes: [],
      habits: [
        { key: 'journalDone', label: 'Journal', done: false },
        { key: 'proteinShake', label: 'Proteinshake', done: false },
      ],
      hour: 8,
    })
    expect(now).toEqual([])
  })

  it('preserves urgency without inventing a life area for unknown regular items', () => {
    const items = selectNowItems({
      anchors: ['Wichtigster Schritt'],
      anchorsDone: [false],
      anchorMinutes: [25],
      habits: [{ key: 'walkDone', label: 'Spaziergang', done: false }],
      hour: 8,
    })
    expect(items.find(item => item.habitKey === 'walkDone')?.area).toBeUndefined()
    expect(items.find(item => item.kind === 'anchor')?.urgency).toBe('now')
  })

  it('never leaks completed gate habits into NOW or overview', () => {
    const habits = [
      { key: 'proteinShake', label: 'Proteinshake', done: true },
      { key: 'coldShower', label: 'Cold Shower', done: true },
      { key: 'breathingDone', label: 'Atmung', done: true },
      { key: 'journalDone', label: 'Journal', done: true },
      { key: 'familyTimeDone', label: 'Familienzeit', done: true },
    ]
    expect(selectNowItems({
      anchors: [], anchorsDone: [], anchorMinutes: [], habits, hour: 20,
    })).toEqual([])
    expect(selectOverviewItems({
      anchors: [], anchorsDone: [], anchorMinutes: [], habits,
    }).map(item => item.habitKey)).toEqual(['familyTimeDone'])
  })
})

describe('overview slots', () => {
  it('groups regular day and evening items while retaining stable slot semantics', () => {
    const items = selectOverviewItems({
      anchors: ['Life OS Migration'],
      anchorsDone: [false],
      anchorMinutes: [45],
      habits: [
        { key: 'familyTimeDone', label: 'Familienzeit', done: false },
      ],
    })
    expect(overviewSlot({ kind: 'habit', habitKey: 'coldShower' })).toBe('morning')
    expect(overviewSlot(items.find(item => item.kind === 'anchor')!)).toBe('day')
    expect(overviewSlot(items.find(item => item.habitKey === 'familyTimeDone')!)).toBe('evening')
  })
})

describe('daily progress', () => {
  it('counts only visible Today work and never hidden gate inputs', () => {
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
    expect(progress.total).toBe(1)
    expect(progress.done).toBe(0)
    expect(progress.percent).toBe(0)
    expect(progress.meaning).not.toContain('Energie')
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

describe('day-boundary modes', () => {
  it('classifies local hour bands without inventing timezone data', () => {
    expect(getDayMode(4)).toBe('morning')
    expect(getDayMode(5)).toBe('morning')
    expect(getDayMode(10)).toBe('morning')
    expect(getDayMode(11)).toBe('day')
    expect(getDayMode(16)).toBe('day')
    expect(getDayMode(17)).toBe('evening')
    expect(getDayMode(23)).toBe('evening')
  })
})

describe('evening close visibility', () => {
  it('hides daily close during the day unless already closed', () => {
    expect(shouldShowDailyClose(11, false)).toBe(false)
    expect(shouldShowDailyClose(4, false)).toBe(false)
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
