import { applyInboundConnectorWebhook } from '../../server/lifeos-webhook-core.js'
import { readSyncJson, syncError, syncJson } from '../../server/sync-core.js'

export const config = {
  maxDuration: 15,
}

function connectorFrom(request: Request): string {
  const url = new URL(request.url)
  const query = url.searchParams.get('connector')?.trim()
  if (query) return query
  const parts = url.pathname.split('/').filter(Boolean)
  const last = parts[parts.length - 1] ?? ''
  if (last && last !== 'webhook' && last !== 'webhooks') return decodeURIComponent(last)
  return ''
}

async function handle(request: Request): Promise<Response> {
  try {
    if (request.method === 'OPTIONS') return syncJson({ ok: true })
    if (request.method !== 'POST') return syncJson({ error: 'Methode nicht erlaubt.' }, 405)
    const body = await readSyncJson<unknown>(request)
    const result = await applyInboundConnectorWebhook({
      connector: connectorFrom(request),
      request,
      body,
    })
    return syncJson(result)
  } catch (error) {
    return syncError(error)
  }
}

export default { fetch: handle }
