import { createHash, timingSafeEqual as nodeTimingSafeEqual } from 'node:crypto'
import { getRoom, saveRoom, type SyncSnapshot } from './sync-store.js'
import { SyncHttpError } from './sync-core.js'
import {
  alreadyProcessed,
  applyNormalizedObjects,
  getConnector,
  webhookIdempotencyKey,
} from '../projectdashboardv1/src/lib/lifeos/connectors.js'
import { createId, emptyLifeOsState, mergeLifeOsState, normalizeLifeOsState, nowIso } from '../projectdashboardv1/src/lib/lifeos/store.js'

const WINDOW_MS = 60_000
const MAX_REQUESTS = 40
const hits = new Map<string, number[]>()

function rateLimited(roomId: string): boolean {
  const now = Date.now()
  const recent = (hits.get(roomId) ?? []).filter(time => now - time < WINDOW_MS)
  recent.push(now)
  hits.set(roomId, recent)
  return recent.length > MAX_REQUESTS
}

function hashSecret(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function hashesMatch(provided: string, stored: string): boolean {
  const hashed = hashSecret(provided)
  const left = Buffer.from(hashed)
  const right = Buffer.from(stored)
  if (left.length !== right.length) return false
  return nodeTimingSafeEqual(left, right)
}

function headerMap(request: Request): Record<string, string> {
  const headers: Record<string, string> = {}
  request.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value
  })
  return headers
}

export async function applyInboundConnectorWebhook(input: {
  connector: string
  request: Request
  body: unknown
}): Promise<{ ok: true; applied: number; idempotent?: boolean; revision: number }> {
  const headers = headerMap(input.request)
  const roomId = headers['x-life-os-room'] ?? ''
  const deviceToken = (headers.authorization ?? '').replace(/^bearer\s+/i, '').trim()
    || headers['x-life-os-token']
    || ''
  const secret = headers['x-life-os-secret'] ?? headers['x-webhook-secret'] ?? ''
  const connectorId = String(input.connector || '').trim()

  if (!connectorId) throw new SyncHttpError(400, 'Connector fehlt.')
  if (!roomId || !deviceToken) throw new SyncHttpError(401, 'Raum und Token sind nötig.')
  if (rateLimited(roomId)) throw new SyncHttpError(429, 'Zu viele Webhook-Requests.')

  const connector = getConnector(connectorId)
  if (!connector) throw new SyncHttpError(404, 'Unbekannter Connector.')

  const room = await getRoom(roomId)
  if (!room) throw new SyncHttpError(404, 'Sync-Raum nicht gefunden.')
  if (!room.deviceTokens.includes(deviceToken)) {
    throw new SyncHttpError(403, 'Gerät nicht mit diesem Sync verbunden.')
  }

  const state = normalizeLifeOsState(room.snapshot?.lifeOs ?? emptyLifeOsState())
  const instance = state.connectors.find(item => item.connectorId === connectorId && item.status === 'connected')
  if (!instance) throw new SyncHttpError(409, 'Connector ist nicht verbunden.')

  const storedHash = instance.configuration.secretHash ?? ''
  if (connector.definition.authentication === 'webhook') {
    if (!secret || !storedHash || !hashesMatch(secret, storedHash)) {
      throw new SyncHttpError(401, 'Webhook-Secret ungültig.')
    }
  }

  const key = webhookIdempotencyKey(headers, input.body)
  if (alreadyProcessed(state, key)) {
    return { ok: true, applied: 0, idempotent: true, revision: room.snapshot?.revision ?? 0 }
  }

  let objects
  try {
    objects = await connector.handleWebhook(input.body, headers, {
      instance,
      verifySecret: provided => Boolean(storedHash && hashesMatch(provided, storedHash)),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Webhook fehlgeschlagen'
    throw new SyncHttpError(400, message)
  }

  const nextLife = applyNormalizedObjects(state, objects, connectorId)
  nextLife.webhookLogs = [...nextLife.webhookLogs, {
    id: createId(),
    direction: 'inbound',
    connectorId,
    status: 200,
    message: `${objects.length} Objekte normalisiert`,
    idempotencyKey: key,
    createdAt: nowIso(),
  }]
  nextLife.connectors = nextLife.connectors.map(item => (
    item.id === instance.id
      ? { ...item, lastSyncAt: nowIso(), lastError: undefined, status: 'connected', updatedAt: nowIso() }
      : item
  ))

  const updatedAt = nowIso()
  const nextRevision = (room.snapshot?.revision ?? 0) + 1
  const nextSnapshot: SyncSnapshot = {
    ...(room.snapshot ?? { entries: [] }),
    revision: nextRevision,
    updatedAt,
    entries: room.snapshot?.entries ?? [],
    lifeOs: mergeLifeOsState(state, nextLife),
  }
  room.snapshot = nextSnapshot
  room.updatedAt = updatedAt
  await saveRoom(room)
  return { ok: true, applied: objects.length, revision: nextRevision }
}

export async function dispatchOutboundWebhook(input: {
  roomId: string
  deviceToken: string
  url: string
  event: string
  payload: Record<string, string>
}): Promise<{ ok: true }> {
  if (!input.roomId || !input.deviceToken) throw new SyncHttpError(401, 'Raum und Token sind nötig.')
  const room = await getRoom(input.roomId)
  if (!room) throw new SyncHttpError(404, 'Sync-Raum nicht gefunden.')
  if (!room.deviceTokens.includes(input.deviceToken)) {
    throw new SyncHttpError(403, 'Gerät nicht mit diesem Sync verbunden.')
  }
  if (!/^https:\/\//i.test(input.url)) throw new SyncHttpError(400, 'Nur HTTPS-Ziele sind erlaubt.')

  const response = await fetch(input.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Life-Os-Event': input.event,
    },
    body: JSON.stringify({ event: input.event, payload: input.payload, sentAt: nowIso() }),
  })
  if (!response.ok) throw new SyncHttpError(502, `Outbound fehlgeschlagen (${response.status}).`)
  return { ok: true }
}
