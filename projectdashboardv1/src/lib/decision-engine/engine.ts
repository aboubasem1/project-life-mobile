import { createId, nowIso } from '../lifeos/store.js'
import { buildAudit } from './audit.js'
import { confidenceBand } from './confidence.js'
import { DEFAULT_DECISION_FLAGS, resolveDecisionFlags, type DecisionFlags } from './flags.js'
import { actionKey } from './idempotency.js'
import { logDecisionObservation } from './logging.js'
import { isBlankInput, normalizeText, toLifeOSInput } from './normalize.js'
import { evaluatePolicy } from './policies.js'
import { createJevProvider, failureReason, type JevFailure } from './providers/jev.js'
import { createLlmProvider } from './providers/llm.js'
import { classifyWithRules, rulesProvider } from './providers/rules.js'
import { parseProviderDecision } from './schemas.js'
import { splitIntents } from './split.js'
import type {
  Decision,
  DecisionBatch,
  DecisionContext,
  DecisionProvider,
  DecisionProviderAdapter,
  LifeOSInput,
  NormalizedItem,
  ProposedAction,
  ProviderDecision,
  ReasonCode,
} from './types.js'

export type DecideOptions = {
  flags?: Partial<DecisionFlags>
  context?: DecisionContext
  providers?: {
    rules?: DecisionProviderAdapter
    jev?: DecisionProviderAdapter
    llm?: DecisionProviderAdapter
  }
  now?: Date
}

function unknownDecision(content: string, reason: ReasonCode, confidence = 0): ProviderDecision {
  return {
    content,
    domain: 'UNKNOWN',
    intent: 'UNKNOWN',
    confidence,
    entities: {},
    suggestedAction: 'REVIEW',
    reasonCode: reason,
  }
}

function blankReason(content: string): ReasonCode {
  return normalizeText(content) === '' ? 'EMPTY_INPUT' : 'UNKNOWN_INTENT'
}

function isComplex(item: NormalizedItem, candidate: ProviderDecision): boolean {
  if (candidate.confidence < 0.7) return true
  if (candidate.domain === 'UNKNOWN') return true
  return item.content.length > 160
}

async function resolveCandidate(input: {
  item: NormalizedItem
  lifeInput: LifeOSInput
  context: DecisionContext
  flags: DecisionFlags
  providers: {
    rules: DecisionProviderAdapter
    jev?: DecisionProviderAdapter
    llm?: DecisionProviderAdapter
  }
}): Promise<{ candidate: ProviderDecision; provider: DecisionProvider; error?: string }> {
  const rulesRaw = await input.providers.rules.decide({
    item: input.item,
    input: input.lifeInput,
    context: input.context,
  })
  const rules = rulesRaw ?? unknownDecision(input.item.content, 'UNKNOWN_INTENT', 0.2)

  if (rules.confidence >= 0.9 && rules.reasonCode === 'OK') {
    return { candidate: rules, provider: 'rules' }
  }

  if (input.flags.jevEnabled && input.providers.jev) {
    try {
      const jev = await input.providers.jev.decide({
        item: input.item,
        input: input.lifeInput,
        context: input.context,
      })
      if (jev && parseProviderDecision(jev, input.item.content)) {
        return { candidate: jev, provider: 'jev' }
      }
      const failure = (input.providers.jev as { lastFailure?: JevFailure }).lastFailure
      if (!input.flags.llmFallbackEnabled || !input.providers.llm || !isComplex(input.item, rules)) {
        return {
          candidate: rules.confidence > 0.4 ? rules : unknownDecision(input.item.content, failureReason(failure), rules.confidence),
          provider: rules.confidence > 0.4 ? 'rules' : 'fallback',
          error: failureReason(failure),
        }
      }
    } catch (error) {
      if (!input.flags.llmFallbackEnabled || !input.providers.llm) {
        return {
          candidate: rules,
          provider: 'rules',
          error: error instanceof Error ? error.message : 'JEV_UNAVAILABLE',
        }
      }
    }
  }

  if (input.flags.llmFallbackEnabled && input.providers.llm && isComplex(input.item, rules)) {
    try {
      const llm = await input.providers.llm.decide({
        item: input.item,
        input: input.lifeInput,
        context: input.context,
      })
      if (llm && parseProviderDecision(llm, input.item.content)) {
        return { candidate: llm, provider: 'llm' }
      }
    } catch {
      return { candidate: rules, provider: 'rules', error: 'LLM_UNAVAILABLE' }
    }
    return { candidate: rules, provider: 'rules', error: 'LLM_UNAVAILABLE' }
  }

  return { candidate: rules, provider: 'rules' }
}

function toDecision(
  input: LifeOSInput,
  item: NormalizedItem,
  candidate: ProviderDecision,
  provider: DecisionProvider,
  flags: DecisionFlags,
  context: DecisionContext,
): { decision: Decision; action: ProposedAction } {
  const policy = evaluatePolicy({ candidate, context, flags })
  const timestamp = nowIso()
  const decisionId = createId()
  const decision: Decision = {
    decisionId,
    inputId: input.id,
    itemIndex: item.index,
    content: candidate.content || item.content,
    domain: candidate.domain,
    intent: policy.intent,
    confidence: candidate.confidence,
    confidenceBand: confidenceBand(candidate.confidence),
    entities: policy.entities ?? {},
    suggestedAction: candidate.suggestedAction ?? policy.intent,
    actionLevel: policy.actionLevel,
    provider,
    requiresConfirmation: policy.requiresConfirmation,
    reasonCode: policy.reasons[0] ?? candidate.reasonCode ?? 'OK',
    timestamp,
    policyResult: policy.result,
    policyReasons: policy.reasons,
  }
  const action: ProposedAction = {
    actionId: actionKey([
      input.id,
      item.index,
      decision.intent,
      decision.domain,
      decision.content,
      decision.entities.mealId,
      decision.entities.title,
    ]),
    decisionId,
    intent: decision.intent,
    domain: decision.domain,
    actionLevel: decision.actionLevel,
    policyResult: decision.policyResult,
    content: decision.content,
    entities: decision.entities,
    requiresConfirmation: decision.requiresConfirmation,
    reversible: decision.actionLevel === 'REVERSIBLE_AUTO',
    undoHint: decision.actionLevel === 'REVERSIBLE_AUTO' ? decision.intent : undefined,
  }
  return { decision, action }
}

function fallbackInput(now: Date): LifeOSInput {
  return {
    id: `in_${Date.now().toString(36)}`,
    source: 'quick_add',
    content: '',
    timestamp: now.toISOString(),
  }
}

function assembleBatch(input: {
  batchId: string
  lifeInput: LifeOSInput
  items: NormalizedItem[]
  resolved: Array<{ candidate: ProviderDecision; provider: DecisionProvider; error?: string }>
  flags: DecisionFlags
  context: DecisionContext
  started: number
}): DecisionBatch {
  const decisions: Decision[] = []
  const proposedActions: ProposedAction[] = []
  const audits = []
  let dominant: DecisionProvider = 'rules'

  for (const [index, item] of input.items.entries()) {
    const current = input.resolved[index] ?? {
      candidate: unknownDecision(item.content, 'UNKNOWN_INTENT'),
      provider: 'fallback' as const,
    }
    const built = toDecision(input.lifeInput, item, current.candidate, current.provider, input.flags, input.context)
    decisions.push(built.decision)
    proposedActions.push(built.action)
    audits.push(buildAudit(input.lifeInput, built.decision, {
      error: current.error,
      latencyMs: Date.now() - input.started,
    }))
    if (current.provider !== 'rules') dominant = current.provider
  }

  const latencyMs = Date.now() - input.started
  logDecisionObservation('batch', {
    provider: dominant,
    latencyMs,
    count: decisions.length,
    intents: decisions.map(item => item.intent),
    domains: decisions.map(item => item.domain),
    confidence: decisions.map(item => item.confidence),
    policyResult: decisions.map(item => item.policyResult),
  })

  return {
    batchId: input.batchId,
    input: input.lifeInput,
    items: input.items,
    decisions,
    proposedActions,
    audits,
    latencyMs,
    provider: dominant,
  }
}

export async function decide(raw: unknown, options: DecideOptions = {}): Promise<DecisionBatch> {
  const started = Date.now()
  const flags = resolveDecisionFlags(options.flags ?? {})
  const now = options.now ?? new Date()
  const context: DecisionContext = { timeZone: 'Europe/Berlin', ...options.context, now }
  const lifeInput = toLifeOSInput(raw, { timestamp: now.toISOString() }) ?? fallbackInput(now)
  const batchId = createId()

  if (isBlankInput(lifeInput.content)) {
    const item: NormalizedItem = { index: 0, content: lifeInput.content, original: lifeInput.content }
    return assembleBatch({
      batchId,
      lifeInput,
      items: [item],
      resolved: [{ candidate: unknownDecision(lifeInput.content, blankReason(lifeInput.content)), provider: 'fallback' }],
      flags,
      context,
      started,
    })
  }

  const items = splitIntents(lifeInput.content)
  const providers = {
    rules: options.providers?.rules ?? rulesProvider,
    jev: options.providers?.jev ?? (flags.jevEnabled ? createJevProvider({ timeoutMs: flags.jevTimeoutMs }) : undefined),
    llm: options.providers?.llm ?? (flags.llmFallbackEnabled ? createLlmProvider({ timeoutMs: flags.llmTimeoutMs }) : undefined),
  }

  const resolved = await Promise.all(items.map(async item => {
    try {
      return await resolveCandidate({ item, lifeInput, context, flags, providers })
    } catch (error) {
      return {
        candidate: unknownDecision(item.content, 'NETWORK_ERROR', 0.2),
        provider: 'fallback' as const,
        error: error instanceof Error ? error.message : 'provider_failed',
      }
    }
  }))

  return assembleBatch({ batchId, lifeInput, items, resolved, flags, context, started })
}

/** Local, never-throwing capture helper. Rules only — no JEV from the UI. */
export function runLocalCaptureDecision(raw: unknown, options: Omit<DecideOptions, 'providers'> = {}): DecisionBatch {
  const started = Date.now()
  const flags: DecisionFlags = {
    ...DEFAULT_DECISION_FLAGS,
    ...options.flags,
    jevEnabled: false,
    llmFallbackEnabled: false,
  }
  const now = options.now ?? new Date()
  const context: DecisionContext = { timeZone: 'Europe/Berlin', ...options.context, now }
  const lifeInput = toLifeOSInput(raw, { timestamp: now.toISOString() }) ?? fallbackInput(now)
  const items = isBlankInput(lifeInput.content)
    ? [{ index: 0, content: lifeInput.content, original: lifeInput.content }]
    : splitIntents(lifeInput.content)
  const resolved = items.map(item => ({
    candidate: isBlankInput(lifeInput.content)
      ? unknownDecision(lifeInput.content, blankReason(lifeInput.content))
      : classifyWithRules(item.content, context),
    provider: 'rules' as const,
  }))
  return assembleBatch({
    batchId: createId(),
    lifeInput,
    items,
    resolved,
    flags,
    context,
    started,
  })
}
