import { calculateScore, type ScoreGoals } from '../projectdashboardv1/src/lib/score.js'
import type { DashboardEntry } from '../projectdashboardv1/src/types/DashboardEntry.js'

type LooseEntry = Record<string, unknown> & { date: string }

function scoreGoalsFromSettings(raw: unknown): ScoreGoals {
  if (!raw || typeof raw !== 'object') return {}
  const settings = raw as { proteinGoal?: unknown; activeHabits?: unknown }
  const proteinGoal = Number(settings.proteinGoal)
  return {
    proteinGoal: Number.isFinite(proteinGoal) && proteinGoal > 0 ? proteinGoal : undefined,
    activeHabits: Array.isArray(settings.activeHabits)
      ? settings.activeHabits.map(String)
      : undefined,
  }
}

export function scoreInboundEntry(entry: LooseEntry, settings: unknown): LooseEntry {
  return {
    ...entry,
    dailyScore: calculateScore(entry as unknown as DashboardEntry, scoreGoalsFromSettings(settings)),
  }
}
