import type { DashboardEntry, HabitKey } from '../types/DashboardEntry'
import { HABITS } from '../types/DashboardEntry'

export const HABIT_KIND_IDS = ['toggle', 'amount', 'timer', 'steps'] as const
export type HabitKind = (typeof HABIT_KIND_IDS)[number]

export type HabitStepDef = {
  id: string
  label: string
}

export type HabitKindConfig = {
  kind: HabitKind
  target: number
  unit: string
  steps: HabitStepDef[]
}

export type HabitLog = {
  value?: number
  elapsed?: number
  checked?: string[]
}

export type HabitKindGoals = {
  proteinGoal: number
  focusMinutes: number
  softMinutes?: number
}

export function isHabitKey(value: string): value is HabitKey {
  return HABITS.some(habit => habit.key === value) || value === 'breathingDone'
}

export function defaultHabitKind(key: HabitKey, goals: HabitKindGoals): HabitKindConfig {
  const soft = goals.softMinutes
  switch (key) {
    case 'breathingDone':
      return { kind: 'timer', target: (soft ?? 11) * 60, unit: 's', steps: [] }
    case 'coldShower':
      return { kind: 'timer', target: soft ? soft * 60 : 180, unit: 's', steps: [] }
    case 'proteinShake':
      return { kind: 'amount', target: Math.min(40, Math.max(25, Math.round(goals.proteinGoal / 5))), unit: 'g', steps: [] }
    case 'pushupsDone':
      return { kind: 'amount', target: 50, unit: 'Wdh', steps: [] }
    case 'squatsDone':
      return { kind: 'amount', target: 50, unit: 'Wdh', steps: [] }
    case 'wallsitDone':
      return { kind: 'timer', target: 50, unit: 's', steps: [] }
    case 'plankDone':
      return { kind: 'timer', target: 50, unit: 's', steps: [] }
    case 'gratitudeDone':
      return { kind: 'toggle', target: 1, unit: '', steps: [] }
    case 'focusDone':
      return { kind: 'timer', target: (soft ?? Math.max(5, goals.focusMinutes)) * 60, unit: 's', steps: [] }
    case 'winnerModeDone':
      return {
        kind: 'steps',
        target: 3,
        unit: '',
        steps: [
          { id: 'pose', label: 'Pose halten' },
          { id: 'breath', label: 'Drei bewusste Atemzüge' },
          { id: 'ready', label: 'Sag: ich bin bereit' },
        ],
      }
    case 'journalDone':
      return { kind: 'toggle', target: 1, unit: '', steps: [] }
    case 'familyTimeDone':
      return { kind: 'toggle', target: 1, unit: '', steps: [] }
    default: {
      const _exhaustive: never = key
      return _exhaustive
    }
  }
}

export function habitLogFor(entry: DashboardEntry, key: string): HabitLog {
  const raw = entry.habitLogs?.[key]
  if (!raw || typeof raw !== 'object') return {}
  return {
    value: typeof raw.value === 'number' && Number.isFinite(raw.value) ? raw.value : undefined,
    elapsed: typeof raw.elapsed === 'number' && Number.isFinite(raw.elapsed) ? raw.elapsed : undefined,
    checked: Array.isArray(raw.checked) ? raw.checked.map(String) : undefined,
  }
}

export function isHabitComplete(entry: DashboardEntry, key: HabitKey, config: HabitKindConfig): boolean {
  if (Boolean(entry[key])) return true
  const log = habitLogFor(entry, key)
  switch (config.kind) {
    case 'toggle':
      return false
    case 'amount':
      return (log.value ?? 0) >= config.target
    case 'timer':
      return (log.elapsed ?? 0) >= config.target
    case 'steps':
      return config.steps.length > 0 && config.steps.every(step => log.checked?.includes(step.id))
    default: {
      const _exhaustive: never = config.kind
      return _exhaustive
    }
  }
}

export function habitProgressLabel(entry: DashboardEntry, key: HabitKey, config: HabitKindConfig): string {
  const log = habitLogFor(entry, key)
  switch (config.kind) {
    case 'toggle':
      return Boolean(entry[key]) ? 'Erledigt' : 'Offen'
    case 'amount':
      return `${Math.min(config.target, log.value ?? 0)}/${config.target} ${config.unit}`.trim()
    case 'timer': {
      const left = Math.max(0, config.target - (log.elapsed ?? 0))
      return Boolean(entry[key]) || left === 0 ? 'Fertig' : formatClock(left)
    }
    case 'steps': {
      const done = config.steps.filter(step => log.checked?.includes(step.id)).length
      return `${done}/${config.steps.length}`
    }
    default: {
      const _exhaustive: never = config.kind
      return _exhaustive
    }
  }
}

export function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.round(totalSeconds))
  const minutes = Math.floor(safe / 60)
  const seconds = safe % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function patchHabitLog(
  entry: DashboardEntry,
  key: HabitKey,
  patch: HabitLog,
  config: HabitKindConfig,
): Partial<DashboardEntry> {
  const current = habitLogFor(entry, key)
  const next: HabitLog = {
    value: patch.value ?? current.value,
    elapsed: patch.elapsed ?? current.elapsed,
    checked: patch.checked ?? current.checked,
  }
  const logs = { ...(entry.habitLogs ?? {}), [key]: next }
  const complete = isHabitComplete({ ...entry, habitLogs: logs, [key]: false } as DashboardEntry, key, config)
  const extra = linkedFields(key, next, entry)
  return {
    habitLogs: logs,
    [key]: complete,
    ...extra,
  }
}

function linkedFields(key: HabitKey, log: HabitLog, entry: DashboardEntry): Partial<DashboardEntry> {
  if (key === 'proteinShake') {
    return {}
  }
  if (key === 'breathingDone' && typeof log.elapsed === 'number') {
    return { meditationMinutes: Math.max(entry.meditationMinutes, Math.round(log.elapsed / 60)) }
  }
  if (key === 'focusDone' && typeof log.elapsed === 'number') {
    return { deepWorkHours: Math.max(entry.deepWorkHours, Math.round((log.elapsed / 3600) * 10) / 10) }
  }
  return {}
}

export function normalizeHabitLogs(raw: unknown): DashboardEntry['habitLogs'] {
  if (!raw || typeof raw !== 'object') return undefined
  const logs: NonNullable<DashboardEntry['habitLogs']> = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== 'object') continue
    const record = value as HabitLog
    logs[key] = {
      value: typeof record.value === 'number' && Number.isFinite(record.value) ? record.value : undefined,
      elapsed: typeof record.elapsed === 'number' && Number.isFinite(record.elapsed) ? record.elapsed : undefined,
      checked: Array.isArray(record.checked) ? record.checked.map(String) : undefined,
    }
  }
  return Object.keys(logs).length > 0 ? logs : undefined
}
