import { randomInt, randomUUID } from 'node:crypto'
import {
  getRoom,
  getRoomIdByPairCode,
  saveRoom,
  syncStorageMode,
  type SyncRoom,
  type SyncSnapshot,
} from './sync-store.js'
import { mergeBodyMeasurements, mergeHealthIngestState, normalizeBodyMeasurements } from '../projectdashboardv1/src/lib/bodyMeasurement.js'
import { mergeDayJournal, mergeQuickNoteStates, parseQuickNote } from './inbound-note.js'

const PAIR_TTL_MS = 30 * 60 * 1000
const MAX_DEVICES = 8

export class SyncHttpError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'SyncHttpError'
    this.status = status
  }
}

export function syncJson(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Life-Os-Room, X-Life-Os-Token',
    },
  })
}

export function syncError(error: unknown): Response {
  if (error instanceof SyncHttpError) {
    return syncJson({ error: error.message, storage: syncStorageMode() }, error.status)
  }
  const message = error instanceof Error ? error.message : 'Unbekannter Sync-Fehler'
  return syncJson({ error: message, storage: syncStorageMode() }, 500)
}

export async function readSyncJson<T>(request: Request): Promise<T> {
  try {
    return await request.json() as T
  } catch {
    throw new SyncHttpError(400, 'Ungültiger JSON-Body.')
  }
}

function newPairCode(): string {
  return String(randomInt(100000, 999999))
}

function assertDevice(room: SyncRoom, deviceToken: string): void {
  if (!room.deviceTokens.includes(deviceToken)) {
    throw new SyncHttpError(403, 'Gerät nicht mit diesem Sync verbunden.')
  }
}

type LooseRitualProgress = {
  date: string
  done: string[]
  selfcareChecked: string[]
  pushups: number
  ko: number
}

function normalizeRitualProgress(raw: unknown): LooseRitualProgress | null {
  if (!raw || typeof raw !== 'object') return null
  const value = raw as Partial<LooseRitualProgress>
  if (typeof value.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.date)) return null
  return {
    date: value.date,
    done: Array.isArray(value.done) ? [...new Set(value.done.map(String))] : [],
    selfcareChecked: Array.isArray(value.selfcareChecked)
      ? [...new Set(value.selfcareChecked.map(String))]
      : [],
    pushups: Math.max(0, Number(value.pushups) || 0),
    ko: Math.max(0, Number(value.ko) || 0),
  }
}

function mergeRitualProgress(current: unknown, incoming: unknown): LooseRitualProgress | undefined {
  const previous = normalizeRitualProgress(current)
  const next = normalizeRitualProgress(incoming)
  if (!previous) return next ?? undefined
  if (!next) return previous
  if (previous.date !== next.date) return previous.date > next.date ? previous : next
  return {
    date: previous.date,
    done: [...new Set([...previous.done, ...next.done])],
    selfcareChecked: [...new Set([...previous.selfcareChecked, ...next.selfcareChecked])],
    pushups: Math.max(previous.pushups, next.pushups),
    ko: Math.max(previous.ko, next.ko),
  }
}

export async function createSyncRoom(): Promise<{
  roomId: string
  pairCode: string
  deviceToken: string
  expiresAt: string
  storage: string
}> {
  const roomId = randomUUID()
  const deviceToken = randomUUID()
  let pairCode = newPairCode()
  // rare collision retry
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const existing = await getRoomIdByPairCode(pairCode)
    if (!existing) break
    pairCode = newPairCode()
  }

  const now = new Date().toISOString()
  const expiresAt = Date.now() + PAIR_TTL_MS
  const room: SyncRoom = {
    roomId,
    deviceTokens: [deviceToken],
    pairCode,
    pairCodeExpiresAt: expiresAt,
    snapshot: null,
    createdAt: now,
    updatedAt: now,
  }
  await saveRoom(room)
  return {
    roomId,
    pairCode,
    deviceToken,
    expiresAt: new Date(expiresAt).toISOString(),
    storage: syncStorageMode(),
  }
}

export async function joinSyncRoom(pairCodeRaw: string): Promise<{
  roomId: string
  deviceToken: string
  storage: string
}> {
  const pairCode = String(pairCodeRaw ?? '').replace(/\D/g, '').slice(0, 6)
  if (pairCode.length !== 6) {
    throw new SyncHttpError(400, 'Bitte den 6-stelligen Code eingeben.')
  }

  const roomId = await getRoomIdByPairCode(pairCode)
  if (!roomId) throw new SyncHttpError(404, 'Code ungültig oder abgelaufen.')

  const room = await getRoom(roomId)
  if (!room || room.pairCode !== pairCode) {
    throw new SyncHttpError(404, 'Code ungültig oder abgelaufen.')
  }
  if (!room.pairCodeExpiresAt || room.pairCodeExpiresAt < Date.now()) {
    room.pairCode = null
    room.pairCodeExpiresAt = null
    await saveRoom(room, pairCode)
    throw new SyncHttpError(410, 'Code abgelaufen. Bitte auf dem anderen Gerät neu erzeugen.')
  }
  if (room.deviceTokens.length >= MAX_DEVICES) {
    throw new SyncHttpError(409, 'Zu viele Geräte in diesem Sync.')
  }

  const deviceToken = randomUUID()
  const previousPair = room.pairCode
  room.deviceTokens.push(deviceToken)
  room.pairCode = null
  room.pairCodeExpiresAt = null
  room.updatedAt = new Date().toISOString()
  await saveRoom(room, previousPair)

  return { roomId: room.roomId, deviceToken, storage: syncStorageMode() }
}

export async function refreshPairCode(roomId: string, deviceToken: string): Promise<{
  pairCode: string
  expiresAt: string
}> {
  const room = await getRoom(roomId)
  if (!room) throw new SyncHttpError(404, 'Sync-Raum nicht gefunden.')
  assertDevice(room, deviceToken)

  const previousPair = room.pairCode
  let pairCode = newPairCode()
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const existing = await getRoomIdByPairCode(pairCode)
    if (!existing || existing === roomId) break
    pairCode = newPairCode()
  }
  const expiresAt = Date.now() + PAIR_TTL_MS
  room.pairCode = pairCode
  room.pairCodeExpiresAt = expiresAt
  room.updatedAt = new Date().toISOString()
  await saveRoom(room, previousPair)
  return { pairCode, expiresAt: new Date(expiresAt).toISOString() }
}

export async function pushSyncSnapshot(input: {
  roomId: string
  deviceToken: string
  snapshot: SyncSnapshot
}): Promise<{ revision: number; updatedAt: string }> {
  const room = await getRoom(input.roomId)
  if (!room) throw new SyncHttpError(404, 'Sync-Raum nicht gefunden.')
  assertDevice(room, input.deviceToken)

  const incoming = input.snapshot
  if (!incoming || typeof incoming !== 'object' || !Array.isArray(incoming.entries)) {
    throw new SyncHttpError(400, 'Ungültiger Sync-Snapshot.')
  }

  const currentRevision = room.snapshot?.revision ?? 0
  const nextRevision = Math.max(currentRevision + 1, Number(incoming.revision) || currentRevision + 1)
  const updatedAt = new Date().toISOString()
  const priorEntries = Array.isArray(room.snapshot?.entries) ? room.snapshot.entries : []
  const mergedByDate = new Map<string, { date?: string; updatedAt?: string; journalText?: unknown; journalDone?: unknown }>()
  for (const item of [...priorEntries, ...incoming.entries]) {
    if (!item || typeof item !== 'object') continue
    const entry = item as { date?: string; updatedAt?: string; journalText?: unknown; journalDone?: unknown }
    if (typeof entry.date !== 'string') continue
    const existing = mergedByDate.get(entry.date)
    if (!existing) {
      mergedByDate.set(entry.date, entry)
      continue
    }
    const incomingAt = Date.parse(String(entry.updatedAt ?? '')) || 0
    const existingAt = Date.parse(String(existing.updatedAt ?? '')) || 0
    const newer = incomingAt >= existingAt ? entry : existing
    const older = newer === entry ? existing : entry
    mergedByDate.set(entry.date, mergeDayJournal(newer, older))
  }
  room.snapshot = {
    revision: nextRevision,
    updatedAt,
    entries: [...mergedByDate.values()],
    settings: incoming.settings ?? room.snapshot?.settings,
    dashboardPlus: incoming.dashboardPlus ?? room.snapshot?.dashboardPlus,
    xp: incoming.xp ?? room.snapshot?.xp,
    quickNote: mergeQuickNoteStates(
      parseQuickNote(room.snapshot?.quickNote),
      parseQuickNote(incoming.quickNote),
    ) ?? incoming.quickNote ?? room.snapshot?.quickNote,
    bodyMeasurements: mergeBodyMeasurements(
      normalizeBodyMeasurements(room.snapshot?.bodyMeasurements),
      normalizeBodyMeasurements(incoming.bodyMeasurements),
    ),
    healthIngest: mergeHealthIngestState(room.snapshot?.healthIngest, incoming.healthIngest),
    morningRitualProgress: mergeRitualProgress(
      room.snapshot?.morningRitualProgress,
      incoming.morningRitualProgress,
    ),
  }
  room.updatedAt = updatedAt
  await saveRoom(room)
  return { revision: nextRevision, updatedAt }
}

export async function pullSyncSnapshot(roomId: string, deviceToken: string): Promise<{
  snapshot: SyncSnapshot | null
  storage: string
}> {
  const room = await getRoom(roomId)
  if (!room) throw new SyncHttpError(404, 'Sync-Raum nicht gefunden.')
  assertDevice(room, deviceToken)
  return { snapshot: room.snapshot, storage: syncStorageMode() }
}
