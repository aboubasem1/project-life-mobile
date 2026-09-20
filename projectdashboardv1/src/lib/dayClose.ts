import type { DashboardEntry, HabitKey } from '../types/DashboardEntry'
import { HABITS } from '../types/DashboardEntry'
import { filterHabitsForDate, type HabitScheduleMap } from './habitSchedule'
import { getDayPolicy } from './dayPolicy'

export type DayCloseAction = 'checkin' | 'plan' | 'today'

export type DayGap = {
  id: string
  label: string
  action: DayCloseAction
}

export type DayCompleteness = {
  percent: number
  done: number
  total: number
  gaps: DayGap[]
  closed: boolean
  closedAt?: string
  shielded: boolean
  readyToClose: boolean
  summary: string
}

type CompletenessInput = {
  entry: DashboardEntry
  activeHabits: string[]
  habitSchedules?: HabitScheduleMap
  focusMinutes?: number
  hour?: number
}

function habitLabel(key: string): string {
  if (key === 'breathingDone') return 'Atmung'
  return HABITS.find(item => item.key === key)?.label ?? key
}

function isHabitDone(entry: DashboardEntry, key: string): boolean {
  return Boolean((entry as unknown as Record<string, unknown>)[key])
}

function isKnownHabit(key: string): key is HabitKey | 'breathingDone' {
  return key === 'breathingDone' || HABITS.some(item => item.key === key)
}

export function assessDayCompleteness(input: CompletenessInput): DayCompleteness {
  const { entry } = input
  const shielded = Boolean(entry.dayShield)
  const closedAt = typeof entry.dayClosedAt === 'string' && entry.dayClosedAt
    ? entry.dayClosedAt
    : undefined
  const closed = Boolean(closedAt)

  if (shielded) {
    return {
      percent: 100,
      done: 1,
      total: 1,
      gaps: [],
      closed,
      closedAt,
      shielded: true,
      readyToClose: true,
      summary: 'Tag bewusst ausgesetzt',
    }
  }

  const habitsDue = filterHabitsForDate(
    input.activeHabits,
    entry.date,
    input.habitSchedules ?? {},
  )
  const policy = getDayPolicy({
    energy: entry.energyLevel,
    activeHabits: habitsDue,
    baseFocusMinutes: input.focusMinutes ?? 25,
    hour: input.hour ?? 18,
  })

  const checks: Array<{ id: string; ok: boolean; gap?: DayGap }> = []

  checks.push({
    id: 'energy',
    ok: Boolean(entry.energyLevel),
    gap: { id: 'energy', label: 'Energie setzen', action: 'today' },
  })

  const anchors = entry.anchors ?? []
  const anchorsDone = entry.anchorsDone ?? []
  if (anchors.length > 0) {
    const open = anchors.filter((_, index) => !anchorsDone[index]).length
    checks.push({
      id: 'anchors',
      ok: open === 0,
      gap: { id: 'anchors', label: `${open} Anker offen`, action: 'plan' },
    })
  }

  const primary = policy.primaryHabitIds.filter(isKnownHabit)
  if (primary.length > 0) {
    const missing = primary.filter(key => !isHabitDone(entry, key))
    checks.push({
      id: 'habits',
      ok: missing.length === 0,
      gap: {
        id: 'habits',
        label: missing.length === 1
          ? `${habitLabel(missing[0])} fehlt`
          : `${missing.length} Habits offen`,
        action: 'today',
      },
    })
  }

  const hasSleep = Boolean(entry.sleepDuration || entry.bedTime || entry.wakeTime || entry.sleepQuality)
  checks.push({
    id: 'checkin',
    ok: Boolean(entry.mood) || hasSleep,
    gap: { id: 'checkin', label: 'Check-in (Stimmung/Schlaf)', action: 'checkin' },
  })

  const hasBody = entry.waterLiters > 0 || entry.proteinGrams > 0 || entry.calories > 0
  checks.push({
    id: 'evening',
    ok: Boolean(entry.journalDone || entry.journalText?.trim()) || hasBody,
    gap: { id: 'evening', label: 'Abendnotiz oder Körperwerte', action: 'checkin' },
  })

  const total = checks.length
  const done = checks.filter(item => item.ok).length
  const gaps = checks
    .filter(item => !item.ok && item.gap)
    .map(item => item.gap!)
  const percent = total === 0 ? 100 : Math.round((done / total) * 100)

  return {
    percent,
    done,
    total,
    gaps,
    closed,
    closedAt,
    shielded: false,
    readyToClose: percent >= 60 || gaps.length <= 1,
    summary: closed
      ? 'Tag abgeschlossen'
      : gaps.length === 0
        ? 'Bereit zum Abschluss'
        : `${gaps.length} offen`,
  }
}

export function formatClosedAt(iso: string): string {
  const date = new Date(iso)
  if (!Number.isFinite(date.getTime())) return '—'
  return new Intl.DateTimeFormat('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function closeDayPatch(at = new Date()): Pick<DashboardEntry, 'dayClosedAt'> {
  return { dayClosedAt: at.toISOString() }
}

export function reopenDayPatch(): { dayClosedAt: null } {
  return { dayClosedAt: null }
}
