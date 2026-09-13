import type { DashboardEntry, HabitKey } from '../types/DashboardEntry'
import { HABITS } from '../types/DashboardEntry'

const GOOD_MOODS = new Set(['Gut', 'Sehr gut', 'gut', 'sehr gut'])
const LOOKBACK = 28

export type MoodHabitLine = {
  text: string
  key: HabitKey
}

function habitDone(entry: DashboardEntry, key: HabitKey): boolean {
  return Boolean(entry[key])
}

function rate(entries: DashboardEntry[], key: HabitKey): number | null {
  if (entries.length < 3) return null
  return entries.filter(entry => habitDone(entry, key)).length / entries.length
}

/** One sentence: how mood and one habit move together. No extra dashboard. */
export function moodHabitLine(entries: DashboardEntry[], today: string, activeHabits: string[]): MoodHabitLine | null {
  const recent = [...entries]
    .filter(entry => entry.date <= today && !entry.dayShield)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, LOOKBACK)

  const good = recent.filter(entry => GOOD_MOODS.has(entry.mood))
  const other = recent.filter(entry => entry.mood && !GOOD_MOODS.has(entry.mood))
  if (good.length < 3 || other.length < 3) return null

  const keys = (activeHabits.filter((key): key is HabitKey => HABITS.some(habit => habit.key === key) || key === 'breathingDone'))
  if (keys.length === 0) return null

  let best: { key: HabitKey; delta: number; goodRate: number; otherRate: number } | null = null
  for (const key of keys) {
    const goodRate = rate(good, key)
    const otherRate = rate(other, key)
    if (goodRate === null || otherRate === null) continue
    const delta = goodRate - otherRate
    if (!best || Math.abs(delta) > Math.abs(best.delta)) {
      best = { key, delta, goodRate, otherRate }
    }
  }
  if (!best || Math.abs(best.delta) < 0.18) return null

  const label = HABITS.find(habit => habit.key === best.key)?.label
    ?? (best.key === 'breathingDone' ? 'Atmung' : best.key)
  const goodPct = Math.round(best.goodRate * 100)
  const otherPct = Math.round(best.otherRate * 100)
  if (best.delta > 0) {
    return {
      key: best.key,
      text: `An guten Stimmungstagen machst du ${label} ${goodPct}% der Tage — sonst ${otherPct}%.`,
    }
  }
  return {
    key: best.key,
    text: `${label} bleibt auch an schweren Tagen bei ${otherPct}% — an guten Tagen ${goodPct}%. Kein Grund, mehr zu pressen.`,
  }
}
