import { describe, expect, it } from 'vitest'
import { weightProjection } from './BodyEvolutionCard'

describe('weightProjection', () => {
  it('uses baseline without observations and does not invent observed trend', () => {
    const result = weightProjection([], 64)
    expect(result.current).toBe(64)
    expect(result.weeklyRate).toBeNull()
    expect(result.projections).toHaveLength(3)
    expect(result.projections.every(p => p.observedTrend === null)).toBe(true)
  })

  it('derives a weekly rate only with enough measured dates', () => {
    const result = weightProjection([
      { date: '2026-10-01', kg: 64 },
      { date: '2026-10-08', kg: 64.4 },
      { date: '2026-10-16', kg: 64.8 },
    ])
    expect(result.current).toBe(64.8)
    expect(result.weeklyRate).not.toBeNull()
    expect(result.weeklyRate!).toBeGreaterThan(0)
  })

  it('rejects invalid readings', () => {
    const result = weightProjection([{ date: 'bad', kg: 200 }, { date: '2026-10-16', kg: -2 }])
    expect(result.current).toBe(64)
  })
})
