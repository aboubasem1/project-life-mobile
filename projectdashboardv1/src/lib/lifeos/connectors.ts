import { parseLifeArea } from './areas'
import {
  type ConnectorCapability,
  type ConnectorDefinition,
  type ConnectorInstance,
  type DomainEvent,
  type LifeOsState,
  type NormalizedObject,
  type Signal,
} from './types'
import { createId, nowIso } from './store'
import { createCapture, recordActivity, recordSignal } from './domain'

export type ConnectorHealth = { ok: boolean; message: string }

export type ConnectorContext = {
  instance: ConnectorInstance
  verifySecret: (provided: string) => boolean
}

export interface LifeOsConnector {
  definition: ConnectorDefinition
  connect(config: Record<string, string>): Promise<Record<string, string>>
  disconnect(): Promise<void>
  sync(ctx: ConnectorContext): Promise<NormalizedObject[]>
  handleWebhook(payload: unknown, headers: Record<string, string>, ctx: ConnectorContext): Promise<NormalizedObject[]>
  normalize(payload: unknown): NormalizedObject[]
  executeAction(action: string, input: unknown, ctx: ConnectorContext): Promise<unknown>
  healthCheck(ctx: ConnectorContext): Promise<ConnectorHealth>
}

const MANUAL: ConnectorDefinition = {
  id: 'manual',
  provider: 'Life OS',
  version: '1.0.0',
  authentication: 'none',
  capabilities: ['write'],
  description: 'Manuelle Signale, Captures und Activity-Records.',
}

const GENERIC_WEBHOOK: ConnectorDefinition = {
  id: 'webhook-generic',
  provider: 'Generic Webhook',
  version: '1.0.0',
  authentication: 'webhook',
  capabilities: ['write', 'events'],
  description: 'Normalisiert generische JSON-Payloads zu Capture oder Signal.',
}

const N8N: ConnectorDefinition = {
  id: 'n8n',
  provider: 'n8n',
  version: '1.0.0',
  authentication: 'webhook',
  capabilities: ['write', 'events', 'actions'],
  description: 'Optionaler Transport-Adapter. Keine Core-Logik.',
}

export const CONNECTOR_CATALOG: ConnectorDefinition[] = [MANUAL, GENERIC_WEBHOOK, N8N]

export function connectorDefinition(id: string): ConnectorDefinition | undefined {
  return CONNECTOR_CATALOG.find(item => item.id === id)
}

function asRecord(payload: unknown): Record<string, unknown> {
  return payload && typeof payload === 'object' ? payload as Record<string, unknown> : {}
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function optionalArea(data: Record<string, unknown>) {
  return parseLifeArea(data.life_area ?? data.lifeArea)
}

function num(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.replace(',', '.'))
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

/** Map provider-specific names onto Life OS signal types. Never copy provider fields through. */
const SIGNAL_ALIASES: Record<string, string> = {
  readiness_score: 'recovery',
  recovery: 'recovery',
  hrv: 'recovery',
  sleep: 'sleep_duration',
  sleep_hours: 'sleep_duration',
  sleep_duration: 'sleep_duration',
  sleep_quality: 'sleep_quality',
  steps: 'steps',
  weight: 'weight',
  weight_kg: 'weight',
  focus: 'focus_time',
  focus_time: 'focus_time',
  screen_time: 'screen_time',
  mood: 'mood',
  energy: 'energy',
  training: 'training',
  activity: 'activity',
  spending: 'spending',
}

export function normalizeSignalType(raw: string): string {
  const key = raw.trim().toLowerCase().replace(/\s+/g, '_')
  return SIGNAL_ALIASES[key] ?? key
}

export function normalizeExternalPayload(payload: unknown): NormalizedObject[] {
  const data = asRecord(payload)
  const objects: NormalizedObject[] = []

  const captureText = text(data.text) || text(data.body) || text(data.note) || text(data.title)
  const kind = text(data.kind) || text(data.type)

  if (kind === 'signal' || data.value != null || data.signal_type) {
    const type = normalizeSignalType(text(data.signal_type) || text(data.metric) || text(data.type) || 'activity')
    const value = num(data.value) ?? num(data.amount)
    if (value != null && type && type !== 'capture' && type !== 'note' && type !== 'task') {
      objects.push({
        kind: 'signal',
        data: {
          type,
          value,
          unit: text(data.unit),
          source: text(data.source) || 'connector',
          sourceId: text(data.source_id) || text(data.id) || undefined,
          timestamp: text(data.timestamp) || undefined,
          lifeArea: optionalArea(data),
        },
      })
    }
  }

  if (kind === 'activity' && text(data.title)) {
    objects.push({
      kind: 'activity',
      data: {
        title: text(data.title),
        date: text(data.date) || nowIso().slice(0, 10),
        plannedDurationMin: num(data.planned_duration) ?? num(data.plannedDurationMin) ?? undefined,
        actualDurationMin: num(data.actual_duration) ?? num(data.actualDurationMin) ?? undefined,
        source: 'connector',
        lifeArea: optionalArea(data),
      },
    })
  }

  if (kind === 'knowledge' && text(data.title)) {
    objects.push({
      kind: 'knowledge',
      data: {
        title: text(data.title),
        content: text(data.content) || text(data.body),
        source: text(data.source) || 'connector',
        sourceUrl: text(data.url) || undefined,
        lifeArea: optionalArea(data),
      },
    })
  }

  if (captureText && objects.length === 0) {
    objects.push({
      kind: 'capture',
      data: {
        raw: captureText,
        url: text(data.url) || undefined,
        lifeArea: optionalArea(data),
      },
    })
  }

  return objects
}

function baseConnector(definition: ConnectorDefinition): LifeOsConnector {
  return {
    definition,
    async connect(config) {
      return Object.fromEntries(
        Object.entries(config).filter(([key]) => !key.toLowerCase().includes('secret') || key.endsWith('Hash')),
      )
    },
    async disconnect() {},
    async sync() {
      return []
    },
    async handleWebhook(payload, headers, ctx) {
      const secret = headers['x-life-os-secret'] ?? headers['x-webhook-secret'] ?? ''
      if (definition.authentication === 'webhook' && !ctx.verifySecret(secret)) {
        throw new Error('Webhook-Secret ungültig.')
      }
      return this.normalize(payload)
    },
    normalize: normalizeExternalPayload,
    async executeAction() {
      throw new Error('Dieser Connector hat keine Actions.')
    },
    async healthCheck(ctx) {
      return {
        ok: ctx.instance.status !== 'error',
        message: ctx.instance.lastError || `${definition.provider} bereit`,
      }
    },
  }
}

const CONNECTORS: Record<string, LifeOsConnector> = {
  manual: baseConnector(MANUAL),
  'webhook-generic': baseConnector(GENERIC_WEBHOOK),
  n8n: baseConnector(N8N),
}

export function getConnector(id: string): LifeOsConnector | undefined {
  return CONNECTORS[id]
}

export function applyNormalizedObjects(state: LifeOsState, objects: NormalizedObject[], source: string): LifeOsState {
  let next = { ...state }
  for (const object of objects) {
    switch (object.kind) {
      case 'capture': {
        const capture = createCapture({ raw: object.data.raw, url: object.data.url, lifeArea: object.data.lifeArea })
        next = { ...next, captures: [...next.captures, capture] }
        break
      }
      case 'signal': {
        const signal = recordSignal({
          type: object.data.type,
          value: object.data.value,
          unit: object.data.unit,
          source: object.data.source || source,
          sourceId: object.data.sourceId,
          timestamp: object.data.timestamp,
          lifeArea: object.data.lifeArea,
        })
        next = { ...next, signals: [...next.signals, signal] }
        break
      }
      case 'activity': {
        const activity = recordActivity({
          title: object.data.title,
          date: object.data.date,
          plannedDurationMin: object.data.plannedDurationMin,
          actualDurationMin: object.data.actualDurationMin,
          source: 'connector',
          lifeArea: object.data.lifeArea,
        })
        next = { ...next, activities: [...next.activities, activity] }
        break
      }
      case 'knowledge': {
        const now = nowIso()
        next = {
          ...next,
          knowledge: [...next.knowledge, {
            id: createId(),
            title: object.data.title,
            content: object.data.content ?? '',
            summary: (object.data.summary ?? object.data.content ?? '').slice(0, 180),
            source: object.data.source ?? source,
            sourceUrl: object.data.sourceUrl,
            type: 'import',
            topics: [],
            tags: [],
            lifeArea: object.data.lifeArea,
            createdAt: now,
            updatedAt: now,
          }],
        }
        break
      }
      default: {
        const _exhaustive: never = object
        void _exhaustive
      }
    }
  }
  return next
}

export async function hashSecret(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value)
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const digest = await crypto.subtle.digest('SHA-256', bytes)
    return [...new Uint8Array(digest)].map(item => item.toString(16).padStart(2, '0')).join('')
  }
  let hash = 0
  for (const byte of bytes) hash = ((hash << 5) - hash + byte) | 0
  return `fnv_${hash.toString(16)}`
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let index = 0; index < a.length; index += 1) {
    mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index)
  }
  return mismatch === 0
}

export async function secretsMatch(provided: string, storedHash: string): Promise<boolean> {
  if (!provided || !storedHash) return false
  const hashed = await hashSecret(provided)
  return timingSafeEqual(hashed, storedHash)
}

export function createConnectorInstance(connectorId: string, configuration: Record<string, string> = {}): ConnectorInstance {
  const now = nowIso()
  const capabilities: ConnectorCapability[] = connectorDefinition(connectorId)?.capabilities ?? []
  void capabilities
  return {
    id: createId(),
    connectorId,
    status: connectorId === 'manual' ? 'connected' : 'disconnected',
    configuration,
    createdAt: now,
    updatedAt: now,
  }
}

export function webhookIdempotencyKey(headers: Record<string, string>, payload: unknown): string {
  const explicit = headers['x-idempotency-key'] || headers['idempotency-key']
  if (explicit) return explicit
  try {
    return `auto_${JSON.stringify(payload).slice(0, 240)}`
  } catch {
    return `auto_${nowIso()}`
  }
}

export function alreadyProcessed(state: LifeOsState, key: string): boolean {
  return state.webhookLogs.some(item => item.idempotencyKey === key && item.status >= 200 && item.status < 300)
}

export function outboundTargetsFor(state: LifeOsState, type: DomainEvent['type']) {
  return state.outboundWebhooks.filter(item => item.enabled && item.events.includes(type))
}

export function sanitizeSignalForLog(signal: Signal): Record<string, string> {
  return {
    type: signal.type,
    unit: signal.unit,
    source: signal.source,
  }
}

export function redactConfig(configuration: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(configuration).map(([key, value]) => (
      /secret|token|key|password/i.test(key) ? [key, value ? '••••' : ''] : [key, value]
    )),
  )
}
