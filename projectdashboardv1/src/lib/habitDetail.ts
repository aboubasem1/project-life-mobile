import type { DashboardEntry, HabitKey } from '../types/DashboardEntry'

export type HabitWeekCell = {
  date: string
  done: boolean
  shielded: boolean
}

export type HabitHeatCell = {
  date: string
  done: boolean
  shielded: boolean
}

export type HabitDetailStats = {
  currentStreak: number
  bestStreak: number
  week: HabitWeekCell[]
  heatmap: HabitHeatCell[]
  completedDays: number
}

function offsetDate(date: string, days: number): string {
  const cursor = new Date(`${date}T12:00:00`)
  cursor.setDate(cursor.getDate() + days)
  const year = cursor.getFullYear()
  const month = String(cursor.getMonth() + 1).padStart(2, '0')
  const day = String(cursor.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function dateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function isDone(entry: DashboardEntry | undefined, key: HabitKey): boolean {
  return Boolean(entry?.[key])
}

export function habitDetailStats(
  entries: DashboardEntry[],
  key: HabitKey,
  today: string,
): HabitDetailStats {
  const byDate = new Map(entries.map(entry => [entry.date, entry]))
  const week = Array.from({ length: 7 }, (_, index) => {
    const date = offsetDate(today, index - 6)
    const entry = byDate.get(date)
    return {
      date,
      done: isDone(entry, key),
      shielded: Boolean(entry?.dayShield),
    }
  })

  const heatmap: HabitHeatCell[] = []
  const end = new Date(`${today}T12:00:00`)
  const start = new Date(end)
  start.setDate(start.getDate() - 83)
  const startDow = (start.getDay() + 6) % 7
  start.setDate(start.getDate() - startDow)
  const cursor = new Date(start)
  while (cursor <= end) {
    const date = dateKey(cursor)
    const entry = byDate.get(date)
    heatmap.push({
      date,
      done: isDone(entry, key),
      shielded: Boolean(entry?.dayShield),
    })
    cursor.setDate(cursor.getDate() + 1)
  }

  let currentStreak = 0
  let walk = today
  while (true) {
    const entry = byDate.get(walk)
    if (!entry) break
    if (entry.dayShield) {
      walk = offsetDate(walk, -1)
      continue
    }
    if (!isDone(entry, key)) break
    currentStreak += 1
    walk = offsetDate(walk, -1)
  }

  let bestStreak = 0
  let running = 0
  const oldest = offsetDate(today, -365)
  let day = oldest
  while (day <= today) {
    const entry = byDate.get(day)
    if (entry?.dayShield) {
      day = offsetDate(day, 1)
      continue
    }
    if (!entry) {
      running = 0
      day = offsetDate(day, 1)
      continue
    }
    if (isDone(entry, key)) {
      running += 1
      if (running > bestStreak) bestStreak = running
    } else {
      running = 0
    }
    day = offsetDate(day, 1)
  }

  const completedDays = entries.filter(entry => !entry.dayShield && isDone(entry, key)).length

  return { currentStreak, bestStreak, week, heatmap, completedDays }
}
