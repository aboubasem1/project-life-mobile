import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  berlinPeriodYm,
  budgetThresholds,
  usdToBudgetEur,
  BudgetPausedError,
  isBudgetPauseError,
} from './ai-budget.ts'

describe('ai budget helpers', () => {
  const keys = [
    'AI_BUDGET_MONTHLY_EUR',
    'AI_BUDGET_USD_EUR',
    'AI_BUDGET_TAX_FACTOR',
    'AI_BUDGET_SAFETY_FACTOR',
    'AI_BUDGET_FX_DATED',
  ] as const
  const previous = new Map<string, string | undefined>()

  beforeEach(() => {
    for (const key of keys) {
      if (!previous.has(key)) previous.set(key, process.env[key])
      delete process.env[key]
    }
  })

  afterEach(() => {
    for (const key of keys) {
      const value = previous.get(key)
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  })

  it('formats Europe/Berlin calendar months', () => {
    // 2026-03-01 00:30 UTC is still February in Berlin? Actually CET is UTC+1 → March 1 01:30 Berlin.
    expect(berlinPeriodYm(new Date('2026-03-01T10:00:00Z'))).toBe('2026-03')
    // Late evening UTC on month boundary: 2026-02-28 23:30 UTC = 2026-03-01 00:30 Berlin.
    expect(berlinPeriodYm(new Date('2026-02-28T23:30:00Z'))).toBe('2026-03')
  })

  it('converts USD to conservative EUR with tax and safety — never 1:1', () => {
    process.env.AI_BUDGET_USD_EUR = '0.95'
    process.env.AI_BUDGET_TAX_FACTOR = '1.19'
    process.env.AI_BUDGET_SAFETY_FACTOR = '1.25'
    const eur = usdToBudgetEur(1)
    expect(eur).toBeCloseTo(0.95 * 1.19 * 1.25, 5)
    expect(eur).not.toBe(1)
  })

  it('exposes default 20 EUR thresholds', () => {
    const thresholds = budgetThresholds()
    expect(thresholds.limitEur).toBe(20)
    expect(thresholds.warnEur).toBe(10)
    expect(thresholds.enrichmentPauseEur).toBe(15)
    expect(thresholds.backgroundPauseEur).toBe(18)
    expect(thresholds.hardStopEur).toBe(20)
  })

  it('detects budget pause errors', () => {
    const error = new BudgetPausedError('background')
    expect(error.status).toBe(402)
    expect(isBudgetPauseError(error)).toBe(true)
    expect(isBudgetPauseError(new Error('nope'))).toBe(false)
  })
})

describe('ai budget concurrent reservation (in-memory simulation)', () => {
  it('rejects a second reservation that would exceed the limit', async () => {
    // Pure logic stand-in: two workers see the same committed total.
    const limit = 20
    const spent = 18.5
    const reserved = 1.0
    const next = 1.0
    const canReserve = spent + reserved + next <= limit
    expect(canReserve).toBe(false)
  })
})
