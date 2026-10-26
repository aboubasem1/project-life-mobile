import { loadLifeOsState, saveLifeOsState, type KnowledgeItem, type DomainEvent, LIFE_AREAS } from '../lifeos'
import { validateReelFile, reelContentType, rememberImportReceipt, readImportReceipts, forgetImportReceipt, type ImportReceipt } from './import-session'
import { loadSyncCredentials } from '../deviceSync'
import type { ReelCandidate, ReelReviewAction } from './types'

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
  // Native WebCrypto is dependency-free and reliable. Very large files skip hashing to avoid high mobile memory usage.
  if (!globalThis.crypto?.subtle || file.size > 32 * 1024 * 1024) return null
  const digest = await globalThis.crypto.subtle.digest('SHA-256', await file.arrayBuffer())
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

function putFile(url: string, headers: Record<string, string>, file: File, onProgress: (percent: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open('PUT', url)
    for (const [name, value] of Object.entries(headers)) request.setRequestHeader(name, value)
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

export async function uploadAndRegisterReel(file: File, onProgress: (percent: number) => void): Promise<ReelCandidate> {
  const invalid = validateReelFile(file)
  if (invalid) throw new Error(invalid)
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
      contentType: reelContentType(file),
      sizeBytes: file.size,
      checksumSha256,
    }),
  })
  const receipt: ImportReceipt = { objectId: presigned.objectId, storageKey: presigned.storageKey, fileName: file.name, contentType: reelContentType(file), sizeBytes: file.size, checksumSha256, createdAt: new Date().toISOString() }
  const roomId = loadSyncCredentials()!.roomId
  rememberImportReceipt(roomId, receipt)
  await putFile(presigned.uploadUrl, presigned.uploadHeaders, file, onProgress)
  return completeReceipt(roomId, receipt)
}

async function completeReceipt(roomId: string, receipt: ImportReceipt): Promise<ReelCandidate> {
  await apiJson('/api/storage/complete', { method: 'POST', body: JSON.stringify(receipt) })
  const registered = await apiJson<{ reel: ReelCandidate }>('/api/reels/register', {
    method: 'POST', body: JSON.stringify({ objectId: receipt.objectId, checksumSha256: receipt.checksumSha256, lifeAreas: LIFE_AREAS.map(a => a.key) }),
  })
  forgetImportReceipt(roomId, receipt.objectId)
  return registered.reel
}

export async function recoverReelUploads(): Promise<number> {
  const roomId = loadSyncCredentials()?.roomId
  if (!roomId) return 0
  let interrupted = 0
  for (const receipt of readImportReceipts(roomId)) {
    try { await completeReceipt(roomId, receipt) } catch { interrupted += 1 }
  }
  return interrupted
}

export async function processReel(reelId: string, lifeAreas: string[]): Promise<ReelCandidate> {
  const result = await apiJson<{ reel: ReelCandidate }>(`/api/reels/${reelId}/process`, {
    method: 'POST',
    body: JSON.stringify({ lifeAreas }),
  })
  return result.reel
}

export async function listReels(): Promise<{ reels: ReelCandidate[]; workerAvailable: boolean }> {
  return apiJson('/api/reels?limit=1000')
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

export type ReelPublication = { version: 1; knowledge: KnowledgeItem; event: DomainEvent }
export function acceptPublication(publication: ReelPublication) {
  const state = loadLifeOsState()
  if (state.deletedKnowledgeIds?.includes(publication.knowledge.id) || state.knowledge.some(k => k.id === publication.knowledge.id)) return
  if (!saveLifeOsState({ ...state, knowledge: [...state.knowledge, publication.knowledge],
    events: state.events.some(e => e.id === publication.event.id) ? state.events : [...state.events, publication.event] })) {
    throw new Error('Auf dem Server gespeichert. Lokaler Speicher voll; bitte Sync erneut laden.')
  }
}
export async function publishReel(reel: ReelCandidate) {
  const result = await apiJson<{ publication: ReelPublication }>(`/api/reels/${reel.id}/publish`, { method: 'POST', body: JSON.stringify({ version: reel.version }) })
  acceptPublication(result.publication)
  return result.publication.knowledge.id
}
export async function batchReviewReels(reels: ReelCandidate[], action: 'publish' | 'reject' | 'source_only') {
  const result = await apiJson<{ results: Array<{ id: string; error?: string; publication?: ReelPublication }> }>('/api/reels/batch', {
    method: 'POST', body: JSON.stringify({ items: reels.map(r => ({ id: r.id, version: r.version })), action }),
  }, 60_000)
  for (const item of result.results) if (item.publication) acceptPublication(item.publication)
  return result.results
}
export async function getReel(id: string): Promise<ReelCandidate> {
  return (await apiJson<{ reel: ReelCandidate }>(`/api/reels/${id}`)).reel
}
