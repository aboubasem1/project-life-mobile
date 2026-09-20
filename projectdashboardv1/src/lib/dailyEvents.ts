export const DAILY_EVENTS_KEY = 'life-os-v1-daily-events'
export const LIFE_OS_DAILY_EVENTS_EVENT = 'life-os-daily-events'
export const MAX_DAILY_EVENTS = 2500

export type DailyEventSource =
  | 'ui'
  | 'quick_add'
  | 'morning_gate'
  | 'focus'
  | 'webhook'
  | 'health'
  | 'sync'

type EventScalar = string | number | boolean | null
export type EventValue = EventScalar | EventScalar[]

type DailyEventBase = {
  id: string
  date: string
  occurredAt: string
  recordedAt: string
  source: DailyEventSource
}

export type EntryPatchEvent = DailyEventBase & {
  type: 'entry_patch'
  changes: Record<string, EventValue>
  previous?: Record<string, EventValue>
  undoOf?: string
}

export type RitualStepEvent = DailyEventBase & {
  type: 'ritual_step'
  stepId: string
  status: 'completed' | 'reopened' | 'updated'
  details?: Record<string, EventValue>
}

export type DailyEvent = EntryPatchEvent | RitualStepEvent

const SOURCES = new Set<DailyEventSource>([
  'ui',
  'quick_add',
  'morning_gate',
  'focus',
  'webhook',
  'health',
  'sync',
])

const EXCLUDED_PATCH_FIELDS = new Set(['dailyScore', 'updatedAt', 'id', 'userId'])

const FIELD_LABELS: Record<string, string> = {
  waterLiters: 'Wasser',
  proteinGrams: 'Protein',
  calories: 'Kalorien',
  fatGrams: 'Fett',
  carbsGrams: 'Kohlenhydrate',
  fiberGrams: 'Ballaststoffe',
  steps: 'Schritte',
  weightKg: 'Gewicht',
  bodyFatPercent: 'Körperfett',
  energyLevel: 'Energie',
  coldShower: 'Cold Shower',
  proteinShake: 'Proteinshake',
  gratitudeDone: 'Dankbarkeit',
  focusDone: 'Fokus',
  winnerModeDone: 'Winner Mode',
  pushupsDone: 'Pushups',
  squatsDone: 'Kniebeugen',
  wallsitDone: 'Wall Sit',
  plankDone: 'Plank',
  breathingDone: 'Atmung',
  journalDone: 'Journal',
  familyTimeDone: 'Familienzeit',
  meditationMinutes: 'Meditation',
  deepWorkHours: 'Deep Work',
  sleepDuration: 'Schlaf',
  bedTime: 'Bettzeit',
  wakeTime: 'Aufstehen',
  mood: 'Stimmung',
  dayShield: 'Aussetzen',
  dayClosedAt: 'Tagesabschluss',
  journalText: 'Journal',
  anchors: 'Anker',
  anchorsDone: 'Anker-Status',
  anchorMinutes: 'Anker-Minuten',
  habitLogs: 'Habit-Log',
}

const SOURCE_LABELS: Record<DailyEventSource, string> = {
  ui: 'App',
  quick_add: 'Quick Add',
  morning_gate: 'Morgen',
  focus: 'Fokus',
  webhook: 'Webhook',
  health: 'Health',
  sync: 'Sync',
}

const RITUAL_STEP_LABELS: Record<string, string> = {
  medsShake: 'Medikamente + Shake',
  gratitude: 'Dankbarkeit',
  coldShower: 'Cold Shower',
  winnerPose: 'Winner Mode',
  prayer: 'Gebet',
  energy: 'Energie',
  todos: 'Todos',
  workout: 'Workout',
  postShower: 'Dusche',
  selfcare: 'Selfcare',
  letsGo: 'LETS GO',
}

function newEventId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID()
  return `event-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function validDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function validTimestamp(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
}

function sanitizeScalar(value: unknown): EventScalar | undefined {
  if (value === null) return null
  if (typeof value === 'boolean') return value
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') return value.slice(0, 600)
  return undefined
}

function sanitizeValue(value: unknown): EventValue | undefined {
  const scalar = sanitizeScalar(value)
  if (scalar !== undefined) return scalar
  if (!Array.isArray(value)) return undefined
  const items = value
    .slice(0, 50)
    .map(sanitizeScalar)
    .filter((item): item is EventScalar => item !== undefined)
  return items
}

function normalizeChanges(raw: unknown): Record<string, EventValue> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const changes: Record<string, EventValue> = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>).slice(0, 40)) {
    if (!key || EXCLUDED_PATCH_FIELDS.has(key)) continue
    const normalized = sanitizeValue(value)
    if (normalized !== undefined) changes[key.slice(0, 80)] = normalized
  }
  return changes
}

function normalizeBase(raw: Record<string, unknown>): DailyEventBase | null {
  if (
    typeof raw.id !== 'string'
    || !raw.id.trim()
    || !validDate(raw.date)
    || !validTimestamp(raw.occurredAt)
  ) {
    return null
  }
  const source = typeof raw.source === 'string' && SOURCES.has(raw.source as DailyEventSource)
    ? raw.source as DailyEventSource
    : 'sync'
  return {
    id: raw.id.slice(0, 240),
    date: raw.date,
    occurredAt: raw.occurredAt,
    recordedAt: validTimestamp(raw.recordedAt) ? raw.recordedAt : raw.occurredAt,
    source,
  }
}

function notifyDailyEventsChanged(): void {
  const target = globalThis as { window?: { dispatchEvent: (event: Event) => boolean }; CustomEvent?: typeof CustomEvent }
  if (!target.window || typeof target.CustomEvent !== 'function') return
  target.window.dispatchEvent(new target.CustomEvent(LIFE_OS_DAILY_EVENTS_EVENT))
}

export function normalizeDailyEvent(raw: unknown): DailyEvent | null {
  if (!raw || typeof raw !== 'object') return null
  const record = raw as Record<string, unknown>
  const base = normalizeBase(record)
  if (!base) return null

  switch (record.type) {
    case 'entry_patch': {
      const changes = normalizeChanges(record.changes)
      if (Object.keys(changes).length === 0) return null
      const previous = normalizeChanges(record.previous)
      const undoOf = typeof record.undoOf === 'string' && record.undoOf.trim()
        ? record.undoOf.slice(0, 240)
        : undefined
      return {
        ...base,
        type: 'entry_patch',
        changes,
        ...(Object.keys(previous).length > 0 ? { previous } : {}),
        ...(undoOf ? { undoOf } : {}),
      }
    }
    case 'ritual_step': {
      const status = record.status === 'completed'
        || record.status === 'reopened'
        || record.status === 'updated'
        ? record.status
        : null
      if (typeof record.stepId !== 'string' || !record.stepId.trim() || !status) return null
      const details = normalizeChanges(record.details)
      return {
        ...base,
        type: 'ritual_step',
        stepId: record.stepId.slice(0, 80),
        status,
        ...(Object.keys(details).length > 0 ? { details } : {}),
      }
    }
    default:
      return null
  }
}

export function normalizeDailyEvents(raw: unknown): DailyEvent[] {
  if (!Array.isArray(raw)) return []
  const byId = new Map<string, DailyEvent>()
  for (const item of raw) {
    const event = normalizeDailyEvent(item)
    if (event) byId.set(event.id, event)
  }
  return [...byId.values()]
    .sort((a, b) => (
      a.occurredAt.localeCompare(b.occurredAt)
      || a.recordedAt.localeCompare(b.recordedAt)
      || a.id.localeCompare(b.id)
    ))
    .slice(-MAX_DAILY_EVENTS)
}

export function mergeDailyEvents(current: unknown, incoming: unknown): DailyEvent[] {
  return normalizeDailyEvents([
    ...normalizeDailyEvents(current),
    ...normalizeDailyEvents(incoming),
  ])
}

export function createEntryPatchEvent(input: {
  date: string
  changes: Record<string, unknown>
  source: DailyEventSource
  occurredAt?: string
  id?: string
  previous?: Record<string, unknown>
  undoOf?: string
}): EntryPatchEvent | null {
  const now = new Date().toISOString()
  return normalizeDailyEvent({
    id: input.id ?? newEventId(),
    date: input.date,
    occurredAt: input.occurredAt ?? now,
    recordedAt: now,
    source: input.source,
    type: 'entry_patch',
    changes: input.changes,
    previous: input.previous,
    undoOf: input.undoOf,
  }) as EntryPatchEvent | null
}

export function diffEntryChanges(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): Record<string, unknown> {
  const changes: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(after)) {
    if (key === 'date' || EXCLUDED_PATCH_FIELDS.has(key)) continue
    if (JSON.stringify(before[key]) !== JSON.stringify(value)) changes[key] = value
  }
  return changes
}

export function capturePreviousValues(
  entry: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const previous: Record<string, unknown> = {}
  for (const key of Object.keys(patch)) {
    if (key === 'date' || EXCLUDED_PATCH_FIELDS.has(key)) continue
    previous[key] = entry[key] ?? null
  }
  return previous
}

export function createRitualStepEvent(input: {
  date: string
  stepId: string
  status?: 'completed' | 'reopened' | 'updated'
  details?: Record<string, unknown>
  occurredAt?: string
}): RitualStepEvent | null {
  const now = new Date().toISOString()
  return normalizeDailyEvent({
    id: newEventId(),
    date: input.date,
    occurredAt: input.occurredAt ?? now,
    recordedAt: now,
    source: 'morning_gate',
    type: 'ritual_step',
    stepId: input.stepId,
    status: input.status ?? 'completed',
    details: input.details,
  }) as RitualStepEvent | null
}

export function loadDailyEvents(): DailyEvent[] {
  try {
    return normalizeDailyEvents(JSON.parse(localStorage.getItem(DAILY_EVENTS_KEY) ?? '[]'))
  } catch {
    return []
  }
}

export function saveDailyEvents(events: unknown): boolean {
  try {
    localStorage.setItem(DAILY_EVENTS_KEY, JSON.stringify(normalizeDailyEvents(events)))
    notifyDailyEventsChanged()
    return true
  } catch {
    return false
  }
}

export function appendDailyEvent(event: DailyEvent | null): boolean {
  if (!event) return false
  return saveDailyEvents(mergeDailyEvents(loadDailyEvents(), [event]))
}

export function eventsForDate(events: DailyEvent[], date: string): DailyEvent[] {
  return events.filter(event => event.date === date).sort((a, b) => (
    b.occurredAt.localeCompare(a.occurredAt)
    || b.recordedAt.localeCompare(a.recordedAt)
    || b.id.localeCompare(a.id)
  ))
}

export function isEntryPatchEvent(event: DailyEvent): event is EntryPatchEvent {
  return event.type === 'entry_patch'
}

export function canUndoEntryPatch(event: DailyEvent, allEvents: DailyEvent[]): event is EntryPatchEvent {
  if (!isEntryPatchEvent(event)) return false
  if (!event.previous || Object.keys(event.previous).length === 0) return false
  if (event.undoOf) return false
  return !allEvents.some(item => isEntryPatchEvent(item) && item.undoOf === event.id)
}

export function canUndoRitualStep(event: DailyEvent, allEvents: DailyEvent[]): event is RitualStepEvent {
  if (event.type !== 'ritual_step' || event.status !== 'completed') return false
  return !allEvents.some(item => (
    item.type === 'ritual_step'
    && item.stepId === event.stepId
    && item.date === event.date
    && item.status === 'reopened'
    && item.occurredAt >= event.occurredAt
  ))
}

export function buildUndoPatch(event: EntryPatchEvent): Record<string, unknown> | null {
  if (!event.previous || Object.keys(event.previous).length === 0) return null
  return { ...event.previous }
}

export function sourceLabel(source: DailyEventSource): string {
  return SOURCE_LABELS[source]
}

function formatEventValue(value: EventValue): string {
  if (value === null) return '—'
  if (typeof value === 'boolean') return value ? 'ja' : 'nein'
  if (Array.isArray(value)) return `${value.length} Einträge`
  if (typeof value === 'number') {
    if (Number.isInteger(value)) return String(value)
    return value.toFixed(1).replace(/\.0$/, '')
  }
  const text = value.trim()
  if (!text) return '—'
  return text.length > 42 ? `${text.slice(0, 40)}…` : text
}

export function fieldLabel(key: string): string {
  return FIELD_LABELS[key] ?? key
}

export function summarizeDailyEvent(event: DailyEvent): string {
  switch (event.type) {
    case 'entry_patch': {
      if (event.undoOf) return 'Änderung rückgängig'
      const keys = Object.keys(event.changes)
      if (keys.length === 0) return 'Änderung'
      if (keys.length === 1) {
        const key = keys[0]
        return `${fieldLabel(key)}: ${formatEventValue(event.changes[key])}`
      }
      return keys.slice(0, 3).map(fieldLabel).join(' · ') + (keys.length > 3 ? ` +${keys.length - 3}` : '')
    }
    case 'ritual_step': {
      const step = RITUAL_STEP_LABELS[event.stepId] ?? event.stepId
      if (event.status === 'completed') return `${step} erledigt`
      if (event.status === 'reopened') return `${step} wieder geöffnet`
      return `${step} aktualisiert`
    }
    default: {
      const _exhaustive: never = event
      return _exhaustive
    }
  }
}

export function formatEventTime(iso: string): string {
  const date = new Date(iso)
  if (!Number.isFinite(date.getTime())) return '—'
  return new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' }).format(date)
}

/** Latest entry_patch wins per field for a date. Journal stays caller-managed. */
export function projectEntryFieldsFromEvents(
  date: string,
  events: DailyEvent[],
): Record<string, EventValue> {
  const fields: Record<string, EventValue> = {}
  const ordered = events
    .filter((event): event is EntryPatchEvent => (
      event.type === 'entry_patch' && event.date === date
    ))
    .sort((a, b) => (
      a.occurredAt.localeCompare(b.occurredAt)
      || a.recordedAt.localeCompare(b.recordedAt)
      || a.id.localeCompare(b.id)
    ))
  for (const event of ordered) {
    for (const [key, value] of Object.entries(event.changes)) {
      if (key === 'journalText' || key === 'journalDone') continue
      fields[key] = value
    }
  }
  return fields
}

export function applyEventFieldsToEntry<T extends { date: string }>(
  entry: T,
  events: DailyEvent[],
): T {
  const fields = projectEntryFieldsFromEvents(entry.date, events)
  if (Object.keys(fields).length === 0) return entry
  return { ...entry, ...fields, date: entry.date }
}

export function projectRitualDoneFromEvents(
  date: string,
  baseDone: string[],
  events: DailyEvent[],
): string[] {
  const done = new Set(baseDone)
  const ordered = events
    .filter((event): event is RitualStepEvent => (
      event.type === 'ritual_step' && event.date === date
    ))
    .sort((a, b) => (
      a.occurredAt.localeCompare(b.occurredAt)
      || a.recordedAt.localeCompare(b.recordedAt)
      || a.id.localeCompare(b.id)
    ))
  for (const event of ordered) {
    if (event.status === 'completed') done.add(event.stepId)
    if (event.status === 'reopened') done.delete(event.stepId)
  }
  return [...done]
}
