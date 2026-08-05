import type { DashboardEntry } from '../types/DashboardEntry'
import type { EnergyLevel } from './dayPolicy'
import { sleepHoursForEntry } from './healthMetrics'

/** Local recovery / readiness score from sleep + energy (Oura-inspired, no wearables). */

export type RecoveryResult = {
  score: number // 0–100
  label: string
  suggestSoftMode: boolean
  note: string
}

const SLEEP_QUALITY_POINTS: Record<string, number> = {
  Schlecht: 15,
  Okay: 35,
  Gut: 55,
  'Sehr gut': 70,
}

const ENERGY_POINTS: Record<EnergyLevel, number> = {
  low: 15,
  okay: 40,
  high: 55,
}

export function calculateRecovery(input: {
  entry: DashboardEntry
  energy?: EnergyLevel
}): RecoveryResult {
  const quality = SLEEP_QUALITY_POINTS[input.entry.sleepQuality] ?? 25
  const hours = sleepHoursForEntry(input.entry)
  let durationPoints = 25
  if (hours !== null) {
    if (hours < 5.5) durationPoints = 10
    else if (hours < 6.5) durationPoints = 25
    else if (hours < 8.5) durationPoints = 45
    else durationPoints = 35 // slightly oversleeping
  }

  const energyPoints = input.energy ? ENERGY_POINTS[input.energy] : 20
  const moodBonus = input.entry.mood === 'Sehr gut' || input.entry.mood === 'Gut' ? 5 : 0

  const score = Math.min(100, Math.round(quality * 0.4 + durationPoints * 0.35 + energyPoints * 0.25 + moodBonus))
  const suggestSoftMode = score < 45 || (hours !== null && hours < 6.5) || input.energy === 'low'

  let label = 'Solide'
  if (score >= 75) label = 'Erholt'
  else if (score >= 55) label = 'Okay'
  else if (score >= 35) label = 'Angeknackst'
  else label = 'Erholung zuerst'

  let note = 'Kapazität wirkt ausgewogen.'
  if (suggestSoftMode) {
    note = hours !== null && hours < 6.5
      ? 'Kurze Nacht — Soft-Mode lohnt sich.'
      : input.energy === 'low'
        ? 'Energie niedrig — heute klein halten.'
        : 'Recovery schwach — weniger ist mehr.'
  } else if (score >= 75) {
    note = 'Gute Basis für tieferen Fokus.'
  }

  return { score, label, suggestSoftMode, note }
}
