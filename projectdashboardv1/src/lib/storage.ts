import type { DashboardEntry } from '../types/DashboardEntry'
import { calculateScore } from './score'

const ENTRIES_KEY = 'project-life-entries'
const USER_ID_KEY  = 'project-life-user-id'

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

export function upsertEntry(entry: DashboardEntry): DashboardEntry[] {
  const all = loadAllEntries()
  const scored: DashboardEntry = { ...entry, dailyScore: calculateScore(entry) }
  const idx = all.findIndex(e => e.date === scored.date)
  if (idx >= 0) all[idx] = scored
  else all.push(scored)
  saveAllEntries(all)
  return all
}

// ─── Import / Export ──────────────────────────────────────────────────────────
export function exportJSON(entries: DashboardEntry[]): void {
  const blob = new Blob([JSON.stringify(entries, null, 2)], { type: 'application/json' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `project-life-backup-${new Date().toISOString().split('T')[0]}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function importJSON(file: File): Promise<DashboardEntry[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string)
        if (!Array.isArray(data)) throw new Error('Ungültiges Format')
        resolve(data.map(migrateLegacy))
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsText(file)
  })
}

// ─── Legacy schema migration ─────────────────────────────────────────────────
function migrateLegacy(raw: Record<string, unknown>): DashboardEntry {
  return {
    date:               String(raw.date ?? ''),
    mood:               String(raw.mood ?? ''),
    sleepQuality:       String(raw.sleepQuality ?? ''),
    sleepDuration:      String(raw.sleepDuration ?? ''),
    meditationMinutes:  Number(raw.meditationMinutes)  || 0,
    coldShower:         Boolean(raw.coldShower),
    proteinShake:       Boolean(raw.proteinShake),
    pushupsDone:        Boolean(raw.pushupsDone),
    squatsDone:         Boolean(raw.squatsDone),
    wallsitDone:        Boolean(raw.wallsitDone),
    plankDone:          Boolean(raw.plankDone),
    gratitudeDone:      Boolean(raw.gratitudeDone),
    focusDone:          Boolean(raw.focusDone),
    winnerModeDone:     Boolean(raw.winnerModeDone),
    proteinReached:     Boolean(raw.proteinReached),
    caloriesReached:    Boolean(raw.caloriesReached),
    proteinGrams:       Number(raw.proteinGrams)       || 0,
    calories:           Number(raw.calories)           || 0,
    tasksDone:          Number(raw.tasksDone)          || 0,
    journalDone:        Boolean(raw.journalDone),
    journalText:        String(raw.journalText ?? ''),
    familyTimeDone:     Boolean(raw.familyTimeDone),
    weightKg:           Number(raw.weightKg)           || 0,
    waterLiters:        Number(raw.waterLiters)        || 0,
    deepWorkHours:      Number(raw.deepWorkHours)      || 0,
    dailyScore:         Number(raw.dailyScore)         || 0,
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
