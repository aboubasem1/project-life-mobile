import type { DecisionIntent } from '../types.js'

export function captureFallbackIntent(): DecisionIntent {
  return 'REVIEW'
}
