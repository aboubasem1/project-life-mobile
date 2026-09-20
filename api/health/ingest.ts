import { applyHealthIngest } from '../../server/health-ingest-core'
import { readSyncJson, syncError, syncJson } from '../../server/sync-core'

export const config = {
  maxDuration: 15,
}

async function handle(request: Request): Promise<Response> {
  try {
    if (request.method === 'OPTIONS') return syncJson({ ok: true })
    if (request.method !== 'POST') return syncJson({ error: 'Methode nicht erlaubt.' }, 405)
    const body = await readSyncJson<unknown>(request)
    const result = await applyHealthIngest(request, body)
    return syncJson({ ok: true, ...result })
  } catch (error) {
    return syncError(error)
  }
}

export default { fetch: handle }
