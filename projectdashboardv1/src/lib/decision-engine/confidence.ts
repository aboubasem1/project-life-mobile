import type { ConfidenceBand } from './types.js'

export type ConfidenceThresholds = {
  high: number
  medium: number
}

export const DEFAULT_CONFIDENCE_THRESHOLDS: ConfidenceThresholds = {
  high: 0.9,
  medium: 0.7,
}

let thresholds: ConfidenceThresholds = { ...DEFAULT_CONFIDENCE_THRESHOLDS }

export function configureConfidenceThresholds(next: Partial<ConfidenceThresholds>): ConfidenceThresholds {
  thresholds = {
    high: clampUnit(next.high ?? thresholds.high),
    medium: clampUnit(next.medium ?? thresholds.medium),
  }
  if (thresholds.medium > thresholds.high) thresholds.medium = thresholds.high
  return { ...thresholds }
}

export function resetConfidenceThresholds(): ConfidenceThresholds {
  thresholds = { ...DEFAULT_CONFIDENCE_THRESHOLDS }
  return { ...thresholds }
}

export function getConfidenceThresholds(): ConfidenceThresholds {
  return { ...thresholds }
}

export function confidenceBand(value: number, config = thresholds): ConfidenceBand {
  if (value >= config.high) return 'high'
  if (value >= config.medium) return 'medium'
  return 'low'
}

export function meetsConfidence(value: number, minimum: ConfidenceBand, config = thresholds): boolean {
  const band = confidenceBand(value, config)
  if (minimum === 'low') return true
  if (minimum === 'medium') return band === 'medium' || band === 'high'
  return band === 'high'
}

function clampUnit(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(1, value))
}
