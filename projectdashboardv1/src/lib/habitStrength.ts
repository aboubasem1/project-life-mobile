import type { DashboardEntry, HabitKey } from '../types/DashboardEntry'

/** Loop-style habit strength: builds gradually, decays on misses — no hard reset. */

const LOOKBACK = 21
const GAIN = 8
const DECAY = 5

export type HabitStrength = {
  key: HabitKey | string
  strength: number // 0–100
  completedDays: number
  missedDays: number
  neverMissTwiceOk: boolean // true if no two consecutive misses in last 7 tracked days
}

export function calculateHabitStrength(
  entries: DashboardEntry[],
  key: HabitKey | string,
  today: string,
): HabitStrength {
  const byDate = new Map(entries.map(entry => [entry.date, entry]))
  let strength = 40
  let completedDays = 0
  let missedDays = 0
  const recentFlags: boolean[] = []

  for (let offset = LOOKBACK - 1; offset >= 0; offset -= 1) {
    const date = offsetDate(today, -offset)
    const entry = byDate.get(date)
    if (!entry) continue
    const done = Boolean(entry[key as keyof DashboardEntry])
    recentFlags.push(done)
    if (done) {
      completedDays += 1
      strength = Math.min(100, strength + GAIN)
    } else {
      missedDays += 1
      strength = Math.max(0, strength - DECAY)
    }
  }

  const lastSeven = recentFlags.slice(-7)
  let neverMissTwiceOk = true
  for (let i = 1; i < lastSeven.length; i += 1) {
    if (!lastSeven[i] && !lastSeven[i - 1]) {
      neverMissTwiceOk = false
      break
    }
  }

  return {
    key,
    strength: Math.round(strength),
    completedDays,
    missedDays,
    neverMissTwiceOk,
  }
}

export function habitStrengthLabel(strength: number): string {
  if (strength >= 80) return 'Stark'
  if (strength >= 55) return 'Stabil'
  if (strength >= 30) return 'Aufbau'
  return 'Start'
}

function offsetDate(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00`)
  d.setDate(d.getDate() + days)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
