import { contentPreview } from './schemas.js'
import type { Decision, DecisionAudit, LifeOSInput, ProposedAction } from './types.js'

const MAX_AUDITS = 200

export function buildAudit(input: LifeOSInput, decision: Decision, extras?: {
  executedAction?: Decision['intent']
  error?: string
  undoReference?: string
  latencyMs?: number
}): DecisionAudit {
  return {
    decisionId: decision.decisionId,
    inputId: input.id,
    source: input.source,
    contentPreview: contentPreview(decision.content || input.content),
    provider: decision.provider,
    domain: decision.domain,
    intent: decision.intent,
    confidence: decision.confidence,
    policyResult: decision.policyResult,
    proposedAction: decision.suggestedAction,
    executedAction: extras?.executedAction,
    timestamp: decision.timestamp,
    error: extras?.error,
    undoReference: extras?.undoReference,
    latencyMs: extras?.latencyMs,
  }
}

export function markExecuted(audit: DecisionAudit, action: ProposedAction, undoReference?: string): DecisionAudit {
  return {
    ...audit,
    executedAction: action.intent,
    undoReference,
  }
}

export function capAudits(audits: DecisionAudit[]): DecisionAudit[] {
  return audits.slice(-MAX_AUDITS)
}
