/** Flexible habit schedules — which weekdays a habit is due (Streaks-style). */

/** 0 = Monday … 6 = Sunday (ISO-ish for DE UX). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6

export type HabitScheduleMap = Record<string, Weekday[]>

export const WEEKDAY_LABELS: { value: Weekday; short: string }[] = [
  { value: 0, short: 'Mo' },
  { value: 1, short: 'Di' },
  { value: 2, short: 'Mi' },
  { value: 3, short: 'Do' },
  { value: 4, short: 'Fr' },
  { value: 5, short: 'Sa' },
  { value: 6, short: 'So' },
]

export const ALL_WEEKDAYS: Weekday[] = [0, 1, 2, 3, 4, 5, 6]

export function weekdayFromDateKey(dateKey: string): Weekday {
  const day = new Date(`${dateKey}T12:00:00`).getDay() // 0=Sun … 6=Sat
  return (day === 0 ? 6 : day - 1) as Weekday
}

export function normalizeHabitSchedules(raw: unknown): HabitScheduleMap {
  if (!raw || typeof raw !== 'object') return {}
  const result: HabitScheduleMap = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(value)) continue
    const days = value
      .map(item => Number(item))
      .filter((item): item is Weekday => Number.isInteger(item) && item >= 0 && item <= 6)
    if (days.length > 0 && days.length < 7) {
      result[key] = [...new Set(days)].sort((a, b) => a - b) as Weekday[]
    }
  }
  return result
}

/** Empty / missing schedule = every day. */
export function isHabitDueToday(
  habitId: string,
  dateKey: string,
  schedules: HabitScheduleMap,
): boolean {
  const schedule = schedules[habitId]
  if (!schedule || schedule.length === 0) return true
  return schedule.includes(weekdayFromDateKey(dateKey))
}

export function filterHabitsForDate(
  habitIds: string[],
  dateKey: string,
  schedules: HabitScheduleMap,
): string[] {
  return habitIds.filter(id => isHabitDueToday(id, dateKey, schedules))
}

export function toggleScheduleDay(
  schedules: HabitScheduleMap,
  habitId: string,
  day: Weekday,
): HabitScheduleMap {
  const current = schedules[habitId] ?? [...ALL_WEEKDAYS]
  const set = new Set(current)
  if (set.has(day)) set.delete(day)
  else set.add(day)
  const next = [...set].sort((a, b) => a - b) as Weekday[]
  const copy = { ...schedules }
  if (next.length === 0 || next.length === 7) {
    delete copy[habitId]
  } else {
    copy[habitId] = next
  }
  return copy
}
