import {
  normalizeAreaIntentions,
  parseLifeArea,
  parseNeedKeys,
} from './areas.js'
import {
  LIFE_OS_KEY,
  LIFE_OS_STORE_VERSION,
  type ActivityRecord,
  type Capture,
  type CaptureStatus,
  type CaptureTargetType,
  type ConnectorInstance,
  type Decision,
  type DecisionStatus,
  type DomainEvent,
  type Insight,
  type KnowledgeItem,
  type KnowledgeType,
  type LifeOsState,
  type OutboundWebhook,
  type Relation,
  type Review,
  type ReviewAggregates,
  type ReviewType,
  type Signal,
  type WebhookLog,
} from './types.js'

export { LIFE_OS_KEY, LIFE_OS_STORE_VERSION }

const CAPTURE_TYPES: CaptureTargetType[] = [
  'inbox', 'task', 'note', 'knowledge', 'goal', 'event', 'decision', 'reference',
]
const CAPTURE_STATUSES: CaptureStatus[] = ['inbox', 'classified', 'converted', 'archived']
const KNOWLEDGE_TYPES: KnowledgeType[] = [
  'thought', 'article', 'webpage', 'video', 'document', 'book', 'research', 'import',
]
const DECISION_STATUSES: DecisionStatus[] = ['active', 'review_due', 'reviewed', 'superseded']
const REVIEW_TYPES: ReviewType[] = ['daily', 'weekly', 'monthly', 'quarterly', 'yearly']

const MAX_EVENTS = 2000
const MAX_WEBHOOK_LOGS = 200
const MAX_INSIGHTS = 80
const MAX_SIGNALS = 4000

export function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `id_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

export function nowIso(): string {
  return new Date().toISOString()
}

export function todayKey(timeZone = 'Europe/Berlin'): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

export function emptyReviewAggregates(): ReviewAggregates {
  return {
    completedTasks: 0,
    openTasks: 0,
    projectProgress: [],
    goals: [],
    captures: 0,
    knowledge: 0,
    decisions: 0,
    decisionReviewsDue: 0,
    signals: [],
    focusMinutes: 0,
    plannedMinutes: 0,
    actualMinutes: 0,
  }
}

export function emptyLifeOsState(): LifeOsState {
  return {
    version: LIFE_OS_STORE_VERSION,
    captures: [],
    knowledge: [],
    decisions: [],
    signals: [],
    reviews: [],
    insights: [],
    relations: [],
    activities: [],
    events: [],
    connectors: [],
    outboundWebhooks: [],
    webhookLogs: [],
    areaIntentions: {},
  }
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function asOptionalString(value: unknown): string | undefined {
  const text = typeof value === 'string' ? value.trim() : ''
  return text ? text : undefined
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.replace(',', '.'))
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? value as T
    : fallback
}

function isoOrNow(value: unknown): string {
  return typeof value === 'string' && value ? value : nowIso()
}

function isoOrUndefined(value: unknown): string | undefined {
  return typeof value === 'string' && value ? value : undefined
}

export function normalizeCapture(raw: unknown): Capture | null {
  if (!raw || typeof raw !== 'object') return null
  const item = raw as Partial<Capture>
  const id = asString(item.id)
  const rawText = asString(item.raw).trim() || asString(item.title).trim() || asString(item.body).trim()
  if (!id || !rawText) return null
  const title = asString(item.title).trim() || rawText.slice(0, 80)
  return {
    id,
    raw: rawText,
    title,
    body: asString(item.body),
    url: asOptionalString(item.url),
    fileName: asOptionalString(item.fileName),
    fileKind: item.fileKind === 'screenshot' || item.fileKind === 'file' ? item.fileKind : undefined,
    fileDataUrl: asOptionalString(item.fileDataUrl),
    targetType: pick(item.targetType, CAPTURE_TYPES, 'inbox'),
    status: pick(item.status, CAPTURE_STATUSES, 'inbox'),
    projectId: asOptionalString(item.projectId),
    goalId: asOptionalString(item.goalId),
    lifeArea: parseLifeArea(item.lifeArea),
    needKeys: parseNeedKeys(item.needKeys),
    converted: item.converted && typeof item.converted === 'object' && item.converted.id
      ? { kind: item.converted.kind, id: String(item.converted.id) }
      : undefined,
    createdAt: isoOrNow(item.createdAt),
    updatedAt: isoOrNow(item.updatedAt),
  }
}

export function normalizeKnowledge(raw: unknown): KnowledgeItem | null {
  if (!raw || typeof raw !== 'object') return null
  const item = raw as Partial<KnowledgeItem>
  const id = asString(item.id)
  const title = asString(item.title).trim()
  if (!id || !title) return null
  return {
    id,
    title,
    content: asString(item.content),
    summary: asString(item.summary),
    source: asString(item.source),
    sourceUrl: asOptionalString(item.sourceUrl),
    type: pick(item.type, KNOWLEDGE_TYPES, 'thought'),
    topics: Array.isArray(item.topics) ? item.topics.map(String).filter(Boolean) : [],
    tags: Array.isArray(item.tags) ? item.tags.map(String).filter(Boolean) : [],
    lifeArea: parseLifeArea(item.lifeArea),
    needKeys: parseNeedKeys(item.needKeys),
    createdAt: isoOrNow(item.createdAt),
    updatedAt: isoOrNow(item.updatedAt),
  }
}

export function normalizeDecision(raw: unknown): Decision | null {
  if (!raw || typeof raw !== 'object') return null
  const item = raw as Partial<Decision>
  const id = asString(item.id)
  const title = asString(item.title).trim()
  if (!id || !title) return null
  const rating = asNumber(item.rating)
  return {
    id,
    title,
    decision: asString(item.decision),
    context: asString(item.context),
    reasoning: asString(item.reasoning),
    alternatives: asString(item.alternatives),
    expectedOutcome: asString(item.expectedOutcome),
    projectId: asOptionalString(item.projectId),
    goalId: asOptionalString(item.goalId),
    decidedAt: asString(item.decidedAt) || todayKey(),
    reviewAt: asOptionalString(item.reviewAt),
    actualOutcome: asOptionalString(item.actualOutcome),
    rating: rating != null ? Math.max(1, Math.min(5, Math.round(rating))) : undefined,
    status: pick(item.status, DECISION_STATUSES, 'active'),
    lifeArea: parseLifeArea(item.lifeArea),
    needKeys: parseNeedKeys(item.needKeys),
    createdAt: isoOrNow(item.createdAt),
    updatedAt: isoOrNow(item.updatedAt),
  }
}

export function normalizeSignal(raw: unknown): Signal | null {
  if (!raw || typeof raw !== 'object') return null
  const item = raw as Partial<Signal>
  const id = asString(item.id)
  const type = asString(item.type).trim()
  const value = asNumber(item.value)
  if (!id || !type || value == null) return null
  const metadata = item.metadata && typeof item.metadata === 'object'
    ? Object.fromEntries(
      Object.entries(item.metadata).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
    )
    : undefined
  return {
    id,
    type,
    value,
    unit: asString(item.unit),
    timestamp: isoOrNow(item.timestamp),
    source: asString(item.source, 'manual'),
    sourceId: asOptionalString(item.sourceId),
    metadata,
    lifeArea: parseLifeArea(item.lifeArea),
    createdAt: isoOrNow(item.createdAt),
  }
}

export function normalizeReview(raw: unknown): Review | null {
  if (!raw || typeof raw !== 'object') return null
  const item = raw as Partial<Review>
  const id = asString(item.id)
  const periodStart = asString(item.periodStart)
  const periodEnd = asString(item.periodEnd)
  if (!id || !/^\d{4}-\d{2}-\d{2}$/.test(periodStart) || !/^\d{4}-\d{2}-\d{2}$/.test(periodEnd)) return null
  const incoming = item.aggregates && typeof item.aggregates === 'object' ? item.aggregates : emptyReviewAggregates()
  return {
    id,
    type: pick(item.type, REVIEW_TYPES, 'weekly'),
    periodStart,
    periodEnd,
    aggregates: { ...emptyReviewAggregates(), ...incoming },
    whatWentWell: asString(item.whatWentWell),
    whatWentWrong: asString(item.whatWentWrong),
    whatILearned: asString(item.whatILearned),
    whatToChange: asString(item.whatToChange),
    nextPriorities: asString(item.nextPriorities),
    notes: asString(item.notes),
    createdAt: isoOrNow(item.createdAt),
    updatedAt: isoOrNow(item.updatedAt),
    completedAt: isoOrUndefined(item.completedAt),
  }
}

export function normalizeInsight(raw: unknown): Insight | null {
  if (!raw || typeof raw !== 'object') return null
  const item = raw as Partial<Insight>
  const id = asString(item.id)
  const title = asString(item.title).trim()
  const message = asString(item.message).trim()
  if (!id || !title || !message) return null
  return {
    id,
    type: asString(item.type, 'generic'),
    title,
    message,
    period: asString(item.period),
    evidence: Array.isArray(item.evidence)
      ? item.evidence
        .filter(row => row && typeof row === 'object')
        .map(row => ({ label: asString(row.label), value: asString(row.value) }))
        .filter(row => row.label && row.value)
      : [],
    confidence: Math.max(0, Math.min(1, asNumber(item.confidence) ?? 0.7)),
    suggestedAction: asOptionalString(item.suggestedAction),
    source: item.source === 'interpretation' ? 'interpretation' : 'deterministic',
    createdAt: isoOrNow(item.createdAt),
  }
}

export function normalizeRelation(raw: unknown): Relation | null {
  if (!raw || typeof raw !== 'object') return null
  const item = raw as Partial<Relation>
  if (!item.id || !item.fromKind || !item.fromId || !item.toKind || !item.toId) return null
  return {
    id: String(item.id),
    fromKind: item.fromKind,
    fromId: String(item.fromId),
    toKind: item.toKind,
    toId: String(item.toId),
    role: asOptionalString(item.role),
    createdAt: isoOrNow(item.createdAt),
  }
}

export function normalizeActivity(raw: unknown): ActivityRecord | null {
  if (!raw || typeof raw !== 'object') return null
  const item = raw as Partial<ActivityRecord>
  const id = asString(item.id)
  const title = asString(item.title).trim()
  const date = asString(item.date)
  if (!id || !title || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  return {
    id,
    kind: item.kind === 'task' || item.kind === 'project' || item.kind === 'training' || item.kind === 'focus' || item.kind === 'custom'
      ? item.kind
      : 'custom',
    title,
    projectId: asOptionalString(item.projectId),
    goalId: asOptionalString(item.goalId),
    plannedDurationMin: asNumber(item.plannedDurationMin),
    actualDurationMin: asNumber(item.actualDurationMin),
    source: item.source === 'timer' || item.source === 'tracking' || item.source === 'connector' ? item.source : 'user',
    date,
    lifeArea: parseLifeArea(item.lifeArea),
    needKeys: parseNeedKeys(item.needKeys),
    createdAt: isoOrNow(item.createdAt),
    updatedAt: isoOrNow(item.updatedAt),
  }
}

export function normalizeEvent(raw: unknown): DomainEvent | null {
  if (!raw || typeof raw !== 'object') return null
  const item = raw as Partial<DomainEvent>
  if (!item.id || !item.type) return null
  const payload = item.payload && typeof item.payload === 'object'
    ? Object.fromEntries(Object.entries(item.payload).map(([key, value]) => [key, String(value)]))
    : {}
  return {
    id: String(item.id),
    type: item.type,
    entityKind: item.entityKind,
    entityId: asOptionalString(item.entityId),
    payload,
    createdAt: isoOrNow(item.createdAt),
  }
}

export function normalizeConnector(raw: unknown): ConnectorInstance | null {
  if (!raw || typeof raw !== 'object') return null
  const item = raw as Partial<ConnectorInstance>
  if (!item.id || !item.connectorId) return null
  const configuration = item.configuration && typeof item.configuration === 'object'
    ? Object.fromEntries(Object.entries(item.configuration).map(([key, value]) => [key, String(value)]))
    : {}
  return {
    id: String(item.id),
    connectorId: String(item.connectorId),
    status: item.status === 'connected' || item.status === 'error' ? item.status : 'disconnected',
    configuration,
    lastSyncAt: isoOrUndefined(item.lastSyncAt),
    lastError: asOptionalString(item.lastError),
    createdAt: isoOrNow(item.createdAt),
    updatedAt: isoOrNow(item.updatedAt),
  }
}

export function normalizeOutboundWebhook(raw: unknown): OutboundWebhook | null {
  if (!raw || typeof raw !== 'object') return null
  const item = raw as Partial<OutboundWebhook>
  if (!item.id || !item.url) return null
  return {
    id: String(item.id),
    url: String(item.url),
    secretCipher: asOptionalString(item.secretCipher),
    events: Array.isArray(item.events) ? item.events : [],
    enabled: item.enabled !== false,
    createdAt: isoOrNow(item.createdAt),
    updatedAt: isoOrNow(item.updatedAt),
  }
}

export function normalizeWebhookLog(raw: unknown): WebhookLog | null {
  if (!raw || typeof raw !== 'object') return null
  const item = raw as Partial<WebhookLog>
  if (!item.id || !item.connectorId) return null
  return {
    id: String(item.id),
    direction: item.direction === 'outbound' ? 'outbound' : 'inbound',
    connectorId: String(item.connectorId),
    status: asNumber(item.status) ?? 0,
    message: asString(item.message),
    idempotencyKey: asOptionalString(item.idempotencyKey),
    createdAt: isoOrNow(item.createdAt),
  }
}

function list<T>(raw: unknown, normalize: (item: unknown) => T | null): T[] {
  if (!Array.isArray(raw)) return []
  const out: T[] = []
  for (const item of raw) {
    const next = normalize(item)
    if (next) out.push(next)
  }
  return out
}

export function normalizeLifeOsState(raw: unknown): LifeOsState {
  const seed = emptyLifeOsState()
  if (!raw || typeof raw !== 'object') return seed
  const item = raw as Partial<LifeOsState>
  return {
    version: LIFE_OS_STORE_VERSION,
    captures: list(item.captures, normalizeCapture),
    knowledge: list(item.knowledge, normalizeKnowledge),
    decisions: list(item.decisions, normalizeDecision).map(decision => refreshDecisionStatus(decision)),
    signals: list(item.signals, normalizeSignal).slice(-MAX_SIGNALS),
    reviews: list(item.reviews, normalizeReview),
    insights: list(item.insights, normalizeInsight).slice(-MAX_INSIGHTS),
    relations: list(item.relations, normalizeRelation),
    activities: list(item.activities, normalizeActivity),
    events: list(item.events, normalizeEvent).slice(-MAX_EVENTS),
    connectors: list(item.connectors, normalizeConnector),
    outboundWebhooks: list(item.outboundWebhooks, normalizeOutboundWebhook),
    webhookLogs: list(item.webhookLogs, normalizeWebhookLog).slice(-MAX_WEBHOOK_LOGS),
    areaIntentions: normalizeAreaIntentions(item.areaIntentions),
  }
}

export function refreshDecisionStatus(decision: Decision, today = todayKey()): Decision {
  if (decision.status === 'reviewed' || decision.status === 'superseded') return decision
  if (decision.reviewAt && decision.reviewAt <= today) {
    return decision.status === 'review_due' ? decision : { ...decision, status: 'review_due' }
  }
  return decision.status === 'active' ? decision : { ...decision, status: 'active' }
}

function mergeByUpdatedAt<T extends { id: string; updatedAt: string }>(local: T[], remote: T[]): T[] {
  const map = new Map<string, T>()
  for (const item of local) map.set(item.id, item)
  for (const item of remote) {
    const current = map.get(item.id)
    if (!current || item.updatedAt >= current.updatedAt) map.set(item.id, item)
  }
  return [...map.values()]
}

function mergeById<T extends { id: string }>(local: T[], remote: T[]): T[] {
  const map = new Map<string, T>()
  for (const item of local) map.set(item.id, item)
  for (const item of remote) map.set(item.id, item)
  return [...map.values()]
}

function mergeByCreatedAt<T extends { id: string; createdAt: string }>(local: T[], remote: T[]): T[] {
  const map = new Map<string, T>()
  for (const item of [...local, ...remote]) {
    const current = map.get(item.id)
    if (!current || item.createdAt >= current.createdAt) map.set(item.id, item)
  }
  return [...map.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

export function mergeLifeOsState(localRaw: unknown, remoteRaw: unknown): LifeOsState {
  const local = normalizeLifeOsState(localRaw)
  const remote = normalizeLifeOsState(remoteRaw)
  return normalizeLifeOsState({
    version: LIFE_OS_STORE_VERSION,
    captures: mergeByUpdatedAt(local.captures, remote.captures),
    knowledge: mergeByUpdatedAt(local.knowledge, remote.knowledge),
    decisions: mergeByUpdatedAt(local.decisions, remote.decisions),
    signals: mergeByCreatedAt(local.signals, remote.signals).slice(-MAX_SIGNALS),
    reviews: mergeByUpdatedAt(local.reviews, remote.reviews),
    insights: mergeByCreatedAt(local.insights, remote.insights).slice(-MAX_INSIGHTS),
    relations: mergeById(local.relations, remote.relations),
    activities: mergeByUpdatedAt(local.activities, remote.activities),
    events: mergeByCreatedAt(local.events, remote.events).slice(-MAX_EVENTS),
    connectors: mergeByUpdatedAt(local.connectors, remote.connectors),
    outboundWebhooks: mergeByUpdatedAt(local.outboundWebhooks, remote.outboundWebhooks),
    webhookLogs: mergeByCreatedAt(local.webhookLogs, remote.webhookLogs).slice(-MAX_WEBHOOK_LOGS),
    areaIntentions: { ...local.areaIntentions, ...remote.areaIntentions },
  })
}

export const LIFE_OS_CHANGE_EVENT = 'life-os-life-changed'

function notifyLifeOsChanged(): void {
  const host = globalThis as {
    window?: { dispatchEvent: (event: unknown) => void; CustomEvent?: new (type: string) => unknown }
  }
  if (!host.window?.CustomEvent) return
  host.window.dispatchEvent(new host.window.CustomEvent(LIFE_OS_CHANGE_EVENT))
}

function browserStorage(): { getItem(key: string): string | null; setItem(key: string, value: string): void } | null {
  const host = globalThis as { localStorage?: { getItem(key: string): string | null; setItem(key: string, value: string): void } }
  return host.localStorage ?? null
}

function safeGet(key: string): string | null {
  try {
    return browserStorage()?.getItem(key) ?? null
  } catch {
    return null
  }
}

function safeSet(key: string, value: string): boolean {
  try {
    const storage = browserStorage()
    if (!storage) return false
    storage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

export function loadLifeOsState(): LifeOsState {
  try {
    return normalizeLifeOsState(JSON.parse(safeGet(LIFE_OS_KEY) ?? 'null'))
  } catch {
    return emptyLifeOsState()
  }
}

export function saveLifeOsState(state: LifeOsState): boolean {
  const normalized = normalizeLifeOsState(state)
  const ok = safeSet(LIFE_OS_KEY, JSON.stringify(normalized))
  if (ok) notifyLifeOsChanged()
  return ok
}

export function patchLifeOsState(updater: (current: LifeOsState) => LifeOsState): LifeOsState {
  const next = normalizeLifeOsState(updater(loadLifeOsState()))
  saveLifeOsState(next)
  return next
}

export function inboxCaptures(state: LifeOsState): Capture[] {
  return state.captures
    .filter(item => item.status === 'inbox' || item.status === 'classified')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}
