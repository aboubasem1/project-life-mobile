import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { closeDatabase, ensureDatabaseSchema } from './database.js'
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

function requestHeaders(request: IncomingMessage): Headers {
  const headers = new Headers()
  for (const [name, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) {
      for (const item of value) headers.append(name, item)
    } else if (value != null) {
      headers.set(name, value)
    }
  }
  return headers
}

async function toFetchRequest(request: IncomingMessage): Promise<Request> {
  const body = await readBody(request)
  const bodyInit = body ? Uint8Array.from(body).buffer : undefined
  return new Request(new URL(request.url || '/', requestOrigin(request)), {
    method: request.method || 'GET',
    headers: requestHeaders(request),
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

const server = createServer((incoming, outgoing) => {
  void (async () => {
    const request = await toFetchRequest(incoming)
    const response = await route(request)
    await writeResponse(response, outgoing, incoming.method || 'GET')
  })().catch(error => {
    const bodyTooLarge = error instanceof Error && error.message === 'Request body too large'
    outgoing.statusCode = bodyTooLarge ? 413 : 500
    outgoing.setHeader('Content-Type', 'application/json; charset=utf-8')
    outgoing.setHeader('Cache-Control', 'no-store')
    outgoing.end(JSON.stringify({ error: bodyTooLarge ? 'Anfrage ist zu groß.' : 'Interner Serverfehler.' }))
  })
})

async function shutdown(signal: string): Promise<void> {
  console.info(`LifeOS API received ${signal}; shutting down.`)
  server.close()
  await closeDatabase().catch(() => undefined)
  process.exit(0)
}

process.on('SIGTERM', () => void shutdown('SIGTERM'))
process.on('SIGINT', () => void shutdown('SIGINT'))

await ensureDatabaseSchema()
server.listen(port, host, () => {
  console.info(`LifeOS API listening on ${host}:${port}`)
})
