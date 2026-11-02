import { createDevicePairing, loadSyncCredentials } from '../deviceSync'
import { loadImportReceipts, markImportUploaded, removeImportReceipt, saveImportReceipt, type ReelImportReceipt } from './import-session'
import type { KnowledgePublishDraft, ReelCandidate, ReelReviewAction } from './types'

export type ReelUploadStage =
  | 'ensure-room'
  | 'checksum'
  | 'presign'
  | 'proxy-upload'
  | 'complete'
  | 'register'
  | 'list'
  | 'process'
  | 'review'
  | 'publish'
  | 'batch'
  | 'recover'
  | 'get'
  | 'translate'

let reelRoomPromise: Promise<void> | null = null

function ensureReelRoom(): Promise<void> {
  if (loadSyncCredentials()) return Promise.resolve()
  if (!reelRoomPromise) {
    reelRoomPromise = createDevicePairing()
      .then(() => {
        if (!loadSyncCredentials()) {
          throw new Error('Reel-Import konnte die Geräte-Anmeldung nicht speichern.')
        }
      })
      .finally(() => {
        reelRoomPromise = null
      })
  }
  return reelRoomPromise
}

function credentialHeaders(): Record<string, string> {
  const credentials = loadSyncCredentials()
  if (!credentials) throw new Error('Reel-Import konnte keinen Server-Eintrag anlegen.')
  return {
    Authorization: `Bearer ${credentials.deviceToken}`,
    'X-Life-Os-Room': credentials.roomId,
  }
}

async function authHeaders(): Promise<Record<string, string>> {
  await ensureReelRoom()
  return credentialHeaders()
}

export function formatReelApiFailure(input: {
  stage: ReelUploadStage
  status: number
  error?: string
  errorRef?: string
}): Error {
  const detail = input.error?.trim() || `Reel-API nicht erreichbar (${input.status}).`
  const ref = input.errorRef ? `, Ref ${input.errorRef}` : ''
  return new Error(`${detail} [Stufe: ${input.stage}, HTTP ${input.status}${ref}]`)
}

async function apiJson<T>(
  path: string,
  init: RequestInit = {},
  timeoutMs = 20_000,
  ensureRoom = false,
  stage: ReelUploadStage = 'list',
): Promise<T> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeoutMs)
  const roomHeaders = ensureRoom ? await authHeaders() : credentialHeaders()
  try {
    const response = await fetch(path, {
      ...init,
      headers: {
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...roomHeaders,
        ...(init.headers ?? {}),
      },
      signal: controller.signal,
    })
    const result = await response.json().catch(() => ({})) as T & { error?: string; errorRef?: string; stage?: string }
    if (!response.ok) {
      throw formatReelApiFailure({
        stage: (result.stage as ReelUploadStage | undefined) || stage,
        status: response.status,
        error: result.error,
        errorRef: result.errorRef || response.headers.get('x-life-os-error-ref') || undefined,
      })
    }
    return result
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(`Der Server braucht zu lange. [Stufe: ${stage}] Der Eintrag kann später erneut geladen werden.`)
    }
    throw error
  } finally {
    window.clearTimeout(timer)
  }
}

async function sha256(file: File): Promise<string | null> {
  // WebCrypto buffers the complete file. Keep the limit conservative for iPhone memory pressure.
  if (!globalThis.crypto?.subtle || file.size > 32 * 1024 * 1024) return null
  const digest = await globalThis.crypto.subtle.digest('SHA-256', await file.arrayBuffer())
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

async function sameOriginUploadHeaders(url: string, headers: Record<string, string>): Promise<Record<string, string>> {
  try {
    const absolute = new URL(url, window.location.origin)
    if (absolute.origin === window.location.origin) return { ...headers, ...(await authHeaders()) }
  } catch {
    // Fall through to the provided headers (e.g. signed R2 / local URLs).
  }
  return headers
}

function readXhrError(request: XMLHttpRequest, status: number): Error {
  let error = ''
  let errorRef = request.getResponseHeader('x-life-os-error-ref') || ''
  let stage: ReelUploadStage = 'proxy-upload'
  try {
    const payload = JSON.parse(request.responseText || '{}') as { error?: unknown; errorRef?: unknown; stage?: unknown }
    if (typeof payload.error === 'string') error = payload.error
    if (typeof payload.errorRef === 'string' && payload.errorRef) errorRef = payload.errorRef
    if (typeof payload.stage === 'string' && payload.stage) stage = payload.stage as ReelUploadStage
  } catch {
    // Non-JSON bodies stay status-only.
  }
  return formatReelApiFailure({
    stage,
    status,
    error: error || `Upload fehlgeschlagen (${status}).`,
    errorRef: errorRef || undefined,
  })
}

async function putFile(
  url: string,
  headers: Record<string, string>,
  file: File,
  onProgress: (percent: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  const uploadHeaders = await sameOriginUploadHeaders(url, headers)
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Upload abgebrochen.', 'AbortError'))
      return
    }
    const request = new XMLHttpRequest()
    const onAbort = () => {
      request.abort()
      reject(new DOMException('Upload abgebrochen.', 'AbortError'))
    }
    signal?.addEventListener('abort', onAbort, { once: true })
    request.open('PUT', url)
    for (const [name, value] of Object.entries(uploadHeaders)) {
      request.setRequestHeader(name, value)
    }
    request.timeout = 10 * 60_000
    request.upload.onloadstart = () => onProgress(1)
    request.upload.onprogress = event => {
      if (!event.lengthComputable) {
        onProgress(Math.max(1, Math.min(95, Math.round((event.loaded / Math.max(file.size, 1)) * 100))))
        return
      }
      onProgress(Math.round((event.loaded / event.total) * 100))
    }
    request.onload = () => {
      signal?.removeEventListener('abort', onAbort)
      request.status >= 200 && request.status < 300
        ? resolve()
        : reject(readXhrError(request, request.status))
    }
    request.onerror = () => {
      signal?.removeEventListener('abort', onAbort)
      reject(new Error('Upload-Verbindung wurde unterbrochen. [Stufe: proxy-upload]'))
    }
    request.ontimeout = () => {
      signal?.removeEventListener('abort', onAbort)
      reject(new Error('Upload hat zu lange gedauert. [Stufe: proxy-upload]'))
    }
    request.send(file)
  })
}

export async function uploadAndRegisterReel(
  file: File,
  onProgress: (percent: number) => void,
  lifeAreas: string[] = [],
  signal?: AbortSignal,
): Promise<{ reel: ReelCandidate; queued: boolean; duplicate: boolean }> {
  try {
    await ensureReelRoom()
  } catch (error) {
    if (error instanceof Error && !error.message.includes('[Stufe:')) {
      throw new Error(`${error.message} [Stufe: ensure-room]`)
    }
    throw error
  }
  let checksumSha256: string | null = null
  try {
    checksumSha256 = await sha256(file)
  } catch (error) {
    throw new Error(`${error instanceof Error ? error.message : 'Prüfsumme fehlgeschlagen.'} [Stufe: checksum]`)
  }
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
  }, 20_000, false, 'presign')
  const credentials = loadSyncCredentials()
  if (!credentials) throw new Error('Reel-Import benötigt einen gekoppelten Geräte-Sync. [Stufe: ensure-room]')
  const receipt: ReelImportReceipt = {
    objectId: presigned.objectId,
    storageKey: presigned.storageKey,
    fileName: file.name,
    contentType: file.type || 'video/mp4',
    sizeBytes: file.size,
    checksumSha256,
    lifeAreas,
    uploaded: false,
    createdAt: new Date().toISOString(),
  }
  saveImportReceipt(credentials.roomId, receipt)
  if (signal?.aborted) throw new DOMException('Upload abgebrochen.', 'AbortError')
  await putFile(presigned.uploadUrl, presigned.uploadHeaders, file, onProgress, signal)
  markImportUploaded(credentials.roomId, presigned.objectId)
  await apiJson('/api/storage/complete', {
    method: 'POST',
    body: JSON.stringify({
      objectId: presigned.objectId,
      storageKey: presigned.storageKey,
      fileName: file.name,
      contentType: file.type || 'video/mp4',
      sizeBytes: file.size,
    }),
  }, 60_000, false, 'complete')
  const registered = await apiJson<{ reel: ReelCandidate; queued?: boolean; duplicate?: boolean }>('/api/reels/register', {
    method: 'POST',
    body: JSON.stringify({ objectId: presigned.objectId, checksumSha256, lifeAreas }),
  }, 60_000, false, 'register')
  removeImportReceipt(credentials.roomId, presigned.objectId)
  return { reel: registered.reel, queued: Boolean(registered.queued), duplicate: Boolean(registered.duplicate) }
}

export async function recoverUploadedReels(): Promise<{ recovered: ReelCandidate[]; awaitingReselection: number }> {
  const credentials = loadSyncCredentials()
  if (!credentials) return { recovered: [], awaitingReselection: 0 }
  const receipts = loadImportReceipts(credentials.roomId)
  const recovered: ReelCandidate[] = []
  for (const receipt of receipts.filter(item => item.uploaded)) {
    try {
      await apiJson('/api/storage/complete', {
        method: 'POST',
        body: JSON.stringify({
          objectId: receipt.objectId,
          storageKey: receipt.storageKey,
          fileName: receipt.fileName,
          contentType: receipt.contentType,
          sizeBytes: receipt.sizeBytes,
        }),
      }, 60_000, false, 'recover')
      const registered = await apiJson<{ reel: ReelCandidate }>('/api/reels/register', {
        method: 'POST',
        body: JSON.stringify({ objectId: receipt.objectId, checksumSha256: receipt.checksumSha256, lifeAreas: receipt.lifeAreas }),
      }, 60_000, false, 'recover')
      recovered.push(registered.reel)
      removeImportReceipt(credentials.roomId, receipt.objectId)
    } catch {
      // Keep the receipt. A later reopen can retry without selecting the completed upload again.
    }
  }
  return {
    recovered,
    awaitingReselection: loadImportReceipts(credentials.roomId).filter(item => !item.uploaded).length,
  }
}

export async function processReel(reelId: string, lifeAreas: string[]): Promise<ReelCandidate> {
  await ensureReelRoom()
  const result = await apiJson<{ reel: ReelCandidate }>(`/api/reels/${reelId}/process`, {
    method: 'POST',
    body: JSON.stringify({ lifeAreas }),
  }, 20_000, false, 'process')
  return result.reel
}

export async function listPublishedKnowledge(): Promise<KnowledgePublishDraft[]> {
  if (!loadSyncCredentials()) return []
  const result = await apiJson<{ drafts?: KnowledgePublishDraft[] }>('/api/reels/knowledge', {}, 20_000, false, 'list')
  return Array.isArray(result.drafts) ? result.drafts : []
}

export async function listReels(): Promise<ReelCandidate[]> {
  if (!loadSyncCredentials()) return []
  const result = await apiJson<{ reels: ReelCandidate[] }>('/api/reels?limit=300', {}, 20_000, false, 'list')
  return result.reels
}

export async function getReel(reelId: string): Promise<ReelCandidate> {
  await ensureReelRoom()
  const result = await apiJson<{ reel: ReelCandidate }>(`/api/reels/${encodeURIComponent(reelId)}`, {}, 20_000, false, 'get')
  if (!result.reel?.id) throw new Error('Reel nicht gefunden.')
  return result.reel
}

export async function translateReelTranscript(reelId: string): Promise<ReelCandidate> {
  await ensureReelRoom()
  const result = await apiJson<{ reel: ReelCandidate }>(`/api/reels/${encodeURIComponent(reelId)}/translate`, {
    method: 'POST',
    body: JSON.stringify({}),
  }, 90_000, false, 'translate')
  if (!result.reel?.id) throw new Error('Übersetzung fehlgeschlagen.')
  return result.reel
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
  await ensureReelRoom()
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
  }, 20_000, false, 'review')
  return result.reel
}

export async function publishReel(reel: ReelCandidate, sourceOnly = false): Promise<{ reel: ReelCandidate; knowledge: KnowledgePublishDraft }> {
  await ensureReelRoom()
  return apiJson(`/api/reels/${reel.id}/publish`, {
    method: 'POST',
    body: JSON.stringify({ version: reel.version, sourceOnly }),
  }, 20_000, false, 'publish')
}

export async function batchReels(input: {
  action: 'approve_publish' | 'reject' | 'source_only'
  reels: ReelCandidate[]
  includeMediumRisk?: boolean
}): Promise<{ results: Array<{ id: string; ok: boolean; error?: string; reel?: ReelCandidate; knowledge?: KnowledgePublishDraft }> }> {
  await ensureReelRoom()
  return apiJson('/api/reels/batch', {
    method: 'POST',
    body: JSON.stringify({
      action: input.action,
      ids: input.reels.map(reel => reel.id),
      versions: Object.fromEntries(input.reels.map(reel => [reel.id, reel.version])),
      includeMediumRisk: Boolean(input.includeMediumRisk),
    }),
  }, 60_000, false, 'batch')
}
