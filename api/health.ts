import { syncJson } from '../server/sync-core'
import { probeSyncStorage } from '../server/sync-store'

export const config = {
  maxDuration: 10,
}

async function handle(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') return syncJson({ ok: true })
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return syncJson({ error: 'Methode nicht erlaubt.' }, 405)
  }
  const probe = await probeSyncStorage()
  return syncJson({
    service: 'life-os',
    ...probe,
  }, probe.ok ? 200 : 503)
}

export default { fetch: handle }
