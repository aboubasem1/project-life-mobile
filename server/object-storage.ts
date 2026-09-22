import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import {
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

export const OBJECT_CATEGORIES = [
  'profile',
  'meals',
  'labs',
  'documents',
  'captures',
  'media',
  'exports',
] as const

export type ObjectCategory = typeof OBJECT_CATEGORIES[number]

let client: S3Client | null = null

function env(name: string): string {
  return process.env[name]?.trim() ?? ''
}

function bucketName(): string {
  return env('R2_BUCKET') || 'lifeos-production'
}

function endpoint(): string {
  const configured = env('R2_ENDPOINT')
  if (configured) return configured.replace(/\/$/, '')
  const accountId = env('R2_ACCOUNT_ID')
  return accountId ? `https://${accountId}.r2.cloudflarestorage.com` : ''
}

export function objectStorageConfigured(): boolean {
  return localStorageConfigured() || r2Configured()
}

function r2Configured(): boolean {
  return Boolean(endpoint() && env('R2_ACCESS_KEY_ID') && env('R2_SECRET_ACCESS_KEY') && bucketName())
}

function localStorageRoot(): string {
  return env('LOCAL_OBJECT_STORAGE_ROOT')
}

function localStorageConfigured(): boolean {
  return Boolean(localStorageRoot() && env('OBJECT_STORAGE_SIGNING_SECRET'))
}

function storageClient(): S3Client {
  if (!r2Configured()) throw new Error('Cloudflare R2 ist nicht konfiguriert.')
  if (!client) {
    client = new S3Client({
      region: env('R2_REGION') || 'auto',
      endpoint: endpoint(),
      credentials: {
        accessKeyId: env('R2_ACCESS_KEY_ID'),
        secretAccessKey: env('R2_SECRET_ACCESS_KEY'),
      },
    })
  }
  return client
}

function localPath(storageKey: string): string {
  const root = resolve(localStorageRoot())
  const target = resolve(root, storageKey)
  if (!target.startsWith(`${root}/`)) throw new Error('Ungültiger Speicherschlüssel.')
  return target
}

function localMetadataPath(storageKey: string): string {
  return `${localPath(storageKey)}.meta.json`
}

function signature(method: 'GET' | 'PUT', storageKey: string, expiresAt: number, contentType: string): string {
  return createHmac('sha256', env('OBJECT_STORAGE_SIGNING_SECRET'))
    .update(`${method}\n${storageKey}\n${expiresAt}\n${contentType}`)
    .digest('base64url')
}

function localSignedUrl(input: {
  method: 'GET' | 'PUT'
  storageKey: string
  contentType: string
  expiresAt: number
  fileName?: string
}): string {
  const parameters = new URLSearchParams({
    key: input.storageKey,
    expires: String(input.expiresAt),
    contentType: input.contentType,
    token: signature(input.method, input.storageKey, input.expiresAt, input.contentType),
  })
  if (input.fileName) parameters.set('fileName', input.fileName)
  return `/api/storage/local?${parameters.toString()}`
}

function validLocalSignature(request: Request, method: 'GET' | 'PUT'): {
  storageKey: string
  contentType: string
  fileName: string
} | null {
  const url = new URL(request.url)
  const storageKey = url.searchParams.get('key')?.trim() ?? ''
  const contentType = normalizeContentType(url.searchParams.get('contentType'))
  const fileName = url.searchParams.get('fileName')?.trim() || 'download'
  const expiresAt = Number(url.searchParams.get('expires'))
  const supplied = url.searchParams.get('token') ?? ''
  if (!storageKey || !Number.isSafeInteger(expiresAt) || expiresAt < Math.floor(Date.now() / 1000)) return null
  const expected = signature(method, storageKey, expiresAt, contentType)
  const suppliedBuffer = Buffer.from(supplied)
  const expectedBuffer = Buffer.from(expected)
  if (suppliedBuffer.length !== expectedBuffer.length || !timingSafeEqual(suppliedBuffer, expectedBuffer)) return null
  try {
    localPath(storageKey)
  } catch {
    return null
  }
  return { storageKey, contentType, fileName }
}

export function parseObjectCategory(value: unknown): ObjectCategory | null {
  return typeof value === 'string' && (OBJECT_CATEGORIES as readonly string[]).includes(value)
    ? value as ObjectCategory
    : null
}

export function normalizeContentType(value: unknown): string {
  const text = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (!text || text.length > 120 || !/^[a-z0-9.+-]+\/[a-z0-9.+-]+$/.test(text)) {
    return 'application/octet-stream'
  }
  return text
}

export function createObjectKey(category: ObjectCategory, roomId: string): string {
  const date = new Date().toISOString().slice(0, 10)
  return `${category}/${roomId}/${date}/${randomUUID()}`
}

function contentDisposition(fileName: string, contentType: string): string {
  const mode = contentType.startsWith('image/') || contentType === 'application/pdf' ? 'inline' : 'attachment'
  const encoded = encodeURIComponent(fileName || 'download').replace(/['()]/g, character => (
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  ))
  return `${mode}; filename*=UTF-8''${encoded}`
}

export async function createPresignedUpload(input: {
  storageKey: string
  contentType: string
}): Promise<{ url: string; expiresIn: number; headers: Record<string, string> }> {
  const expiresIn = 10 * 60
  if (localStorageConfigured()) {
    const expiresAt = Math.floor(Date.now() / 1000) + expiresIn
    return {
      url: localSignedUrl({
        method: 'PUT',
        storageKey: input.storageKey,
        contentType: input.contentType,
        expiresAt,
      }),
      expiresIn,
      headers: { 'Content-Type': input.contentType },
    }
  }
  const command = new PutObjectCommand({
    Bucket: bucketName(),
    Key: input.storageKey,
    ContentType: input.contentType,
  })
  const url = await getSignedUrl(storageClient(), command, { expiresIn })
  return {
    url,
    expiresIn,
    headers: { 'Content-Type': input.contentType },
  }
}

export async function createPresignedDownload(input: {
  storageKey: string
  fileName: string
  contentType: string
}): Promise<{ url: string; expiresIn: number }> {
  const expiresIn = 5 * 60
  if (localStorageConfigured()) {
    const expiresAt = Math.floor(Date.now() / 1000) + expiresIn
    return {
      url: localSignedUrl({
        method: 'GET',
        storageKey: input.storageKey,
        contentType: input.contentType,
        fileName: input.fileName,
        expiresAt,
      }),
      expiresIn,
    }
  }
  const command = new GetObjectCommand({
    Bucket: bucketName(),
    Key: input.storageKey,
    ResponseContentType: input.contentType,
    ResponseContentDisposition: contentDisposition(input.fileName, input.contentType),
  })
  return {
    url: await getSignedUrl(storageClient(), command, { expiresIn }),
    expiresIn,
  }
}

export async function putStoredObject(input: {
  storageKey: string
  contentType: string
  body: Uint8Array
}): Promise<void> {
  if (localStorageConfigured()) {
    const target = localPath(input.storageKey)
    const temporary = `${target}.${randomUUID()}.tmp`
    await mkdir(dirname(target), { recursive: true })
    await writeFile(temporary, input.body, { mode: 0o600 })
    await rename(temporary, target)
    await writeFile(localMetadataPath(input.storageKey), JSON.stringify({ contentType: input.contentType }), { mode: 0o600 })
    return
  }
  await storageClient().send(new PutObjectCommand({
    Bucket: bucketName(),
    Key: input.storageKey,
    ContentType: input.contentType,
    Body: input.body,
  }))
}

export async function headStoredObject(storageKey: string): Promise<{
  sizeBytes: number
  contentType: string
}> {
  if (localStorageConfigured()) {
    const details = await stat(localPath(storageKey))
    let contentType = 'application/octet-stream'
    try {
      const metadata = JSON.parse(await readFile(localMetadataPath(storageKey), 'utf8')) as { contentType?: unknown }
      contentType = normalizeContentType(metadata.contentType)
    } catch {
      // Older locally stored objects may not have metadata; the database remains authoritative.
    }
    return { sizeBytes: details.size, contentType }
  }
  const result = await storageClient().send(new HeadObjectCommand({
    Bucket: bucketName(),
    Key: storageKey,
  }))
  return {
    sizeBytes: Number(result.ContentLength) || 0,
    contentType: result.ContentType || 'application/octet-stream',
  }
}

export async function probeObjectStorage(): Promise<{
  ok: boolean
  status: 'ok' | 'not_configured' | 'error'
  bucket?: string
  error?: string
}> {
  if (!objectStorageConfigured()) return { ok: false, status: 'not_configured' }
  if (localStorageConfigured()) {
    try {
      await mkdir(localStorageRoot(), { recursive: true })
      await stat(localStorageRoot())
      return { ok: true, status: 'ok', bucket: 'ovh-local' }
    } catch (error) {
      return {
        ok: false,
        status: 'error',
        bucket: 'ovh-local',
        error: error instanceof Error ? error.message : 'Lokaler Dateispeicher nicht erreichbar.',
      }
    }
  }
  try {
    await storageClient().send(new HeadBucketCommand({ Bucket: bucketName() }))
    return { ok: true, status: 'ok', bucket: bucketName() }
  } catch (error) {
    return {
      ok: false,
      status: 'error',
      bucket: bucketName(),
      error: error instanceof Error ? error.message : 'R2 nicht erreichbar.',
    }
  }
}

export async function handleSignedLocalObject(request: Request): Promise<Response> {
  if (!localStorageConfigured()) return new Response('Not found', { status: 404 })
  if (request.method !== 'GET' && request.method !== 'PUT') {
    return new Response('Method not allowed', { status: 405 })
  }
  const signed = validLocalSignature(request, request.method)
  if (!signed) return new Response('Link ungültig oder abgelaufen.', { status: 403 })

  if (request.method === 'PUT') {
    await putStoredObject({
      storageKey: signed.storageKey,
      contentType: signed.contentType,
      body: new Uint8Array(await request.arrayBuffer()),
    })
    return new Response(null, { status: 204 })
  }

  try {
    const body = await readFile(localPath(signed.storageKey))
    return new Response(Uint8Array.from(body).buffer, {
      headers: {
        'Cache-Control': 'private, no-store',
        'Content-Type': signed.contentType,
        'Content-Disposition': contentDisposition(signed.fileName, signed.contentType),
      },
    })
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === 'ENOENT') return new Response('Datei nicht gefunden.', { status: 404 })
    throw error
  }
}
