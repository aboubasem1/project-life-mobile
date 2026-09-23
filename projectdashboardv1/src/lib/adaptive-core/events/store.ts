import { asRecord, asString, createId, nowIso, pick } from '../schema.js'

export const ADAPTIVE_EVENTS_KEY = 'life-os-v1-adaptive-events'
export const MAX_ADAPTIVE_EVENTS = 3000

export const ADAPTIVE_EVENT_TYPES = [
  'routine.started',
  'routine.completed',
  'routine.abandoned',
  'routine_step.completed',
  'routine_step.skipped',
  'task.created',
  'task.completed',
  'task.deferred',
  'gate.opened',
  'gate.completed',
  'gate.abandoned',
  'meal.logged',
  'metric.recorded',
  'suggestion.created',
  'suggestion.shown',
  'suggestion.accepted',
  'suggestion.rejected',
  'change.requested',
  'change.proposed',
  'change.approved',
  'change.applied',
  'change.failed',
  'change.reverted',
  'experiment.started',
  'experiment.completed',
] as const

export type AdaptiveEventType = (typeof ADAPTIVE_EVENT_TYPES)[number]

export type AdaptiveEvent = {
  id: string
  type: AdaptiveEventType
  timestamp: string
  date: string
  entityId?: string
  surface?: string
  payload?: Record<string, string | number | boolean | null>
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null
  } catch {
    return null
  }
}

export function normalizeAdaptiveEvent(raw: unknown): AdaptiveEvent | null {
  const data = asRecord(raw)
  const type = pick(data.type, ADAPTIVE_EVENT_TYPES)
  const timestamp = asString(data.timestamp) || nowIso()
  if (!type) return null
  return {
    id: asString(data.id) || createId('evt'),
    type,
    timestamp,
    date: asString(data.date) || timestamp.slice(0, 10),
    entityId: asString(data.entityId) || undefined,
    surface: asString(data.surface) || undefined,
    payload: data.payload && typeof data.payload === 'object'
      ? data.payload as AdaptiveEvent['payload']
      : undefined,
  }
}

export function loadAdaptiveEvents(): AdaptiveEvent[] {
  const storage = safeStorage()
  if (!storage) return []
  try {
    const raw = JSON.parse(storage.getItem(ADAPTIVE_EVENTS_KEY) ?? '[]')
    if (!Array.isArray(raw)) return []
    return raw.map(normalizeAdaptiveEvent).filter((e): e is AdaptiveEvent => Boolean(e))
  } catch {
    return []
  }
}

export function saveAdaptiveEvents(events: AdaptiveEvent[]): void {
  const storage = safeStorage()
  if (!storage) return
  try {
    storage.setItem(ADAPTIVE_EVENTS_KEY, JSON.stringify(events.slice(0, MAX_ADAPTIVE_EVENTS)))
  } catch {
    /* ignore */
  }
}

export function emitAdaptiveEvent(
  type: AdaptiveEventType,
  input: {
    entityId?: string
    surface?: string
    date?: string
    payload?: AdaptiveEvent['payload']
    at?: Date
  } = {},
): AdaptiveEvent {
  const timestamp = (input.at ?? new Date()).toISOString()
  const event: AdaptiveEvent = {
    id: createId('evt'),
    type,
    timestamp,
    date: input.date ?? timestamp.slice(0, 10),
    entityId: input.entityId,
    surface: input.surface,
    payload: input.payload,
  }
  const next = [event, ...loadAdaptiveEvents()].slice(0, MAX_ADAPTIVE_EVENTS)
  saveAdaptiveEvents(next)
  return event
}

/** Idempotent append — skips if same id already present. */
export function appendAdaptiveEventOnce(event: AdaptiveEvent): AdaptiveEvent {
  const existing = loadAdaptiveEvents()
  if (existing.some(item => item.id === event.id)) return event
  saveAdaptiveEvents([event, ...existing].slice(0, MAX_ADAPTIVE_EVENTS))
  return event
}
