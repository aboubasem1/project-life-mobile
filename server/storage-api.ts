import { randomUUID } from 'node:crypto'
import { databaseConfigured, databaseQuery } from './database.js'
import {
  createObjectKey,
  createPresignedDownload,
  createPresignedUpload,
  handleSignedLocalObject,
  headStoredObject,
  normalizeContentType,
  objectStorageConfigured,
  parseObjectCategory,
} from './object-storage.js'
import { SyncHttpError, readSyncJson, syncJson } from './sync-core.js'
import { getRoom } from './sync-store.js'

const MAX_OBJECT_BYTES = 100 * 1024 * 1024

type StoredObjectRow = {
  id: string
  room_id: string
  category: string
  storage_key: string
  original_name: string
  content_type: string
  size_bytes: string | number
  checksum_sha256: string | null
  status: 'pending' | 'ready'
  created_at: Date | string
  uploaded_at: Date | string | null
}

function bearerToken(request: Request): string {
  const header = request.headers.get('authorization') ?? ''
  return header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : ''
}

async function authorizeRoom(request: Request): Promise<string> {
  const roomId = request.headers.get('x-life-os-room')?.trim() ?? ''
  const deviceToken = bearerToken(request) || request.headers.get('x-life-os-token')?.trim() || ''
  if (!roomId || !deviceToken) throw new SyncHttpError(401, 'Raum und Token sind nötig.')
  const room = await getRoom(roomId)
  if (!room) throw new SyncHttpError(404, 'Sync-Raum nicht gefunden.')
  if (!room.deviceTokens.includes(deviceToken)) {
    throw new SyncHttpError(403, 'Gerät nicht mit diesem Sync verbunden.')
  }
  return roomId
}

function requireStorage(): void {
  if (!objectStorageConfigured()) {
    throw new SyncHttpError(503, 'Dateispeicher ist noch nicht konfiguriert.')
  }
}

function normalizeFileName(value: unknown): string {
  const text = typeof value === 'string' ? value.trim() : ''
  const cleaned = text.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 255)
  if (!cleaned) throw new SyncHttpError(400, 'Dateiname fehlt.')
  return cleaned
}

function normalizeOptionalFileName(value: unknown): string {
  try {
    return normalizeFileName(value)
  } catch {
    return 'Datei'
  }
}

function normalizeObjectId(value: unknown, required = true): string {
  const objectId = typeof value === 'string' ? value.trim() : ''
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(objectId)) {
    return objectId
  }
  if (!required) return randomUUID()
  throw new SyncHttpError(400, 'Ungültige Datei-ID.')
}

function assertStorageKeyForRoom(storageKey: string, roomId: string): void {
  const parts = storageKey.split('/')
  if (
    parts.length !== 4
    || !parseObjectCategory(parts[0])
    || parts[1] !== roomId
    || !/^\d{4}-\d{2}-\d{2}$/.test(parts[2] ?? '')
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(parts[3] ?? '')
  ) {
    throw new SyncHttpError(403, 'Datei gehört nicht zu diesem Sync-Raum.')
  }
}

function normalizeSize(value: unknown): number {
  const size = Number(value)
  if (!Number.isSafeInteger(size) || size <= 0) {
    throw new SyncHttpError(400, 'Ungültige Dateigröße.')
  }
  if (size > MAX_OBJECT_BYTES) {
    throw new SyncHttpError(413, 'Datei ist größer als 100 MB.')
  }
  return size
}

function normalizeChecksum(value: unknown): string | null {
  const checksum = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (!checksum) return null
  if (!/^[a-f0-9]{64}$/.test(checksum)) {
    throw new SyncHttpError(400, 'Ungültige SHA-256-Prüfsumme.')
  }
  return checksum
}

async function presignUpload(request: Request): Promise<Response> {
  requireStorage()
  const roomId = await authorizeRoom(request)
  const body = await readSyncJson<{
    category?: unknown
    fileName?: unknown
    contentType?: unknown
    sizeBytes?: unknown
    checksumSha256?: unknown
  }>(request)
  const category = parseObjectCategory(body.category)
  if (!category) throw new SyncHttpError(400, 'Ungültige Speicherkategorie.')
  const fileName = normalizeFileName(body.fileName)
  const contentType = normalizeContentType(body.contentType)
  const sizeBytes = normalizeSize(body.sizeBytes)
  const checksumSha256 = normalizeChecksum(body.checksumSha256)
  const objectId = randomUUID()
  const storageKey = createObjectKey(category, roomId)

  if (databaseConfigured()) {
    await databaseQuery(`
      INSERT INTO lifeos_objects (
        id, room_id, category, storage_key, original_name, content_type, size_bytes, checksum_sha256
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [objectId, roomId, category, storageKey, fileName, contentType, sizeBytes, checksumSha256])
  }

  const signed = await createPresignedUpload({ storageKey, contentType })
  return syncJson({
    ok: true,
    objectId,
    storageKey,
    uploadUrl: signed.url,
    uploadHeaders: signed.headers,
    expiresIn: signed.expiresIn,
  })
}

async function completeUpload(request: Request): Promise<Response> {
  requireStorage()
  const roomId = await authorizeRoom(request)
  const body = await readSyncJson<{
    objectId?: unknown
    storageKey?: unknown
    fileName?: unknown
    contentType?: unknown
    sizeBytes?: unknown
  }>(request)
  const objectId = normalizeObjectId(body.objectId)
  let object: StoredObjectRow | undefined
  if (databaseConfigured()) {
    const result = await databaseQuery<StoredObjectRow>(`
      SELECT * FROM lifeos_objects WHERE id = $1 AND room_id = $2 LIMIT 1
    `, [objectId, roomId])
    object = result.rows[0]
  }

  const storageKey = object?.storage_key ?? (typeof body.storageKey === 'string' ? body.storageKey.trim() : '')
  if (!storageKey) throw new SyncHttpError(400, 'Speicherschlüssel fehlt.')
  assertStorageKeyForRoom(storageKey, roomId)
  const fileName = object?.original_name ?? normalizeFileName(body.fileName)
  const contentType = object?.content_type ?? normalizeContentType(body.contentType)
  const sizeBytes = object ? Number(object.size_bytes) : normalizeSize(body.sizeBytes)
  const stored = await headStoredObject(storageKey)
  if (stored.sizeBytes !== sizeBytes) {
    throw new SyncHttpError(409, 'Hochgeladene Dateigröße stimmt nicht überein.')
  }

  if (databaseConfigured()) {
    if (object) {
      await databaseQuery(`
        UPDATE lifeos_objects
        SET status = 'ready', uploaded_at = now()
        WHERE id = $1 AND room_id = $2
      `, [objectId, roomId])
    } else {
      const category = parseObjectCategory(storageKey.split('/')[0])
      await databaseQuery(`
        INSERT INTO lifeos_objects (
          id, room_id, category, storage_key, original_name, content_type, size_bytes, status, uploaded_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'ready', now())
      `, [objectId, roomId, category, storageKey, fileName, contentType, sizeBytes])
    }
  }

  return syncJson({
    ok: true,
    objectId,
    storageKey,
    fileName,
    contentType,
    sizeBytes,
  })
}

async function presignDownload(request: Request): Promise<Response> {
  requireStorage()
  const roomId = await authorizeRoom(request)
  const body = await readSyncJson<{
    objectId?: unknown
    storageKey?: unknown
    fileName?: unknown
    contentType?: unknown
  }>(request)
  const storageKey = typeof body.storageKey === 'string' ? body.storageKey.trim() : ''
  if (!storageKey) throw new SyncHttpError(400, 'Speicherschlüssel fehlt.')
  assertStorageKeyForRoom(storageKey, roomId)

  let object: StoredObjectRow | undefined
  if (databaseConfigured()) {
    const result = await databaseQuery<StoredObjectRow>(`
      SELECT *
      FROM lifeos_objects
      WHERE storage_key = $1 AND room_id = $2
      LIMIT 1
    `, [storageKey, roomId])
    object = result.rows[0]
  }

  const stored = await headStoredObject(storageKey)
  const objectId = object?.id ?? normalizeObjectId(body.objectId, false)
  const fileName = object?.original_name ?? normalizeOptionalFileName(body.fileName)
  const contentType = object?.content_type ?? normalizeContentType(body.contentType || stored.contentType)
  const sizeBytes = stored.sizeBytes

  if (databaseConfigured()) {
    const category = parseObjectCategory(storageKey.split('/')[0])
    await databaseQuery(`
      INSERT INTO lifeos_objects (
        id, room_id, category, storage_key, original_name, content_type, size_bytes, status, uploaded_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'ready', now())
      ON CONFLICT (storage_key) DO UPDATE SET
        status = 'ready',
        uploaded_at = COALESCE(lifeos_objects.uploaded_at, now()),
        size_bytes = EXCLUDED.size_bytes
    `, [objectId, roomId, category, storageKey, fileName, contentType, sizeBytes])
  }

  const signed = await createPresignedDownload({
    storageKey,
    fileName,
    contentType,
  })
  return syncJson({
    ok: true,
    downloadUrl: signed.url,
    expiresIn: signed.expiresIn,
    fileName,
    contentType,
    sizeBytes,
  })
}

export async function handleStorageRequest(request: Request): Promise<Response> {
  try {
    if (request.method === 'OPTIONS') return syncJson({ ok: true })
    const url = new URL(request.url)
    const pathname = url.pathname.replace(/\/$/, '')
    if (pathname.endsWith('/api/storage/local')) return await handleSignedLocalObject(request)
    const operation = url.searchParams.get('operation') ?? pathname.split('/').pop() ?? ''

    if (operation === 'presign-upload' && request.method === 'POST') {
      return await presignUpload(request)
    }
    if (operation === 'complete' && request.method === 'POST') {
      return await completeUpload(request)
    }
    if (operation === 'presign-download' && request.method === 'POST') {
      return await presignDownload(request)
    }
    return syncJson({ error: 'Not found' }, 404)
  } catch (error) {
    if (error instanceof SyncHttpError) throw error
    console.error(error)
    throw new SyncHttpError(502, 'Dateispeicher nicht erreichbar.')
  }
}
