import { describe, expect, it } from 'vitest'
import { scoreInboundEntry } from '../../../server/entry-score'
import { createDefaultEntry } from '../types/DashboardEntry'
import { calculateScore } from './score'

describe('scoreInboundEntry', () => {
  it('recalculates imported entries with synced goals', () => {
    const entry = {
      ...createDefaultEntry('2026-09-15'),
      proteinGrams: 180,
      waterLiters: 2.5,
      gratitudeDone: true,
      dailyScore: 0,
    }
    const settings = {
      proteinGoal: 180,
      activeHabits: ['gratitudeDone'],
    }

    const scored = scoreInboundEntry(entry, settings)

    expect(scored.dailyScore).toBe(calculateScore(entry, settings))
    expect(scored.dailyScore).toBeGreaterThan(0)
  })

  it('respects a custom protein goal from the synced settings', () => {
    const entry = {
      ...createDefaultEntry('2026-09-15'),
      proteinGrams: 150,
    }

    const atGoal = scoreInboundEntry(entry, { proteinGoal: 150 })
    const belowGoal = scoreInboundEntry(entry, { proteinGoal: 180 })

    expect(Number(atGoal.dailyScore)).toBeGreaterThan(Number(belowGoal.dailyScore))
  })
})
