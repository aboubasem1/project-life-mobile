import type { DashboardEntry, HabitKey } from '../types/DashboardEntry'

export type ScoreGoals = {
  proteinGoal?: number
  /** When set, only these habit keys count toward the score. */
  activeHabits?: string[]
}

const SETTINGS_KEY = 'life-os-v1-settings'

export function readScoreGoals(): ScoreGoals {
  try {
    const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') as {
      proteinGoal?: number
      activeHabits?: string[]
    }
    const proteinGoal = Number(raw.proteinGoal)
    return {
      proteinGoal: Number.isFinite(proteinGoal) && proteinGoal > 0 ? proteinGoal : 150,
      activeHabits: Array.isArray(raw.activeHabits) ? raw.activeHabits.map(String) : undefined,
    }
  } catch {
    return { proteinGoal: 150 }
  }
}

// Habits — breathing included so the hero ritual actually counts
const HABIT_SCORES: { key: keyof DashboardEntry; points: number; label: string }[] = [
  { key: 'breathingDone',  points: 8, label: 'Atmung'         },
  { key: 'coldShower',     points: 8, label: 'Cold Shower'    },
  { key: 'proteinShake',   points: 5, label: 'Protein Shake'  },
  { key: 'pushupsDone',    points: 8, label: 'Pushups'        },
  { key: 'squatsDone',     points: 8, label: 'Squats'         },
  { key: 'wallsitDone',    points: 5, label: 'Wallsit'        },
  { key: 'plankDone',      points: 5, label: 'Plank'          },
  { key: 'gratitudeDone',  points: 8, label: 'Dankbarkeit'    },
  { key: 'focusDone',      points: 8, label: 'Deep Focus'     },
  { key: 'winnerModeDone', points: 8, label: 'Winner Mode'    },
  { key: 'journalDone',    points: 8, label: 'Journal'        },
  { key: 'familyTimeDone', points: 5, label: 'Familienzeit'   },
]

function isHabitActive(key: string, activeHabits?: string[]): boolean {
  if (!activeHabits || activeHabits.length === 0) return true
  return activeHabits.includes(key)
}

function activeHabitScores(goals: ScoreGoals) {
  return HABIT_SCORES.filter(habit => isHabitActive(String(habit.key), goals.activeHabits))
}

function numericScores(goals: ScoreGoals) {
  const proteinGoal = goals.proteinGoal ?? 150
  return [
    { key: 'meditationMinutes' as const, threshold: 10, points: 5, label: 'Meditation ≥10 min' },
    { key: 'proteinGrams' as const, threshold: proteinGoal, points: 5, label: `Protein ≥${proteinGoal} g` },
    { key: 'waterLiters' as const, threshold: 2.5, points: 5, label: 'Wasser ≥2.5 L' },
    { key: 'deepWorkHours' as const, threshold: 2, points: 5, label: 'Deep Work ≥2 h' },
    { key: 'tasksDone' as const, threshold: 3, points: 4, label: 'Tasks ≥3' },
  ]
}

// Flat mood points: honest check-in shouldn't be punished
const MOOD_LOG_POINTS = 3

const SLEEP_SCORES: Record<string, number> = {
  Schlecht: 0,
  Okay: 1,
  Gut: 3,
  'Sehr gut': 5,
}

export function calculateScore(entry: DashboardEntry, goals: ScoreGoals = readScoreGoals()): number {
  let score = 0
  for (const habit of activeHabitScores(goals)) {
    if (entry[habit.key]) score += habit.points
  }
  for (const numeric of numericScores(goals)) {
    if ((entry[numeric.key] as number) >= numeric.threshold) score += numeric.points
  }
  if (entry.mood) score += MOOD_LOG_POINTS
  score += SLEEP_SCORES[entry.sleepQuality] ?? 0
  return Math.min(100, score)
}

export interface ScoreBreakdown {
  category: string
  achieved: number
  max: number
  items: { label: string; achieved: boolean; points: number; earned: number }[]
}

export function getScoreBreakdown(
  entry: DashboardEntry,
  goals: ScoreGoals = readScoreGoals(),
): ScoreBreakdown[] {
  const habits = activeHabitScores(goals)
  const numerics = numericScores(goals)

  const section = (
    label: string,
    habitKeys: (keyof DashboardEntry)[],
    numericKeys: (keyof DashboardEntry)[] = [],
    extraItems: { label: string; achieved: boolean; points: number; earned: number }[] = [],
  ): ScoreBreakdown => {
    const items = [
      ...habits.filter(habit => habitKeys.includes(habit.key)).map(habit => ({
        label: habit.label,
        achieved: !!entry[habit.key],
        points: habit.points,
        earned: entry[habit.key] ? habit.points : 0,
      })),
      ...numerics.filter(numeric => numericKeys.includes(numeric.key)).map(numeric => {
        const achieved = (entry[numeric.key] as number) >= numeric.threshold
        return {
          label: numeric.label,
          achieved,
          points: numeric.points,
          earned: achieved ? numeric.points : 0,
        }
      }),
      ...extraItems,
    ]
    return {
      category: label,
      achieved: items.reduce((sum, item) => sum + item.earned, 0),
      max: items.reduce((sum, item) => sum + item.points, 0),
      items,
    }
  }

  return [
    section('Morgen', ['breathingDone', 'coldShower', 'proteinShake'], ['meditationMinutes'], [
      {
        label: entry.mood ? `Stimmung: ${entry.mood}` : 'Stimmung: —',
        achieved: Boolean(entry.mood),
        points: MOOD_LOG_POINTS,
        earned: entry.mood ? MOOD_LOG_POINTS : 0,
      },
      {
        label: `Schlafqualität: ${entry.sleepQuality || '—'}`,
        achieved: Boolean(entry.sleepQuality),
        points: 5,
        earned: SLEEP_SCORES[entry.sleepQuality] ?? 0,
      },
    ]),
    section('Training', ['pushupsDone', 'squatsDone', 'wallsitDone', 'plankDone']),
    section('Mindset', ['gratitudeDone', 'focusDone', 'winnerModeDone']),
    section('Abend', ['journalDone', 'familyTimeDone'], ['proteinGrams', 'waterLiters', 'deepWorkHours', 'tasksDone']),
  ]
}

export function getScoreLabel(score: number): string {
  if (score >= 90) return 'ELITE'
  if (score >= 75) return 'STARK'
  if (score >= 55) return 'SOLIDE'
  if (score >= 35) return 'AUSBAUFÄHIG'
  return 'ANLAUF'
}

export function getScoreColor(score: number): string {
  if (score >= 90) return '#ffd60a'
  if (score >= 75) return '#34c759'
  if (score >= 55) return '#4facfe'
  if (score >= 35) return '#ff9500'
  return '#ff3b30'
}

export function calculateStreakForHabit(entries: DashboardEntry[], key: HabitKey): number {
  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date))
  let streak = 0
  for (const entry of sorted) {
    if (entry[key]) streak++
    else break
  }
  return streak
}

export function calculateCompletionRate(
  entries: DashboardEntry[],
  key: HabitKey,
  days = 30,
): number {
  const sorted = [...entries]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, days)
  if (sorted.length === 0) return 0
  return Math.round((sorted.filter(entry => entry[key]).length / sorted.length) * 100)
}
