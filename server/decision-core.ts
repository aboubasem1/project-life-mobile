import { decide, type DecideOptions } from '../projectdashboardv1/src/lib/decision-engine/engine.js'
import { resolveDecisionFlags } from '../projectdashboardv1/src/lib/decision-engine/flags.js'
import { parseLifeOSInput } from '../projectdashboardv1/src/lib/decision-engine/schemas.js'
import type { DecisionBatch, DecisionContext } from '../projectdashboardv1/src/lib/decision-engine/types.js'

export type DecisionRequestBody = {
  input?: unknown
  content?: unknown
  source?: unknown
  context?: DecisionContext
  flags?: DecideOptions['flags']
}

/** Structured decisions only. Never writes rooms, entries, or notifications. */
export async function runDecisionRequest(body: DecisionRequestBody): Promise<DecisionBatch> {
  const flags = resolveDecisionFlags(body.flags ?? {})
  const parsed = parseLifeOSInput(body.input ?? { content: body.content, source: body.source }, `in_${Date.now().toString(36)}`, new Date().toISOString())
  return decide(parsed ?? { content: typeof body.content === 'string' ? body.content : '' }, {
    flags,
    context: body.context,
  })
}
