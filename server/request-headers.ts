import type { IncomingHttpHeaders } from 'node:http'

const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'proxy-connection',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
])

/** Fetch/undici rejects pseudo-headers and any name outside token grammar. */
export function isSafeFetchHeaderName(name: string): boolean {
  if (!name || name.startsWith(':')) return false
  return /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(name)
}

/**
 * Copy Node incoming headers into a Fetch Headers object without throwing.
 * Invalid names (injected by some mobile proxies / HTTP2 leftovers) previously
 * aborted the whole request as an opaque production 500 ("Interner Serverfehler.").
 */
export function buildFetchHeaders(incoming: IncomingHttpHeaders): Headers {
  const headers = new Headers()
  for (const [rawName, value] of Object.entries(incoming)) {
    const name = rawName.toLowerCase()
    if (!isSafeFetchHeaderName(name) || HOP_BY_HOP.has(name)) continue
    if (value == null) continue
    try {
      if (Array.isArray(value)) {
        for (const item of value) {
          if (item == null || item === '') continue
          headers.append(name, item)
        }
      } else if (value !== '') {
        headers.set(name, value)
      }
    } catch {
      // Skip values undici still rejects (e.g. embedded NUL). Never fail the request.
    }
  }
  return headers
}
