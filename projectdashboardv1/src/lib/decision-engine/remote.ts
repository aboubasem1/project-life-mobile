import { resolveDecisionFlags, type DecisionFlags } from './flags.js'
import { runLocalCaptureDecision, type DecideOptions } from './engine.js'
import type { DecisionBatch, DecisionContext, LifeOSInputSource } from './types.js'

export type RemoteDecisionBody = {
  content: string
  source?: LifeOSInputSource
  context?: DecisionContext
  flags?: Partial<DecisionFlags>
}

function parseRemoteBatch(payload: unknown): DecisionBatch | null {
  if (!payload || typeof payload !== 'object') return null
  const root = payload as { batch?: DecisionBatch }
  const batch = root.batch
  if (!batch || typeof batch !== 'object' || !Array.isArray(batch.decisions)) return null
  return batch
}

/** Server JEV path. Never throws — callers keep the local rules fallback. */
export async function requestRemoteDecision(body: RemoteDecisionBody): Promise<DecisionBatch | null> {
  try {
    const response = await fetch('/api/decision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!response.ok) return null
    return parseRemoteBatch(await response.json())
  } catch {
    return null
  }
}

/** UI-safe capture decide: remote JEV when flagged, otherwise local rules. */
export async function decideCaptureInput(
  raw: unknown,
  options: Omit<DecideOptions, 'providers'> = {},
): Promise<DecisionBatch> {
  const flags = resolveDecisionFlags(options.flags ?? {})
  const content = typeof raw === 'object' && raw && 'content' in raw
    ? String((raw as { content?: unknown }).content ?? '')
    : typeof raw === 'string' ? raw : ''
  const source = typeof raw === 'object' && raw && 'source' in raw
    ? (raw as { source?: LifeOSInputSource }).source
    : 'quick_add'
  if (flags.jevEnabled && content.trim()) {
    const remote = await requestRemoteDecision({
      content,
      source,
      context: options.context,
      flags,
    })
    if (remote) return remote
  }
  return runLocalCaptureDecision(raw, { ...options, flags })
}
