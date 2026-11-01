import { describe, expect, it } from 'vitest'
import { createDefaultEntry } from '../types/DashboardEntry'
import {
  buildDailyWeightPoints,
  parseHealthIngestBody,
  selectTodayWeight,
  upsertManualDayWeight,
} from './bodyMeasurement'

const SHORTCUT_WEIGHT = {
  metric: 'weight',
  value: 56.8,
  unit: 'kg',
  date: '2026-09-13T07:42:00+02:00',
  source: 'Fitdays',
}

const HAE_FITDAYS = {
  data: {
    metrics: [
      {
        name: 'weight_body_mass',
        units: 'kg',
        data: [
          {
            qty: 79.4,
            date: '2026-09-20 08:10:00 +0200',
            source: 'Fitdays',
          },
        ],
      },
      {
        name: 'body_fat_percentage',
        units: '%',
        data: [
          {
            qty: 18.2,
            date: '2026-09-20 08:10:00 +0200',
            source: { name: 'Fitdays', bundleIdentifier: 'com.fitdays.scale' },
          },
        ],
      },
      {
        name: 'step_count',
        units: 'count',
        data: [
          {
            qty: 6400,
            date: '2026-09-20 08:10:00 +0200',
            source: 'Apple Health',
          },
        ],
      },
    ],
  },
}

const BITFIT_SCALE = {
  data: {
    metrics: [
      {
        name: 'body_mass',
        units: 'kg',
        data: [
          {
            Qty: 81.2,
            date: '2026-09-21 07:05:00 +0200',
            source: 'Bitfit',
          },
        ],
      },
    ],
  },
}

describe('health ingest payloads', () => {
  it('accepts the documented shortcut weight payload', () => {
    const parsed = parseHealthIngestBody(SHORTCUT_WEIGHT)
    expect(parsed.measurements).toHaveLength(1)
    expect(parsed.measurements[0]?.weightKg).toBe(56.8)
    expect(parsed.measurements[0]?.sourceApp).toBe('fitdays')
    expect(parsed.dailyPatches).toEqual([
      expect.objectContaining({
        date: '2026-09-13',
        weightKg: 56.8,
      }),
    ])
  })

  it('accepts Health Auto Export metrics from Fitdays, including steps', () => {
    const parsed = parseHealthIngestBody(HAE_FITDAYS)
    expect(parsed.measurements[0]?.weightKg).toBe(79.4)
    expect(parsed.measurements[0]?.bodyFatPercent).toBe(18.2)
    expect(parsed.measurements[0]?.sourceApp).toBe('fitdays')
    expect(parsed.dailyPatches).toEqual([
      expect.objectContaining({
        date: '2026-09-20',
        weightKg: 79.4,
        bodyFatPercent: 18.2,
        steps: 6400,
      }),
    ])
  })

  it('accepts a Bitfit scale sample and lets it win over a same-day manual weight', () => {
    const parsed = parseHealthIngestBody(BITFIT_SCALE)
    const measurement = parsed.measurements[0]
    expect(measurement?.weightKg).toBe(81.2)
    expect(measurement?.sourceApp).toBe('bitfit')

    const manual = createDefaultEntry('2026-09-21')
    manual.weightKg = 80
    manual.weightMeasuredAt = '2026-09-21T07:00:00.000Z'
    const selected = selectTodayWeight({
      date: '2026-09-21',
      entry: manual,
      measurements: parsed.measurements,
    })
    expect(selected).toEqual(expect.objectContaining({
      value: 81.2,
      source: 'fitdays',
    }))

    const points = buildDailyWeightPoints([manual], parsed.measurements)
    expect(points.find(point => point.date === '2026-09-21')).toEqual(expect.objectContaining({
      kg: 81.2,
      sourceApp: 'bitfit',
    }))
  })

  it('replaces the same manual day weight instead of adding another row', () => {
    const first = upsertManualDayWeight([], '2026-11-01', 80.2, '2026-11-01T07:00:00.000Z')
    const second = upsertManualDayWeight(first, '2026-11-01', 80.4, '2026-11-01T07:05:00.000Z')
    expect(second.filter(item => item.externalId === 'manual-weight:2026-11-01')).toHaveLength(1)
    expect(second.find(item => item.externalId === 'manual-weight:2026-11-01')?.weightKg).toBe(80.4)
  })
})
