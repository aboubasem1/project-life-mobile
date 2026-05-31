/**
 * Weekly Challenges — auto-generated every Monday from a pool.
 * Key: lifeos-challenge-v1
 */

import type { DashboardEntry, HabitKey } from '../types/DashboardEntry'


export interface WeeklyChallenge {
  id: string
  icon: string
  title: string
  desc: string
  xpReward: number
  weekISO: string       // ISO week start date (Monday) YYYY-MM-DD
  completed: boolean
  completedAt?: string
}

interface ChallengeDef {
  id: string
  icon: string
  title: string
  makeDesc: () => string
  xpReward: number
  check: (entries: DashboardEntry[], weekStart: string) => boolean
}

const POOL: ChallengeDef[] = [
  {
    id: 'cold_week',
    icon: '🧊', title: 'Eiswoche',
    makeDesc: () => 'Jeden Tag diese Woche Cold Shower',
    xpReward: 400,
    check: (entries, ws) => getWeekEntries(entries, ws).filter(e => e.coldShower).length >= 7,
  },
  {
    id: 'score_70_week',
    icon: '🎯', title: 'Konsistent',
    makeDesc: () => 'Jeden Tag ≥70 Punkte diese Woche',
    xpReward: 500,
    check: (entries, ws) => getWeekEntries(entries, ws).every(e => (e.dailyScore ?? 0) >= 70),
  },
  {
    id: 'meditate_week',
    icon: '🧘', title: 'Woche der Stille',
    makeDesc: () => '7 Tage ≥10 min Meditation',
    xpReward: 350,
    check: (entries, ws) => getWeekEntries(entries, ws).filter(e => e.meditationMinutes >= 10).length >= 7,
  },
  {
    id: 'journal_week',
    icon: '✍️', title: 'Tagebuch-Woche',
    makeDesc: () => '7 Tage Journal schreiben',
    xpReward: 300,
    check: (entries, ws) => getWeekEntries(entries, ws).filter(e => e.journalDone).length >= 7,
  },
  {
    id: 'pushups_week',
    icon: '💪', title: 'Push-Woche',
    makeDesc: () => '7 Tage Pushups & Squats täglich',
    xpReward: 400,
    check: (entries, ws) => getWeekEntries(entries, ws).filter(e => e.pushupsDone && e.squatsDone).length >= 7,
  },
  {
    id: 'water_week',
    icon: '💧', title: 'Hydration Hero',
    makeDesc: () => '7 Tage ≥2.5L Wasser täglich',
    xpReward: 300,
    check: (entries, ws) => getWeekEntries(entries, ws).filter(e => e.waterLiters >= 2.5).length >= 7,
  },
  {
    id: 'protein_week',
    icon: '🥩', title: 'Protein-Woche',
    makeDesc: () => '7 Tage ≥150g Protein täglich',
    xpReward: 350,
    check: (entries, ws) => getWeekEntries(entries, ws).filter(e => e.proteinGrams >= 150).length >= 7,
  },
  {
    id: 'deepwork_week',
    icon: '🎧', title: 'Deep Work Woche',
    makeDesc: () => '7 Tage ≥2h Deep Work täglich',
    xpReward: 500,
    check: (entries, ws) => getWeekEntries(entries, ws).filter(e => e.deepWorkHours >= 2).length >= 7,
  },
  {
    id: 'family_week',
    icon: '❤️', title: 'Familienwoche',
    makeDesc: () => '7 Tage Familienzeit täglich',
    xpReward: 400,
    check: (entries, ws) => getWeekEntries(entries, ws).filter(e => e.familyTimeDone).length >= 7,
  },
  {
    id: 'allhabits_3',
    icon: '🌟', title: '3× Allround',
    makeDesc: () => '3 Tage alle 11 Habits in einer Woche',
    xpReward: 600,
    check: (entries, ws) => {
      const KEYS: HabitKey[] = ['coldShower','proteinShake','pushupsDone','squatsDone',
        'wallsitDone','plankDone','gratitudeDone','focusDone','winnerModeDone','journalDone','familyTimeDone']
      return getWeekEntries(entries, ws).filter(e => KEYS.every(k => e[k])).length >= 3
    },
  },
]

const STORE_KEY = 'lifeos-challenge-v1'

export function getCurrentWeekStart(): string {
  const d = new Date()
  const day = d.getDay() // 0=Sun
  const diff = (day === 0 ? -6 : 1 - day) // shift to Monday
  d.setDate(d.getDate() + diff)
  return d.toISOString().split('T')[0]
}

function getWeekEntries(entries: DashboardEntry[], weekStart: string): DashboardEntry[] {
  const start = new Date(weekStart + 'T00:00:00')
  const end = new Date(start)
  end.setDate(end.getDate() + 7)
  return entries.filter(e => {
    const d = new Date(e.date + 'T00:00:00')
    return d >= start && d < end
  })
}

export function loadChallenge(): WeeklyChallenge | null {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function saveChallenge(c: WeeklyChallenge): void {
  localStorage.setItem(STORE_KEY, JSON.stringify(c))
}

/** Returns current week's challenge, generating a new one if Monday changed */
export function getOrCreateChallenge(): WeeklyChallenge {
  const ws = getCurrentWeekStart()
  const existing = loadChallenge()
  if (existing && existing.weekISO === ws) return existing

  // Pick deterministically based on week number (not random — reproducible)
  const weekNum = Math.floor(new Date(ws).getTime() / (7 * 24 * 60 * 60 * 1000))
  const def = POOL[weekNum % POOL.length]
  const c: WeeklyChallenge = {
    id: def.id,
    icon: def.icon,
    title: def.title,
    desc: def.makeDesc(),
    xpReward: def.xpReward,
    weekISO: ws,
    completed: false,
  }
  saveChallenge(c)
  return c
}

/** Check if this week's challenge was completed, award XP if so */
export function checkAndCompleteChallenge(entries: DashboardEntry[]): boolean {
  const c = getOrCreateChallenge()
  if (c.completed) return false
  const def = POOL.find(d => d.id === c.id)
  if (!def) return false
  if (!def.check(entries, c.weekISO)) return false
  const updated: WeeklyChallenge = {
    ...c,
    completed: true,
    completedAt: new Date().toISOString().split('T')[0],
  }
  saveChallenge(updated)
  return true
}

/** Returns progress 0-7 for current week's challenge */
export function getChallengeProgress(entries: DashboardEntry[], challenge: WeeklyChallenge): number {
  const we = getWeekEntries(entries, challenge.weekISO)
  const def = POOL.find(d => d.id === challenge.id)
  if (!def) return 0
  // For most challenges: count qualifying days
  return Math.min(7, we.filter(e => {
    const KEYS: HabitKey[] = ['coldShower','proteinShake','pushupsDone','squatsDone',
      'wallsitDone','plankDone','gratitudeDone','focusDone','winnerModeDone','journalDone','familyTimeDone']
    if (challenge.id === 'cold_week')      return e.coldShower
    if (challenge.id === 'score_70_week')  return (e.dailyScore ?? 0) >= 70
    if (challenge.id === 'meditate_week')  return e.meditationMinutes >= 10
    if (challenge.id === 'journal_week')   return e.journalDone
    if (challenge.id === 'pushups_week')   return e.pushupsDone && e.squatsDone
    if (challenge.id === 'water_week')     return e.waterLiters >= 2.5
    if (challenge.id === 'protein_week')   return e.proteinGrams >= 150
    if (challenge.id === 'deepwork_week')  return e.deepWorkHours >= 2
    if (challenge.id === 'family_week')    return e.familyTimeDone
    if (challenge.id === 'allhabits_3')    return KEYS.every(k => e[k])
    return false
  }).length)
}
