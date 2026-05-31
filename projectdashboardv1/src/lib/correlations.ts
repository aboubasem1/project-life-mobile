/**
 * Correlation insights — "An Tagen mit Cold Shower ist dein Score im Schnitt +23 Pkt"
 */

import type { DashboardEntry, HabitKey } from '../types/DashboardEntry'
import { HABITS } from '../types/DashboardEntry'
import { calculateScore } from './score'

export interface CorrelationInsight {
  habitKey: HabitKey
  habitLabel: string
  habitIcon: string
  avgWithHabit: number
  avgWithoutHabit: number
  delta: number         // avg with - avg without
  sampleSize: number
}

export function computeCorrelations(entries: DashboardEntry[]): CorrelationInsight[] {
  if (entries.length < 5) return []

  const results: CorrelationInsight[] = []

  for (const h of HABITS) {
    const withHabit    = entries.filter(e => e[h.key])
    const withoutHabit = entries.filter(e => !e[h.key])

    if (withHabit.length < 3 || withoutHabit.length < 3) continue

    const avgWith    = avg(withHabit.map(e => e.dailyScore ?? calculateScore(e)))
    const avgWithout = avg(withoutHabit.map(e => e.dailyScore ?? calculateScore(e)))
    const delta = Math.round(avgWith - avgWithout)

    results.push({
      habitKey: h.key,
      habitLabel: h.label,
      habitIcon: h.color,
      avgWithHabit: Math.round(avgWith),
      avgWithoutHabit: Math.round(avgWithout),
      delta,
      sampleSize: withHabit.length,
    })
  }

  // Sort by absolute delta descending
  return results.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 5)
}

function avg(nums: number[]): number {
  if (!nums.length) return 0
  return nums.reduce((s, v) => s + v, 0) / nums.length
}
