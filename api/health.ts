import { syncJson } from '../server/sync-core'
import { syncStorageMode } from '../server/sync-store'

export const config = {
  maxDuration: 10,
}

async function handle(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') return syncJson({ ok: true })
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return syncJson({ error: 'Methode nicht erlaubt.' }, 405)
  }
  return syncJson({
    ok: true,
    service: 'life-os',
    storage: syncStorageMode(),
    time: new Date().toISOString(),
  })
}

export default { fetch: handle }
