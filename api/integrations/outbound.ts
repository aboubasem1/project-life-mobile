import { dispatchOutboundWebhook } from '../../server/lifeos-webhook-core.js'
import { readSyncJson, syncError, syncJson } from '../../server/sync-core.js'

export const config = {
  maxDuration: 15,
}

function bearerToken(request: Request): string {
  const header = request.headers.get('authorization') ?? ''
  return header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : ''
}

async function handle(request: Request): Promise<Response> {
  try {
    if (request.method === 'OPTIONS') return syncJson({ ok: true })
    if (request.method !== 'POST') return syncJson({ error: 'Methode nicht erlaubt.' }, 405)
    const body = await readSyncJson<{
      roomId?: unknown
      deviceToken?: unknown
      url?: unknown
      event?: unknown
      payload?: Record<string, string>
    }>(request)
    const result = await dispatchOutboundWebhook({
      roomId: String(body.roomId ?? request.headers.get('x-life-os-room') ?? ''),
      deviceToken: bearerToken(request) || String(body.deviceToken ?? ''),
      url: String(body.url ?? ''),
      event: String(body.event ?? ''),
      payload: body.payload ?? {},
    })
    return syncJson(result)
  } catch (error) {
    return syncError(error)
  }
}

export default { fetch: handle }
