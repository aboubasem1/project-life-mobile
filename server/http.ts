import { randomUUID } from 'node:crypto'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { Readable } from 'node:stream'
import { closeDatabase, ensureDatabaseSchema } from './database.js'
import { shouldStreamRequest } from './http-policy.js'
import { buildFetchHeaders } from './request-headers.js'
import { startReelWorker, stopReelWorker } from './reel-jobs.js'
import { handleSyncRequest } from './sync-router.js'
import developerChange from '../api/developer/change.js'
import developerDiscard from '../api/developer/discard.js'
import developerPublish from '../api/developer/publish.js'
import developerSession from '../api/developer/session.js'

const port = Number(process.env.PORT) || 3000
const host = process.env.HOST?.trim() || '0.0.0.0'
const maxBodyBytes = Number(process.env.MAX_REQUEST_BODY_BYTES) || 8 * 1024 * 1024

function requestOrigin(request: IncomingMessage): string {
  const forwardedProto = request.headers['x-forwarded-proto']
  const protocol = (Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto) || 'http'
  const forwardedHost = request.headers['x-forwarded-host']
  const hostname = (Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost)
    || request.headers.host
    || '127.0.0.1'
  return `${protocol}://${hostname}`
}

async function readBody(request: IncomingMessage): Promise<Buffer | undefined> {
  if (request.method === 'GET' || request.method === 'HEAD') return undefined
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > maxBodyBytes) throw new Error('Request body too large')
    chunks.push(buffer)
  }
  return Buffer.concat(chunks)
}

async function toFetchRequest(request: IncomingMessage): Promise<Request> {
  const url = new URL(request.url || '/', requestOrigin(request))
  const headers = buildFetchHeaders(request.headers)
  const isMediaUpload = shouldStreamRequest(request.method, url.pathname)
  if (isMediaUpload) {
    return new Request(url, {
      method: 'PUT',
      headers,
      body: Readable.toWeb(request) as ReadableStream<Uint8Array>,
      duplex: 'half',
    } as RequestInit & { duplex: 'half' })
  }
  const body = await readBody(request)
  const bodyInit = body ? Uint8Array.from(body).buffer : undefined
  return new Request(url, {
    method: request.method || 'GET',
    headers,
    body: bodyInit,
  })
}

async function route(request: Request): Promise<Response> {
  const pathname = new URL(request.url).pathname.replace(/\/$/, '')
  if (pathname === '/api/developer/session') return developerSession(request)
  if (pathname === '/api/developer/change') return developerChange(request)
  if (pathname === '/api/developer/publish') return developerPublish(request)
  if (pathname === '/api/developer/discard') return developerDiscard(request)
  return handleSyncRequest(request)
}

async function writeResponse(response: Response, target: ServerResponse, method: string): Promise<void> {
  target.statusCode = response.status
  const responseHeaders = response.headers as Headers & { getSetCookie?: () => string[] }
  for (const [name, value] of responseHeaders.entries()) {
    if (name.toLowerCase() !== 'set-cookie') target.setHeader(name, value)
  }
  const cookies = responseHeaders.getSetCookie?.() ?? []
  if (cookies.length > 0) target.setHeader('Set-Cookie', cookies)
  if (method === 'HEAD') {
    target.end()
    return
  }
  target.end(Buffer.from(await response.arrayBuffer()))
}

function withErrorRef(response: Response, errorRef: string): Response {
  if (response.headers.has('x-life-os-error-ref')) return response
  const headers = new Headers(response.headers)
  headers.set('X-Life-Os-Error-Ref', errorRef)
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

const server = createServer((incoming, outgoing) => {
  const errorRef = randomUUID().slice(0, 8)
  void (async () => {
    const request = await toFetchRequest(incoming)
    const response = withErrorRef(await route(request), errorRef)
    await writeResponse(response, outgoing, incoming.method || 'GET')
  })().catch(error => {
    const bodyTooLarge = error instanceof Error && error.message === 'Request body too large'
    console.error(JSON.stringify({
      scope: 'http',
      event: 'request_failed',
      errorRef,
      method: incoming.method,
      url: incoming.url,
      message: error instanceof Error ? error.message : 'unknown',
      // Never log header values — they may contain bearer tokens.
      headerNames: Object.keys(incoming.headers),
    }))
    if (!bodyTooLarge) console.error(error)
    if (outgoing.headersSent) {
      outgoing.destroy(error instanceof Error ? error : undefined)
      return
    }
    outgoing.statusCode = bodyTooLarge ? 413 : 500
    outgoing.setHeader('Content-Type', 'application/json; charset=utf-8')
    outgoing.setHeader('Cache-Control', 'no-store')
    outgoing.setHeader('X-Life-Os-Error-Ref', errorRef)
    outgoing.end(JSON.stringify({
      error: bodyTooLarge ? 'Anfrage ist zu groß.' : 'Interner Serverfehler.',
      errorRef,
      stage: 'http',
    }))
  })
})

async function shutdown(signal: string): Promise<void> {
  console.info(`LifeOS API received ${signal}; shutting down.`)
  stopReelWorker()
  server.close()
  await closeDatabase().catch(() => undefined)
  process.exit(0)
}

process.on('SIGTERM', () => void shutdown('SIGTERM'))
process.on('SIGINT', () => void shutdown('SIGINT'))

await ensureDatabaseSchema()
startReelWorker()
server.listen(port, host, () => {
  console.info(`LifeOS API listening on ${host}:${port}`)
})
