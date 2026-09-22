import { randomUUID } from 'node:crypto'
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
  return Boolean(endpoint() && env('R2_ACCESS_KEY_ID') && env('R2_SECRET_ACCESS_KEY') && bucketName())
}

function storageClient(): S3Client {
  if (!objectStorageConfigured()) throw new Error('Cloudflare R2 ist nicht konfiguriert.')
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
