import type { DashboardEntry, HabitKey } from '../types/DashboardEntry'

// ─── Score weights ────────────────────────────────────────────────────────────
// Habits (76 pts total)
const HABIT_SCORES: { key: keyof DashboardEntry; points: number; label: string }[] = [
  { key: 'coldShower',     points: 8,  label: 'Cold Shower'    },
  { key: 'proteinShake',   points: 5,  label: 'Protein Shake'  },
  { key: 'pushupsDone',    points: 8,  label: 'Pushups'        },
  { key: 'squatsDone',     points: 8,  label: 'Squats'         },
  { key: 'wallsitDone',    points: 5,  label: 'Wallsit'        },
  { key: 'plankDone',      points: 5,  label: 'Plank'          },
  { key: 'gratitudeDone',  points: 8,  label: 'Dankbarkeit'    },
  { key: 'focusDone',      points: 8,  label: 'Deep Focus'     },
  { key: 'winnerModeDone', points: 8,  label: 'Winner Mode'    },
  { key: 'journalDone',    points: 8,  label: 'Journal'        },
  { key: 'familyTimeDone', points: 5,  label: 'Familienzeit'   },
]

// Numeric thresholds (24 pts total)
const NUMERIC_SCORES: { key: keyof DashboardEntry; threshold: number; points: number; label: string }[] = [
  { key: 'meditationMinutes', threshold: 10,  points: 5, label: 'Meditation ≥10 min' },
  { key: 'proteinGrams',      threshold: 150, points: 5, label: 'Protein ≥150 g'     },
  { key: 'waterLiters',       threshold: 2.5, points: 5, label: 'Wasser ≥2.5 L'      },
  { key: 'deepWorkHours',     threshold: 2,   points: 5, label: 'Deep Work ≥2 h'     },
  { key: 'tasksDone',         threshold: 3,   points: 4, label: 'Tasks ≥3'           },
]

// Mood bonus (5 pts max) — aligned with the UI options
const MOOD_SCORES: Record<string, number> = {
  Ruhig: 5,
  Gut: 3,
  Neutral: 1,
  Müde: 0,
  Gestresst: 0,
}

// Sleep quality bonus (5 pts max) — aligned with the UI options
const SLEEP_SCORES: Record<string, number> = {
  Schlecht: 0,
  Okay: 1,
  Gut: 3,
  'Sehr gut': 5,
}

// ─── Score calc ───────────────────────────────────────────────────────────────
export function calculateScore(entry: DashboardEntry): number {
  let score = 0
  for (const h of HABIT_SCORES) {
    if (entry[h.key]) score += h.points
  }
  for (const n of NUMERIC_SCORES) {
    if ((entry[n.key] as number) >= n.threshold) score += n.points
  }
  score += MOOD_SCORES[entry.mood]          ?? 0
  score += SLEEP_SCORES[entry.sleepQuality] ?? 0
  return Math.min(100, score)
}

export interface ScoreBreakdown {
  category: string
  achieved: number
  max: number
  items: { label: string; achieved: boolean; points: number; earned: number }[]
}

export function getScoreBreakdown(entry: DashboardEntry): ScoreBreakdown[] {
  const section = (
    label: string,
    habitKeys: (keyof DashboardEntry)[],
    numericKeys: (keyof DashboardEntry)[] = [],
    extraItems: { label: string; achieved: boolean; points: number; earned: number }[] = [],
  ): ScoreBreakdown => {
    const items = [
      ...HABIT_SCORES.filter(h => habitKeys.includes(h.key)).map(h => ({
        label: h.label,
        achieved: !!entry[h.key],
        points: h.points,
        earned: entry[h.key] ? h.points : 0,
      })),
      ...NUMERIC_SCORES.filter(n => numericKeys.includes(n.key)).map(n => {
        const achieved = (entry[n.key] as number) >= n.threshold
        return { label: n.label, achieved, points: n.points, earned: achieved ? n.points : 0 }
      }),
      ...extraItems,
    ]
    return {
      category: label,
      achieved: items.reduce((s, i) => s + i.earned, 0),
      max: items.reduce((s, i) => s + i.points, 0),
      items,
    }
  }

  return [
    // Mood/sleep award partial credit (e.g. "Gut" = 3 of 5), so their max stays
    // the fixed ceiling while `earned` reflects the actual points scored —
    // otherwise the category max would shrink to whatever mood happens to be
    // selected and make 100% trivially reachable on a bad day.
    section('Morgen', ['coldShower', 'proteinShake'], ['meditationMinutes'], [
      { label: `Stimmung: ${entry.mood || '—'}`, achieved: Boolean(entry.mood), points: 5, earned: MOOD_SCORES[entry.mood] ?? 0 },
      { label: `Schlafqualität: ${entry.sleepQuality || '—'}`, achieved: Boolean(entry.sleepQuality), points: 5, earned: SLEEP_SCORES[entry.sleepQuality] ?? 0 },
    ]),
    section('Training', ['pushupsDone', 'squatsDone', 'wallsitDone', 'plankDone']),
    section('Mindset', ['gratitudeDone', 'focusDone', 'winnerModeDone']),
    section('Abend', ['journalDone', 'familyTimeDone'], ['proteinGrams', 'waterLiters', 'deepWorkHours', 'tasksDone']),
  ]
}

export function getScoreColor(score: number): string {
  if (score >= 90) return '#ffd60a'
  if (score >= 75) return '#34c759'
  if (score >= 55) return '#4facfe'
  if (score >= 35) return '#ff9500'
  return '#ff3b30'
}

// ─── Streak / completion helpers ──────────────────────────────────────────────
export function calculateStreakForHabit(entries: DashboardEntry[], key: HabitKey): number {
  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date))
  let streak = 0
  for (const e of sorted) {
    if (e[key]) streak++
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
  return Math.round((sorted.filter(e => e[key]).length / sorted.length) * 100)
}
