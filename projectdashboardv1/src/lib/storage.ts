import type { DashboardEntry } from '../types/DashboardEntry'
import { calculateScore } from './score'
import { loadXP, saveXP, type XPStore, XP_KEY } from './xp-store'

const ENTRIES_KEY = 'project-life-entries'
const USER_ID_KEY = 'project-life-user-id'
const SETTINGS_KEY = 'life-os-v1-settings'
const DASHBOARD_PLUS_KEY = 'life-os-v1-dashboard-plus'
const LAST_BACKUP_KEY = 'life-os-v1-last-backup-at'
export const BACKUP_VERSION = 2

export type LifeOsBackupBundle = {
  version: number
  exportedAt: string
  entries: DashboardEntry[]
  settings?: unknown
  dashboardPlus?: unknown
  xp?: XPStore
}

// ─── User identity (UUID stored in localStorage) ──────────────────────────────
export function getUserId(): string {
  let id = safeGetItem(USER_ID_KEY)
  if (!id) {
    id = crypto.randomUUID()
    safeSetItem(USER_ID_KEY, id)
  }
  return id
}

// ─── Local CRUD ───────────────────────────────────────────────────────────────
export function loadAllEntries(): DashboardEntry[] {
  try {
    const raw = safeGetItem(ENTRIES_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map(migrateLegacy)
  } catch {
    return []
  }
}

export function saveAllEntries(entries: DashboardEntry[]): boolean {
  return safeSetItem(ENTRIES_KEY, JSON.stringify(entries))
}

export type UpsertResult = {
  entries: DashboardEntry[]
  ok: boolean
}

export function upsertEntry(entry: DashboardEntry): UpsertResult {
  const all = loadAllEntries()
  const scored: DashboardEntry = { ...entry, dailyScore: calculateScore(entry) }
  const idx = all.findIndex(e => e.date === scored.date)
  if (idx >= 0) all[idx] = scored
  else all.push(scored)
  const ok = saveAllEntries(all)
  return { entries: all, ok }
}

export function getLastBackupAt(): string | null {
  return safeGetItem(LAST_BACKUP_KEY)
}

export function listDayBackupKeys(): string[] {
  const keys: string[] = []
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index)
      if (key?.startsWith('project-life-backup-') && !key.endsWith('.json')) {
        keys.push(key)
      }
    }
  } catch { /* ignore */ }
  return keys.sort().reverse()
}

export function loadDayBackup(date: string): DashboardEntry | null {
  try {
    const raw = safeGetItem(`project-life-backup-${date}`)
    if (!raw) return null
    return migrateLegacy(JSON.parse(raw) as Record<string, unknown>)
  } catch {
    return null
  }
}

// ─── Import / Export ──────────────────────────────────────────────────────────
export function exportBackupBundle(input: {
  entries: DashboardEntry[]
  settings?: unknown
  dashboardPlus?: unknown
}): void {
  const bundle: LifeOsBackupBundle = {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    entries: input.entries,
    settings: input.settings,
    dashboardPlus: input.dashboardPlus,
    xp: loadXP(),
  }
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `life-os-backup-${new Date().toISOString().split('T')[0]}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  safeSetItem(LAST_BACKUP_KEY, bundle.exportedAt)
}

/** @deprecated Prefer exportBackupBundle — kept for simple entry dumps */
export function exportJSON(entries: DashboardEntry[]): void {
  exportBackupBundle({ entries })
}

export type ImportResult = {
  entries: DashboardEntry[]
  settings?: unknown
  dashboardPlus?: unknown
  xp?: XPStore
  mode: 'bundle' | 'entries'
  entryCount: number
}

export function importBackupFile(file: File): Promise<ImportResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => {
      try {
        const data = JSON.parse(e.target?.result as string)
        if (Array.isArray(data)) {
          const entries = data.map(migrateLegacy)
          resolve({ entries, mode: 'entries', entryCount: entries.length })
          return
        }
        if (data && typeof data === 'object' && Array.isArray(data.entries)) {
          const entries = data.entries.map((item: Record<string, unknown>) => migrateLegacy(item))
          resolve({
            entries,
            settings: data.settings,
            dashboardPlus: data.dashboardPlus,
            xp: data.xp,
            mode: 'bundle',
            entryCount: entries.length,
          })
          return
        }
        throw new Error('Ungültiges Format')
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsText(file)
  })
}

export function importJSON(file: File): Promise<DashboardEntry[]> {
  return importBackupFile(file).then(result => result.entries)
}

export function mergeEntriesByDate(current: DashboardEntry[], incoming: DashboardEntry[]): DashboardEntry[] {
  const map = new Map<string, DashboardEntry>()
  for (const entry of current) map.set(entry.date, entry)
  for (const entry of incoming) {
    const existing = map.get(entry.date)
    if (!existing || (entry.dailyScore ?? 0) >= (existing.dailyScore ?? 0)) {
      map.set(entry.date, entry)
    }
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date))
}

export function applyBackupExtras(result: ImportResult): void {
  if (result.settings) safeSetItem(SETTINGS_KEY, JSON.stringify(result.settings))
  if (result.dashboardPlus) safeSetItem(DASHBOARD_PLUS_KEY, JSON.stringify(result.dashboardPlus))
  if (result.xp) saveXP({ ...loadXP(), ...result.xp })
  safeSetItem(LAST_BACKUP_KEY, new Date().toISOString())
}

export { SETTINGS_KEY, DASHBOARD_PLUS_KEY, XP_KEY }

// ─── Legacy schema migration ─────────────────────────────────────────────────
function migrateLegacy(raw: Record<string, unknown>): DashboardEntry {
  const dreamQuality = raw.dreamQuality === 'gut' || raw.dreamQuality === 'schlecht'
    ? raw.dreamQuality
    : undefined

  return {
    id: typeof raw.id === 'string' ? raw.id : undefined,
    date: String(raw.date ?? ''),
    userId: typeof raw.userId === 'string' ? raw.userId : undefined,
    mood: String(raw.mood ?? ''),
    sleepQuality: String(raw.sleepQuality ?? ''),
    sleepDuration: String(raw.sleepDuration ?? ''),
    meditationMinutes: Number(raw.meditationMinutes) || 0,
    coldShower: Boolean(raw.coldShower),
    proteinShake: Boolean(raw.proteinShake),
    pushupsDone: Boolean(raw.pushupsDone),
    squatsDone: Boolean(raw.squatsDone),
    wallsitDone: Boolean(raw.wallsitDone),
    plankDone: Boolean(raw.plankDone),
    gratitudeDone: Boolean(raw.gratitudeDone),
    focusDone: Boolean(raw.focusDone),
    winnerModeDone: Boolean(raw.winnerModeDone),
    proteinReached: Boolean(raw.proteinReached),
    caloriesReached: Boolean(raw.caloriesReached),
    proteinGrams: Number(raw.proteinGrams) || 0,
    calories: Number(raw.calories) || 0,
    tasksDone: Number(raw.tasksDone) || 0,
    journalDone: Boolean(raw.journalDone),
    journalText: String(raw.journalText ?? ''),
    familyTimeDone: Boolean(raw.familyTimeDone),
    weightKg: Number(raw.weightKg) || 0,
    waterLiters: Number(raw.waterLiters) || 0,
    deepWorkHours: Number(raw.deepWorkHours) || 0,
    dailyScore: Number(raw.dailyScore) || 0,
    breathingDone: Boolean(raw.breathingDone),
    energyLevel: raw.energyLevel === 'low' || raw.energyLevel === 'okay' || raw.energyLevel === 'high'
      ? raw.energyLevel
      : undefined,
    anchors: Array.isArray(raw.anchors) ? raw.anchors.map(String) : undefined,
    anchorsDone: Array.isArray(raw.anchorsDone) ? raw.anchorsDone.map(Boolean) : undefined,
    dreamed: typeof raw.dreamed === 'boolean' ? raw.dreamed : undefined,
    dreamQuality,
  }
}

function safeGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function safeSetItem(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}
