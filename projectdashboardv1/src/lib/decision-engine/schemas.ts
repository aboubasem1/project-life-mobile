import {
  ACTION_LEVELS,
  DECISION_DOMAINS,
  DECISION_INTENTS,
  DECISION_PROVIDERS,
  LIFEOS_INPUT_SOURCES,
  POLICY_RESULTS,
  REASON_CODES,
  type ActionLevel,
  type Decision,
  type DecisionDomain,
  type DecisionEntities,
  type DecisionIntent,
  type DecisionProvider,
  type LifeOSInput,
  type LifeOSInputSource,
  type PolicyResult,
  type ProviderDecision,
  type ReasonCode,
} from './types.js'

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {}
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function pick<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? value as T
    : null
}

export function isDecisionDomain(value: unknown): value is DecisionDomain {
  return pick(value, DECISION_DOMAINS) != null
}

export function isDecisionIntent(value: unknown): value is DecisionIntent {
  return pick(value, DECISION_INTENTS) != null
}

export function isActionLevel(value: unknown): value is ActionLevel {
  return pick(value, ACTION_LEVELS) != null
}

export function isPolicyResult(value: unknown): value is PolicyResult {
  return pick(value, POLICY_RESULTS) != null
}

export function isDecisionProvider(value: unknown): value is DecisionProvider {
  return pick(value, DECISION_PROVIDERS) != null
}

export function isReasonCode(value: unknown): value is ReasonCode {
  return pick(value, REASON_CODES) != null
}

export function isLifeOSInputSource(value: unknown): value is LifeOSInputSource {
  return pick(value, LIFEOS_INPUT_SOURCES) != null
}

export function clampConfidence(value: unknown): number {
  const number = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  if (!Number.isFinite(number)) return 0
  return Math.max(0, Math.min(1, number))
}

export function parseLifeOSInput(raw: unknown, fallbackId: string, fallbackTime: string): LifeOSInput | null {
  if (typeof raw === 'string') {
    return {
      id: fallbackId,
      source: 'quick_add',
      content: raw.trim(),
      timestamp: fallbackTime,
    }
  }
  const data = asRecord(raw)
  const content = asString(data.content) || asString(data.raw) || asString(data.text) || asString(data.title)
  const id = asString(data.id) || fallbackId
  const source = isLifeOSInputSource(data.source) ? data.source : 'quick_add'
  const timestamp = asString(data.timestamp) || fallbackTime
  if (!id) return null
  const contextRaw = asRecord(data.context)
  const context = Object.keys(contextRaw).length > 0
    ? {
      currentModule: asString(contextRaw.currentModule) || undefined,
      projectId: asString(contextRaw.projectId) || undefined,
      routineId: asString(contextRaw.routineId) || undefined,
      metadata: contextRaw.metadata && typeof contextRaw.metadata === 'object'
        ? contextRaw.metadata as Record<string, unknown>
        : undefined,
    }
    : undefined
  return {
    id,
    source,
    content,
    timestamp,
    context,
    audioRef: asString(data.audioRef) || undefined,
    transcriptId: asString(data.transcriptId) || undefined,
  }
}

const PRIORITIES = ['p1', 'p2', 'p3', 'p4'] as const

export function parseEntities(raw: unknown): DecisionEntities {
  const data = asRecord(raw)
  const priority = pick(data.priority, PRIORITIES) ?? undefined
  const tags = Array.isArray(data.tags)
    ? data.tags.map(item => asString(item)).filter(Boolean).slice(0, 12)
    : undefined
  return {
    product: asString(data.product) || undefined,
    mealId: asString(data.mealId) || undefined,
    mealLabel: asString(data.mealLabel) || undefined,
    quantity: asString(data.quantity) || undefined,
    due: asString(data.due) || undefined,
    priority,
    projectId: asString(data.projectId) || undefined,
    projectLabel: asString(data.projectLabel) || undefined,
    title: asString(data.title) || undefined,
    body: asString(data.body) || undefined,
    tags: tags && tags.length > 0 ? tags : undefined,
    domainHint: isDecisionDomain(data.domainHint) ? data.domainHint : undefined,
    relatedProject: asString(data.relatedProject) || undefined,
    transcriptReference: asString(data.transcriptReference) || undefined,
    listName: asString(data.listName) || undefined,
  }
}

export function parseProviderDecision(raw: unknown, fallbackContent: string): ProviderDecision | null {
  const data = asRecord(raw)
  const domain = pick(data.domain, DECISION_DOMAINS)
  const intent = pick(data.intent, DECISION_INTENTS)
  if (!domain || !intent) return null
  return {
    content: asString(data.content) || fallbackContent,
    domain,
    intent,
    confidence: clampConfidence(data.confidence),
    entities: parseEntities(data.entities),
    suggestedAction: pick(data.suggestedAction, DECISION_INTENTS) ?? intent,
    reasonCode: pick(data.reasonCode, REASON_CODES) ?? undefined,
  }
}

export function assertDecisionShape(value: unknown): Decision | null {
  const data = asRecord(value)
  const domain = pick(data.domain, DECISION_DOMAINS)
  const intent = pick(data.intent, DECISION_INTENTS)
  const actionLevel = pick(data.actionLevel, ACTION_LEVELS)
  const provider = pick(data.provider, DECISION_PROVIDERS)
  const policyResult = pick(data.policyResult, POLICY_RESULTS)
  const reasonCode = pick(data.reasonCode, REASON_CODES)
  const decisionId = asString(data.decisionId)
  const inputId = asString(data.inputId)
  if (!domain || !intent || !actionLevel || !provider || !policyResult || !reasonCode || !decisionId || !inputId) {
    return null
  }
  return {
    decisionId,
    inputId,
    itemIndex: typeof data.itemIndex === 'number' ? data.itemIndex : 0,
    content: asString(data.content),
    domain,
    intent,
    confidence: clampConfidence(data.confidence),
    confidenceBand: data.confidenceBand === 'high' || data.confidenceBand === 'medium' || data.confidenceBand === 'low'
      ? data.confidenceBand
      : 'low',
    entities: parseEntities(data.entities),
    suggestedAction: pick(data.suggestedAction, DECISION_INTENTS) ?? intent,
    actionLevel,
    provider,
    requiresConfirmation: data.requiresConfirmation === true,
    reasonCode,
    timestamp: asString(data.timestamp),
    policyResult,
    policyReasons: Array.isArray(data.policyReasons)
      ? data.policyReasons.map(item => pick(item, REASON_CODES)).filter((item): item is ReasonCode => item != null)
      : [],
  }
}

const SECRET_KEY = /secret|token|key|password|authorization|api[_-]?key/i

export function redactForLog(value: unknown): unknown {
  if (typeof value === 'string') return value.length > 180 ? `${value.slice(0, 180)}…` : value
  if (!value || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.slice(0, 12).map(item => redactForLog(item))
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => (
      SECRET_KEY.test(key) ? [key, item ? '••••' : ''] : [key, redactForLog(item)]
    )),
  )
}

export function contentPreview(text: string, max = 80): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  return clean.length > max ? `${clean.slice(0, max)}…` : clean
}
