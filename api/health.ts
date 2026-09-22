import { syncJson } from '../server/sync-core.js'
import { buildHealthStatus } from '../server/health-status.js'

export const config = {
  maxDuration: 10,
}

async function handle(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') return syncJson({ ok: true })
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return syncJson({ error: 'Methode nicht erlaubt.' }, 405)
  }
  const health = await buildHealthStatus()
  return syncJson(health, health.ok ? 200 : 503)
}

export default { fetch: handle }
