import { loadSyncCredentials } from './deviceSync'

export type LifeOsObjectCategory =
  | 'profile'
  | 'meals'
  | 'labs'
  | 'documents'
  | 'captures'
  | 'media'
  | 'exports'

export type StoredFileReference = {
  objectId: string
  storageKey: string
  fileName: string
  contentType: string
  sizeBytes: number
}

function authHeaders(): Record<string, string> {
  const credentials = loadSyncCredentials()
  if (!credentials) throw new Error('Cloud-Dateien benötigen einen gekoppelten Geräte-Sync.')
  return {
    Authorization: `Bearer ${credentials.deviceToken}`,
    'X-Life-Os-Room': credentials.roomId,
  }
}

async function storageJson<T>(path: string, body: unknown, timeoutMs = 15_000): Promise<T> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    const result = await response.json().catch(() => ({})) as T & { error?: string }
    if (!response.ok) throw new Error(result.error || `Dateispeicher nicht erreichbar (${response.status}).`)
    return result
  } finally {
    window.clearTimeout(timer)
  }
}

export async function uploadLifeOsFile(
  file: File,
  category: LifeOsObjectCategory = 'captures',
): Promise<StoredFileReference> {
  const presigned = await storageJson<{
    objectId: string
    storageKey: string
    uploadUrl: string
    uploadHeaders: Record<string, string>
  }>('/api/storage/presign-upload', {
    category,
    fileName: file.name,
    contentType: file.type || 'application/octet-stream',
    sizeBytes: file.size,
  })

  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), 90_000)
  try {
    const response = await fetch(presigned.uploadUrl, {
      method: 'PUT',
      headers: presigned.uploadHeaders,
      body: file,
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`Upload fehlgeschlagen (${response.status}).`)
  } finally {
    window.clearTimeout(timer)
  }

  return storageJson<StoredFileReference>('/api/storage/complete', {
    objectId: presigned.objectId,
    storageKey: presigned.storageKey,
    fileName: file.name,
    contentType: file.type || 'application/octet-stream',
    sizeBytes: file.size,
  })
}

export async function getLifeOsFileUrl(input: {
  objectId?: string
  storageKey: string
  fileName?: string
  contentType?: string
}): Promise<string> {
  const result = await storageJson<{ downloadUrl: string }>('/api/storage/presign-download', {
    objectId: input.objectId,
    storageKey: input.storageKey,
    fileName: input.fileName,
    contentType: input.contentType,
  })
  return result.downloadUrl
}
