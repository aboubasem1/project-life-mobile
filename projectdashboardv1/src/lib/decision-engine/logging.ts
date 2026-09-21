import { redactForLog } from './schemas.js'

function isDev(): boolean {
  const meta = (import.meta as { env?: { DEV?: boolean; MODE?: string } }).env
  if (meta?.DEV) return true
  const nodeEnv = (globalThis as { process?: { env?: { NODE_ENV?: string } } }).process?.env?.NODE_ENV
  return nodeEnv !== 'production'
}

export function logDecisionObservation(event: string, payload: Record<string, unknown>): void {
  if (!isDev()) return
  console.info(`[decision-engine] ${event}`, redactForLog(payload))
}
