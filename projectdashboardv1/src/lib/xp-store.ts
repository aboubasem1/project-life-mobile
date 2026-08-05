/**
 * Unified XP Store — shared between React app and dashboard-bridge.html
 * Both systems read/write from the same localStorage key: lifeos-xp-v1
 * No Supabase, no fake sync — honest local-first with full export/import.
 */

export const XP_KEY = 'lifeos-xp-v1'

export interface XPStore {
  xp: number           // current XP in this level
  level: number        // current level (1-based)
  totalXP: number      // all-time XP earned
  lastUpdated: string  // ISO date YYYY-MM-DD
  streakDays: number   // consecutive days with score ≥ 50
  lastScoreDate: string
}

const XP_PER_LEVEL = 500

export function loadXP(): XPStore {
  try {
    const raw = safeGetItem(XP_KEY)
    if (!raw) return defaultXP()
    const parsed = { ...defaultXP(), ...JSON.parse(raw) }
    // Also check dashboard-bridge state — take whichever has more totalXP
    const bridgeRaw = safeGetItem('lifeos-sv4')
    if (bridgeRaw) {
      const bridge = JSON.parse(bridgeRaw)
      if ((bridge.xp ?? 0) > parsed.totalXP) {
        // Bridge has more — use its data as authoritative
        const totalXP = bridge.xp ?? 0
        return {
          ...parsed,
          totalXP,
          level: bridge.lv ?? Math.floor(totalXP / XP_PER_LEVEL) + 1,
          xp: totalXP % XP_PER_LEVEL,
          streakDays: bridge.streak ?? parsed.streakDays,
        }
      }
    }
    return parsed
  } catch {
    return defaultXP()
  }
}

export function saveXP(store: XPStore): void {
  if (safeSetItem(XP_KEY, JSON.stringify(store))) {
    // Notify other tabs / HTML pages instantly
    window.dispatchEvent(new StorageEvent('storage', {
      key: XP_KEY,
      newValue: JSON.stringify(store),
    }))
  }
}

function todayKeyLocal(): string {
  const d = new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Award XP for a daily score.
 * Only mutates streak / lastScoreDate when `date` is today — editing past
 * days never rewinds the live streak. Historical days can still top-up
 * per-day XP if the score improved (never subtract).
 */
export function awardDailyXP(score: number, date: string, today = todayKeyLocal()): XPStore {
  const store = loadXP()
  const earned = scoreToXP(score)
  const perDayKey = `lifeos-xp-day-${date}`
  const prevAwarded = Number(safeGetItem(perDayKey) ?? '0')
  const diff = earned - prevAwarded

  // Editing a past / future day: only top up XP, never touch streak clock
  if (date !== today) {
    if (diff <= 0) return store
    safeSetItem(perDayKey, String(earned))
    const totalXP = store.totalXP + diff
    const updated: XPStore = {
      ...store,
      totalXP,
      level: Math.floor(totalXP / XP_PER_LEVEL) + 1,
      xp: totalXP % XP_PER_LEVEL,
    }
    saveXP(updated)
    return updated
  }

  // Today — same-day improvement
  if (store.lastScoreDate === date) {
    if (diff <= 0) return store
    safeSetItem(perDayKey, String(earned))
    return applyXP(store, diff, date)
  }

  // Today — first award of the day (or first after a gap)
  safeSetItem(perDayKey, String(earned))

  const yesterday = offsetDate(date, -1)
  const streak = store.lastScoreDate === yesterday && score >= 50
    ? store.streakDays + 1
    : score >= 50 ? 1 : 0

  return applyXP(
    { ...store, streakDays: streak },
    Math.max(0, earned),
    date,
  )
}

function applyXP(store: XPStore, amount: number, date: string): XPStore {
  const totalXP = store.totalXP + amount
  const level = Math.floor(totalXP / XP_PER_LEVEL) + 1
  const xp = totalXP % XP_PER_LEVEL
  const updated: XPStore = {
    ...store,
    xp,
    level,
    totalXP,
    lastUpdated: date,
    lastScoreDate: date,
  }
  saveXP(updated)
  return updated
}

/** Convert a 0-100 daily score to XP earned */
export function scoreToXP(score: number): number {
  if (score >= 90) return 200
  if (score >= 75) return 150
  if (score >= 55) return 100
  if (score >= 35) return 50
  if (score >= 1)  return 20
  return 0
}

/**
 * Rebuild XP + streak from entry scores after a backup import.
 * Clears prior per-day XP keys, then rewrites from the imported set.
 */
export function recomputeXPFromEntries(
  entries: Array<{ date: string; dailyScore: number }>,
  today = todayKeyLocal(),
): XPStore {
  const sorted = [...entries]
    .filter(entry => entry.date)
    .sort((a, b) => a.date.localeCompare(b.date))

  // Drop orphan day keys so awardDailyXP never under-awards against stale history.
  try {
    const toRemove: string[] = []
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index)
      if (key?.startsWith('lifeos-xp-day-')) toRemove.push(key)
    }
    for (const key of toRemove) localStorage.removeItem(key)
  } catch { /* storage blocked */ }

  let totalXP = 0
  for (const entry of sorted) {
    const earned = scoreToXP(Math.max(0, Math.min(100, Math.round(entry.dailyScore || 0))))
    totalXP += earned
    safeSetItem(`lifeos-xp-day-${entry.date}`, String(earned))
  }

  let streakDays = 0
  let cursor = today
  const byDate = new Map(sorted.map(entry => [entry.date, entry.dailyScore || 0]))
  while (true) {
    const score = byDate.get(cursor)
    if (score === undefined || score < 50) break
    streakDays += 1
    cursor = offsetDate(cursor, -1)
  }

  const lastWithScore = [...sorted].reverse().find(entry => (entry.dailyScore || 0) > 0)
  const store: XPStore = {
    totalXP,
    level: Math.floor(totalXP / XP_PER_LEVEL) + 1,
    xp: totalXP % XP_PER_LEVEL,
    lastUpdated: today,
    streakDays,
    lastScoreDate: lastWithScore?.date ?? '',
  }
  saveXP(store)
  return store
}

export function xpToNextLevel(store: XPStore): number {
  return XP_PER_LEVEL - store.xp
}

export function levelProgress(store: XPStore): number {
  return Math.round((store.xp / XP_PER_LEVEL) * 100)
}

function defaultXP(): XPStore {
  return {
    xp: 0,
    level: 1,
    totalXP: 0,
    lastUpdated: '',
    streakDays: 0,
    lastScoreDate: '',
  }
}

function offsetDate(date: string, days: number): string {
  const d = new Date(date + 'T12:00:00')
  d.setDate(d.getDate() + days)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
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
