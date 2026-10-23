import { loadSyncCredentials } from '../deviceSync'
import type { KnowledgePublishDraft, ReelCandidate, ReelReviewAction } from './types'

function authHeaders(): Record<string, string> {
  const credentials = loadSyncCredentials()
  if (!credentials) throw new Error('Reel-Import benötigt einen gekoppelten Geräte-Sync.')
  return {
    Authorization: `Bearer ${credentials.deviceToken}`,
    'X-Life-Os-Room': credentials.roomId,
  }
}

async function apiJson<T>(path: string, init: RequestInit = {}, timeoutMs = 20_000): Promise<T> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(path, {
      ...init,
      headers: {
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...authHeaders(),
        ...(init.headers ?? {}),
      },
      signal: controller.signal,
    })
    const result = await response.json().catch(() => ({})) as T & { error?: string }
    if (!response.ok) throw new Error(result.error || `Reel-API nicht erreichbar (${response.status}).`)
    return result
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw new Error('Der Server braucht zu lange. Der Eintrag kann später erneut geladen werden.')
    throw error
  } finally {
    window.clearTimeout(timer)
  }
}

async function sha256(file: File): Promise<string | null> {
  // Native WebCrypto is dependency-free and reliable. Very large files skip hashing to avoid high Mac RAM usage.
  if (!globalThis.crypto?.subtle || file.size > 128 * 1024 * 1024) return null
  const digest = await globalThis.crypto.subtle.digest('SHA-256', await file.arrayBuffer())
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

function sameOriginUploadHeaders(url: string, headers: Record<string, string>): Record<string, string> {
  try {
    const absolute = new URL(url, window.location.origin)
    if (absolute.origin === window.location.origin) return { ...headers, ...authHeaders() }
  } catch {
    // Fall through to the provided headers (e.g. signed R2 / local URLs).
  }
  return headers
}

function putFile(url: string, headers: Record<string, string>, file: File, onProgress: (percent: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open('PUT', url)
    for (const [name, value] of Object.entries(sameOriginUploadHeaders(url, headers))) {
      request.setRequestHeader(name, value)
    }
    request.timeout = 10 * 60_000
    request.upload.onprogress = event => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100))
    }
    request.onload = () => request.status >= 200 && request.status < 300
      ? resolve()
      : reject(new Error(`Upload fehlgeschlagen (${request.status}).`))
    request.onerror = () => reject(new Error('Upload-Verbindung wurde unterbrochen.'))
    request.ontimeout = () => reject(new Error('Upload hat zu lange gedauert.'))
    request.send(file)
  })
}

export async function uploadAndRegisterReel(
  file: File,
  onProgress: (percent: number) => void,
  lifeAreas: string[] = [],
): Promise<{ reel: ReelCandidate; queued: boolean; duplicate: boolean }> {
  const checksumSha256 = await sha256(file)
  const presigned = await apiJson<{
    objectId: string
    storageKey: string
    uploadUrl: string
    uploadHeaders: Record<string, string>
  }>('/api/storage/presign-upload', {
    method: 'POST',
    body: JSON.stringify({
      category: 'media',
      fileName: file.name,
      contentType: file.type || 'video/mp4',
      sizeBytes: file.size,
      checksumSha256,
    }),
  })
  await putFile(presigned.uploadUrl, presigned.uploadHeaders, file, onProgress)
  await apiJson('/api/storage/complete', {
    method: 'POST',
    body: JSON.stringify({
      objectId: presigned.objectId,
      storageKey: presigned.storageKey,
      fileName: file.name,
      contentType: file.type || 'video/mp4',
      sizeBytes: file.size,
    }),
  })
  const registered = await apiJson<{ reel: ReelCandidate; queued?: boolean; duplicate?: boolean }>('/api/reels/register', {
    method: 'POST',
    body: JSON.stringify({ objectId: presigned.objectId, checksumSha256, lifeAreas }),
  })
  return { reel: registered.reel, queued: Boolean(registered.queued), duplicate: Boolean(registered.duplicate) }
}

export async function processReel(reelId: string, lifeAreas: string[]): Promise<ReelCandidate> {
  const result = await apiJson<{ reel: ReelCandidate }>(`/api/reels/${reelId}/process`, {
    method: 'POST',
    body: JSON.stringify({ lifeAreas }),
  })
  return result.reel
}

export async function listReels(): Promise<ReelCandidate[]> {
  const result = await apiJson<{ reels: ReelCandidate[] }>('/api/reels?limit=300')
  return result.reels
}

export async function reviewReel(input: {
  reel: ReelCandidate
  action: ReelReviewAction
  title: string
  summary: string
  lifeArea: string
  topics: string[]
  suggestedTarget: ReelCandidate['suggestedTarget']
  reviewerNote: string
}): Promise<ReelCandidate> {
  const result = await apiJson<{ reel: ReelCandidate }>(`/api/reels/${input.reel.id}/review`, {
    method: 'POST',
    body: JSON.stringify({
      action: input.action,
      version: input.reel.version,
      title: input.title,
      summary: input.summary,
      lifeArea: input.lifeArea,
      topics: input.topics,
      suggestedTarget: input.suggestedTarget,
      reviewerNote: input.reviewerNote,
    }),
  })
  return result.reel
}

export async function publishReel(reel: ReelCandidate, sourceOnly = false): Promise<{ reel: ReelCandidate; knowledge: KnowledgePublishDraft }> {
  return apiJson(`/api/reels/${reel.id}/publish`, {
    method: 'POST',
    body: JSON.stringify({ version: reel.version, sourceOnly }),
  })
}

export async function batchReels(input: {
  action: 'approve_publish' | 'reject' | 'source_only'
  reels: ReelCandidate[]
  includeMediumRisk?: boolean
}): Promise<{ results: Array<{ id: string; ok: boolean; error?: string; reel?: ReelCandidate; knowledge?: KnowledgePublishDraft }> }> {
  return apiJson('/api/reels/batch', {
    method: 'POST',
    body: JSON.stringify({
      action: input.action,
      ids: input.reels.map(reel => reel.id),
      versions: Object.fromEntries(input.reels.map(reel => [reel.id, reel.version])),
      includeMediumRisk: Boolean(input.includeMediumRisk),
    }),
  })
}
