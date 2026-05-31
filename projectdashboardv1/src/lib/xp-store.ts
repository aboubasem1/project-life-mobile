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
    const raw = localStorage.getItem(XP_KEY)
    if (!raw) return defaultXP()
    const parsed = { ...defaultXP(), ...JSON.parse(raw) }
    // Also check dashboard-bridge state — take whichever has more totalXP
    const bridgeRaw = localStorage.getItem('lifeos-sv4')
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
  localStorage.setItem(XP_KEY, JSON.stringify(store))
  // Notify other tabs / HTML pages instantly
  window.dispatchEvent(new StorageEvent('storage', {
    key: XP_KEY,
    newValue: JSON.stringify(store),
  }))
}

/** Award XP for a daily score. Idempotent per date — safe to call on every save. */
export function awardDailyXP(score: number, date: string): XPStore {
  const store = loadXP()

  // Only award once per day
  if (store.lastScoreDate === date) {
    // Recalculate in case score improved — never subtract
    const newXP = scoreToXP(score)
    // To handle same-day updates: store per-day XP awarded
    const perDayKey = `lifeos-xp-day-${date}`
    const prevAwarded = Number(localStorage.getItem(perDayKey) ?? '0')
    const diff = newXP - prevAwarded
    if (diff <= 0) return store
    localStorage.setItem(perDayKey, String(newXP))
    return applyXP(store, diff, date)
  }

  // New day
  const earned = scoreToXP(score)
  localStorage.setItem(`lifeos-xp-day-${date}`, String(earned))

  // Streak: consecutive days with score >= 50
  const yesterday = offsetDate(date, -1)
  const streak = store.lastScoreDate === yesterday && score >= 50
    ? store.streakDays + 1
    : score >= 50 ? 1 : 0

  const updated: XPStore = applyXP(
    { ...store, streakDays: streak },
    earned,
    date,
  )
  return updated
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
  const d = new Date(date + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}
