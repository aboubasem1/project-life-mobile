import { describe, expect, it } from 'vitest'
import { createDefaultEntry } from '../types/DashboardEntry'
import {
  assessDayCompleteness,
  closeDayPatch,
  reopenDayPatch,
} from './dayClose'

describe('day close', () => {
  it('reports gaps for an empty day and becomes ready when filled', () => {
    const empty = createDefaultEntry('2026-09-20')
    const emptyStatus = assessDayCompleteness({
      entry: empty,
      activeHabits: ['breathingDone', 'proteinShake'],
      hour: 20,
    })
    expect(emptyStatus.percent).toBeLessThan(60)
    expect(emptyStatus.gaps.map(gap => gap.id)).toEqual(
      expect.arrayContaining(['energy', 'habits', 'checkin', 'evening']),
    )
    expect(emptyStatus.readyToClose).toBe(false)

    const filled = {
      ...empty,
      energyLevel: 'okay' as const,
      breathingDone: true,
      proteinShake: true,
      mood: 'Gut',
      waterLiters: 2,
      anchors: ['Deep Work'],
      anchorsDone: [true],
    }
    const ready = assessDayCompleteness({
      entry: filled,
      activeHabits: ['breathingDone', 'proteinShake'],
      hour: 20,
    })
    expect(ready.gaps).toEqual([])
    expect(ready.percent).toBe(100)
    expect(ready.readyToClose).toBe(true)
    expect(ready.summary).toBe('Bereit zum Abschluss')
  })

  it('treats shield as complete and tracks close/reopen patches', () => {
    const entry = {
      ...createDefaultEntry('2026-09-20'),
      dayShield: true,
      dayClosedAt: '2026-09-20T21:00:00.000Z',
    }
    const status = assessDayCompleteness({
      entry,
      activeHabits: ['coldShower'],
    })
    expect(status.shielded).toBe(true)
    expect(status.closed).toBe(true)
    expect(status.percent).toBe(100)
    expect(closeDayPatch(new Date('2026-09-20T21:10:00.000Z'))).toEqual({
      dayClosedAt: '2026-09-20T21:10:00.000Z',
    })
    expect(reopenDayPatch()).toEqual({ dayClosedAt: null })
  })
})
