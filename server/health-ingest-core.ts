import {
  filterNewSampleIds,
  mergeBodyMeasurements,
  mergeHealthIngestState,
  normalizeBodyMeasurements,
  normalizeHealthIngestState,
  parseHealthIngestBody,
  type HealthDailyPatch,
  type HealthIngestState,
} from '../projectdashboardv1/src/lib/bodyMeasurement.js'
import { SyncHttpError } from './sync-core.js'
import { getRoom, saveRoom, type SyncSnapshot } from './sync-store.js'
import { scoreInboundEntry } from './entry-score.js'
import {
  createEntryPatchEvent,
  capturePreviousValues,
  diffEntryChanges,
  mergeDailyEvents,
} from '../projectdashboardv1/src/lib/dailyEvents.js'

type LooseEntry = Record<string, unknown> & { date: string }

function bearerOrQuery(request: Request, body: Record<string, unknown>): {
  roomId: string
  deviceToken: string
} {
  const url = new URL(request.url)
  const header = request.headers.get('authorization') ?? ''
  const bearer = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : ''
  const roomId = String(
    request.headers.get('x-life-os-room')
    ?? request.headers.get('x-room-id')
    ?? url.searchParams.get('roomId')
    ?? body.roomId
    ?? '',
  ).trim()
  const deviceToken = String(
    bearer
    || request.headers.get('x-life-os-token')
    || url.searchParams.get('deviceToken')
    || body.deviceToken
    || '',
  ).trim()
  return { roomId, deviceToken }
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

function applyDailyPatch(entry: LooseEntry, patch: HealthDailyPatch): LooseEntry {
  const next = { ...entry }
  let changed = false
  const currentMeasuredAt = typeof next.weightMeasuredAt === 'string' ? next.weightMeasuredAt : ''
  if (patch.weightKg != null && patch.weightKg > 0) {
    const incomingAt = patch.weightMeasuredAt ?? ''
    const currentWeight = Number(next.weightKg) || 0
    if (currentWeight <= 0 || !currentMeasuredAt || incomingAt >= currentMeasuredAt) {
      next.weightKg = patch.weightKg
      if (incomingAt) next.weightMeasuredAt = incomingAt
      changed = true
    }
  }
  if (patch.bodyFatPercent != null && patch.bodyFatPercent > 0) {
    next.bodyFatPercent = patch.bodyFatPercent
    changed = true
  }
  if (patch.steps != null && patch.steps > 0) {
    const currentSteps = Number(next.steps) || 0
    if (patch.steps >= currentSteps) {
      next.steps = patch.steps
      changed = true
    }
  }
  if (changed) next.updatedAt = new Date().toISOString()
  return next
}

function applyPatches(
  entries: LooseEntry[],
  patches: HealthDailyPatch[],
  settings: unknown,
): { entries: LooseEntry[]; dates: string[] } {
  const next = [...entries]
  const dates: string[] = []
  for (const patch of patches) {
    if (patch.weightKg == null && patch.bodyFatPercent == null && patch.steps == null) continue
    const index = next.findIndex(item => String(item.date) === patch.date)
    const current = index >= 0
      ? { ...seedEntry(patch.date), ...next[index], date: patch.date }
      : seedEntry(patch.date)
    const patched = scoreInboundEntry(applyDailyPatch(current, patch), settings)
    if (index >= 0) next[index] = patched
    else next.push(patched)
    dates.push(patch.date)
  }
  return { entries: next, dates: [...new Set(dates)].sort() }
}

export async function applyHealthIngest(request: Request, body: unknown): Promise<{
  accepted: number
  skipped: number
  dates: string[]
  revision: number
  updatedAt: string
}> {
  const root = body && typeof body === 'object' ? body as Record<string, unknown> : {}
  const { roomId, deviceToken } = bearerOrQuery(request, root)
  if (!roomId || !deviceToken) {
    throw new SyncHttpError(400, 'roomId und deviceToken sind nötig.')
  }

  const parsed = parseHealthIngestBody(body)
  if (parsed.sampleIds.length === 0 && parsed.measurements.length === 0) {
    throw new SyncHttpError(400, 'Keine gültigen Health-Messwerte im Body.')
  }

  const room = await getRoom(roomId)
  if (!room) throw new SyncHttpError(404, 'Sync-Raum nicht gefunden.')
  if (!room.deviceTokens.includes(deviceToken)) {
    throw new SyncHttpError(403, 'Gerät nicht mit diesem Sync verbunden.')
  }

  const snapshot = room.snapshot
  const existingMeasurements = normalizeBodyMeasurements(snapshot?.bodyMeasurements)
  const ingestState = normalizeHealthIngestState(snapshot?.healthIngest)
  const dedup = filterNewSampleIds(ingestState, parsed.sampleIds)
  const measurements = mergeBodyMeasurements(existingMeasurements, parsed.measurements)
  const entries = Array.isArray(snapshot?.entries)
    ? snapshot.entries.filter((item): item is LooseEntry => Boolean(item && typeof item === 'object' && typeof (item as { date?: unknown }).date === 'string'))
    : []
  const patched = applyPatches(entries, parsed.dailyPatches, snapshot?.settings)
  const ingestEvents = patched.dates.map(date => {
    const before = entries.find(item => item.date === date) ?? seedEntry(date)
    const after = patched.entries.find(item => item.date === date)
    if (!after) return null
    const changes = diffEntryChanges(before, after)
    return createEntryPatchEvent({
      date,
      changes,
      previous: capturePreviousValues(before, changes),
      source: 'health',
      occurredAt: typeof after.updatedAt === 'string' ? after.updatedAt : undefined,
    })
  })
  const nextIngest: HealthIngestState = mergeHealthIngestState(dedup.next, snapshot?.healthIngest)
  const updatedAt = new Date().toISOString()
  const nextRevision = (snapshot?.revision ?? 0) + 1
  const nextSnapshot: SyncSnapshot = {
    revision: nextRevision,
    updatedAt,
    entries: patched.entries,
    settings: snapshot?.settings,
    dashboardPlus: snapshot?.dashboardPlus,
    xp: snapshot?.xp,
    quickNote: snapshot?.quickNote,
    bodyMeasurements: measurements,
    healthIngest: nextIngest,
    morningRitualProgress: snapshot?.morningRitualProgress,
    dailyEvents: mergeDailyEvents(snapshot?.dailyEvents, ingestEvents),
    lifeOs: snapshot?.lifeOs,
    privateVault: snapshot?.privateVault,
  }
  room.snapshot = nextSnapshot
  room.updatedAt = updatedAt
  await saveRoom(room)

  return {
    accepted: dedup.fresh.length,
    skipped: dedup.skipped,
    dates: patched.dates,
    revision: nextRevision,
    updatedAt,
  }
}
