import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { databaseConfigured, databaseQuery, probeDatabase } from './database.js'
import {
  createObjectKey,
  headStoredObject,
  normalizeContentType,
  objectStorageConfigured,
  putStoredObject,
} from './object-storage.js'

function loadLocalEnvFiles(): void {
  const candidates = [
    path.join(process.cwd(), '.env.local'),
    path.join(process.cwd(), 'projectdashboardv1', '.env.local'),
    path.join(process.cwd(), '..', '.env.local'),
  ]
  for (const file of candidates) {
    if (!existsSync(file)) continue
    try {
      const text = readFileSync(file, 'utf8')
      for (const rawLine of text.split('\n')) {
        const line = rawLine.trim()
        if (!line || line.startsWith('#')) continue
        const eq = line.indexOf('=')
        if (eq <= 0) continue
        const key = line.slice(0, eq).trim()
        const value = line.slice(eq + 1).trim()
        if (!key.startsWith('UPSTASH_')) continue
        if (process.env.VERCEL) {
          if (!process.env[key]) process.env[key] = value
        } else {
          process.env[key] = value
        }
      }
    } catch {
      /* ignore */
    }
  }
}

loadLocalEnvFiles()

export type SyncSnapshot = {
  revision: number
  updatedAt: string
  entries: unknown[]
  settings?: unknown
  dashboardPlus?: unknown
  xp?: unknown
  quickNote?: unknown
  bodyMeasurements?: unknown
  healthIngest?: unknown
  morningRitualProgress?: unknown
  dailyEvents?: unknown
  lifeOs?: unknown
  privateVault?: unknown
}

export type SyncRoom = {
  roomId: string
  deviceTokens: string[]
  pairCode: string | null
  pairCodeExpiresAt: number | null
  snapshot: SyncSnapshot | null
  createdAt: string
  updatedAt: string
}

type SyncStoreFile = {
  rooms: Record<string, SyncRoom>
  pairIndex: Record<string, string>
}

const MEMORY_KEY = '__lifeOsSyncStore'
const LOCAL_FILE = path.join(process.cwd(), 'projectdashboardv1', '.data', 'life-os-sync.json')
const MAX_SNAPSHOT_CHARS = 1_400_000

/** After a failed Upstash call off Vercel, stay on the file store for this process. */
let localUpstashBroken = false

export type SyncStorageMode = 'postgres' | 'upstash' | 'file' | 'memory'

export type SyncStorageProbe = {
  ok: boolean
  storage: SyncStorageMode
  time: string
  error?: string
  warning?: string
}

function memoryStore(): SyncStoreFile {
  const g = globalThis as typeof globalThis & { [MEMORY_KEY]?: SyncStoreFile }
  if (!g[MEMORY_KEY]) {
    g[MEMORY_KEY] = { rooms: {}, pairIndex: {} }
  }
  return g[MEMORY_KEY]!
}

function hasUpstash(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL?.trim() && process.env.UPSTASH_REDIS_REST_TOKEN?.trim(),
  )
}

function usesUpstash(): boolean {
  return hasUpstash() && !localUpstashBroken
}

function markLocalUpstashBroken(): void {
  if (!process.env.VERCEL) localUpstashBroken = true
}

function upstashBridgeEnabled(): boolean {
  const value = process.env.SYNC_UPSTASH_BRIDGE?.trim().toLowerCase()
  return databaseConfigured() && hasUpstash() && ['1', 'true', 'yes', 'on'].includes(value ?? '')
}

function newerRoom(left: SyncRoom | null, right: SyncRoom | null): SyncRoom | null {
  if (!left) return right
  if (!right) return left
  return Date.parse(right.updatedAt) > Date.parse(left.updatedAt) ? right : left
}

function abortSignalAfter(ms: number): AbortSignal {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(ms)
  }
  const controller = new AbortController()
  setTimeout(() => controller.abort(), ms)
  return controller.signal
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} Timeout (${ms}ms).`)), ms)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

async function upstashFetch(command: unknown[]): Promise<unknown> {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim()
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim()
  if (!url || !token) {
    throw new Error(
      'Upstash nicht konfiguriert. Bitte UPSTASH_REDIS_REST_URL und UPSTASH_REDIS_REST_TOKEN auf Vercel setzen.',
    )
  }

  let response: Response
  try {
    response = await withTimeout(
      fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(command),
        signal: abortSignalAfter(8_000),
      }),
      8_500,
      'Upstash',
    )
  } catch (error) {
    markLocalUpstashBroken()
    if (
      error instanceof Error
      && (error.name === 'AbortError' || error.name === 'TimeoutError' || /Timeout/i.test(error.message))
    ) {
      throw new Error(
        'Upstash Timeout — Redis antwortet nicht. Prüfe UPSTASH_REDIS_REST_URL/TOKEN auf Vercel (temporäre DB ggf. neu claimen).',
      )
    }
    throw error
  }
  if (!response.ok) {
    throw new Error(`Upstash Fehler (${response.status})`)
  }
  const payload = await response.json() as { result?: unknown; error?: string }
  if (payload.error) throw new Error(payload.error)
  return payload.result
}

async function readLocalFile(): Promise<SyncStoreFile> {
  try {
    const raw = await readFile(LOCAL_FILE, 'utf8')
    const parsed = JSON.parse(raw) as SyncStoreFile
    return {
      rooms: parsed.rooms ?? {},
      pairIndex: parsed.pairIndex ?? {},
    }
  } catch {
    return { rooms: {}, pairIndex: {} }
  }
}

async function writeLocalFile(store: SyncStoreFile): Promise<void> {
  await mkdir(path.dirname(LOCAL_FILE), { recursive: true })
  await writeFile(LOCAL_FILE, JSON.stringify(store), 'utf8')
}

type PostgresRoomRow = {
  room_id: string
  device_tokens: string[]
  pair_code: string | null
  pair_code_expires_at: Date | string | null
  snapshot: SyncSnapshot | null
  created_at: Date | string
  updated_at: Date | string
}

function postgresRowToRoom(row: PostgresRoomRow): SyncRoom {
  return {
    roomId: row.room_id,
    deviceTokens: Array.isArray(row.device_tokens) ? row.device_tokens : [],
    pairCode: row.pair_code,
    pairCodeExpiresAt: row.pair_code_expires_at ? new Date(row.pair_code_expires_at).getTime() : null,
    snapshot: row.snapshot,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  }
}

async function getRoomFromPostgres(roomId: string): Promise<SyncRoom | null> {
  const result = await databaseQuery<PostgresRoomRow>(`
    SELECT room_id, device_tokens, pair_code, pair_code_expires_at, snapshot, created_at, updated_at
    FROM lifeos_sync_rooms
    WHERE room_id = $1
    LIMIT 1
  `, [roomId])
  return result.rows[0] ? postgresRowToRoom(result.rows[0]) : null
}

async function clearExpiredPairCodesFromPostgres(): Promise<void> {
  await databaseQuery(`
    UPDATE lifeos_sync_rooms
    SET pair_code = NULL, pair_code_expires_at = NULL
    WHERE pair_code IS NOT NULL
      AND pair_code_expires_at <= now()
  `)
}

async function getRoomIdByPairCodeFromPostgres(pairCode: string): Promise<string | null> {
  await clearExpiredPairCodesFromPostgres()
  const result = await databaseQuery<{ room_id: string }>(`
    SELECT room_id
    FROM lifeos_sync_rooms
    WHERE pair_code = $1
      AND pair_code_expires_at > now()
    LIMIT 1
  `, [pairCode])
  return result.rows[0]?.room_id ?? null
}

async function saveRoomToPostgres(room: SyncRoom): Promise<void> {
  if (room.pairCode) await clearExpiredPairCodesFromPostgres()
  await databaseQuery(`
    INSERT INTO lifeos_sync_rooms (
      room_id,
      device_tokens,
      pair_code,
      pair_code_expires_at,
      snapshot,
      created_at,
      updated_at
    ) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
    ON CONFLICT (room_id) DO UPDATE SET
      device_tokens = EXCLUDED.device_tokens,
      pair_code = EXCLUDED.pair_code,
      pair_code_expires_at = EXCLUDED.pair_code_expires_at,
      snapshot = EXCLUDED.snapshot,
      updated_at = EXCLUDED.updated_at
  `, [
    room.roomId,
    room.deviceTokens,
    room.pairCode,
    room.pairCodeExpiresAt ? new Date(room.pairCodeExpiresAt) : null,
    room.snapshot ? JSON.stringify(room.snapshot) : null,
    room.createdAt,
    room.updatedAt,
  ])
}

async function getRoomFromUpstash(roomId: string): Promise<SyncRoom | null> {
  const raw = await upstashFetch(['GET', `lifeos:sync:room:${roomId}`])
  if (typeof raw !== 'string' || !raw) return null
  return JSON.parse(raw) as SyncRoom
}

async function saveRoomToUpstash(room: SyncRoom, previousPairCode?: string | null): Promise<void> {
  await upstashFetch(['SET', `lifeos:sync:room:${room.roomId}`, JSON.stringify(room)])
  if (previousPairCode && previousPairCode !== room.pairCode) {
    await upstashFetch(['DEL', `lifeos:sync:pair:${previousPairCode}`])
  }
  if (room.pairCode && room.pairCodeExpiresAt) {
    const ttlSeconds = Math.max(1, Math.ceil((room.pairCodeExpiresAt - Date.now()) / 1000))
    await upstashFetch(['SET', `lifeos:sync:pair:${room.pairCode}`, room.roomId, 'EX', ttlSeconds])
  }
}

type EmbeddedCapture = Record<string, unknown> & {
  id?: unknown
  fileName?: unknown
  fileDataUrl?: unknown
  fileStorageKey?: unknown
  fileContentType?: unknown
}

function decodeEmbeddedFile(value: unknown): { body: Uint8Array; contentType: string } | null {
  if (typeof value !== 'string' || !value.startsWith('data:')) return null
  const comma = value.indexOf(',')
  if (comma < 0) return null
  const header = value.slice(5, comma)
  const payload = value.slice(comma + 1)
  const base64 = header.toLowerCase().endsWith(';base64')
  const rawType = base64 ? header.slice(0, -7) : header
  try {
    const buffer = base64
      ? Buffer.from(payload, 'base64')
      : Buffer.from(decodeURIComponent(payload), 'utf8')
    if (buffer.length === 0 || buffer.length > 2 * 1024 * 1024) return null
    return {
      body: new Uint8Array(buffer),
      contentType: normalizeContentType(rawType),
    }
  } catch {
    return null
  }
}

async function migrateEmbeddedCaptureFiles(room: SyncRoom): Promise<boolean> {
  if (!databaseConfigured() || !objectStorageConfigured() || !room.snapshot?.lifeOs) return false
  if (typeof room.snapshot.lifeOs !== 'object' || room.snapshot.lifeOs === null) return false
  const lifeOs = room.snapshot.lifeOs as Record<string, unknown>
  if (!Array.isArray(lifeOs.captures)) return false

  let changed = false
  const captures: unknown[] = []
  for (const rawCapture of lifeOs.captures) {
    if (!rawCapture || typeof rawCapture !== 'object') {
      captures.push(rawCapture)
      continue
    }
    const capture = rawCapture as EmbeddedCapture
    if (typeof capture.fileStorageKey === 'string' && capture.fileStorageKey) {
      captures.push(capture)
      continue
    }
    const embedded = decodeEmbeddedFile(capture.fileDataUrl)
    if (!embedded) {
      captures.push(capture)
      continue
    }

    try {
      const objectId = randomUUID()
      const storageKey = createObjectKey('captures', room.roomId)
      const fileName = typeof capture.fileName === 'string' && capture.fileName.trim()
        ? capture.fileName.trim().replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 255)
        : 'Datei'
      const contentType = normalizeContentType(capture.fileContentType || embedded.contentType)
      await putStoredObject({ storageKey, contentType, body: embedded.body })
      const stored = await headStoredObject(storageKey)
      if (stored.sizeBytes !== embedded.body.byteLength) {
        throw new Error('Uploaded capture size does not match the embedded original.')
      }
      await databaseQuery(`
        INSERT INTO lifeos_objects (
          id, room_id, category, storage_key, original_name, content_type, size_bytes, status, uploaded_at
        ) VALUES ($1, $2, 'captures', $3, $4, $5, $6, 'ready', now())
      `, [objectId, room.roomId, storageKey, fileName, contentType, embedded.body.byteLength])
      captures.push({
        ...capture,
        fileDataUrl: undefined,
        fileObjectId: objectId,
        fileStorageKey: storageKey,
        fileContentType: contentType,
        fileSize: embedded.body.byteLength,
      })
      changed = true
    } catch (error) {
      console.warn('Embedded capture migration failed; original data remains intact.', error)
      captures.push(capture)
    }
  }

  if (!changed) return false
  room.snapshot = {
    ...room.snapshot,
    lifeOs: { ...lifeOs, captures },
  }
  room.updatedAt = new Date().toISOString()
  return true
}

async function finalizePostgresRoom(room: SyncRoom | null, mirrorToUpstash: boolean): Promise<SyncRoom | null> {
  if (!room) return null
  if (await migrateEmbeddedCaptureFiles(room)) {
    await saveRoomToPostgres(room)
    if (mirrorToUpstash) {
      try {
        await saveRoomToUpstash(room)
      } catch (error) {
        console.warn('Migrated capture could not be mirrored to Upstash yet.', error)
      }
    }
  }
  return room
}

export async function getRoom(roomId: string): Promise<SyncRoom | null> {
  if (databaseConfigured()) {
    const postgresRoom = await getRoomFromPostgres(roomId)
    if (!upstashBridgeEnabled()) return finalizePostgresRoom(postgresRoom, false)

    try {
      const legacyRoom = await getRoomFromUpstash(roomId)
      const selected = newerRoom(postgresRoom, legacyRoom)
      if (selected && selected === legacyRoom) await saveRoomToPostgres(selected)
      return await finalizePostgresRoom(selected, true)
    } catch (error) {
      console.warn('Upstash bridge read failed; PostgreSQL remains authoritative.', error)
      return postgresRoom
    }
  }

  if (usesUpstash()) {
    try {
      return await getRoomFromUpstash(roomId)
    } catch (error) {
      if (process.env.VERCEL) throw error
      markLocalUpstashBroken()
    }
  }
  if (process.env.VERCEL) {
    return memoryStore().rooms[roomId] ?? null
  }
  const store = await readLocalFile()
  return store.rooms[roomId] ?? null
}

export async function getRoomIdByPairCode(pairCode: string): Promise<string | null> {
  if (databaseConfigured()) {
    const postgresRoomId = await getRoomIdByPairCodeFromPostgres(pairCode)
    if (postgresRoomId || !upstashBridgeEnabled()) return postgresRoomId

    try {
      const raw = await upstashFetch(['GET', `lifeos:sync:pair:${pairCode}`])
      const legacyRoomId = typeof raw === 'string' && raw ? raw : null
      if (!legacyRoomId) return null
      const legacyRoom = await getRoomFromUpstash(legacyRoomId)
      if (legacyRoom) await saveRoomToPostgres(legacyRoom)
      return legacyRoom?.roomId ?? null
    } catch (error) {
      console.warn('Upstash bridge pair lookup failed.', error)
      return null
    }
  }

  if (usesUpstash()) {
    try {
      const raw = await upstashFetch(['GET', `lifeos:sync:pair:${pairCode}`])
      return typeof raw === 'string' && raw ? raw : null
    } catch (error) {
      if (process.env.VERCEL) throw error
      markLocalUpstashBroken()
    }
  }
  if (process.env.VERCEL) {
    return memoryStore().pairIndex[pairCode] ?? null
  }
  const store = await readLocalFile()
  return store.pairIndex[pairCode] ?? null
}

export async function saveRoom(room: SyncRoom, previousPairCode?: string | null): Promise<void> {
  if (room.snapshot) {
    const size = JSON.stringify(room.snapshot).length
    if (size > MAX_SNAPSHOT_CHARS) {
      throw new Error('Sync-Daten zu groß. Bitte ältere Einträge per Backup aufräumen.')
    }
  }

  if (databaseConfigured()) {
    await saveRoomToPostgres(room)
    if (upstashBridgeEnabled()) {
      try {
        await saveRoomToUpstash(room, previousPairCode)
      } catch (error) {
        console.warn('Upstash bridge write failed; room is safely stored in PostgreSQL.', error)
      }
    }
    return
  }

  if (usesUpstash()) {
    try {
      await saveRoomToUpstash(room, previousPairCode)
      return
    } catch (error) {
      if (process.env.VERCEL) throw error
      markLocalUpstashBroken()
    }
  }

  if (process.env.VERCEL) {
    const store = memoryStore()
    if (previousPairCode && previousPairCode !== room.pairCode) {
      delete store.pairIndex[previousPairCode]
    }
    store.rooms[room.roomId] = room
    if (room.pairCode) store.pairIndex[room.pairCode] = room.roomId
    return
  }

  const store = await readLocalFile()
  if (previousPairCode && previousPairCode !== room.pairCode) {
    delete store.pairIndex[previousPairCode]
  }
  // drop expired pair codes
  for (const [code, id] of Object.entries(store.pairIndex)) {
    const other = store.rooms[id]
    if (!other?.pairCode || !other.pairCodeExpiresAt || other.pairCodeExpiresAt < Date.now()) {
      if (other) {
        other.pairCode = null
        other.pairCodeExpiresAt = null
      }
      delete store.pairIndex[code]
    }
  }
  store.rooms[room.roomId] = room
  if (room.pairCode) store.pairIndex[room.pairCode] = room.roomId
  await writeLocalFile(store)
}

export function syncStorageMode(): SyncStorageMode {
  if (databaseConfigured()) return 'postgres'
  if (usesUpstash()) return 'upstash'
  if (process.env.VERCEL) return hasUpstash() ? 'upstash' : 'memory'
  return 'file'
}

export async function probeSyncStorage(): Promise<SyncStorageProbe> {
  const time = new Date().toISOString()
  if (databaseConfigured()) {
    const database = await probeDatabase()
    return database.ok
      ? { ok: true, storage: 'postgres', time }
      : { ok: false, storage: 'postgres', time, error: 'PostgreSQL nicht erreichbar.' }
  }

  if (hasUpstash() && !localUpstashBroken) {
    try {
      const result = await upstashFetch(['PING'])
      if (String(result).toUpperCase() !== 'PONG') {
        throw new Error(`Unerwartete PING-Antwort: ${String(result)}`)
      }
      return { ok: true, storage: 'upstash', time }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upstash nicht erreichbar.'
      if (process.env.VERCEL) {
        return { ok: false, storage: 'upstash', time, error: message }
      }
      markLocalUpstashBroken()
      return { ok: true, storage: 'file', time, warning: message }
    }
  }

  if (process.env.VERCEL) {
    return {
      ok: false,
      storage: 'memory',
      time,
      error: 'Kein persistenter Store. UPSTASH_REDIS_REST_URL und TOKEN auf Vercel setzen.',
    }
  }

  return { ok: true, storage: 'file', time }
}
