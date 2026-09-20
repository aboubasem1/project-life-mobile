import { getRoom, saveRoom, type SyncSnapshot } from './sync-store'
import { SyncHttpError } from './sync-core'
import { appendJournal, formatNoteLine, mergeQuickNote, parseQuickNote } from './inbound-note'
import { scoreInboundEntry } from './entry-score'

const HABIT_KEYS = new Set([
  'breathingDone',
  'coldShower',
  'proteinShake',
  'pushupsDone',
  'squatsDone',
  'wallsitDone',
  'plankDone',
  'gratitudeDone',
  'focusDone',
  'winnerModeDone',
  'journalDone',
  'familyTimeDone',
])

export type InboundHookType = 'log' | 'quick' | 'task' | 'note'

export function isInboundHookType(value: unknown): value is InboundHookType {
  return value === 'log' || value === 'quick' || value === 'task' || value === 'note'
}

export function resolveInboundHookType(raw: Partial<InboundHook>): InboundHookType {
  if (isInboundHookType(raw.type)) return raw.type
  const text = String(raw.text ?? raw.title ?? '').trim()
  const hasMetric = raw.proteinGrams != null
    || raw.calories != null
    || raw.fatGrams != null
    || raw.carbsGrams != null
    || raw.fiberGrams != null
    || raw.waterLiters != null
    || raw.steps != null
    || raw.weightKg != null
    || raw.energy != null
    || Boolean(raw.habit)
  if (text && !hasMetric) return 'note'
  return 'log'
}

export type InboundHook = {
  roomId: string
  deviceToken: string
  type: InboundHookType
  date?: string
  text?: string
  title?: string
  proteinGrams?: number
  calories?: number
  fatGrams?: number
  carbsGrams?: number
  fiberGrams?: number
  waterLiters?: number
  steps?: number
  weightKg?: number
  energy?: 'low' | 'okay' | 'high'
  habit?: string
}

type LooseEntry = Record<string, unknown> & { date: string }

function todayInBerlin(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function validDate(raw: unknown): string | null {
  const value = String(raw ?? '').trim()
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null
}

function finiteNumber(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  if (typeof raw === 'string' && raw.trim()) {
    const value = Number(raw.replace(',', '.'))
    return Number.isFinite(value) ? value : null
  }
  return null
}

function validEnergy(raw: unknown): 'low' | 'okay' | 'high' | undefined {
  return raw === 'low' || raw === 'okay' || raw === 'high' ? raw : undefined
}

type QuickParse =
  | { kind: 'fields'; fields: Partial<LooseEntry> }
  | { kind: 'task'; title: string }

function parseQuickText(raw: string): QuickParse | null {
  const text = raw.trim()
  const toNumber = (match: string) => Number(match.replace(',', '.'))
  const weight = text.match(/(\d+(?:[.,]\d+)?)\s*kg\b/i)
  if (weight) return { kind: 'fields', fields: { weightKg: toNumber(weight[1]) } }
  const calories = text.match(/(\d+(?:[.,]\d+)?)\s*kcal\b/i)
  if (calories) return { kind: 'fields', fields: { calories: toNumber(calories[1]) } }
  const protein = text.match(/(\d+(?:[.,]\d+)?)\s*(?:g\s*)?(?:protein|eiwei[sß])\b/i)
    ?? text.match(/(\d+(?:[.,]\d+)?)\s*g\s*p\b/i)
  if (protein) return { kind: 'fields', fields: { proteinGrams: toNumber(protein[1]) } }
  const fat = text.match(/(\d+(?:[.,]\d+)?)\s*(?:g\s*)?(?:fett|fat)\b/i)
  if (fat) return { kind: 'fields', fields: { fatGrams: toNumber(fat[1]) } }
  const carbs = text.match(/(\d+(?:[.,]\d+)?)\s*(?:g\s*)?(?:kh|kohlenhydrate|carbs?)\b/i)
  if (carbs) return { kind: 'fields', fields: { carbsGrams: toNumber(carbs[1]) } }
  const fiber = text.match(/(\d+(?:[.,]\d+)?)\s*(?:g\s*)?(?:ballaststoffe?|fiber)\b/i)
  if (fiber) return { kind: 'fields', fields: { fiberGrams: toNumber(fiber[1]) } }
  const water = text.match(/(\d+(?:[.,]\d+)?)\s*(?:l|liter)\b/i)
  if (water) return { kind: 'fields', fields: { waterLiters: toNumber(water[1]) } }
  const steps = text.match(/(\d+(?:[.,]\d+)?)\s*(?:schritte|steps)\b/i)
  if (steps) return { kind: 'fields', fields: { steps: Math.round(toNumber(steps[1])) } }
  if (text) return { kind: 'task', title: text }
  return null
}

function seedEntry(date: string): LooseEntry {
  return {
    date,
    mood: '',
    sleepQuality: '',
    sleepDuration: '',
    meditationMinutes: 0,
    coldShower: false,
    proteinShake: false,
    pushupsDone: false,
    squatsDone: false,
    wallsitDone: false,
    plankDone: false,
    gratitudeDone: false,
    focusDone: false,
    winnerModeDone: false,
    proteinReached: false,
    caloriesReached: false,
    proteinGrams: 0,
    calories: 0,
    fatGrams: 0,
    carbsGrams: 0,
    fiberGrams: 0,
    tasksDone: 0,
    journalDone: false,
    journalText: '',
    familyTimeDone: false,
    weightKg: 0,
    waterLiters: 0,
    deepWorkHours: 0,
    steps: 0,
    dailyScore: 0,
    breathingDone: false,
    anchors: [],
    anchorsDone: [],
    anchorMinutes: [],
    updatedAt: new Date().toISOString(),
  }
}

function addTask(entry: LooseEntry, title: string): void {
  const anchors = Array.isArray(entry.anchors) ? entry.anchors.map(item => String(item)) : []
  const done = Array.isArray(entry.anchorsDone) ? entry.anchorsDone.map(item => Boolean(item)) : []
  const minutes = Array.isArray(entry.anchorMinutes) ? entry.anchorMinutes.map(item => Number(item)) : []
  anchors.push(title)
  done.push(false)
  minutes.push(25)
  entry.anchors = anchors
  entry.anchorsDone = done
  entry.anchorMinutes = minutes
}

function applyPatch(entry: LooseEntry, hook: InboundHook): LooseEntry {
  const next = { ...entry }
  if (hook.type === 'note') {
    const text = (hook.text ?? hook.title ?? '').trim()
    if (text) {
      next.journalText = appendJournal(String(next.journalText ?? ''), formatNoteLine(text))
      next.journalDone = true
    }
    next.updatedAt = typeof entry.updatedAt === 'string' && entry.updatedAt
      ? entry.updatedAt
      : new Date().toISOString()
    return next
  }

  const fromText = hook.text ? parseQuickText(hook.text) : null
  if (fromText?.kind === 'task' && hook.type !== 'log') {
    addTask(next, fromText.title)
  } else if (fromText?.kind === 'fields') {
    Object.assign(next, fromText.fields)
  }

  if (hook.proteinGrams !== null && hook.proteinGrams !== undefined) next.proteinGrams = hook.proteinGrams
  if (hook.calories !== null && hook.calories !== undefined) next.calories = hook.calories
  if (hook.fatGrams !== null && hook.fatGrams !== undefined) next.fatGrams = hook.fatGrams
  if (hook.carbsGrams !== null && hook.carbsGrams !== undefined) next.carbsGrams = hook.carbsGrams
  if (hook.fiberGrams !== null && hook.fiberGrams !== undefined) next.fiberGrams = hook.fiberGrams
  if (hook.waterLiters !== null && hook.waterLiters !== undefined) next.waterLiters = hook.waterLiters
  if (hook.steps !== null && hook.steps !== undefined) next.steps = hook.steps
  if (hook.weightKg !== null && hook.weightKg !== undefined) {
    next.weightKg = hook.weightKg
    next.weightMeasuredAt = new Date().toISOString()
  }
  if (hook.energy) next.energyLevel = hook.energy
  if (hook.habit && HABIT_KEYS.has(hook.habit)) next[hook.habit] = true

  if (hook.type === 'task' && hook.title?.trim()) {
    addTask(next, hook.title.trim())
  }

  next.updatedAt = new Date().toISOString()
  return next
}

export async function applyInboundHook(raw: InboundHook): Promise<{
  date: string
  revision: number
  updatedAt: string
}> {
  const roomId = String(raw.roomId ?? '').trim()
  const deviceToken = String(raw.deviceToken ?? '').trim()
  if (!roomId || !deviceToken) {
    throw new SyncHttpError(400, 'roomId und deviceToken sind nötig.')
  }

  const type = resolveInboundHookType(raw)

  const room = await getRoom(roomId)
  if (!room) throw new SyncHttpError(404, 'Sync-Raum nicht gefunden.')
  if (!room.deviceTokens.includes(deviceToken)) {
    throw new SyncHttpError(403, 'Gerät nicht mit diesem Sync verbunden.')
  }

  const noteText = (raw.text ?? raw.title ?? '').trim()
  if (type === 'note' && !noteText) {
    throw new SyncHttpError(400, 'Notiz braucht text.')
  }

  const date = validDate(raw.date) ?? todayInBerlin()
  const snapshot = room.snapshot
  const entries = Array.isArray(snapshot?.entries)
    ? snapshot.entries.filter((item): item is LooseEntry => Boolean(item && typeof item === 'object'))
    : []
  const index = entries.findIndex(item => String(item.date) === date)
  const current = index >= 0
    ? { ...seedEntry(date), ...entries[index], date }
    : seedEntry(date)
  const patched = scoreInboundEntry(applyPatch(current, {
    ...raw,
    roomId,
    deviceToken,
    type,
    proteinGrams: finiteNumber(raw.proteinGrams) ?? undefined,
    calories: finiteNumber(raw.calories) ?? undefined,
    fatGrams: finiteNumber(raw.fatGrams) ?? undefined,
    carbsGrams: finiteNumber(raw.carbsGrams) ?? undefined,
    fiberGrams: finiteNumber(raw.fiberGrams) ?? undefined,
    waterLiters: finiteNumber(raw.waterLiters) ?? undefined,
    steps: finiteNumber(raw.steps) ?? undefined,
    weightKg: finiteNumber(raw.weightKg) ?? undefined,
    energy: validEnergy(raw.energy),
  }), snapshot?.settings)

  if (index >= 0) entries[index] = patched
  else entries.push(patched)

  const updatedAt = new Date().toISOString()
  const nextRevision = (snapshot?.revision ?? 0) + 1
  const nextSnapshot: SyncSnapshot = {
    revision: nextRevision,
    updatedAt,
    entries,
    settings: snapshot?.settings,
    dashboardPlus: snapshot?.dashboardPlus,
    xp: snapshot?.xp,
    quickNote: type === 'note' && noteText
      ? mergeQuickNote(parseQuickNote(snapshot?.quickNote), formatNoteLine(noteText))
      : snapshot?.quickNote,
    bodyMeasurements: snapshot?.bodyMeasurements,
    healthIngest: snapshot?.healthIngest,
    morningRitualProgress: snapshot?.morningRitualProgress,
  }
  room.snapshot = nextSnapshot
  room.updatedAt = updatedAt
  await saveRoom(room)
  return { date, revision: nextRevision, updatedAt }
}
