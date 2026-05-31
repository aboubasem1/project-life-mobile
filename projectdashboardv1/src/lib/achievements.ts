/**
 * Achievements — earned once, stored in localStorage.
 * Key: lifeos-achievements-v1
 * Uses existing calculateStreakForHabit + completion data.
 */

import type { DashboardEntry, HabitKey } from '../types/DashboardEntry'
import { calculateStreakForHabit, calculateCompletionRate, calculateScore } from './score'

export interface Achievement {
  id: string
  icon: string
  title: string
  desc: string
  xpReward: number
  unlockedAt?: string // ISO date
}

// ─── Achievement definitions ─────────────────────────────────────────────────
export const ACHIEVEMENT_DEFS: Omit<Achievement, 'unlockedAt'>[] = [
  // Streaks per habit
  { id: 'cold_3',    icon: '🧊', title: 'Ice Ice Baby',      desc: '3 Tage Cold Shower am Stück',    xpReward: 100 },
  { id: 'cold_7',    icon: '❄️', title: 'Frostbite',         desc: '7 Tage Cold Shower am Stück',    xpReward: 250 },
  { id: 'cold_30',   icon: '🌊', title: 'Wim Hof Modus',     desc: '30 Tage Cold Shower am Stück',   xpReward: 1000 },
  { id: 'push_7',    icon: '💪', title: 'Durchgehend',        desc: '7 Tage Pushups am Stück',        xpReward: 250 },
  { id: 'push_30',   icon: '🦾', title: 'Eiserne Disziplin',  desc: '30 Tage Pushups am Stück',       xpReward: 1000 },
  { id: 'meditate_7',icon: '🧘', title: 'Stille Woche',       desc: '7 Tage Meditation am Stück',     xpReward: 250 },
  { id: 'journal_7', icon: '📖', title: 'Chronist',           desc: '7 Tage Journal am Stück',        xpReward: 250 },
  { id: 'journal_30',icon: '✍️', title: 'Lebenschronist',     desc: '30 Tage Journal am Stück',       xpReward: 1000 },
  { id: 'family_7',  icon: '❤️', title: 'Familienheld',       desc: '7 Tage Familienzeit am Stück',   xpReward: 300 },
  // Score milestones
  { id: 'score_50',  icon: '⚡', title: 'Erster Halber',      desc: 'Score ≥50 an einem Tag',         xpReward: 50 },
  { id: 'score_75',  icon: '🔥', title: 'Stark',              desc: 'Score ≥75 an einem Tag',         xpReward: 150 },
  { id: 'score_90',  icon: '👑', title: 'Elite',              desc: 'Score ≥90 an einem Tag',         xpReward: 300 },
  { id: 'score_100', icon: '💎', title: 'Perfekter Tag',      desc: 'Score 100 — absolutes Maximum',  xpReward: 500 },
  // Volume / entries
  { id: 'days_7',    icon: '📅', title: 'Eine Woche',         desc: '7 Tage erfasst (gesamt)',        xpReward: 100 },
  { id: 'days_30',   icon: '🗓️', title: 'Ein Monat',          desc: '30 Tage erfasst (gesamt)',       xpReward: 300 },
  { id: 'days_100',  icon: '💯', title: '100 Tage',           desc: '100 Tage erfasst (gesamt)',      xpReward: 1000 },
  // Completion rates
  { id: 'rate_80',   icon: '📈', title: 'Konstant',           desc: '30 Tage Ø ≥80% Habit-Rate',     xpReward: 500 },
  // All habits in one day
  { id: 'all_habits',icon: '🌟', title: 'Allround-Champion',  desc: 'Alle 11 Habits an einem Tag',    xpReward: 300 },
]

const STORE_KEY = 'lifeos-achievements-v1'

export function loadAchievements(): Achievement[] {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (!raw) return []
    return JSON.parse(raw)
  } catch { return [] }
}

function saveAchievements(list: Achievement[]): void {
  localStorage.setItem(STORE_KEY, JSON.stringify(list))
}

/** Check all entries, return newly unlocked achievements (not previously stored) */
export function checkAchievements(entries: DashboardEntry[]): Achievement[] {
  const existing = loadAchievements()
  const existingIds = new Set(existing.map(a => a.id))
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date))
  const today = new Date().toISOString().split('T')[0]
  const newOnes: Achievement[] = []

  const unlock = (id: string) => {
    if (existingIds.has(id)) return
    const def = ACHIEVEMENT_DEFS.find(d => d.id === id)
    if (!def) return
    const a: Achievement = { ...def, unlockedAt: today }
    newOnes.push(a)
    existingIds.add(id)
  }

  // Streak checks
  const streakChecks: [HabitKey, string, number][] = [
    ['coldShower',    'cold_3',     3],
    ['coldShower',    'cold_7',     7],
    ['coldShower',    'cold_30',   30],
    ['pushupsDone',   'push_7',     7],
    ['pushupsDone',   'push_30',   30],
    ['gratitudeDone', 'meditate_7', 7],
    ['journalDone',   'journal_7',  7],
    ['journalDone',   'journal_30',30],
    ['familyTimeDone','family_7',   7],
  ]
  for (const [key, id, threshold] of streakChecks) {
    if (calculateStreakForHabit(sorted, key) >= threshold) unlock(id)
  }

  // Score milestones
  for (const e of sorted) {
    const s = e.dailyScore ?? calculateScore(e)
    if (s >= 50)  unlock('score_50')
    if (s >= 75)  unlock('score_75')
    if (s >= 90)  unlock('score_90')
    if (s >= 100) unlock('score_100')
  }

  // All habits in one day
  const HABIT_KEYS: HabitKey[] = ['coldShower','proteinShake','pushupsDone','squatsDone',
    'wallsitDone','plankDone','gratitudeDone','focusDone','winnerModeDone','journalDone','familyTimeDone']
  for (const e of sorted) {
    if (HABIT_KEYS.every(k => e[k])) { unlock('all_habits'); break }
  }

  // Days tracked
  if (sorted.length >= 7)   unlock('days_7')
  if (sorted.length >= 30)  unlock('days_30')
  if (sorted.length >= 100) unlock('days_100')

  // Consistency rate — avg across all habits last 30 days ≥ 80%
  const allRates = HABIT_KEYS.map(k => calculateCompletionRate(sorted, k, 30))
  const avgRate = allRates.reduce((s, v) => s + v, 0) / allRates.length
  if (avgRate >= 80) unlock('rate_80')

  if (newOnes.length > 0) {
    saveAchievements([...existing, ...newOnes])
  }
  return newOnes
}
