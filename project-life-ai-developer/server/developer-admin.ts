import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'

export const GITHUB_OWNER = 'aboubasem1'
export const GITHUB_REPO = 'project-life-mobile'
export const PRODUCTION_BRANCH = 'main'
export const WORKFLOW_FILE = 'ai-change.yml'
export const GITHUB_API_VERSION = '2026-03-10'

const COOKIE_NAME = 'pl_dev_session'
const SESSION_SECONDS = 12 * 60 * 60

type JsonRecord = Record<string, unknown>

export class HttpError extends Error {
  status: number
  details?: unknown

  constructor(status: number, message: string, details?: unknown) {
    super(message)
    this.name = 'HttpError'
    this.status = status
    this.details = details
  }
}

export function json(data: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...headers,
    },
  })
}

export function errorResponse(error: unknown): Response {
  if (error instanceof HttpError) {
    return json(
      {
        error: error.message,
        details: error.details,
      },
      error.status,
    )
  }

  console.error(error)
  return json({ error: 'Interner Serverfehler.' }, 500)
}

export async function readJson<T extends JsonRecord>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T
  } catch {
    throw new HttpError(400, 'Ungültige JSON-Anfrage.')
  }
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new HttpError(500, `${name} ist nicht konfiguriert.`)
  }
  return value
}

function toBase64Url(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url')
}

function fromBase64Url(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8')
}

function sign(payload: string): string {
  return createHmac('sha256', requireEnv('DEV_ADMIN_SECRET'))
    .update(payload)
    .digest('base64url')
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)

  if (leftBuffer.length !== rightBuffer.length) {
    return false
  }

  return timingSafeEqual(leftBuffer, rightBuffer)
}

export function verifyAdminPassword(password: string): boolean {
  const expected = requireEnv('DEV_ADMIN_SECRET')
  return safeEqual(password, expected)
}

export function createSessionCookie(): string {
  const payload = toBase64Url(
    JSON.stringify({
      exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS,
      nonce: randomUUID(),
    }),
  )
  const token = `${payload}.${sign(payload)}`

  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_SECONDS}`
}

export function clearSessionCookie(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`
}

function getCookie(request: Request, name: string): string | null {
  const cookieHeader = request.headers.get('cookie') ?? ''
  for (const part of cookieHeader.split(';')) {
    const [rawKey, ...rawValue] = part.trim().split('=')
    if (rawKey === name) {
      return rawValue.join('=') || null
    }
  }
  return null
}

export function isAdmin(request: Request): boolean {
  const token = getCookie(request, COOKIE_NAME)
  if (!token) return false

  const [payload, signature] = token.split('.')
  if (!payload || !signature || !safeEqual(signature, sign(payload))) {
    return false
  }

  try {
    const parsed = JSON.parse(fromBase64Url(payload)) as { exp?: number }
    return typeof parsed.exp === 'number' && parsed.exp > Math.floor(Date.now() / 1000)
  } catch {
    return false
  }
}

export function requireAdmin(request: Request): void {
  if (!isAdmin(request)) {
    throw new HttpError(401, 'Nicht angemeldet.')
  }
}

export function createRequestId(): string {
  return `chg-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`
}

export function validateRequestId(value: string): string {
  if (!/^chg-[a-z0-9-]{8,64}$/.test(value)) {
    throw new HttpError(400, 'Ungültige Änderungs-ID.')
  }
  return value
}

export function branchFor(requestId: string): string {
  return `ai/${validateRequestId(requestId)}`
}

export function cleanText(value: unknown, maxLength: number): string {
  return String(value ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\r\n/g, '\n')
    .trim()
    .slice(0, maxLength)
}

export async function github<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = requireEnv('GITHUB_ADMIN_TOKEN')
  const response = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': GITHUB_API_VERSION,
      'User-Agent': 'project-life-developer-console',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  })

  const text = await response.text()
  let data: unknown = null

  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }
  }

  if (!response.ok) {
    const message =
      typeof data === 'object' && data !== null && 'message' in data
        ? String((data as { message?: unknown }).message)
        : `GitHub-Anfrage fehlgeschlagen (${response.status}).`

    throw new HttpError(response.status, message, data)
  }

  return data as T
}

export async function sleep(milliseconds: number): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, milliseconds))
}
